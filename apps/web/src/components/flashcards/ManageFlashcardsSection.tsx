import { useMemo, useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { TOKEN_STORAGE_KEY } from "../../../../../shared/constants"
import { logActivity } from "../../lib/activityLog"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { Modal } from "../ui/Modal"
import AttachmentPreview from "./AttachmentPreview"
import { MnemonicModal } from "./MnemonicModal"
import { AttachMediaModal } from "./AttachMediaModal"
import { EnrichModal } from "./EnrichModal"
import RichTextEditor from "./RichTextEditor"
import DOMPurify from "dompurify"
import type { ReviewCard } from "./ReviewCardsSection"
import { apiClient } from "../../lib/api"

function resolveMediaUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('/') || url.startsWith('/media')) {
    return `${(apiClient as any).baseUrl}${url}`
  }
  return url
}

const CARD_TAGS = ["b","strong","i","em","u","sup","sub","a","ul","ol","li","span","p","br"]
const CARD_ATTR = ["href","target","rel","style","class"]

// sanitize card html and auto-link bare urls
function sanitizeCard(html: string): string {

  const linked = (html || "").replace(
    /(?<!href=["'])(https?:\/\/[^\s<>"']+)/g,
    (url) => `<a href="${url}">${url}</a>`
  )
  const clean = DOMPurify.sanitize(linked, { ALLOWED_TAGS: CARD_TAGS, ALLOWED_ATTR: CARD_ATTR })

  return clean.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ')
}

type Props = {
  seedCards?: ReviewCard[]
  onToast: (msg: string) => void
}

type EditDraft = { front: string; back: string; tips?: string; mnemonic?: string }

function getYouTubeEmbedUrl(url: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`
  }
  return null
}

const PAGE_SIZE = 50

export function ManageFlashcardsSection({ seedCards, onToast }: Props) {
  const [cards, setCards] = useState<ReviewCard[]>(() => [...(seedCards || [])])
  const [loadingCards, setLoadingCards] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCards, setTotalCards] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filterText, setFilterText] = useState("")
  const [filterTag, setFilterTag] = useState<string>("")

  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string | null }>>([])
  const [availableConcepts, setAvailableConcepts] = useState<Array<{ id: string; title: string }>>([])
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [showTagEditorDropdown, setShowTagEditorDropdown] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft>({ front: "", back: "", tips: "", mnemonic: "" })
  const [isMnemonicOpen, setIsMnemonicOpen] = useState(false)
  const [isAttachOpen, setIsAttachOpen] = useState(false)
  const [isEnrichOpen, setIsEnrichOpen] = useState(false)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [audioPlayerUrl, setAudioPlayerUrl] = useState<string | null>(null)
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState<string | null>(null)
  const [suggestedExplanation, setSuggestedExplanation] = useState<any | null>(null)
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [activeAttachment, setActiveAttachment] = useState<{ url: string; type?: string } | null>(null)
  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [tagEditingId, setTagEditingId] = useState<string | null>(null)
  const [tagSaving, setTagSaving] = useState(false)
  const [existingTopics, setExistingTopics] = useState<string[]>([])
  const [topicEditingId, setTopicEditingId] = useState<string | null>(null)
  const [topicInput, setTopicInput] = useState("")
  const [topicSaving, setTopicSaving] = useState(false)

  // shape a server row into the ReviewCard the ui uses
  function mapCardRow(r: any): ReviewCard {
    let cardType = r.card_type || undefined
    let back = r.back || r.back_content || ""

    let mcqChoices: string[] | undefined
    let mcqCorrectAnswer: string | undefined
    if (cardType === "mcq") {
      mcqChoices = Array.isArray(r.choices) ? r.choices : (r.choices ? String(r.choices).split(/\||;|,/).map((s: string) => s.trim()) : [])
      mcqCorrectAnswer = r.correct_answer || r.correctAnswer || undefined
      if (!back || !(back + "").trim()) {
        back = mcqCorrectAnswer ?? ""
      }
    }

    const attachments = Array.isArray(r.attachments)
      ? r.attachments.map((m: any) => ({ id: m.id, type: m.media_type || m.type, url: m.file_url || m.url }))
      : undefined

    const mnemonic = r.mnemonic || (Array.isArray(r.mnemonics) && r.mnemonics.length ? r.mnemonics[r.mnemonics.length - 1].content : undefined)

    return {
      id: r.id,
      front: r.front || r.front_content,
      back,
      dueLabel: r.due_label || r.dueLabel,
      ...(r.tags ? { tags: r.tags } : {}),
      ...(cardType ? { card_type: cardType } : {}),
      ...(mcqChoices ? { choices: mcqChoices } : {}),
      ...(mcqCorrectAnswer ? { correctAnswer: mcqCorrectAnswer } : {}),
      ...(attachments ? { attachments } : {}),
      ...(r.tips ? { tips: r.tips } : {}),
      ...(mnemonic ? { mnemonic } : {}),
      ...(r.topic ? { topic: r.topic } : {}),
    }
  }

  // fetch a page of review cards, append if paging
  async function fetchReview(pageNum = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoadingCards(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      const tokens = stored ? (() => { try { return JSON.parse(stored as string) } catch { localStorage.removeItem(TOKEN_STORAGE_KEY); return null } })() : null
      if (tokens?.access_token) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`
      }

      const res = await fetch(`/api/flashcards/review?page=${pageNum}&page_size=${PAGE_SIZE}`, {
        headers,
        credentials: 'include',
        method: 'GET'
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }

      const data = await res.json()
      const rows: any[] = Array.isArray(data) ? data : (Array.isArray(data?.cards) ? data.cards : [])
      const total: number = data?.total ?? rows.length

      if (rows.length > 0) {
        logActivity("flashcard", "view", undefined, { count: rows.length })
        const mapped = rows.map(mapCardRow)
        if (append) {
          setCards(prev => [...prev, ...mapped])
        } else {
          setCards(mapped)
        }
        setTotalCards(total)
        setPage(pageNum)
      } else if (!append) {
        setCards([])
        setTotalCards(0)
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error("[ManageFlashcards] Failed to load review cards:", errorMsg, e)
      onToast("Failed to load flashcards: " + errorMsg)
    } finally {
      if (append) setLoadingMore(false)
      else setLoadingCards(false)
    }
  }

  // on mount: pull tags, subjects, topics and concepts in parallel
  useEffect(() => {
    let mounted = true
    fetchReview()
    fetch("/api/tags?page_size=100", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { tags: [] })
      .then((data: { tags?: any[] }) => {
        if (!mounted) return
        setAvailableTags((data?.tags || []).map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? null })))
      })
      .catch(() => {})
    Promise.all([
      fetch("/api/documents/knowledge-base/subjects", { credentials: "include" }).then(r => r.ok ? r.json() : { subjects: [] }).catch(() => ({ subjects: [] })),
      fetch("/api/flashcards/topics", { credentials: "include" }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([kbData, topicData]) => {
      if (!mounted) return
      const kbNames = (kbData?.subjects || []).map((s: any) => s.name).filter(Boolean)
      const topicNames = Array.isArray(topicData) ? topicData.map((t: any) => t.name).filter(Boolean) : []
      setAvailableSubjects(Array.from(new Set([...kbNames, ...topicNames])))
      setExistingTopics(Array.from(new Set([...kbNames, ...topicNames])))
    })
    fetch("/api/documents/knowledge-map/data", { credentials: "include" })
      .then((r) => r.ok ? r.json() : {})
      .then((data: { concepts?: any[] }) => {
        if (!mounted) return
        setAvailableConcepts((data?.concepts || []).map((c: any) => ({ id: c.id || c.concept_id, title: c.title || c.name || "Untitled" })))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const total = useMemo(() => cards.length, [cards])

  const tags = useMemo(() => {
    const s = new Set<string>()
    for (const c of cards) {
      if ((c as any).tags && Array.isArray((c as any).tags)) {
        for (const t of (c as any).tags) s.add(String(t))
      }
    }
    return Array.from(s)
  }, [cards])

  const displayedTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of availableTags) set.add(t.name)
    for (const t of tags) set.add(t)
    return Array.from(set)
  }, [availableTags, tags])

  const filteredCards = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    return cards.filter((c) => {
      if (filterTag && !(c as any).tags) return false
      if (filterTag && Array.isArray((c as any).tags) && !(c as any).tags.includes(filterTag)) return false
      if (!q) return true
      return (c.front || "").toLowerCase().includes(q) || (c.back || "").toLowerCase().includes(q)
    })
  }, [cards, filterText, filterTag])

  // add a tag to a card (server + local state)
  async function addTagToCard(cardId: string, tagName: string) {
    const name = tagName.trim()
    if (!name) return
    setTagSaving(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      const tokens = stored ? (() => { try { return JSON.parse(stored as string) } catch { localStorage.removeItem(TOKEN_STORAGE_KEY); return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const res = await fetch(`/api/flashcards/${cardId}/tags`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ tag_name: name }),
      })
      if (!res.ok) throw new Error("Failed to add tag")
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, tags: [...new Set([...((c as any).tags || []), name])] }
            : c
        )
      )
      setTagEditingId(null)
    } catch (e) {
      onToast((e as any)?.message || "Failed to add tag")
    } finally {
      setTagSaving(false)
    }
  }

  async function removeTagFromCard(cardId: string, tagName: string) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      const tokens = stored ? (() => { try { return JSON.parse(stored as string) } catch { localStorage.removeItem(TOKEN_STORAGE_KEY); return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const res = await fetch(`/api/flashcards/${cardId}/tags/${encodeURIComponent(tagName)}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to remove tag")
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, tags: ((c as any).tags || []).filter((t: string) => t !== tagName) }
            : c
        )
      )
    } catch (e) {
      onToast((e as any)?.message || "Failed to remove tag")
    }
  }

  async function saveTopicForCard(cardId: string, topic: string) {
    const trimmed = topic.trim()
    setTopicSaving(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      const tokens = stored ? (() => { try { return JSON.parse(stored as string) } catch { localStorage.removeItem(TOKEN_STORAGE_KEY); return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const res = await fetch(`/api/flashcards/${cardId}/topic`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ topic: trimmed }),
      })
      if (!res.ok) throw new Error("Failed to update topic")
      setCards((prev) =>
        prev.map((c) => c.id === cardId ? { ...c, topic: trimmed || undefined } : c)
      )
      setTopicEditingId(null)
      setTopicInput("")
      logActivity("flashcard", "modify", cardId, { field: "topic" })
      onToast("Topic updated")
    } catch (e) {
      onToast((e as any)?.message || "Failed to update topic")
    } finally {
      setTopicSaving(false)
    }
  }

  function startEdit(card: ReviewCard) {
    setEditingId(card.id)
    setDraft({ front: card.front, back: card.back, tips: card.tips || "", mnemonic: card.mnemonic || "" })
  }

  // validate + sanitize then commit edits locally
  function saveEdit(id: string) {
    function stripHtml(html: string) {
      if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '')
      const d = document.createElement('div')
      d.innerHTML = html
      return (d.textContent || d.innerText || '').toString()
    }

    function isEmptyHtml(html: string) {
      return !stripHtml(html).trim()
    }

    if (isEmptyHtml(draft.front) || isEmptyHtml(draft.back)) {
      onToast("Question and answer required")
      return
    }
    const cleanDraftFront = sanitizeCard(draft.front || "")
    const cleanDraftBack = sanitizeCard(draft.back || "")

    setCards((prev) => prev.map((c) => (
      c.id === id ? {
        ...c,
        front: cleanDraftFront,
        back: cleanDraftBack,
        ...(draft.tips ? { tips: draft.tips } : {}),
        ...(draft.mnemonic ? { mnemonic: draft.mnemonic } : {})
      } : c
    )))
    setEditingId(null)
    onToast("Card updated (local)")
  }

  async function deleteCard(id: string) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      const tokens = stored ? (() => { try { return JSON.parse(stored as string) } catch { localStorage.removeItem(TOKEN_STORAGE_KEY); return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const res = await fetch(`/api/flashcards/${id}`, { method: "DELETE", headers })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Delete failed" }))
        throw new Error(err.detail)
      }
      setCards((prev) => prev.filter((c) => c.id !== id))
      logActivity("flashcard", "delete", id)
      onToast("Card deleted")
    } catch (e) {
      console.error("Failed to delete card", e)
      onToast((e as any)?.message || "Failed to delete card")
    }
  }

  function openMnemonic(card: ReviewCard) {
    setActiveCardId(card.id)
    setIsMnemonicOpen(true)
  }

  function handleGenerateMnemonic(mnemonic: string) {
    if (!activeCardId) return
    setCards((prev) => prev.map((c) => (c.id === activeCardId ? { ...c, mnemonic } : c)))
    onToast("Mnemonic attached to card (local)")
    setActiveCardId(null)
  }

  function openAttach(card: ReviewCard) {
    setActiveCardId(card.id)
    setIsAttachOpen(true)
  }

  function handleAttach(attachment: any) {
    if (!activeCardId) return

    if (attachment && (attachment.id || attachment.media_id)) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId
            ? { ...c, attachments: [...(c.attachments || []), { id: attachment.id, type: attachment.media_type || (attachment as any).type, url: attachment.file_url || (attachment as any).url }] }
            : c
        )
      )
      onToast("Attachment saved")
      setActiveCardId(null)
      return
    }

    ;(async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
        const tokens = stored ? (() => { try { return JSON.parse(stored as string) } catch { localStorage.removeItem(TOKEN_STORAGE_KEY); return null } })() : null
        if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

        const body = { type: attachment.type, url: attachment.url, position: 'hint', caption: null }
        const res = await fetch(`/api/flashcards/${activeCardId}/attachments`, { method: "POST", headers, body: JSON.stringify(body) })
        if (!res.ok) {
          const txt = await res.text().catch(() => "")
          throw new Error(txt || "Failed to save attachment")
        }
        const data = await res.json()

        setCards((prev) =>
          prev.map((c) =>
            c.id === activeCardId
              ? { ...c, attachments: [...(c.attachments || []), { id: data.id, type: data.media_type, url: data.file_url }] }
              : c
          )
        )
        onToast("Attachment saved")
      } catch (err) {
        console.error("Failed to save attachment", err)
        onToast((err as any)?.message || "Failed to save attachment")
      } finally {
        setActiveCardId(null)
      }
    })()
  }

  function openEnrich(card: ReviewCard) {
    setActiveCardId(card.id)
    setIsEnrichOpen(true)
  }

  // enrichment save: upload attachments, tips, mnemonic in sequence
  async function handleEnrichSave(data: { tips?: string; mnemonic?: string; attachments?: any[] }) {
    if (!activeCardId) return

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    const tokens = stored ? (() => { try { return JSON.parse(stored as string) } catch { localStorage.removeItem(TOKEN_STORAGE_KEY); return null } })() : null
    if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

    const savedAttachments: Array<any> = []
    if (data.attachments && data.attachments.length) {
      for (const a of data.attachments) {
        if (a && (a.id || a.media_id || (typeof a.url === 'string' && a.url.startsWith('/media/')))) {
          savedAttachments.push({ id: a.id || a.media_id || null, type: a.type, url: a.file_url || a.url })
          continue
        }
        try {
          const body = { type: a.type, url: a.url, position: 'hint', caption: null }
          const res = await fetch(`/api/flashcards/${activeCardId}/attachments`, { method: 'POST', headers, body: JSON.stringify(body) })
          if (res.ok) {
            const d = await res.json()
            savedAttachments.push({ id: d.id, type: d.media_type, url: d.file_url })
          } else {
            savedAttachments.push(a)
          }
        } catch (err) {
          console.error('Failed to save attachment', err)
          savedAttachments.push(a)
        }
      }
    }

    if (data.tips) {
      try {
        const res = await fetch(`/api/flashcards/${activeCardId}/tips`, { method: 'PUT', headers, body: JSON.stringify({ tips: data.tips }) })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          console.error('Failed to save tips', res.status, txt)
          onToast(`Failed to save tips: ${res.status}`)
        } else {
          logActivity("flashcard", "modify", activeCardId ?? undefined, { field: "tips" })
        }
      } catch (err) {
        console.error('Failed to save tips', err)
        onToast('Failed to save tips')
      }
    }

    if (data.mnemonic) {
      try {
        const res = await fetch(`/api/flashcards/${activeCardId}/mnemonics`, { method: 'POST', headers, body: JSON.stringify({ mnemonic_type: 'user', content: data.mnemonic }) })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          let detail = txt
          try {
            const json = JSON.parse(txt || '{}')
            detail = json.detail || JSON.stringify(json)
          } catch {}
          console.error('Failed to save mnemonic', res.status, detail)
          onToast(`Failed to save mnemonic: ${res.status} ${detail}`)
        }
      } catch (err) {
        console.error('Failed to save mnemonic', err)
        onToast('Failed to save mnemonic')
      }
    }

    setCards((prev) =>
      prev.map((c) =>
        c.id === activeCardId
          ? { ...c, tips: data.tips, mnemonic: data.mnemonic, attachments: savedAttachments.length ? savedAttachments : data.attachments }
          : c
      )
    )

    onToast('Enrichment saved')
    setActiveCardId(null)
  }

  const navigate = useNavigate()

  // fetch a friendly title for the video being previewed
  useEffect(() => {
    if (!videoPlayerUrl) {
      setVideoTitle(null)
      return
    }
    const embedUrl = getYouTubeEmbedUrl(videoPlayerUrl)
    if (embedUrl) {
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoPlayerUrl)}&format=json`)
        .then((r) => r.json())
        .then((d) => setVideoTitle(d.title || null))
        .catch(() => setVideoTitle(null))
    } else {
      try {
        const pathname = new URL(videoPlayerUrl).pathname
        const filename = pathname.split("/").pop()
        setVideoTitle(filename ? decodeURIComponent(filename) : null)
      } catch {
        setVideoTitle(null)
      }
    }
  }, [videoPlayerUrl])

  return (
    <Card title="Manage flashcards" subtitle="Manage and inspect your saved flashcards.">
      <div className="grid gap-4">
        <div className="space-y-3 min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search front/back"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:flex-1"
            />
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value as any)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:w-auto"
            >
              <option value="">All tags</option>
              {displayedTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => fetchReview()}>
                Refresh
              </Button>
              <Button variant="ghost" onClick={() => setExpandedMap({})}>
                Collapse all
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const m: Record<string, boolean> = {}
                  filteredCards.forEach((c) => (m[c.id] = true))
                  setExpandedMap(m)
                }}
              >
                Expand all
              </Button>
            </div>
          </div>

          {loadingCards ? (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400">Loading cards...</div>
          ) : (
            <>
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  {editingId === card.id ? (
                    <div className="space-y-2">
                      <div>
                        <RichTextEditor
                          value={draft.front}
                          onChange={(v) => setDraft((d) => ({ ...d, front: v }))}
                          placeholder="Question — e.g., What is the capital of France?"
                          dataTestId={`editor-front-edit-${card.id}`}
                          minHeight="400px"
                        />
                      </div>
                      <div>
                        <RichTextEditor
                          value={draft.back}
                          onChange={(v) => setDraft((d) => ({ ...d, back: v }))}
                          placeholder="Answer — e.g., Paris"
                          dataTestId={`editor-back-edit-${card.id}`}
                          minHeight="400px"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Tips (optional)</label>
                        <textarea
                          value={draft.tips || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, tips: e.target.value }))}
                          placeholder="Add helpful tips for remembering this card..."
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 font-sans"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Mnemonic (optional)</label>
                        <textarea
                          value={draft.mnemonic || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, mnemonic: e.target.value }))}
                          placeholder="Create a memory aid to help recall this information..."
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 font-sans"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => saveEdit(card.id)}>
                          Save
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    (expandedMap[card.id] ?? false) ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeCard(card.front || "") }} />
                          </div>
                          {(card as any).card_type === "mcq" && (
                            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              MCQ
                            </span>
                          )}
                        </div>
                        {/* Tag editor */}
                        <div className="mt-1">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {((card as any).tags || []).map((t: string, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                #{t}
                                <button
                                  type="button"
                                  onClick={() => removeTagFromCard(card.id, t)}
                                  className="ml-0.5 hover:text-red-500"
                                  title="Remove tag"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            {tagEditingId === card.id ? (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setShowTagEditorDropdown(showTagEditorDropdown === card.id ? null : card.id)}
                                  className="rounded border border-indigo-300 px-2 py-0.5 text-xs text-indigo-600 dark:border-indigo-700"
                                >
                                  {showTagEditorDropdown === card.id ? "▲ Close" : "▼ Select tag"}
                                </button>
                                {showTagEditorDropdown === card.id && (
                                  <div className="absolute left-0 top-6 z-20 w-48 rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 max-h-48 overflow-y-auto">
                                    {availableTags.map((t) => (
                                      <button
                                        key={t.id}
                                        type="button"
                                        disabled={tagSaving || ((card as any).tags || []).includes(t.name)}
                                        onClick={() => { addTagToCard(card.id, t.name); setShowTagEditorDropdown(null) }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-gray-800"
                                      >
                                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color ?? "#6b7280" }} />
                                        {t.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => { setTagEditingId(null); setShowTagEditorDropdown(null) }}
                                  className="ml-1 text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setTagEditingId(card.id)}
                                className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-indigo-400 hover:text-indigo-500 dark:border-gray-700"
                              >
                                + tag
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Topic editor */}
                        <div className="mt-1 flex items-center gap-2">
                          {topicEditingId === card.id ? (
                            <span className="inline-flex items-center gap-1 flex-wrap">
                              <select
                                autoFocus
                                value={availableConcepts.some(c => c.title === topicInput) ? topicInput : topicInput ? "__custom__" : ""}
                                onChange={(e) => {
                                  if (e.target.value === "__custom__") return
                                  setTopicInput(e.target.value)
                                }}
                                className="rounded border border-indigo-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-indigo-700 dark:bg-gray-900"
                              >
                                <option value="">— No topic —</option>
                                {availableConcepts.map((c) => (
                                  <option key={c.id} value={c.title}>{c.title}</option>
                                ))}
                                <option value="__custom__">+ Enter new topic…</option>
                              </select>
                              {(!availableConcepts.some(c => c.title === topicInput) && topicInput !== "") || topicInput === "__custom__" ? (
                                <input
                                  value={topicInput === "__custom__" ? "" : topicInput}
                                  onChange={(e) => setTopicInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveTopicForCard(card.id, topicInput); if (e.key === "Escape") { setTopicEditingId(null); setTopicInput("") } }}
                                  placeholder="e.g. Physics"
                                  className="rounded border border-indigo-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-indigo-700 dark:bg-gray-900"
                                />
                              ) : null}
                              <button type="button" disabled={topicSaving} onClick={() => saveTopicForCard(card.id, topicInput)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Save</button>
                              <button type="button" onClick={() => { setTopicEditingId(null); setTopicInput("") }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
                            </span>
                          ) : (card as any).topic ? (
                            <button
                              type="button"
                              onClick={() => { setTopicEditingId(card.id); setTopicInput((card as any).topic || "") }}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                              title="Click to edit topic"
                            >
                              {(card as any).topic} ✎
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setTopicEditingId(card.id); setTopicInput("") }}
                              className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-emerald-400 hover:text-emerald-500 dark:border-gray-700"
                            >
                              + topic
                            </button>
                          )}
                        </div>
                                          <div className="text-sm text-gray-700 dark:text-gray-300">
                                            <div
                                              dangerouslySetInnerHTML={{ __html: sanitizeCard(card.back || "") }}
                                            />
                                          </div>
                        {card.choices && Array.isArray(card.choices) && card.choices.length > 0 && (
                          <div className="mt-1 space-y-1">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Choices:</div>
                            <ul className="space-y-0.5 text-xs">
                              {card.choices.map((ch: string, idx: number) => (
                                <li
                                  key={idx}
                                  className={`rounded px-2 py-1 ${
                                    ch === card.correctAnswer
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  }`}
                                >
                                  {ch === card.correctAnswer && "✓ "}
                                  {ch}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {typeof (card as any).tips === 'string' && (card as any).tips.trim() && (
                          <div className="mt-2 rounded-md bg-blue-50 p-2 text-sm text-blue-800 dark:bg-blue-900/10 dark:text-blue-200">
                            <span className="font-semibold">Tips:</span> {(card as any).tips}
                          </div>
                        )}
                        {card.mnemonic && (
                          <div className="mt-2 rounded-md bg-yellow-50 p-2 text-sm text-yellow-800 dark:bg-yellow-900/10 dark:text-yellow-200">
                            <span className="font-semibold">Mnemonic:</span> {card.mnemonic}
                          </div>
                        )}
                        {card.attachments && card.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2 items-center text-xs">
                            {card.attachments.map((a, i) => {
                              const url = (a as any).url || ""
                              const type = (a as any).type || ""
                              const isImage = (typeof type === "string" && type.startsWith("image")) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)
                              const isYouTube = !!getYouTubeEmbedUrl(url)
                              const isVideo = isYouTube || (typeof type === "string" && type.startsWith("video")) || /\.(mp4|webm|ogv|mov|avi|mkv)(\?.*)?$/i.test(url)
                              const isAudio = !isVideo && ((typeof type === "string" && type.startsWith("audio")) || /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(url))
                              return (
                                <div key={i} className="flex items-center">
                                  {isImage ? (
                                    <button type="button" onClick={() => setPreviewImageUrl(resolveMediaUrl(url))} className="block">
                                      <img src={resolveMediaUrl(url)} alt={type || `attachment-${i}`} className="h-16 w-16 rounded object-cover border border-gray-200 dark:border-gray-700" />
                                    </button>
                                  ) : isVideo ? (
                                    <button
                                      type="button"
                                      onClick={() => setVideoPlayerUrl(url)}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                      </svg>
                                      Play Video
                                    </button>
                                  ) : isAudio ? (
                                    <button
                                      type="button"
                                      onClick={() => setAudioPlayerUrl(url)}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
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
                                      className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                        <div className="flex gap-2 text-xs">
                          <Button variant="secondary" onClick={() => startEdit(card)}>
                            Edit
                          </Button>
                          <Button variant="ghost" onClick={() => deleteCard(card.id)}>
                            Delete
                          </Button>
                          <Button variant="secondary" onClick={() => openEnrich(card)}>
                            Enrich
                          </Button>
                          
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" dangerouslySetInnerHTML={{ __html: sanitizeCard(card.front || "") }} />
                          {(card as any).topic ? (
                            <button
                              type="button"
                              onClick={() => { setTopicEditingId(card.id); setTopicInput((card as any).topic || ""); setExpandedMap((m) => ({ ...m, [card.id]: true })) }}
                              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                              title="Click to edit topic"
                            >
                              {(card as any).topic}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setTopicEditingId(card.id); setTopicInput(""); setExpandedMap((m) => ({ ...m, [card.id]: true })) }}
                              className="shrink-0 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-emerald-400 hover:text-emerald-500 dark:border-gray-700"
                            >
                              + topic
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="ghost" onClick={() => setExpandedMap((m) => ({ ...m, [card.id]: true }))}>
                            Open
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ))}
            </>
          )}

          {cards.length === 0 && !loadingCards && (
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              No cards yet. Create or import to begin.
            </div>
          )}

          {cards.length < totalCards && (
            <div className="pt-2 flex justify-center">
              <Button
                variant="secondary"
                disabled={loadingMore}
                onClick={() => fetchReview(page + 1, true)}
              >
                {loadingMore ? "Loading…" : `Load more (${cards.length} / ${totalCards})`}
              </Button>
            </div>
          )}
        </div>

      </div>

      <MnemonicModal
        isOpen={isMnemonicOpen}
        onClose={() => {
          setIsMnemonicOpen(false)
          setActiveCardId(null)
        }}
        onGenerate={handleGenerateMnemonic}
        cardFront={cards.find((c) => c.id === activeCardId)?.front}
      />

      <AttachMediaModal
        isOpen={isAttachOpen}
        onClose={() => {
          setIsAttachOpen(false)
          setActiveCardId(null)
        }}
        onAttach={handleAttach}
        flashcardId={activeCardId ?? undefined}
      />

      <EnrichModal
        isOpen={isEnrichOpen}
        onClose={() => {
          setIsEnrichOpen(false)
          setActiveCardId(null)
        }}
        cardFront={cards.find((c) => c.id === activeCardId)?.front}
        initialData={(() => {
          const card = cards.find((c) => c.id === activeCardId)
          if (!card) return undefined
          return {
            tips: (card as any).tips,
            mnemonic: card.mnemonic,
            attachments: card.attachments,
          }
        })()}
        onSave={handleEnrichSave}
        flashcardId={activeCardId ?? undefined}
      />

      <Modal isOpen={!!previewImageUrl} onClose={() => setPreviewImageUrl(null)} title="Preview" size="lg">
        <div className="flex justify-center">
          {previewImageUrl && (
            <img src={previewImageUrl} alt="Attachment preview" className="max-h-[80vh] w-auto rounded" />
          )}
        </div>
      </Modal>

      <Modal isOpen={!!audioPlayerUrl} onClose={() => setAudioPlayerUrl(null)} title="Audio Player" size="sm">
        <div className="flex flex-col items-center gap-4 py-2">
          {audioPlayerUrl && (
            <>
              <audio
                key={audioPlayerUrl}
                controls
                autoPlay
                src={audioPlayerUrl}
                className="w-full rounded"
              />
              <a
                href={audioPlayerUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </a>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!videoPlayerUrl} onClose={() => setVideoPlayerUrl(null)} title="Video Player" size="lg">
        <div className="flex flex-col items-center gap-4 py-2">
          {videoTitle && (
            <p className="w-full text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-2">{videoTitle}</p>
          )}
          {videoPlayerUrl && (() => {
            const embedUrl = getYouTubeEmbedUrl(videoPlayerUrl)
            return embedUrl ? (
              <>
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title="YouTube video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full rounded"
                  />
                </div>
                <a
                  href={videoPlayerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  Open on YouTube
                </a>
              </>
            ) : (
              <>
                <video
                  key={videoPlayerUrl}
                  controls
                  autoPlay
                  src={videoPlayerUrl}
                  className="w-full max-h-[60vh] rounded bg-black"
                />
                <a
                  href={videoPlayerUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download
                </a>
              </>
            )
          })()}
        </div>
      </Modal>
      <Modal
        isOpen={showAttachmentModal}
        onClose={() => {
          setShowAttachmentModal(false)
          setActiveAttachment(null)
        }}
        title="Attachment"
        size="full"
      >
        <div className="py-2">
          {activeAttachment && (
            <AttachmentPreview url={activeAttachment.url} type={activeAttachment.type ?? ""} />
          )}
        </div>
      </Modal>
    </Card>
  )
}

export default ManageFlashcardsSection
