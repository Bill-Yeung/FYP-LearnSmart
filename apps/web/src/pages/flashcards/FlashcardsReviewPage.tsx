import { defaultDueCounts } from "../../configs/flashcardsData"
import { Card } from "../../components"
import { Modal } from "../../components/ui/Modal"
import { StatsSummary } from "../../components/flashcards/StatsSummary"
import ReviewCardsSection from "../../components/flashcards/ReviewCardsSection"
import type { ReviewCard } from "../../components/flashcards/ReviewCardsSection"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiClient } from "../../lib/api"

export type FlashcardsReviewPageProps = {
  onToast?: (msg: string) => void
}

export function FlashcardsReviewPage(props: FlashcardsReviewPageProps) {
  const toast = props.onToast ?? (() => {})
  const navigate = useNavigate()
  const [dueCounts, setDueCounts] = useState<{ today: number; overdue: number; new: number }>(defaultDueCounts)
  const [cards, setCards] = useState<ReviewCard[]>([])
  const [allCards, setAllCards] = useState<ReviewCard[] | null>(null)
  const [algorithm, setAlgorithm] = useState<"sm2" | "leitner" | "simple" | "fsrs">("sm2")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showIntroBanner, setShowIntroBanner] = useState(true)
  const [showIntroModal, setShowIntroModal] = useState(false)
  const [startSignal, setStartSignal] = useState(0)
  const [started, setStarted] = useState(false)

  // refetch algorithm when tab regains focus
  useEffect(() => {
    function fetchAlgorithm() {
      apiClient.get<{ algorithm: string }>('/api/flashcards/algorithm')
        .then(data => {
          const a = data?.algorithm
          if (a && ['sm2', 'leitner', 'simple', 'fsrs'].includes(a)) {
            setAlgorithm(a as any)
          }
        })
        .catch(() => { })
    }
    fetchAlgorithm()
    document.addEventListener('visibilitychange', fetchAlgorithm)
    return () => document.removeEventListener('visibilitychange', fetchAlgorithm)
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const stored = (() => { try { return localStorage.getItem("learnsmart-tokens") } catch { return null } })()
    const accessToken = stored ? (() => { try { return (JSON.parse(stored) as any).access_token } catch { return null } })() : null
    const headers: Record<string, string> = {}
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`
    }

    fetch("/api/flashcards/review", { headers })
      .then(async res => {
        if (res.status === 401) {
          navigate('/login')
          return []
        }
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
        return res.json()
      })
      .then((data: any) => {
        if (!mounted) return

        const rows: any[] = Array.isArray(data) ? data : (Array.isArray(data?.cards) ? data.cards : [])
        const mapped: ReviewCard[] = rows.map(d => {
          const normalizedAttachments = d.attachments && Array.isArray(d.attachments)
            ? d.attachments.map((a: any) => ({
                type: a.media_type || a.type,
                url: a.file_url || a.url
              }))
            : undefined

          let mnemonicText: string | undefined = undefined
          if (d.mnemonics && Array.isArray(d.mnemonics) && d.mnemonics.length > 0) {
            const latest = d.mnemonics[d.mnemonics.length - 1]
            mnemonicText = latest.content ?? undefined
          }

          return {
            id: d.id,
            front: d.front ?? d.front_content,
            back: d.back ?? d.back_content,
            choices: Array.isArray(d.choices) ? d.choices : undefined,
            correctAnswer: d.correct_answer ?? undefined,
            dueLabel: d.due_label ?? undefined,
            tips: d.tips ?? undefined,
            mnemonic: mnemonicText,
            attachments: normalizedAttachments,
            topic: d.topic ?? d.content_metadata?.topic ?? undefined,
            tags: Array.isArray(d.tags) ? d.tags : (Array.isArray(d.content_metadata?.tags) ? d.content_metadata.tags : undefined),
            concept: d.concept ?? d.concept_title ?? undefined,
            subject: d.subject ?? d.subject_name ?? undefined,
            interval_days: d.interval_days ?? 0,
            reps: d.reps ?? 0,
            ease_factor: d.ease_factor ?? 2.5,
            stability: d.stability ?? undefined,
            difficulty: d.difficulty ?? undefined,
          }
        })

        let today = 0
        let overdue = 0
        let newly = 0
        mapped.forEach(c => {
          const lbl = (c.dueLabel || "").toLowerCase()
          if (lbl.includes("overdue")) overdue += 1
          if (lbl.includes("due") || lbl.includes("today")) today += 1
          if (lbl.includes("new")) newly += 1
        })

        const dueOnly = mapped.filter(c => {
          const lbl = (c.dueLabel || "").toLowerCase()
          return lbl.includes("due") || lbl.includes("today") || lbl.includes("overdue")
        })

        setAllCards(mapped)
        setCards(dueOnly)
        setDueCounts({ today, overdue, new: newly })
      })
      .catch(err => {
        if (!mounted) return
        setError(String(err))
      })
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <StatsSummary
          dueCounts={dueCounts}
          onPrimary={() => {
            if (cards.length === 0 && allCards && allCards.length > 0) {
              setCards(allCards)
            }
            setStarted(true)
            setStartSignal(s => s + 1)
          }}
          onSecondary={() => navigate('/flashcards/schedule')}
          onSettings={() => navigate('/settings/memorize')}
          primaryLabel={`Start review (${algorithm.toUpperCase()})`}
        />

        {loading ? (
          <Card>
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading cards...</div>
          </Card>
        ) : error ? (
          <Card>
            <div className="text-sm text-red-600">Error loading cards: {error}</div>
          </Card>
        ) : cards.length === 0 ? (
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">All caught up!</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">No cards are due right now.</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { if (cards.length === 0 && allCards && allCards.length > 0) setCards(allCards); setStarted(true); setStartSignal(s => s + 1) }}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  Start anyway
                </button>
                <button
                  onClick={() => { if (allCards) setCards(allCards) }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Show all
                </button>
              </div>
            </div>
          </Card>
        ) : (
          <ReviewCardsSection cards={cards} onToast={toast} algorithm={algorithm} startSignal={startSignal} />
        )}

        {showIntroBanner && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">How it works</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">Click "Show answer" to reveal, then mark your recall. Use "Review again now" to re-queue locally.</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowIntroModal(true)} className="text-xs text-blue-600 hover:underline dark:text-blue-300">Learn more</button>
                <button onClick={() => setShowIntroBanner(false)} className="text-xs text-gray-500 hover:underline dark:text-gray-400">Dismiss</button>
              </div>
            </div>
          </div>
        )}

        <Modal isOpen={showIntroModal} onClose={() => setShowIntroModal(false)} title="How this works" size="md">
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>Click "Show answer" to reveal the correct answer, then mark your recall.</li>
            <li>After revealing, mark your recall: Again/Hard/Good/Easy to schedule the next review (mock intervals).</li>
            <li>Use "Review again now" to immediately re-queue the current card locally.</li>
          </ul>
        </Modal>

        
      </main>
    </div>
  )
}

export default FlashcardsReviewPage
