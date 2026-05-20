import { useState } from "react"

type ReflectionResult = {
  reflection_id: string
  error_context?: string
  why_wrong: string
  avoid_next_time: string
  is_private: boolean
  saved_at: string
}

type UseAnalysisMistakeReturn = {
  errorContext: string
  setErrorContext: (value: string) => void
  whyWrong: string
  setWhyWrong: (value: string) => void
  avoidNextTime: string
  setAvoidNextTime: (value: string) => void
  isPrivate: boolean
  setIsPrivate: (value: boolean) => void
  isSaving: boolean
  result: ReflectionResult | null
  showSummary: boolean
  setShowSummary: (value: boolean) => void
  saveReflection: (onToast: (msg: string) => void) => Promise<void>
  skipReflection: (onToast: (msg: string) => void) => void
  reset: () => void
}

export function useAnalysisMistake(): UseAnalysisMistakeReturn {
  const [errorContext, setErrorContext] = useState("")
  const [whyWrong, setWhyWrong] = useState("")
  const [avoidNextTime, setAvoidNextTime] = useState("")
  const [isPrivate, setIsPrivate] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<ReflectionResult | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  // post the user's reflection to the server, fall back to a local snapshot if it fails
  const saveReflection = async (onToast: (msg: string) => void) => {
    if (!whyWrong.trim() && !avoidNextTime.trim()) {
      onToast("Please add at least one reflection before saving")
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch("/api/errors/analysis-mistake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_context: errorContext.trim() || undefined,
          why_wrong: whyWrong.trim() || undefined,
          avoid_next_time: avoidNextTime.trim() || undefined,
          is_private: isPrivate
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(errorData.detail || "Failed to save reflection")
      }

      const data = await response.json()
      setResult({
        reflection_id: data.reflection_id || `ref_${Date.now()}`,
        error_context: errorContext.trim() || undefined,
        why_wrong: whyWrong.trim(),
        avoid_next_time: avoidNextTime.trim(),
        is_private: isPrivate,
        saved_at: data.saved_at || new Date().toISOString()
      })
      setShowSummary(true)
      onToast(data.message || "Reflection saved")
    } catch (err) {
      const localResult = {
        reflection_id: `ref_${Date.now()}`,
        error_context: errorContext.trim() || undefined,
        why_wrong: whyWrong.trim(),
        avoid_next_time: avoidNextTime.trim(),
        is_private: isPrivate,
        saved_at: new Date().toISOString()
      }
      setResult(localResult)
      setShowSummary(true)
      const message = err instanceof Error ? err.message : "Saved reflection locally"
      onToast(message)
      console.error("Reflection save error:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const skipReflection = (onToast: (msg: string) => void) => {
    onToast("Reflection skipped")
    reset()
  }

  const reset = () => {
    setErrorContext("")
    setWhyWrong("")
    setAvoidNextTime("")
    setIsPrivate(true)
    setIsSaving(false)
    setResult(null)
    setShowSummary(false)
  }

  return {
    errorContext,
    setErrorContext,
    whyWrong,
    setWhyWrong,
    avoidNextTime,
    setAvoidNextTime,
    isPrivate,
    setIsPrivate,
    isSaving,
    result,
    showSummary,
    setShowSummary,
    saveReflection,
    skipReflection,
    reset
  }
}
