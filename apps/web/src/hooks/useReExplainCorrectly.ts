import { useCallback, useEffect, useState } from "react"

export interface ReExplainItem {
  id: string
  prompt: string
  correctAnswer: string
  concept: string
}

export type ExplanationStatus = "idle" | "evaluating" | "aligned" | "needs_review" | "skipped"

export interface ExplanationResult {
  status: ExplanationStatus
  feedback: string
  confidence?: number
  gaps?: string[]
}

export interface UseReExplainCorrectlyResult {
  items: ReExplainItem[]
  selectedId: string
  setSelectedId: (id: string) => void
  explanation: string
  setExplanation: (text: string) => void
  result: ExplanationResult
  loading: boolean
  submit: () => Promise<void>
  markReviewLater: () => void
  sampleMode: boolean
}

export function useReExplainCorrectly(): UseReExplainCorrectlyResult {
  const [items, setItems] = useState<ReExplainItem[]>([])
  const [selectedId, setSelectedIdState] = useState<string>("")
  const [explanation, setExplanation] = useState("")
  const [result, setResult] = useState<ExplanationResult>({ status: "idle", feedback: "" })
  const [loading, setLoading] = useState(true)
  const [sampleMode, setSampleMode] = useState(false)

  // pull the user's open errors from the server, falling back to baked-in samples if empty/offline
  const loadErrors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/error-book?filter=open&limit=100", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load errors")

      const data = await res.json() as {
        errors: Array<{
          id: string
          question_stem: string | null
          correct_answer_snapshot: string | null
          topic: string | null
          wrong_answer: string
        }>
      }

      const errors = data.errors ?? []

      if (errors.length === 0) {
        setSampleMode(true)
        const sampleItems: ReExplainItem[] = [
          {
            id: "sample-1",
            prompt: "Re-explain Newton's Third Law in your own words.",
            correctAnswer: "For every action force there is an equal and opposite reaction force acting on a different body.",
            concept: "Mechanics",
          },
          {
            id: "sample-2",
            prompt: "Explain why the acceleration is zero at the top of the projectile's path.",
            correctAnswer: "At the top, velocity in the vertical direction is zero but gravity still acts downward with g; acceleration is constant at -9.8 m/s² throughout the flight.",
            concept: "Kinematics",
          },
        ]
        setItems(sampleItems)
        setSelectedIdState(sampleItems[0].id)
      } else {
        setSampleMode(false)
        const mapped: ReExplainItem[] = errors.map(e => ({
          id: e.id,
          prompt: e.question_stem
            ? `Re-explain in your own words: ${e.question_stem}`
            : "Re-explain the correct answer in your own words.",
          correctAnswer: e.correct_answer_snapshot ?? "(no answer recorded)",
          concept: e.topic ?? "General",
        }))
        setItems(mapped)
        setSelectedIdState(mapped[0].id)
      }
    } catch {
      setSampleMode(true)
      const sampleItems: ReExplainItem[] = [
        {
          id: "sample-1",
          prompt: "Re-explain Newton's Third Law in your own words.",
          correctAnswer: "For every action force there is an equal and opposite reaction force acting on a different body.",
          concept: "Mechanics",
        },
      ]
      setItems(sampleItems)
      setSelectedIdState(sampleItems[0].id)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadErrors() }, [loadErrors])

  function setSelectedId(id: string) {
    setSelectedIdState(id)
    setExplanation("")
    setResult({ status: "idle", feedback: "" })
  }

  // grade the user's re-explanation: in sample mode by keyword overlap, otherwise via the ai endpoint
  async function submit() {
    if (!selectedId || !explanation.trim()) return

    if (sampleMode) {
      const current = items.find(i => i.id === selectedId)
      if (!current) return
      const needles = current.correctAnswer
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 4)
      const unique = Array.from(new Set(needles))
      const lower = explanation.toLowerCase()
      const hits = unique.filter(w => lower.includes(w))
      const ok = hits.length >= Math.max(2, Math.ceil(unique.length * 0.25))
      setResult(
        ok
          ? { status: "aligned", feedback: "Your explanation aligns with the correct answer." }
          : { status: "needs_review", feedback: "This needs another pass. Re-read the correct answer and try again." }
      )
      return
    }

    setResult({ status: "evaluating", feedback: "Checking with AI…" })

    try {
      const res = await fetch("/api/error-book/re-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ error_id: selectedId, user_explanation: explanation }),
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const data = await res.json() as {
        understood: boolean
        confidence: number
        feedback: string
        gaps: string[]
      }

      setResult({
        status: data.understood ? "aligned" : "needs_review",
        feedback: data.feedback,
        confidence: data.confidence,
        gaps: data.gaps,
      })

      if (data.understood) {
        void loadErrors()
      }
    } catch {
      setResult({ status: "needs_review", feedback: "AI evaluation unavailable. Please try again." })
    }
  }

  function markReviewLater() {
    setResult({ status: "skipped", feedback: "Marked to review later." })
  }

  return {
    items,
    selectedId,
    setSelectedId,
    explanation,
    setExplanation,
    result,
    loading,
    submit,
    markReviewLater,
    sampleMode,
  }
}
