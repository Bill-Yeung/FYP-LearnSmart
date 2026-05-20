import { useCallback, useEffect, useRef, useState } from "react"
import { Card, Button } from "../../components"
import { logActivity } from "../../lib/activityLog"
import { onErrorBookChanged, dispatchErrorBookChanged } from "../../lib/errorBookEvents"

type ErrorCategory = {
  id: string
  slug: string
  label: string
  description: string | null
  color_hex: string
  icon: string
  is_system: boolean
  sort_order: number
}

type SpacedRepAlgo = "sm2" | "fsrs" | "simple" | "leitner"
type ChatMsg = { role: "user" | "assistant"; content: string }

type ErrorRecord = {
  id: string
  question_id: string | null
  wrong_answer: string
  correct_answer_snapshot: string | null
  system_explanation: string | null
  error_category_id: string | null
  error_category: string | null
  category_label: string | null
  category_color: string | null
  user_reflection_notes: string | null
  first_wrong_time: string
  last_review_time: string | null
  next_review_time: string | null
  review_count: number
  is_mastered: boolean
  error_pattern_tags: string[]
  question_stem: string | null
  topic: string | null
  source_exam: string | null
  year: number | null
  question_type: string | null
}

type PatternStats = {
  by_category: { error_category: string; category_label: string | null; count: number }[]
  by_topic: { topic: string; count: number }[]
  weekly: { day: string; count: number }[]
}

const ALGO_LABELS: Record<SpacedRepAlgo, string> = {
  sm2: "SM-2", fsrs: "FSRS", simple: "Simple", leitner: "Leitner",
}

const ALGO_DESC: Record<SpacedRepAlgo, string> = {
  sm2:     "Adjusts ease-factor per rating. Best for most learners.",
  fsrs:    "Stability-based. Targets 90% recall rate.",
  simple:  "Doubles interval each success: 1→2→4→8 days.",
  leitner: "5-box system with fixed intervals (1/3/7/14/30 days).",
}

function CategoryPill({ label, colorHex }: { label: string; colorHex?: string | null }) {
  const hex = colorHex ?? "#6B7280"
  return (
    <span
      style={{ backgroundColor: hex + "22", color: hex, borderColor: hex + "55" }}
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
    >
      {label}
    </span>
  )
}

function HorizBar({ label, count, max, colorHex }: { label: string; count: number; max: number; colorHex?: string | null }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  const hex = colorHex ?? "#6366f1"
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 sm:w-36 shrink-0 truncate text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: hex }} />
      </div>
      <span className="w-5 text-right text-xs text-gray-400">{count}</span>
    </div>
  )
}

