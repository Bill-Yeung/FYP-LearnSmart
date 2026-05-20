import { useMemo, useState, useEffect } from "react"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import AttachmentPreview from "./AttachmentPreview"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { Modal } from "../ui/Modal"
import LaTeXRenderer from "./LaTeXRenderer"

export type ReviewCard = {
  id: string
  front: string
  back: string
  dueLabel?: string
  card_type?: string
  choices?: string[]
  correctAnswer?: string
  mnemonic?: string
  tips?: string
  attachments?: { type: string; url: string }[]
  topic?: string
  tags?: string[]
  concept?: string
  subject?: string
  interval_days?: number
  reps?: number
  ease_factor?: number
  stability?: number
  difficulty?: number
}

type Props = {
  cards: ReviewCard[]
  onToast: (msg: string) => void
  algorithm: "sm2" | "leitner" | "simple" | "fsrs"
  startSignal?: number
}

function getAccessToken(): string {
  try {
    const raw = localStorage.getItem('learnsmart-tokens')
    if (!raw) return ''
    return JSON.parse(raw).access_token || ''
  } catch {
    return ''
  }
}

export default function ReviewCardsSection({ cards, onToast, algorithm, startSignal }: Props) {

  const [queue, setQueue] = useState<ReviewCard[]>([])
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showIntro, setShowIntro] = useState(true)
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false)
  const [activeAttachment, setActiveAttachment] = useState<{ type: string; url: string } | null>(null)
  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewIsPdf, setPreviewIsPdf] = useState(false)

  const [selectedMcqChoice, setSelectedMcqChoice] = useState<string | null>(null)

  const [meta, setMeta] = useState<Record<string, any>>({})
  const [recommendedFeedback, setRecommendedFeedback] = useState<string | null>(null)
  const [lastCard, setLastCard] = useState<ReviewCard | null>(null)
  const [lastOutcome, setLastOutcome] = useState<string | null>(null)

  const feedbackOptions = [
    { key: 'again', label: 'Again', color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', short: 'Again' },
    { key: 'hard', label: 'Hard', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', short: 'Hard' },
    { key: 'good', label: 'Good', color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', short: 'Good' },
    { key: 'easy', label: 'Easy', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', short: 'Easy' }
  ]

  function getPriorityLabel(weight: number) {
    if (weight >= 100) return { text: 'Overdue', color: 'bg-red-100 text-red-800' }
    if (weight >= 70) return { text: 'Due', color: 'bg-amber-100 text-amber-800' }
    if (weight >= 50) return { text: 'New', color: 'bg-blue-100 text-blue-800' }
    return { text: 'Low', color: 'bg-gray-100 text-gray-800' }
  }

  function computeCardWeight(card?: ReviewCard) {
    if (!card) return 0
    const d = (card.dueLabel || '').toLowerCase()
    if (d.includes('overdue')) return 120
    if (d.includes('due') || d.includes('today')) return 80
    if (d.includes('new')) return 50
    return 10
  }

  // sort cards so the most-overdue ones show first
  function buildPrioritizedQueue(items: ReviewCard[]) {
    const sorted = [...items].sort((a, b) => {
      const wDiff = computeCardWeight(b) - computeCardWeight(a)
      if (wDiff !== 0) return wDiff
      const lblA = (a.dueLabel || "").toLowerCase()
      const lblB = (b.dueLabel || "").toLowerCase()
      if (lblA < lblB) return -1
      if (lblA > lblB) return 1
      return a.id.localeCompare(b.id)
    })
    return sorted
  }

  useEffect(() => {
    if (typeof startSignal !== 'number') return
    const prioritized = buildPrioritizedQueue(cards)
    setQueue(prioritized)
    setIndex(0)
    setShowAnswer(false)
    setSelectedMcqChoice(null)
    setShowIntro(false)
    const seeded: Record<string, any> = {}
    for (const c of prioritized) {
      seeded[c.id] = {
        repetitions: c.reps ?? 0,
        ef: c.ease_factor ?? 2.5,
        interval: c.interval_days ?? 0,
        stability: c.stability ?? undefined,
        difficulty: c.difficulty ?? undefined,
        leitner: c.interval_days ? Math.max(1, Math.min(5, Math.round(Math.log2((c.interval_days ?? 1) + 1)))) : 0,
      }
    }
    setMeta(seeded)
    onToast('Starting review (prioritized by schedule)')
    setTimeout(() => {
      const el = document.getElementById('review-cards-section')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }, [startSignal, cards, onToast])

  const total = cards.length
  const dueToday = cards.filter(c => {
    const d = (c.dueLabel || '').toLowerCase()
    return d.includes('due') || d.includes('today')
  }).length
  const overdue = cards.filter(c => (c.dueLabel || '').toLowerCase().includes('overdue')).length
  const newly = cards.filter(c => (c.dueLabel || '').toLowerCase().includes('new')).length

  const current = queue[index]
  const remaining = Math.max(queue.length - index, 0)

  function handleReviewAgain() {
    const source = current ?? lastCard
    if (!source) {
      onToast('No card available to review again')
      return
    }
    const duplicate: ReviewCard = { ...source, id: `${source.id}::repeat::${Date.now()}` }
    setQueue(prev => {
      const arr = [...prev]
      const insertAt = Math.min(index + 1, arr.length)
      arr.splice(insertAt, 0, duplicate)
      return arr
    })
    onToast('Card queued for immediate re-review (local)')
  }

  function handleFlip() {
    if (!current) return
    setShowAnswer(true)
    setRecommendedFeedback(null)
  }

  // user graded the card: compute next due, send to server, move to next card
  async function handleFeedback(feedbackKey: string, interval: string) {
    if (!current) return

    const qualityMap: Record<string, number> = { again: 0, hard: 1, good: 2, easy: 3 }
    const quality = qualityMap[feedbackKey] ?? 2

    const nextDue = computeNextDue(current.id, feedbackKey)

    try {
      await submitReviewFeedback(current.id, quality)
      logActivity("flashcard", "review", current.id, { feedback: feedbackKey, quality })
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save review — please check your connection')
    }
    setQueue(prev => prev.map(c =>
      c.id === current.id ? { ...c, dueLabel: nextDue } : c
    ))

    onToast(`Marked ${feedbackKey.toUpperCase()} → next due ${nextDue} `)
    setLastOutcome(`${current.front} → ${feedbackKey} (${nextDue})`)
    setLastCard(current)
    setShowAnswer(false)
    setRecommendedFeedback(null)
    setSelectedMcqChoice(null)
    setIndex(prev => prev + 1)
  }

  async function submitReviewFeedback(cardId: string, quality: number) {
    const response = await fetch(`/api/flashcards/${cardId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify({ flashcard_id: cardId, quality, algorithm })
    })
    if (!response.ok) {
      console.error('[ReviewCardsSection] Failed to submit review:', response.status, response.statusText)
      throw new Error(`Failed to save review (${response.status})`)
    }
  }

  function determineRecommendation(_card: ReviewCard | undefined, _selected: string) {
    return null
  }

  // run the chosen spaced-repetition algorithm and update meta
  function computeNextDue(cardId: string, feedbackKey: string) {
    const now = new Date()
    const currentMeta = meta[cardId] ?? { repetitions: 0, ef: 2.5, interval: 0, leitner: 1 }

    const qualityMap: Record<string, number> = { again: 0, hard: 1, good: 2, easy: 3 }
    const q = qualityMap[feedbackKey] ?? 2
    const q5 = ([1, 3, 4, 5] as const)[q] ?? 4

    if (algorithm === 'simple') {
      const isNew = !currentMeta.interval
      if (isNew) {
        const firstInterval: Record<string, number> = { again: 1, hard: 3, good: 7, easy: 14 }
        const interval = firstInterval[feedbackKey] ?? 1
        setMeta(prev => ({ ...prev, [cardId]: { ...currentMeta, interval } }))
        return `+${interval}d`
      }
      if (feedbackKey === 'again') {
        setMeta(prev => ({ ...prev, [cardId]: { ...currentMeta, interval: 1 } }))
        return '+1d'
      }
      const nextInterval = Math.max(1, (currentMeta.interval || 1) * 2)
      setMeta(prev => ({ ...prev, [cardId]: { ...currentMeta, interval: nextInterval } }))
      return `+${nextInterval}d`
    }

    if (algorithm === 'leitner') {
      const isNew = !currentMeta.leitner
      let box = Number(currentMeta.leitner ?? 1)
      if (isNew) {
        const firstBox: Record<string, number> = { again: 1, hard: 1, good: 2, easy: 3 }
        box = firstBox[feedbackKey] ?? 1
      } else {
        if (feedbackKey === 'again') box = 1
        else if (feedbackKey === 'hard') box = Math.max(1, box - 1)
        else if (feedbackKey === 'good') box = Math.min(5, box + 1)
        else if (feedbackKey === 'easy') box = Math.min(5, box + 2)
      }

      const boxToDays: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }
      const days = boxToDays[box] ?? 1
      setMeta(prev => ({ ...prev, [cardId]: { ...currentMeta, leitner: box, interval: days } }))
      return `+${days}d`
    }

    if (algorithm === 'fsrs') {
      const w = [0.4072,1.1829,3.1262,15.4722,7.2102,0.5316,1.0651,0.0589,1.5330,0.1544,1.0071,1.9395,0.1100,0.2900,2.2700,0.2500,2.9898,0.5100,0.4340]
      const DECAY = -0.5
      const FACTOR = 0.9 ** (1 / DECAY) - 1
      const isNew = !currentMeta.stability

      if (isNew) {
        const ratingIdx = [0, 1, 2, 3][q5 === 1 ? 0 : q5 === 3 ? 1 : q5 === 4 ? 2 : 3]
        const s = Math.max(0.1, w[ratingIdx])
        const d = Math.min(10, Math.max(1, w[4] - Math.exp(w[5] * ratingIdx) + 1))
        const intervalDays = Math.max(1, Math.round(s))
        setMeta(prev => ({ ...prev, [cardId]: { ...currentMeta, stability: s, difficulty: d, interval: intervalDays } }))
        return `+${intervalDays}d`
      }

      const s = Math.max(0.1, Number(currentMeta.stability))
      const d = Math.min(10, Math.max(1, Number(currentMeta.difficulty ?? 5)))
      const lastInterval = Math.max(1, Number(currentMeta.interval ?? 1))
      const r = (1 + FACTOR * lastInterval / s) ** DECAY

      let newS: number
      if (q5 < 3) {
        newS = Math.max(0.1, w[11] * (d ** -w[12]) * ((s + 1) ** w[13] - 1) * Math.exp(w[14] * (1 - r)))
      } else {
        const hardPenalty = q5 === 3 ? w[15] : 1
        const easyBonus  = q5 === 5 ? w[16] : 1
        newS = s * (Math.exp(w[8]) * (11 - d) * (s ** -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1)
      }

      const deltaD = -w[6] * (q5 === 1 ? 0 : q5 === 3 ? 1 : q5 === 4 ? 2 : 3)
      const newD = Math.min(10, Math.max(1, d + deltaD * (10 - d) / 9))
      const intervalDays = q5 < 3 ? 1 : Math.max(1, Math.round((newS / FACTOR) * (0.9 ** (1 / DECAY) - 1)))
      setMeta(prev => ({ ...prev, [cardId]: { ...currentMeta, stability: newS, difficulty: newD, interval: intervalDays } }))
      return `+${intervalDays}d`
    }

    let repetitions = Number(currentMeta.repetitions ?? 0)
    let ef = Number(currentMeta.ef ?? 2.5)
    let interval = Number(currentMeta.interval ?? 0)

    if (q5 < 3) {
      repetitions = 0
      interval = 1
    } else {
      if (repetitions === 0) {
        interval = 1
        repetitions = 1
      } else if (repetitions === 1) {
        interval = 6
        repetitions = 2
      } else {
        interval = Math.max(1, Math.round(interval * ef))
        repetitions = repetitions + 1
      }

      ef = ef + (0.1 - (5 - q5) * (0.08 + (5 - q5) * 0.02))
      if (ef < 1.3) ef = 1.3
    }

    setMeta(prev => ({ ...prev, [cardId]: { ...currentMeta, repetitions, ef, interval } }))
    return `+${interval}d`
  }

  // same math as computeNextDue but without mutating meta
  function computeProjectedInterval(cardId: string, feedbackKey: string) {
    const currentMeta = meta[cardId] ?? { repetitions: 0, ef: 2.5, interval: 0, leitner: 1 }
    const qualityMap: Record<string, number> = { again: 0, hard: 1, good: 2, easy: 3 }
    const q = qualityMap[feedbackKey] ?? 2
    const q5 = ([1, 3, 4, 5] as const)[q] ?? 4

    if (algorithm === 'simple') {
      const isNew = !currentMeta.interval
      if (isNew) {
        const firstInterval: Record<string, number> = { again: 1, hard: 3, good: 7, easy: 14 }
        return `+${firstInterval[feedbackKey] ?? 1}d`
      }
      if (feedbackKey === 'again') return '+1d'
      const nextInterval = Math.max(1, (currentMeta.interval || 1) * 2)
      return `+${nextInterval}d`
    }

    if (algorithm === 'leitner') {
      const isNew = !currentMeta.leitner
      let box = Number(currentMeta.leitner ?? 1)
      if (isNew) {
        const firstBox: Record<string, number> = { again: 1, hard: 1, good: 2, easy: 3 }
        box = firstBox[feedbackKey] ?? 1
      } else {
        if (feedbackKey === 'again') box = 1
        else if (feedbackKey === 'hard') box = Math.max(1, box - 1)
        else if (feedbackKey === 'good') box = Math.min(5, box + 1)
        else if (feedbackKey === 'easy') box = Math.min(5, box + 2)
      }
      const boxToDays: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }
      return `+${boxToDays[box] ?? 1}d`
    }

    if (algorithm === 'fsrs') {
      const w = [0.4072,1.1829,3.1262,15.4722,7.2102,0.5316,1.0651,0.0589,1.5330,0.1544,1.0071,1.9395,0.1100,0.2900,2.2700,0.2500,2.9898,0.5100,0.4340]
      const DECAY = -0.5
      const FACTOR = 0.9 ** (1 / DECAY) - 1

      const isNew = !currentMeta.stability
      if (isNew) {
        const ratingIdx = [0, 1, 2, 3][q5 === 1 ? 0 : q5 === 3 ? 1 : q5 === 4 ? 2 : 3]
        const s = Math.max(0.1, w[ratingIdx])
        return `+${Math.max(1, Math.round(s))}d`
      }

      if (q5 < 3) return '+1d'

      const s = Math.max(0.1, Number(currentMeta.stability))
      const d = Math.min(10, Math.max(1, Number(currentMeta.difficulty ?? 5)))
      const lastInterval = Math.max(1, Number(currentMeta.interval ?? 1))
      const r = (1 + FACTOR * lastInterval / s) ** DECAY
      const hardPenalty = q5 === 3 ? w[15] : 1
      const easyBonus  = q5 === 5 ? w[16] : 1
      const newS = s * (Math.exp(w[8]) * (11 - d) * (s ** -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1)
      const intervalDays = Math.max(1, Math.round((newS / FACTOR) * (0.9 ** (1 / DECAY) - 1)))
      return `+${intervalDays}d`
    }

    let { repetitions, ef, interval } = currentMeta
    repetitions = repetitions ?? 0
    ef = ef ?? 2.5
    interval = interval ?? 0

    if (repetitions === 0) {
      if (feedbackKey === 'again') return '+1d'
      return '+1d'
    }

    if (q5 < 3) return '+1d'

    let projReps = repetitions
    let projInterval = interval
    let projEf = ef

    if (projReps === 1) {
      projInterval = 6
      projReps = 2
    } else {
      projInterval = Math.round(projInterval * projEf) || 1
      projReps = projReps + 1
    }

    projEf = projEf + (0.1 - (5 - q5) * (0.08 + (5 - q5) * 0.02))
    if (projEf < 1.3) projEf = 1.3

    return `+${projInterval}d`
  }

  if (!current) {

    if (queue.length === 0) return null

    return (
      <div id="review-cards-section" className="w-full">
        <Card title="Review cards" subtitle="Spaced review with recall feedback." className="w-full">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Session complete!</div>
            <div className="text-base text-gray-500 dark:text-gray-400">You've reviewed all {queue.length} cards.</div>
            <Button variant="secondary" onClick={() => { setIndex(queue.length - 1); setShowAnswer(false); setRecommendedFeedback(null); setSelectedMcqChoice(null) }}>
              ← Back to last card
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const progressPct = Math.round(((index) / Math.max(queue.length, 1)) * 100)

  return (
    <>
      <div id="review-cards-section" className="w-full">
        <Card title="Review cards" subtitle="Spaced review with recall feedback." className="w-full">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Algorithm: {algorithm.toUpperCase()}</div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600 dark:text-gray-300">{index + 1}/{queue.length}</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Progress</div>
              </div>
            </div>
            <div className="w-full flex items-center gap-2">
              <div className="flex-1">
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden dark:bg-gray-900">
                  <div className="h-3 bg-blue-500 dark:bg-blue-400 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">{progressPct}%</div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Card {index + 1} of {queue.length}</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-200">{current.dueLabel ?? 'Due'}</span>
                {(() => {
                  const w = computeCardWeight(current)
                  const p = getPriorityLabel(w)
                  return (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.color}`}>{p.text}</span>
                  )
                })()}
              </div>
            </div>

            {/* Tags / Subject / Topic / Concept metadata */}
            {(current.tags?.length || current.subject || current.topic || current.concept) ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {current.subject && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {current.subject}
                  </span>
                )}
                {current.topic && current.topic !== current.subject && (
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {current.topic}
                  </span>
                )}
                {current.concept && current.concept !== current.topic && (
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    {current.concept}
                  </span>
                )}
                {current.tags?.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 md:p-12 text-gray-900 shadow-xl dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
              <div className="text-base sm:text-xl font-semibold">Question</div>
              <div className="mt-3 text-xl sm:text-2xl md:text-4xl leading-relaxed font-medium">
                <LaTeXRenderer content={current.front} />
              </div>

              {/* Memory Aids */}
              {current.attachments && current.attachments.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3 items-center text-sm">
                  {current.attachments.map((a, i) => {
                    const baseUrl: string = (apiClient as any).baseUrl ?? ""
                    const url = typeof a.url === "string" && (a.url.startsWith('/') || a.url.startsWith('/media')) && baseUrl
                      ? `${baseUrl}${a.url}`
                      : (a.url ?? "")
                    const type = a.type || ""
                    const isImage = (typeof type === "string" && type.startsWith("image")) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url || "")
                    const isYouTube = !!(url && /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url))
                    const isVideo = isYouTube || (typeof type === "string" && type.startsWith("video")) || /\.(mp4|webm|ogv|mov|avi|mkv)(\?.*)?$/i.test(url || "")
                    const isAudio = !isVideo && ((typeof type === "string" && type.startsWith("audio")) || /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(url || ""))
                    
                    return (
                      <div key={i} className="flex items-center">
                        {isImage ? (
                          <button type="button" onClick={() => { setActiveAttachment({ type: a.type, url }); setShowAttachmentModal(true) }} className="block">
                            <img src={url} alt={type || `attachment-${i}`} className="h-16 w-16 sm:h-24 sm:w-24 rounded object-cover border border-gray-200 dark:border-gray-700" />
                          </button>
                        ) : isVideo ? (
                          <button
                            type="button"
                            onClick={() => { setActiveAttachment({ type: a.type, url }); setShowAttachmentModal(true) }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                            </svg>
                            Play Video
                          </button>
                        ) : isAudio ? (
                          <button
                            type="button"
                            onClick={() => { setActiveAttachment({ type: a.type, url }); setShowAttachmentModal(true) }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                            </svg>
                            Play Audio
                          </button>
                        ) : (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            {(() => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url.length > 30 ? url.slice(0, 30) + "…" : url } })()}
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {index > 0 && (
                <Button variant="secondary" onClick={() => { setIndex(prev => prev - 1); setShowAnswer(false); setSelectedMcqChoice(null); setRecommendedFeedback(null) }}>
                  ← Previous
                </Button>
              )}
              {!showAnswer && (
                <Button variant="secondary" onClick={handleFlip}>Show answer</Button>
              )}
              {showAnswer && (current.tips || current.mnemonic) && (
                <Button variant="secondary" onClick={() => setShowEnrichmentModal(true)}>
                  Tips & Mnemonic
                </Button>
              )}
            </div>

            {showAnswer && (
              <>

                {/* Answer section */}
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 sm:p-6 md:p-8 text-gray-900 shadow-sm dark:border-green-900/40 dark:bg-green-900/10 dark:text-gray-100">
                  <div className="text-base font-semibold">Answer</div>
                  <div className="mt-2 text-base sm:text-lg leading-relaxed">
                    <LaTeXRenderer content={current.back} />
                  </div>
                </div>
              </>
            )}

            {showAnswer && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full">
                {feedbackOptions.map(opt => {
                  const projected = computeProjectedInterval(current.id, opt.key)
                  const isRecommended = recommendedFeedback === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleFeedback(opt.key, projected)}
                      className={`w-full rounded-lg px-2 py-3 text-sm sm:text-base font-semibold transition flex flex-col items-center gap-1 ${opt.color} hover:opacity-95 ${isRecommended ? 'ring-2 ring-offset-1 ring-yellow-400 dark:ring-yellow-600' : ''}`}
                      aria-pressed={isRecommended}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-xs sm:text-sm font-normal opacity-75 tabular-nums">{projected}</span>
                      {isRecommended && (
                        <span className="mt-0.5 inline-block bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 text-xs font-semibold px-1.5 py-0.5 rounded">
                          ★ Rec
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-3 text-base text-gray-600 dark:text-gray-400">
              {remaining - 1 > 0 ? `${remaining - 1} cards left after this one.` : 'Last card in this mock queue.'}
            </div>
          </div>
        </Card>
      </div>
      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} title="How this works" size="md">
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Click "Show answer" to reveal the correct answer, then mark your recall.</li>
          <li>After revealing, mark your recall: Again/Hard/Good/Easy to schedule the next review (mock intervals).</li>
          <li>Use "Review again now" to immediately re-queue the current card locally (appears in the finished view).</li>
        </ul>
      </Modal>
      <Modal isOpen={showEnrichmentModal} onClose={() => setShowEnrichmentModal(false)} title="Enrichment" size="lg">
        <div className="space-y-4 text-base text-gray-700 dark:text-gray-300">
          {current.tips && (
            <div className="rounded-md bg-blue-50 p-4 text-base text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <div className="font-semibold text-lg">Tips</div>
              <div className="mt-2 text-base leading-relaxed">{current.tips}</div>
            </div>
          )}
          {current.mnemonic && (
            <div className="rounded-md bg-yellow-50 p-4 text-base text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              <div className="font-semibold text-lg">Mnemonic</div>
              <div className="mt-2 text-base leading-relaxed">{current.mnemonic}</div>
            </div>
          )}
        </div>
      </Modal>
      <Modal isOpen={showAttachmentModal} onClose={() => { setShowAttachmentModal(false); setActiveAttachment(null); setPreviewText(null); setPreviewIsPdf(false) }} title="Media" size="full">
        {activeAttachment && (
          <AttachmentPreview url={activeAttachment.url} type={activeAttachment.type} />
        )}
      </Modal>
    </>
  )
}
