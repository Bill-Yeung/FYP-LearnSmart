import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../../contexts"
import { logActivity } from "../../lib/activityLog"
import RichTextEditor from "../../components/flashcards/RichTextEditor"
import DOMPurify from "dompurify"
import { apiClient } from "../../lib/api"

export default function CreateCardPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [newFront, setNewFront] = useState("")
  const [newBack, setNewBack] = useState("")
  const [newTips, setNewTips] = useState("")
  const [newMnemonic, setNewMnemonic] = useState("")
  const [showTips, setShowTips] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [newTags, setNewTags] = useState<string[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [showKbTagDropdown, setShowKbTagDropdown] = useState(false)
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string | null; flashcard_count: number }>>([])
  const [newConceptId, setNewConceptId] = useState<string | null>(null)
  const [availableConcepts, setAvailableConcepts] = useState<Array<{ id: string; title: string }>>([])
  const [newSubject, setNewSubject] = useState("")
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [newSourceId, setNewSourceId] = useState<string | null>(null)
  const [availableDocs, setAvailableDocs] = useState<Array<{ id: string; document_name: string }>>([])
  const [savingCard, setSavingCard] = useState(false)
  const txtFileInputRef = useRef<HTMLInputElement | null>(null)
  const [txtFileName, setTxtFileName] = useState<string | null>(null)
  const [txtContent, setTxtContent] = useState("")
  const [txtTopic, setTxtTopic] = useState("")
  const [txtTargetCount, setTxtTargetCount] = useState<number | "">(1)
  const [txtLoading, setTxtLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const [kbMode, setKbMode] = useState<"subject" | "concepts" | "source">("subject")
  const [kbTopic, setKbTopic] = useState("")
  const [kbConceptIds, setKbConceptIds] = useState<string[]>([])
  const [kbSourceIds, setKbSourceIds] = useState<string[]>([])
  const [kbTargetCount, setKbTargetCount] = useState<number | "">(1)
  const [kbLoading, setKbLoading] = useState(false)

  const [kbTags, setKbTags] = useState<string[]>([])

  const [reviewCards, setReviewCards] = useState<Array<{ front: string; back: string; tips?: string; mnemonic?: string; tags?: string[] }>>([])
  const [reviewSource, setReviewSource] = useState<"kb" | "txt" | null>(null)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewRegenerating, setReviewRegenerating] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const [kbCustomPrompt, setKbCustomPrompt] = useState("")
  const [txtCustomPrompt, setTxtCustomPrompt] = useState("")

  const [kbConceptSearch, setKbConceptSearch] = useState("")
  const [kbSourceSearch, setKbSourceSearch] = useState("")
  const [kbAvailableConcepts, setKbAvailableConcepts] = useState<Array<{ id: string; title: string }>>([])
  const [kbAvailableSources, setKbAvailableSources] = useState<Array<{ id: string; document_name: string }>>([])
  const [kbConceptsLoading, setKbConceptsLoading] = useState(false)
  const [kbSourcesLoading, setKbSourcesLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const conceptData = await apiClient.get<{ concepts?: any[] }>(`/api/documents/knowledge-map/data`)
        if (mounted) {
          setAvailableConcepts((conceptData?.concepts || []).map((c: any) => ({ id: c.id, title: c.title || c.name || "Untitled" })))
        }
      } catch { if (mounted) setAvailableConcepts([]) }

      let kbSubjectNames: string[] = []
      let flashcardTopicNames: string[] = []
      try {
        const kbSubjectData = await apiClient.get<{ subjects?: any[] }>(`/api/documents/knowledge-base/subjects`)
        kbSubjectNames = (kbSubjectData?.subjects || []).map((s: any) => s.name).filter(Boolean)
      } catch {}
      try {
        const topicData = await apiClient.get<{ name: string }[]>(`/api/flashcards/topics`)
        flashcardTopicNames = Array.isArray(topicData) ? topicData.map((t: any) => t.name).filter(Boolean) : []
      } catch {}
      if (mounted) {
        const merged = Array.from(new Set([...kbSubjectNames, ...flashcardTopicNames]))
        setAvailableSubjects(merged)
      }

      try {
        const tagData = await apiClient.get<{ tags?: any[] }>(`/api/tags?page_size=100`)
        if (mounted) {
          setAvailableTags(
            (tagData?.tags || []).map((t: any) => ({
              id: t.id,
              name: t.name,
              color: t.color ?? null,
              flashcard_count: t.flashcard_count ?? 0,
            }))
          )
        }
      } catch { if (mounted) setAvailableTags([]) }

      try {
        const docData = await apiClient.get<any>(`/api/documents?page=1&page_size=100`)
        if (mounted) {
          const docs = docData?.documents || docData?.items || docData?.data || []
          setAvailableDocs(docs.map((d: any) => ({ id: d.id, document_name: d.document_name || d.name || "Untitled" })))
        }
      } catch { if (mounted) setAvailableDocs([]) }
    })()
    return () => { mounted = false }
  }, [])

  // lazy-load concepts only when the user switches to that mode
  useEffect(() => {
    if (kbMode !== "concepts") return
    let mounted = true
    const loadConcepts = async () => {
      setKbConceptsLoading(true)
      try {
        const data = await apiClient.get<{ concepts?: any[]; data?: any[] }>(`/api/documents/knowledge-map/data`)
        if (!mounted) return
        const concepts = (data?.concepts || []).map((c: any) => ({
          id: c.id || c.concept_id,
          title: c.title || c.name || "Untitled"
        }))
        console.log("Loaded concepts:", concepts)
        setKbAvailableConcepts(concepts)
      } catch (err) {
        if (!mounted) return
        console.error("Failed to load concepts", err)
        setKbAvailableConcepts([])
      } finally {
        if (mounted) setKbConceptsLoading(false)
      }
    }
    loadConcepts()
    return () => { mounted = false }
  }, [kbMode])

  useEffect(() => {
    if (kbMode !== "source") return
    let mounted = true
    const loadSources = async () => {
      setKbSourcesLoading(true)
      try {
        const data = await apiClient.get<{ documents?: any[]; sources?: any[]; items?: any[]; data?: any[] }>(`/api/documents?page=1&page_size=100`)
        if (!mounted) return
        let sources = data?.documents || data?.sources || data?.items || data?.data || []
        sources = sources.map((s: any) => ({
          id: s.id,
          document_name: s.document_name || s.name || "Untitled"
        }))
        console.log("Loaded documents:", sources)
        setKbAvailableSources(sources)
      } catch (err) {
        if (!mounted) return
        console.error("Failed to load documents", err)
        setKbAvailableSources([])
      } finally {
        if (mounted) setKbSourcesLoading(false)
      }
    }
    loadSources()
    return () => { mounted = false }
  }, [kbMode])

  function stripHtml(html: string) {
    if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '')
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent ?? ''
  }

  function isEmptyHtml(html: string) {
    return !stripHtml(html).trim()
  }

  async function handleAddCard() {
    if (isEmptyHtml(newFront) || isEmptyHtml(newBack)) {
      showToast("Question and answer required")
      return
    }
    setSavingCard(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem("learnsmart-tokens")
      const tokens = stored ? (() => { try { return JSON.parse(stored) } catch { return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const cleanFront = DOMPurify.sanitize(newFront || "", { ALLOWED_TAGS: ["b","strong","i","em","u","sup","sub","ul","ol","li","span","p","br","mark"], ALLOWED_ATTR: ["style","class"] })
      const cleanBack = DOMPurify.sanitize(newBack || "", { ALLOWED_TAGS: ["b","strong","i","em","u","sup","sub","a","ul","ol","li","span","p","br","mark"], ALLOWED_ATTR: ["href","target","rel","style","class"] })

      const body: any = { front: cleanFront, back: cleanBack, card_type: 'standard' }
      const tagsArray = newTags.map((t) => t.trim()).filter(Boolean)
      if (tagsArray.length) body.tags = tagsArray
      if (newConceptId) body.concept_id = newConceptId
      if (newSubject.trim()) body.topic = newSubject.trim()
      if (newSourceId) body.source_id = newSourceId
      if (newTips.trim()) body.tips = newTips.trim()
      if (newMnemonic.trim()) body.mnemonic = newMnemonic.trim()

      const res = await fetch("/api/flashcards/create", { method: "POST", headers, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to create card" }))
        throw new Error(err.detail || "Failed to create card")
      }
      logActivity("flashcard", "create")
      showToast("Card created successfully")
      navigate("/flashcards/manage")
    } catch (err: any) {
      console.error(err)
      showToast(err.message || "Failed to create card")
    } finally {
      setSavingCard(false)
    }
  }

  async function generateFromKnowledgeBase() {
    if (kbMode === "subject" && !kbTopic.trim()) {
      showToast("Select a subject first")
      return
    }
    if (kbMode === "concepts" && kbConceptIds.length === 0) {
      showToast("Select at least one concept")
      return
    }
    if (kbMode === "source" && kbSourceIds.length === 0) {
      showToast("Select at least one document")
      return
    }

    setKbLoading(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem("learnsmart-tokens")
      const tokens = stored ? (() => { try { return JSON.parse(stored) } catch { return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const payload: any = {
        save: false
      }

      if (kbTargetCount && kbTargetCount !== 0) {
        payload.target_count = kbTargetCount
      }
      if (kbTags.length > 0) {
        payload.tags = kbTags
      }
      if (kbCustomPrompt.trim()) {
        payload.custom_prompt = kbCustomPrompt.trim()
      }

      if (kbMode === "subject") {
        payload.topic = kbTopic.trim()
      } else if (kbMode === "concepts") {
        payload.concept_ids = kbConceptIds
      } else if (kbMode === "source") {
        payload.source_id = kbSourceIds[0]
      }

      const res = await fetch("/api/flashcards/generate-from-knowledge-base", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(err.detail || "Knowledge base generation failed")
      }

      const data = await res.json()
      const cards: any[] = data.flashcards ?? []
      if (!cards.length) { showToast("No cards were generated"); return }
      setReviewCards(cards.map((c: any) => ({
        front: c.front ?? "",
        back: c.back ?? "",
        tips: c.tips ?? "",
        mnemonic: c.mnemonic ?? "",
        tags: Array.isArray(c.tags) ? c.tags : (kbTags.length > 0 ? kbTags : []),
      })))
      setReviewSource("kb")
    } catch (err: any) {
      console.error(err)
      showToast(String(err).slice(0, 140) || 'Knowledge base generation failed')
    } finally {
      setKbLoading(false)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0] ?? null
    handleTxtFile(file)
  }

  async function handleTxtFile(file: File | null) {
    if (!file) return
    setTxtFileName(file.name)
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
    if (!txtTopic) setTxtTopic(baseName)

    const name = file.name.toLowerCase()
    if (name.endsWith(".txt")) {
      const reader = new FileReader()
      reader.onload = () => setTxtContent(String(reader.result || ""))
      reader.readAsText(file)
    } else {
      try {
        const stored = localStorage.getItem("learnsmart-tokens")
        const tokens = stored ? (() => { try { return JSON.parse(stored) } catch { return null } })() : null
        const headers: Record<string, string> = {}
        if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`
        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/flashcards/extract-text", { method: "POST", headers, body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Extraction failed" }))
          showToast(err.detail || "Failed to extract text from file")
          return
        }
        const data = await res.json()
        setTxtContent(data.text || "")
      } catch {
        showToast("Failed to read file")
      }
    }
  }

  async function generateFromTxt() {
    const content = txtContent.trim()
    const topic = txtTopic.trim()
    if (!content && !topic) {
      showToast("Paste some text or upload a .txt file first")
      return
    }
    setTxtLoading(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem("learnsmart-tokens")
      const tokens = stored ? (() => { try { return JSON.parse(stored) } catch { return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          topic: topic || "General",
          content: content || undefined,
          target_count: txtTargetCount || 1,
          save: false,
          ...(txtCustomPrompt.trim() ? { custom_prompt: txtCustomPrompt.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Generation failed" }))
        throw new Error(err.detail || "Generation failed")
      }
      const data = await res.json()
      const cards: any[] = Array.isArray(data) ? data : (data.flashcards ?? [])
      if (!cards.length) { showToast("No cards were generated"); return }

      setReviewCards(cards.map((c: any) => ({
        front: c.front ?? "",
        back: c.back ?? "",
        tips: c.tips ?? "",
        mnemonic: c.mnemonic ?? "",
        tags: Array.isArray(c.tags) ? c.tags : [],
      })))
      setReviewSource("txt")
    } catch (err: any) {
      showToast(err.message || "Generation failed")
    } finally {
      setTxtLoading(false)
    }
  }

  async function saveReviewedCards() {
    if (!reviewCards.length) return
    setReviewSaving(true)
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const stored = localStorage.getItem("learnsmart-tokens")
    const tokens = stored ? (() => { try { return JSON.parse(stored) } catch { return null } })() : null
    if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

    const saved: any[] = []
    for (const card of reviewCards) {
      try {
        const r = await fetch("/api/flashcards/create", {
          method: "POST",
          headers,
          body: JSON.stringify({
            front: card.front,
            back: card.back,
            tips: card.tips || undefined,
            mnemonic: card.mnemonic || undefined,
            tags: card.tags ?? [],
            card_type: "standard",
          }),
        })
        if (r.ok) saved.push(await r.json())
      } catch {}
    }
    logActivity("flashcard", "create", undefined, { source: reviewSource === "kb" ? "knowledge_base" : "txt_ai", count: saved.length })
    showToast(`Saved ${saved.length} flashcard${saved.length !== 1 ? "s" : ""}`)
    setReviewCards([])
    setReviewSource(null)
    setReviewSaving(false)
    navigate("/flashcards/manage")
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create Flashcards</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Choose how to add flashcards: manually, with AI, or from a file.</p>
        </div>

        <div className="space-y-6">
          {/* Section 1: Create Single Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">1</div>
              <h2 className="text-lg font-semibold">Create a Single Card</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Manually add a flashcard with question and answer.</p>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Question</label>
                <RichTextEditor value={newFront} onChange={setNewFront} placeholder="e.g., What is the capital of France?" minHeight="300px" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Answer</label>
                <RichTextEditor value={newBack} onChange={setNewBack} placeholder="e.g., Paris" minHeight="300px" />
              </div>

              {/* Tips section */}
              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setShowTips((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tips</span>
                    <span className="text-xs text-gray-400">optional</span>
                    {newTips.trim() && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">Added</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{showTips ? "▲" : "▼"}</span>
                </button>
                {showTips && (
                  <div className="border-t border-gray-200 px-4 pb-4 pt-3 dark:border-gray-700">
                    <p className="mb-2 text-xs text-gray-500">Helpful hints shown on demand during review.</p>
                    <textarea
                      value={newTips}
                      onChange={(e) => setNewTips(e.target.value)}
                      placeholder="Add helpful tips for remembering this card..."
                      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 font-sans"
                      rows={3}
                    />
                  </div>
                )}
              </div>

              {/* Mnemonic section */}
              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setShowMnemonic((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mnemonic</span>
                    <span className="text-xs text-gray-400">optional</span>
                    {newMnemonic.trim() && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">Added</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{showMnemonic ? "▲" : "▼"}</span>
                </button>
                {showMnemonic && (
                  <div className="border-t border-gray-200 px-4 pb-4 pt-3 dark:border-gray-700">
                    <p className="mb-2 text-xs text-gray-500">A memory aid or story to help recall this information.</p>
                    <textarea
                      value={newMnemonic}
                      onChange={(e) => setNewMnemonic(e.target.value)}
                      placeholder="e.g. ROY G BIV for the colors of the rainbow..."
                      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 font-sans"
                      rows={3}
                    />
                  </div>
                )}
              </div>

              {/* Tags — dropdown selector */}
              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tags <span className="font-normal text-gray-400">(optional)</span>
                </label>
                {availableTags.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowTagDropdown((v) => !v)}
                      className="w-full flex items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      <span>{newTags.length > 0 ? `${newTags.length} tag${newTags.length > 1 ? "s" : ""} selected` : "Select tags…"}</span>
                      <span className="text-gray-400">{showTagDropdown ? "▲" : "▼"}</span>
                    </button>
                    {showTagDropdown && (
                      <div className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 max-h-52 overflow-y-auto">
                        {availableTags.map((tag) => {
                          const selected = newTags.includes(tag.name)
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => setNewTags((prev) => selected ? prev.filter((t) => t !== tag.name) : [...prev, tag.name])}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${selected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                            >
                              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color ?? "#6b7280" }} />
                              <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{tag.name}</span>
                              <span className="text-xs text-gray-400">{tag.flashcard_count} items tagged</span>
                              {selected && <span className="text-blue-500 text-xs font-semibold">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {newTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {newTags.map((name) => {
                          const t = availableTags.find((t) => t.name === name)
                          return (
                            <span key={name} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs text-white" style={{ backgroundColor: t?.color ?? "#6b7280" }}>
                              {name}
                              <button type="button" onClick={() => setNewTags((prev) => prev.filter((t) => t !== name))} className="opacity-70 hover:opacity-100">×</button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Subject */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subject <span className="font-normal text-gray-400">(optional)</span>
                </label>
                {availableSubjects.length > 0 ? (
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">— None —</option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                    No subjects found. Upload documents linked to subjects first.
                  </p>
                )}
              </div>

              {/* Concept */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Concept <span className="font-normal text-gray-400">(optional)</span>
                </label>
                {availableConcepts.length > 0 ? (
                  <select
                    value={newConceptId ?? ""}
                    onChange={(e) => setNewConceptId(e.target.value || null)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">— None —</option>
                    {availableConcepts.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                    No concepts found. Upload documents first so the knowledge base can extract concepts.
                  </p>
                )}
              </div>

              {/* Document */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Document <span className="font-normal text-gray-400">(optional — link to a source)</span>
                </label>
                {availableDocs.length === 0 ? (
                  <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                    No documents found. Upload documents to link a card to a source.
                  </p>
                ) : (
                  <select
                    value={newSourceId ?? ""}
                    onChange={(e) => setNewSourceId(e.target.value || null)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">— None —</option>
                    {availableDocs.map((d) => (
                      <option key={d.id} value={d.id}>{d.document_name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600">Cancel</button>
                <button onClick={handleAddCard} disabled={savingCard} className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-md disabled:opacity-50">{savingCard ? 'Saving...' : 'Create card'}</button>
              </div>
            </div>
          </div>

          {/* Section 2: Knowledge Base Generation */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">2</div>
              <h2 className="text-lg font-semibold">Generate from Knowledge Base</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Generate flashcards from your knowledge base by topic, concepts, or documents.</p>

            <div className="space-y-4">
              {/* Mode selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Generation Mode</label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="kb-mode" value="subject" checked={kbMode === "subject"} onChange={() => setKbMode("subject")} className="cursor-pointer" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">By Subject</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="kb-mode" value="concepts" checked={kbMode === "concepts"} onChange={() => setKbMode("concepts")} className="cursor-pointer" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">By Concepts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="kb-mode" value="source" checked={kbMode === "source"} onChange={() => setKbMode("source")} className="cursor-pointer" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">By Document</span>
                  </label>
                </div>
              </div>

              {/* Input fields based on mode */}
              {kbMode === "subject" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Select Subject</label>
                  {availableSubjects.length > 0 ? (
                    <select
                      value={kbTopic}
                      onChange={(e) => setKbTopic(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="">— Select a subject —</option>
                      {availableSubjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                      No subjects found. Upload documents linked to subjects first.
                    </p>
                  )}
                </div>
              )}

              {kbMode === "concepts" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Select Concepts</label>
                  <div className="space-y-2">
                    {/* Search input */}
                    <input
                      type="text"
                      value={kbConceptSearch}
                      onChange={(e) => setKbConceptSearch(e.target.value)}
                      placeholder="Search concepts..."
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />

                    {/* Concept list */}
                    <div className="border border-gray-300 rounded bg-white dark:bg-gray-900 dark:border-gray-700 max-h-48 overflow-y-auto">
                      {kbConceptsLoading ? (
                        <div className="p-3 text-sm text-gray-600 dark:text-gray-400">Loading concepts...</div>
                      ) : kbAvailableConcepts.length === 0 ? (
                        <div className="p-3 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-200">
                          No concepts found. Try uploading documents first so the knowledge base can extract concepts.
                        </div>
                      ) : (
                        kbAvailableConcepts
                          .filter((c) => c.title.toLowerCase().includes(kbConceptSearch.toLowerCase()))
                          .map((concept) => (
                            <label key={concept.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={kbConceptIds.includes(concept.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setKbConceptIds([...kbConceptIds, concept.id])
                                  } else {
                                    setKbConceptIds(kbConceptIds.filter((id) => id !== concept.id))
                                  }
                                }}
                                className="cursor-pointer"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{concept.title}</span>
                            </label>
                          ))
                      )}
                    </div>

                    {/* Selected concepts display */}
                    {kbConceptIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {kbConceptIds.map((id) => {
                          const concept = kbAvailableConcepts.find((c) => c.id === id)
                          return (
                            <div key={id} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                              {concept?.title || id}
                              <button
                                type="button"
                                onClick={() => setKbConceptIds(kbConceptIds.filter((cid) => cid !== id))}
                                className="ml-1 hover:text-blue-900 dark:hover:text-blue-200"
                              >
                                ✕
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {kbMode === "source" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Select Document</label>
                  <div className="space-y-2">
                    {/* Search input */}
                    <input
                      type="text"
                      value={kbSourceSearch}
                      onChange={(e) => setKbSourceSearch(e.target.value)}
                      placeholder="Search documents..."
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />

                    {/* Source/Document checkboxes */}
                    <div className="border border-gray-300 rounded bg-white dark:bg-gray-900 dark:border-gray-700 max-h-48 overflow-y-auto">
                      {kbSourcesLoading ? (
                        <div className="p-3 text-sm text-gray-600 dark:text-gray-400">Loading documents...</div>
                      ) : kbAvailableSources.length === 0 ? (
                        <div className="p-3 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-200">
                          No documents found. Upload documents first to generate flashcards from them.
                        </div>
                      ) : (
                        kbAvailableSources
                          .filter((s) => s.document_name.toLowerCase().includes(kbSourceSearch.toLowerCase()))
                          .map((source) => (
                            <label
                              key={source.id}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={kbSourceIds.includes(source.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setKbSourceIds([...kbSourceIds, source.id])
                                  } else {
                                    setKbSourceIds(kbSourceIds.filter((id) => id !== source.id))
                                  }
                                }}
                                className="cursor-pointer"
                              />
                              <span className="text-gray-700 dark:text-gray-300">{source.document_name}</span>
                            </label>
                          ))
                      )}
                    </div>

                    {/* Selected documents display */}
                    {kbSourceIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {kbSourceIds.map((id) => {
                          const src = kbAvailableSources.find((s) => s.id === id)
                          return (
                            <div key={id} className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                              {src?.document_name || id}
                              <button
                                type="button"
                                onClick={() => setKbSourceIds(kbSourceIds.filter((sid) => sid !== id))}
                                className="ml-1 hover:text-green-900 dark:hover:text-green-200"
                              >
                                ✕
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags to attach to generated cards */}
              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Tags <span className="font-normal text-gray-400">(optional — attached to all generated cards)</span></label>
                {availableTags.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowKbTagDropdown((v) => !v)}
                      className="w-full flex items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      <span>{kbTags.length > 0 ? `${kbTags.length} tag${kbTags.length > 1 ? "s" : ""} selected` : "Select tags…"}</span>
                      <span className="text-gray-400">{showKbTagDropdown ? "▲" : "▼"}</span>
                    </button>
                    {showKbTagDropdown && (
                      <div className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 max-h-52 overflow-y-auto">
                        {availableTags.map((tag) => {
                          const selected = kbTags.includes(tag.name)
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => setKbTags((prev) => selected ? prev.filter((t) => t !== tag.name) : [...prev, tag.name])}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${selected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                            >
                              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color ?? "#6b7280" }} />
                              <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{tag.name}</span>
                              <span className="text-xs text-gray-400">{tag.flashcard_count} items tagged</span>
                              {selected && <span className="text-blue-500 text-xs font-semibold">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {kbTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {kbTags.map((name) => {
                          const t = availableTags.find((t) => t.name === name)
                          return (
                            <span key={name} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs text-white" style={{ backgroundColor: t?.color ?? "#6b7280" }}>
                              {name}
                              <button type="button" onClick={() => setKbTags((prev) => prev.filter((t) => t !== name))} className="opacity-70 hover:opacity-100">×</button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extra Instructions <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={kbCustomPrompt}
                  onChange={(e) => setKbCustomPrompt(e.target.value)}
                  placeholder="e.g. Focus on definitions, use simple language, include examples..."
                  rows={2}
                  maxLength={500}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 resize-none"
                />
                <p className="mt-1 text-xs text-gray-400 text-right">{kbCustomPrompt.length}/500</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Target Number of Cards</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Enter 0 to let the AI decide how many cards to generate</p>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={kbTargetCount as any}
                  onChange={(e) => setKbTargetCount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="0 for auto, or 1-50"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setKbTopic("")
                    setKbConceptIds([])
                    setKbSourceIds([])
                    setKbConceptSearch("")
                    setKbSourceSearch("")
                    setKbTags([])
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600"
                >
                  Clear
                </button>
                <button
                  onClick={generateFromKnowledgeBase}
                  disabled={kbLoading}
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg shadow hover:shadow-md disabled:opacity-50"
                >
                  {kbLoading ? 'Generating...' : 'Generate from KB'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Generate from Text / File */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-600 dark:bg-green-900/40 dark:text-green-300">3</div>
              <h2 className="text-lg font-semibold">Generate from Text</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Upload a file or paste your notes — AI will generate flashcards from the content. Supports .txt, .docx (Word), and .pdf.</p>

            <div className="space-y-4">
              {/* File upload drop zone */}
              <div
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${dragOver ? "border-green-400 bg-green-50 dark:bg-green-950" : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => txtFileInputRef.current?.click()}
              >
                <input
                  ref={(r) => (txtFileInputRef.current = r)}
                  type="file"
                  accept=".txt,.docx,.pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  onChange={(e) => handleTxtFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {txtFileName ? (
                  <div className="text-sm font-medium text-green-600 dark:text-green-400">✓ {txtFileName}</div>
                ) : (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Drop a file here or click to browse</div>
                    <div className="text-xs text-gray-400">.txt, .docx (Word), .pdf supported</div>
                  </div>
                )}
              </div>

              {/* Paste area */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Or paste your text</label>
                <textarea
                  value={txtContent}
                  onChange={(e) => setTxtContent(e.target.value)}
                  rows={6}
                  placeholder="Paste lecture notes, study material, or any text here..."
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 resize-y"
                />
              </div>

              {/* Topic + count */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Topic <span className="font-normal text-gray-400">(optional label)</span></label>
                  <input
                    type="text"
                    value={txtTopic}
                    onChange={(e) => setTxtTopic(e.target.value)}
                    placeholder="e.g. Cell Biology"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Cards to generate</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={txtTargetCount}
                    onChange={(e) => setTxtTargetCount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extra Instructions <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={txtCustomPrompt}
                  onChange={(e) => setTxtCustomPrompt(e.target.value)}
                  placeholder="e.g. Focus on key terms, make cards suitable for beginners, avoid acronyms..."
                  rows={2}
                  maxLength={500}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 resize-none"
                />
                <p className="mt-1 text-xs text-gray-400 text-right">{txtCustomPrompt.length}/500</p>
              </div>

              <button
                type="button"
                onClick={generateFromTxt}
                disabled={txtLoading || (!txtContent.trim() && !txtTopic.trim())}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {txtLoading ? "Generating…" : "Generate Flashcards with AI"}
              </button>

              {/* Sample text */}
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 select-none">Show sample text</summary>
                <div className="mt-2 rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Example — Cell Biology notes:</p>
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed">{`The cell is the basic unit of life. There are two main types: prokaryotic cells, which lack a nucleus (e.g. bacteria), and eukaryotic cells, which have a membrane-bound nucleus (e.g. plant and animal cells).

The cell membrane controls what enters and exits the cell. It is made of a phospholipid bilayer with embedded proteins.

The mitochondria generate energy in the form of ATP through cellular respiration. They are often called the "powerhouse of the cell".

The nucleus contains the cell's DNA and controls gene expression. Within it, the nucleolus produces ribosomes.

Ribosomes synthesise proteins and can be found free in the cytoplasm or attached to the rough endoplasmic reticulum (RER).`}</pre>
                  <button
                    type="button"
                    onClick={() => {
                      setTxtContent(`The cell is the basic unit of life. There are two main types: prokaryotic cells, which lack a nucleus (e.g. bacteria), and eukaryotic cells, which have a membrane-bound nucleus (e.g. plant and animal cells).\n\nThe cell membrane controls what enters and exits the cell. It is made of a phospholipid bilayer with embedded proteins.\n\nThe mitochondria generate energy in the form of ATP through cellular respiration. They are often called the "powerhouse of the cell".\n\nThe nucleus contains the cell's DNA and controls gene expression. Within it, the nucleolus produces ribosomes.\n\nRibosomes synthesise proteins and can be found free in the cytoplasm or attached to the rough endoplasmic reticulum (RER).`)
                      if (!txtTopic) setTxtTopic("Cell Biology")
                    }}
                    className="mt-2 text-xs text-green-600 hover:underline dark:text-green-400"
                  >
                    Use this sample
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>

      </main>

      {/* Review Modal */}
      {reviewCards.length > 0 && reviewSource !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Review Generated Flashcards</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{reviewCards.length} card{reviewCards.length !== 1 ? "s" : ""} generated — edit or remove before saving</p>
              </div>
              <button
                type="button"
                onClick={() => { setReviewCards([]); setReviewSource(null) }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Cards list */}
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {reviewCards.map((card, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {editingIndex === idx ? (
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Front (Question)</label>
                        <textarea
                          value={card.front}
                          onChange={(e) => setReviewCards(prev => prev.map((c, i) => i === idx ? { ...c, front: e.target.value } : c))}
                          rows={3}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Back (Answer)</label>
                        <textarea
                          value={card.back}
                          onChange={(e) => setReviewCards(prev => prev.map((c, i) => i === idx ? { ...c, back: e.target.value } : c))}
                          rows={3}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tips</label>
                        <textarea
                          value={card.tips ?? ""}
                          onChange={(e) => setReviewCards(prev => prev.map((c, i) => i === idx ? { ...c, tips: e.target.value } : c))}
                          rows={2}
                          placeholder="Add helpful tips for remembering this card..."
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mnemonic</label>
                        <textarea
                          value={card.mnemonic ?? ""}
                          onChange={(e) => setReviewCards(prev => prev.map((c, i) => i === idx ? { ...c, mnemonic: e.target.value } : c))}
                          rows={2}
                          placeholder="e.g. ROY G BIV for the colors of the rainbow..."
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 resize-y"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingIndex(null)} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center justify-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1 whitespace-pre-wrap">{card.front || <span className="italic text-gray-400">No question</span>}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{card.back || <span className="italic text-gray-400">No answer</span>}</p>
                          {typeof card.tips === 'string' && card.tips.trim() && <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">Tip: {card.tips}</p>}
                          {typeof card.mnemonic === 'string' && card.mnemonic.trim() && <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">Mnemonic: {card.mnemonic}</p>}
                          {card.tags && card.tags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {card.tags.map((tag, ti) => (
                                <span key={ti} className="px-1.5 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingIndex(idx)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded"
                            title="Edit card"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewCards(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"
                            title="Remove card"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Regenerate prompt row */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Regenerate with different instructions</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reviewSource === "kb" ? kbCustomPrompt : txtCustomPrompt}
                  onChange={(e) => reviewSource === "kb" ? setKbCustomPrompt(e.target.value) : setTxtCustomPrompt(e.target.value)}
                  placeholder="e.g. Make cards harder, focus on examples, simpler language..."
                  maxLength={500}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setReviewRegenerating(true)
                    setEditingIndex(null)
                    if (reviewSource === "kb") {
                      await generateFromKnowledgeBase()
                    } else {
                      await generateFromTxt()
                    }
                    setReviewRegenerating(false)
                  }}
                  disabled={reviewRegenerating || kbLoading || txtLoading}
                  className="px-3 py-1.5 text-sm font-medium bg-gray-700 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-500 disabled:opacity-50 whitespace-nowrap"
                >
                  {reviewRegenerating ? "Regenerating..." : "Regenerate"}
                </button>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">{reviewCards.length} card{reviewCards.length !== 1 ? "s" : ""} to save</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setReviewCards([]); setReviewSource(null) }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Discard All
                </button>
                <button
                  type="button"
                  onClick={saveReviewedCards}
                  disabled={reviewSaving || reviewCards.length === 0}
                  className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-md disabled:opacity-50"
                >
                  {reviewSaving ? "Saving..." : `Save ${reviewCards.length} Card${reviewCards.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