function WeeklyBars({ data }: { data: { day: string; count: number }[] }) {
  if (!data.length) return <p className="text-xs text-gray-400 py-4 text-center">No data for the past 28 days.</p>
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map(d => {
        const h = Math.max(3, Math.round((d.count / max) * 72))
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.day}: ${d.count} error${d.count !== 1 ? "s" : ""}`}>
            <div className="w-full rounded-t bg-rose-400 dark:bg-rose-500 group-hover:bg-rose-500 dark:group-hover:bg-rose-400 transition-colors" style={{ height: h }} />
            <span className="text-[9px] text-gray-400">{d.day.slice(5)}</span>
          </div>
        )
      })}
    </div>
  )
}

const RATING_OPTIONS = [
  { value: 1, label: "Again", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
  { value: 2, label: "Hard",  color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800" },
  { value: 3, label: "Good",  color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  { value: 4, label: "Easy",  color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
]

function ScheduleRow({
  e, algo, scheduling, selected, setSelected, scheduleReview, isDue,
}: {
  e: ErrorRecord
  algo: SpacedRepAlgo
  scheduling: boolean
  selected: ErrorRecord | null
  setSelected: (e: ErrorRecord | null) => void
  scheduleReview: (rating: number) => Promise<void>
  isDue: boolean
}) {
  const [scheduleRating, setScheduleRating] = useState(3)
  const isExpanded = selected?.id === e.id
  const nextDate = e.next_review_time ? new Date(e.next_review_time).toLocaleDateString() : "Not set"

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isDue
        ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
    }`}>
      {/* Row header */}
      <div
        className="flex items-start justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
        onClick={() => setSelected(isExpanded ? null : e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {isDue ? (
              <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300">
                Due now
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Next: {nextDate}
              </span>
            )}
            <CategoryPill label={e.category_label ?? e.error_category ?? "Uncategorised"} colorHex={e.category_color} />
            {e.topic && <span className="text-xs text-gray-400 dark:text-gray-500">{e.topic}</span>}
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
            {e.question_stem ?? e.wrong_answer ?? "Unknown question"}
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {e.review_count === 0 ? "Never reviewed" : `${e.review_count} review${e.review_count !== 1 ? "s" : ""} done`}
            {e.source_exam && ` · ${e.source_exam}`}
          </p>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 mt-1 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 space-y-4 bg-white dark:bg-gray-900">
          {/* Wrong / Correct answer recap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {e.wrong_answer && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">Your wrong answer</p>
                <p className="text-sm text-red-800 dark:text-red-200">{e.wrong_answer}</p>
              </div>
            )}
            {e.correct_answer_snapshot && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Correct answer</p>
                <p className="text-sm text-emerald-900 dark:text-emerald-100">{e.correct_answer_snapshot}</p>
              </div>
            )}
          </div>

          {/* Rating + schedule button */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recall rating:</span>
            {RATING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScheduleRating(opt.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  scheduleRating === opt.value
                    ? opt.color + " ring-2 ring-offset-1 ring-indigo-400"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <Button
              onClick={() => scheduleReview(scheduleRating)}
              disabled={scheduling}
            >
              {scheduling ? "Saving…" : "Schedule"}
            </Button>
          </div>
          {e.next_review_time && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Current next review: {nextDate}</p>
          )}
        </div>
      )}
    </div>
  )
}

type Tab = "list" | "patterns" | "schedule"

function groupErrorsByQuestion(errors: ErrorRecord[]): Map<string, { errors: ErrorRecord[]; count: number; mostRecentId: string }> {
  const grouped = new Map<string, { errors: ErrorRecord[]; count: number; mostRecentId: string }>()
  
  errors.forEach(err => {
    const key = err.question_id || `no-question-${err.id}`
    if (!grouped.has(key)) {
      grouped.set(key, { errors: [], count: 0, mostRecentId: err.id })
    }
    const group = grouped.get(key)!
    group.errors.push(err)
    group.count++

    const currentMostRecent = group.errors.find(e => e.id === group.mostRecentId)
    if (!currentMostRecent || new Date(err.first_wrong_time) > new Date(currentMostRecent.first_wrong_time)) {
      group.mostRecentId = err.id
    }
  })
  
  return grouped
}

export function ErrorLogPage() {

  const [errors, setErrors]   = useState<ErrorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<"all" | "open" | "mastered" | "due">("open")
  const [selected, setSelected] = useState<ErrorRecord | null>(null)
  const [tab, setTab]         = useState<Tab>("list")
  const [patterns, setPatterns] = useState<PatternStats | null>(null)
  const [algo, setAlgo]       = useState<SpacedRepAlgo>("sm2")
  const [toast, setToast]     = useState<string | null>(null)

  const [categories, setCategories] = useState<ErrorCategory[]>([])

  const [analyseWhy, setAnalyseWhy] = useState("")
  const [analyseHowFix, setAnalyseHowFix] = useState("")
  const [analyseSaving, setAnalyseSaving] = useState(false)
  const [analyseEditing, setAnalyseEditing] = useState(false)

  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)


  const [editingCategory, setEditingCategory] = useState(false)
  const [categoryNote, setCategoryNote] = useState("")
  const [categoryAiLoading, setCategoryAiLoading] = useState(false)

  const [newCatLabel, setNewCatLabel] = useState("")
  const [newCatColor, setNewCatColor] = useState("#6B7280")
  const [newCatSaving, setNewCatSaving] = useState(false)
  const [showNewCatForm, setShowNewCatForm] = useState(false)

  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  const [scheduling, setScheduling]   = useState(false)
  const [detailScheduleRating, setDetailScheduleRating] = useState(3)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/error-book?filter=${filter}&limit=100`, { credentials: "include" })
      if (!res.ok) throw new Error(`Failed to load error log (${res.status})`)
      const data = (await res.json() as { errors: ErrorRecord[] }).errors
      setErrors(data)
      logActivity("error_review", "view", undefined, { count: data.length, filter })
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load errors")
    } finally { setLoading(false) }
  }, [filter])

  const loadPatterns = useCallback(async () => {
    try {
      const res = await fetch("/api/error-book/stats/patterns", { credentials: "include" })
      if (!res.ok) throw new Error(`Failed to load patterns (${res.status})`)
      setPatterns(await res.json() as PatternStats)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load patterns")
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (tab === "patterns") void loadPatterns() }, [tab, loadPatterns])

  useEffect(() => onErrorBookChanged(() => { void load() }), [load])

  useEffect(() => {
    fetch("/api/error-book/categories", { credentials: "include" })
      .then(r => r.ok ? r.json() : { categories: [] })
      .then((d: { categories?: ErrorCategory[] }) => setCategories(d.categories ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setNotes(selected?.user_reflection_notes ?? "")
    setAnalyseWhy("")
    setAnalyseHowFix("")
    setAnalyseEditing(false)
    setChatHistory([])
    setChatInput("")
    setEditingCategory(false)
    setCategoryNote("")
    setShowNewCatForm(false)
    setNewCatLabel("")
    setNewCatColor("#6B7280")
  }, [selected?.id])

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/error-book/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      throw new Error(data.detail || `Save failed (${res.status})`)
    }
    return res
  }

  const markMastered = async (rec: ErrorRecord) => {
    try {
      await patch(rec.id, { is_mastered: true })
      logActivity("error_review", "complete", rec.id)
      showToast("Marked as mastered!")
      setSelected(null)
      void load()
      dispatchErrorBookChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save")
    }
  }

  const changeCategory = async (rec: ErrorRecord, cat: ErrorCategory) => {
    try {
      await patch(rec.id, { error_category_id: cat.id })
      setErrors(prev => prev.map(e => e.id === rec.id
        ? { ...e, error_category_id: cat.id, error_category: cat.slug, category_label: cat.label, category_color: cat.color_hex }
        : e))
      if (selected?.id === rec.id)
        setSelected(s => s ? { ...s, error_category_id: cat.id, error_category: cat.slug, category_label: cat.label, category_color: cat.color_hex } : s)
      setEditingCategory(false)
      showToast("Category updated")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save")
    }
  }

  const createAndSelectCategory = async (rec: ErrorRecord) => {
    if (!newCatLabel.trim()) return
    setNewCatSaving(true)
    try {
      const res = await fetch("/api/error-book/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label: newCatLabel.trim(), color_hex: newCatColor }),
      })
      if (res.ok) {
        const cat: ErrorCategory = await res.json()
        setCategories(prev => {
          const exists = prev.find(c => c.id === cat.id)
          return exists ? prev.map(c => c.id === cat.id ? cat : c) : [...prev, cat]
        })
        await changeCategory(rec, cat)
        setShowNewCatForm(false)
        setNewCatLabel("")
        setNewCatColor("#6B7280")
      }
    } finally { setNewCatSaving(false) }
  }

  const aiSuggestCategory = async () => {
    if (!selected) return
    setCategoryAiLoading(true)
    try {
      const categoryList = categories.map(c => `- ${c.slug} (${c.label})`).join("\n")
      const res = await fetch(`/api/error-book/${selected.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: `Based on this error, suggest ONE category from this list and explain briefly why:\n${categoryList}\n\nExtra context from user: ${categoryNote || "(none)"}\n\nReply in this format:\nSuggested category: <category_slug>\nReason: <one sentence>`,
          history: [],
        }),
      })
      if (res.ok) {
        const data = await res.json() as { reply: string }
        const match = data.reply.match(/suggested category:\s*(\w+)/i)
        if (match) {
          const slug = match[1].toLowerCase()
          const found = categories.find(c => c.slug === slug)
          if (found) {
            setCategoryNote(prev => prev + (prev ? "\n" : "") + `AI suggested: ${found.label}\n${data.reply.replace(/suggested category:.*\n?/i, "").trim()}`)
          } else {
            setCategoryNote(prev => prev + (prev ? "\n" : "") + data.reply)
          }
        } else {
          setCategoryNote(prev => prev + (prev ? "\n\n" : "") + data.reply)
        }
      }
    } catch { } finally { setCategoryAiLoading(false) }
  }

  const saveNotes = async () => {
    if (!selected) return
    setSavingNotes(true)
    try {
      await patch(selected.id, { user_reflection_notes: notes })
      setSelected(s => s ? { ...s, user_reflection_notes: notes } : s)
      showToast("Notes saved")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save notes")
    } finally {
      setSavingNotes(false)
    }
  }

  const saveAnalysis = async () => {
    if (!selected || (!analyseWhy.trim() && !analyseHowFix.trim())) return
    setAnalyseSaving(true)
    const combined = [
      analyseWhy.trim()   && `Why wrong:\n${analyseWhy.trim()}`,
      analyseHowFix.trim() && `How to fix:\n${analyseHowFix.trim()}`,
    ].filter(Boolean).join("\n\n")
    try {
      const existing = selected.user_reflection_notes?.trim() || ''
      const merged = existing ? `${existing}\n\n---\n\n${combined}` : combined
      await patch(selected.id, { user_reflection_notes: merged })
      setSelected(s => s ? { ...s, user_reflection_notes: merged } : s)
      setAnalyseEditing(false)
      showToast("Analysis saved")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save analysis")
    } finally {
      setAnalyseSaving(false)
    }
  }

  const sendChat = async () => {
    if (!selected || !chatInput.trim() || chatLoading) return
    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() }
    setChatHistory(h => [...h, userMsg])
    setChatInput("")
    setChatLoading(true)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    try {
      const res = await fetch(`/api/error-book/${selected.id}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ message: userMsg.content, history: chatHistory }),
      })
      if (res.ok) {
        const data = await res.json() as { reply: string }
        setChatHistory(h => [...h, { role: "assistant", content: data.reply }])
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
      }
    } finally { setChatLoading(false) }
  }

  const scheduleReview = async (rating: number) => {
    if (!selected) return
    setScheduling(true)
    try {
      const res = await fetch("/api/error-book/schedule-review", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ error_id: selected.id, algorithm: algo, rating }),
      })
      if (res.ok) {
        const data = await res.json() as { next_review_time: string; interval_days: number }
        showToast(`Next review in ${data.interval_days} day(s) — ${ALGO_LABELS[algo]}`)
        setSelected(prev => prev ? { ...prev, next_review_time: data.next_review_time } : prev)
        void load()
        dispatchErrorBookChanged()
      }
    } finally { setScheduling(false) }
  }

  const isDue = (rec: ErrorRecord) => !rec.next_review_time || new Date(rec.next_review_time) <= new Date()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">

        {/* Page header + tabs */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Error Log</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Track wrong answers · analyse mistakes · schedule reviews
            </p>
          </div>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-sm font-medium shadow-sm">
            {(["list", "patterns", "schedule"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 transition ${tab === t
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"}`}
              >
                {t === "list" ? "Error List" : t === "patterns" ? "Error Patterns" : "Schedule Review"}
              </button>
            ))}
          </div>
        </div>

        {/* TAB — Error List */}
        {tab === "list" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">

            <div className="lg:col-span-2 space-y-3">

              {/* Filter tabs */}
              <div className="flex gap-1">
                {(["all", "open", "mastered", "due"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setSelected(null) }}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${filter === f
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Error list */}
              {loading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : errors.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-10 text-center text-sm text-gray-500">
                  No errors in this filter.
                </div>
              ) : (
                <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-0.5">
                  {Array.from(groupErrorsByQuestion(errors).values()).map(group => {
                    const e = group.errors.find(err => err.id === group.mostRecentId) || group.errors[0]
                    const due = isDue(e)
                    const active = selected?.id === e.id
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className={`w-full text-left rounded-xl border p-3.5 transition ${active
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm"
                          : "border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-700"}`}
                      >
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <CategoryPill label={e.category_label ?? e.error_category ?? "Uncategorised"} colorHex={e.category_color} />
                          {group.count > 1 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              {group.count}× attempts
                            </span>
                          )}
                          {due && !e.is_mastered && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">Due</span>
                          )}
                          {e.is_mastered && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">✓ Mastered</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                          {e.question_stem ?? "(no question text)"}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {[e.topic, e.source_exam, e.year && String(e.year), new Date(e.first_wrong_time).toLocaleDateString()].filter(Boolean).join(" · ")}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              {!selected ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400">
                  Select an error on the left to view details
                </div>
              ) : (
                <div className="space-y-4">

                  {/* Header card */}
                  <Card
                    title={selected.question_stem ?? "(no question)"}
                    subtitle={[selected.topic, selected.source_exam, selected.year && String(selected.year), `Reviewed ${selected.review_count}×`].filter(Boolean).join(" · ")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryPill label={selected.category_label ?? selected.error_category ?? "Uncategorised"} colorHex={selected.category_color} />
                      {selected.next_review_time && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Next review: <span className="font-medium text-indigo-600 dark:text-indigo-400">{new Date(selected.next_review_time).toLocaleDateString()}</span>
                        </span>
                      )}
                      <div className="ml-auto flex gap-2">
                        {!selected.is_mastered && (
                          <Button variant="secondary" onClick={() => markMastered(selected)}>Mark Mastered</Button>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Wrong / Correct answers */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/10">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Your wrong answer</p>
                      <p className="text-sm whitespace-pre-wrap text-rose-900 dark:text-rose-100">{selected.wrong_answer}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Correct answer</p>
                      <p className="text-sm whitespace-pre-wrap text-emerald-900 dark:text-emerald-100">{selected.correct_answer_snapshot || "—"}</p>
                      {selected.system_explanation && (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap border-t border-emerald-200 dark:border-emerald-700 pt-2">{selected.system_explanation}</p>
                      )}
                    </div>
                  </div>

                  {/* Analyse Mistake */}
                  <Card
                    title="Analyse Mistake"
                    subtitle="Reflect on why the error happened and how to prevent it next time"
                  >
                    <div className="space-y-4">
                      {!analyseEditing && (
                        analyseWhy || analyseHowFix ? (
                          <div className="space-y-3">
                            {analyseWhy && (
                              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Why was this wrong?</h3>
                                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analyseWhy}</p>
                              </div>
                            )}
                            {analyseHowFix && (
                              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">How can I avoid it next time?</h3>
                                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analyseHowFix}</p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button variant="secondary" onClick={() => setAnalyseEditing(true)}>Edit Reflection</Button>
                            </div>
                          </div>
                        ) : (
                          /* Nothing filled yet */
                          <button
                            onClick={() => setAnalyseEditing(true)}
                            className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 py-5 text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition"
                          >
                            + Click to reflect on this mistake
                          </button>
                        )
                      )}

                      {analyseEditing && (
                        <div className="space-y-3">
                          <div>
                            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                              </svg>
                              Why was this wrong?
                            </label>
                            <textarea
                              rows={4}
                              value={analyseWhy}
                              onChange={e => setAnalyseWhy(e.target.value)}
                              placeholder="e.g. I misread the question and skipped the economic angle"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                            />
                          </div>
                          <div>
                            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                              </svg>
                              How can I avoid it next time?
                            </label>
                            <textarea
                              rows={4}
                              value={analyseHowFix}
                              onChange={e => setAnalyseHowFix(e.target.value)}
                              placeholder="e.g. Underline command words, plan two economic factors first"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={saveAnalysis} disabled={analyseSaving || (!analyseWhy.trim() && !analyseHowFix.trim())}>
                              {analyseSaving ? "Saving…" : "Save Reflection"}
                            </Button>
                            <Button variant="secondary" onClick={() => setAnalyseEditing(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}

                      {/* AI Chat */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Not sure why? Ask the AI tutor</p>
                        {chatHistory.length > 0 && (
                          <div className="max-h-52 overflow-y-auto space-y-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 border border-gray-200 dark:border-gray-700">
                            {chatHistory.map((m, i) => (
                              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm ${m.role === "user"
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200"}`}>
                                  {m.content}
                                </div>
                              </div>
                            ))}
                            {chatLoading && (
                              <div className="flex justify-start">
                                <div className="rounded-xl px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm text-gray-400">Thinking…</div>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat() } }}
                            placeholder="Ask why you got it wrong…"
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                          />
                          <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>Send</Button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Error Category */}
                  <Card title="Error Category" subtitle="Classify this mistake to track patterns over time">
                    <div className="space-y-3">
                      {!editingCategory ? (
                        <div className="flex items-center gap-3">
                          <CategoryPill label={selected.category_label ?? selected.error_category ?? "Uncategorised"} colorHex={selected.category_color} />
                          <button
                            onClick={() => setEditingCategory(true)}
                            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                            </svg>
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Text box for context / AI hint */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Describe why you made this mistake <span className="text-gray-400">(optional — helps AI suggest a category)</span>
                            </label>
                            <textarea
                              rows={3}
                              value={categoryNote}
                              onChange={e => setCategoryNote(e.target.value)}
                              placeholder="e.g. I forgot the formula, or I mixed up two concepts…"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                            />
                            <Button
                              variant="ghost"
                              onClick={aiSuggestCategory}
                              disabled={categoryAiLoading}
                              className="flex items-center gap-1.5 text-xs"
                            >
                              {categoryAiLoading ? (
                                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                                </svg>
                              )}
                              {categoryAiLoading ? "Thinking…" : "AI Suggest Category"}
                            </Button>
                          </div>

                          {/* Category grid */}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {categories.map(cat => {
                              const active = selected.error_category_id === cat.id
                              return (
                                <button
                                  key={cat.id}
                                  onClick={() => changeCategory(selected, cat)}
                                  style={active ? { backgroundColor: cat.color_hex + "22", color: cat.color_hex, borderColor: cat.color_hex + "88" } : undefined}
                                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${active
                                    ? ""
                                    : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"}`}
                                >
                                  {cat.label}
                                </button>
                              )
                            })}
                          </div>

                          {/* + New Category inline form */}
                          {!showNewCatForm ? (
                            <button
                              onClick={() => setShowNewCatForm(true)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                            >
                              + New Category
                            </button>
                          ) : (
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Create new category</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newCatLabel}
                                  onChange={e => setNewCatLabel(e.target.value)}
                                  placeholder="Category name…"
                                  maxLength={100}
                                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                                />
                                <input
                                  type="color"
                                  value={newCatColor}
                                  onChange={e => setNewCatColor(e.target.value)}
                                  className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0.5 dark:border-gray-600"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => createAndSelectCategory(selected)} disabled={newCatSaving || !newCatLabel.trim()}>
                                  {newCatSaving ? "Saving…" : "Create & Select"}
                                </Button>
                                <Button variant="ghost" onClick={() => { setShowNewCatForm(false); setNewCatLabel(""); setNewCatColor("#6B7280") }}>Cancel</Button>
                              </div>
                            </div>
                          )}

                          <Button variant="ghost" onClick={() => { setEditingCategory(false); setCategoryNote("") }}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Schedule Review */}
                  <Card title="Schedule Review" subtitle="Pick an algorithm and rate your recall to set the next review date">
                    <div className="space-y-4">
                      {selected.next_review_time && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Next review: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{new Date(selected.next_review_time).toLocaleDateString()}</span>
                        </p>
                      )}

                      {/* Algorithm picker */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Algorithm</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                          {(["sm2", "fsrs", "simple", "leitner"] as SpacedRepAlgo[]).map(a => (
                            <button
                              key={a}
                              onClick={() => setAlgo(a)}
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${algo === a
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"}`}
                            >
                              {ALGO_LABELS[a]}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{ALGO_DESC[algo]}</p>
                      </div>

                      {/* Rating */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Your recall rating</label>
                        <div className="flex gap-2">
                          {([
                            { r: 1, label: "Again" },
                            { r: 2, label: "Hard" },
                            { r: 3, label: "Good" },
                            { r: 4, label: "Easy" },
                          ]).map(({ r, label }) => (
                            <button
                              key={r}
                              onClick={() => setDetailScheduleRating(r)}
                              className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${detailScheduleRating === r
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button onClick={() => scheduleReview(detailScheduleRating)} disabled={scheduling}>
                        {scheduling ? "Saving…" : "Schedule Next Review"}
                      </Button>
                    </div>
                  </Card>

                  {/* Reflection note */}
                  <Card title="Reflection Notes" subtitle="Personal notes — not shared">
                    <div className="space-y-3">
                      <textarea
                        rows={4}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="e.g. Why did I get this wrong? How can I avoid it next time?"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                      <Button onClick={saveNotes} disabled={savingNotes}>
                        {savingNotes ? "Saving…" : "Save Notes"}
                      </Button>
                    </div>
                  </Card>

                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB — Error Patterns */}
        {tab === "patterns" && (
          <div className="space-y-4">
            {!patterns ? (
              <div className="py-16 text-center text-sm text-gray-400">Loading patterns…</div>
            ) : (
              <>
                <Card title="Errors — last 28 days" subtitle="Daily count of new wrong answers">
                  <WeeklyBars data={patterns.weekly} />
                </Card>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card title="By Error Category" subtitle="Open (unmastered) errors">
                    <div className="space-y-3">
                      {patterns.by_category.length === 0
                        ? <p className="text-sm text-gray-400">No open errors.</p>
                        : (() => {
                            const mx = Math.max(...patterns.by_category.map(c => c.count), 1)
                            return patterns.by_category.map(c => {
                              const cat = categories.find(x => x.slug === c.error_category)
                              const label = c.category_label ?? c.error_category ?? "Uncategorised"
                              return <HorizBar key={c.error_category ?? "unknown"} label={label} count={c.count} max={mx} colorHex={cat?.color_hex} />
                            })
                          })()
                      }
                    </div>
                  </Card>

                  <Card title="By Topic" subtitle="Top 10 topics with most open errors">
                    <div className="space-y-3">
                      {patterns.by_topic.length === 0
                        ? <p className="text-sm text-gray-400">No open errors.</p>
                        : (() => {
                            const mx = Math.max(...patterns.by_topic.map(t => t.count), 1)
                            return patterns.by_topic.map(t => (
                              <HorizBar key={t.topic} label={t.topic} count={t.count} max={mx} colorHex="#6366f1" />
                            ))
                          })()
                      }
                    </div>
                  </Card>
                </div>

                {/* Insight */}
                {patterns.by_category.length > 0 && (() => {
                  const top = patterns.by_category[0]
                  const cat = categories.find(x => x.slug === top.error_category)
                  const label = top.category_label ?? top.error_category ?? "Uncategorised"
                  const hex   = cat?.color_hex ?? "#6B7280"
                  return (
                    <div className="rounded-xl border p-4" style={{ backgroundColor: hex + "11", borderColor: hex + "44" }}>
                      <p className="text-sm font-semibold" style={{ color: hex }}>
                        Most common: {label} ({top.count} error{top.count !== 1 ? "s" : ""})
                      </p>
                      <p className="mt-1 text-xs opacity-80" style={{ color: hex }}>
                        Review and categorise your errors to track patterns and improve.
                      </p>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {/* TAB — Schedule Review */}
        {tab === "schedule" && (() => {
          const nonMastered = errors.filter(e => !e.is_mastered)
          const dueItems = nonMastered.filter(e => isDue(e))
          const upcomingItems = nonMastered
            .filter(e => !isDue(e) && e.next_review_time)
            .sort((a, b) => new Date(a.next_review_time!).getTime() - new Date(b.next_review_time!).getTime())

          return (
            <div className="space-y-6">
              {/* Algorithm picker */}
              <Card title="Spaced Repetition Algorithm" subtitle="Choose which algorithm to use when scheduling reviews">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  {(["sm2", "fsrs", "simple", "leitner"] as SpacedRepAlgo[]).map(a => (
                    <button
                      key={a}
                      onClick={() => setAlgo(a)}
                      className={`rounded-xl border p-4 text-left transition ${algo === a
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900"}`}
                    >
                      <p className={`text-sm font-semibold mb-1 ${algo === a ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-200"}`}>{ALGO_LABELS[a]}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{ALGO_DESC[a]}</p>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Full review list */}
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {nonMastered.length} error{nonMastered.length !== 1 ? "s" : ""} tracked
                  </span>
                  {dueItems.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                      {dueItems.length} due now
                    </span>
                  )}
                  {dueItems.length === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      All caught up
                    </span>
                  )}
                </div>

                {nonMastered.length === 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No errors tracked yet.</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Wrong answers from quizzes will appear here automatically.</p>
                  </div>
                )}

                {/* Due items */}
                {dueItems.map(e => (
                  <ScheduleRow
                    key={e.id}
                    e={e}
                    algo={algo}
                    scheduling={scheduling}
                    selected={selected}
                    setSelected={setSelected}
                    scheduleReview={scheduleReview}
                    isDue={true}
                  />
                ))}

                {/* Upcoming items */}
                {upcomingItems.map(e => (
                  <ScheduleRow
                    key={e.id}
                    e={e}
                    algo={algo}
                    scheduling={scheduling}
                    selected={selected}
                    setSelected={setSelected}
                    scheduleReview={scheduleReview}
                    isDue={false}
                  />
                ))}
              </div>
            </div>
          )
        })()}

      </main>
    </div>
  )
}
