import { useState } from "react"

export type ErrorCategory = {
  subject?: string
  question_type?: string
  cause: "conceptual_misunderstanding" | "miscalculation" | "time_pressure" | "careless_mistake" | "incomplete_knowledge" | "other"
  additional_tags?: string[]
}

export type ErrorRecord = {
  id?: string
  description: string
  context?: string
  suggested_category: ErrorCategory
  user_confirmed: boolean
}

export type CategorizeErrorResult = {
  error_id: string
  original_description: string
  suggested_category: ErrorCategory
  analytics_updated: boolean
}

type UseCategorizeErrorReturn = {
  errorDescription: string
  setErrorDescription: (value: string) => void
  errorContext: string
  setErrorContext: (value: string) => void
  isAnalyzing: boolean
  result: CategorizeErrorResult | null
  showResults: boolean
  setShowResults: (value: boolean) => void
  selectedSubject: string
  setSelectedSubject: (value: string) => void
  selectedQuestionType: string
  setSelectedQuestionType: (value: string) => void
  selectedCause: ErrorCategory["cause"]
  setSelectedCause: (value: ErrorCategory["cause"]) => void
  additionalTags: string[]
  setAdditionalTags: (value: string[]) => void
  usingSampleData: boolean
  analyzeError: (onToast: (msg: string) => void) => Promise<void>
  confirmCategory: (onToast: (msg: string) => void) => Promise<void>
  reset: () => void
}

export function useCategorizeError(): UseCategorizeErrorReturn {
  const [errorDescription, setErrorDescription] = useState("")
  const [errorContext, setErrorContext] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<CategorizeErrorResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  
  const [selectedSubject, setSelectedSubject] = useState("")
  const [selectedQuestionType, setSelectedQuestionType] = useState("")
  const [selectedCause, setSelectedCause] = useState<ErrorCategory["cause"]>("conceptual_misunderstanding")
  const [additionalTags, setAdditionalTags] = useState<string[]>([])
  const [usingSampleData, setUsingSampleData] = useState(false)

  // local fallback: guess the category from keywords in the description when the api fails
  const buildSampleSuggestion = () => {
    const lower = errorDescription.toLowerCase()
    const cause: ErrorCategory["cause"] = lower.includes("misread")
      ? "careless_mistake"
      : lower.includes("time")
        ? "time_pressure"
        : lower.includes("calc") || lower.includes("equation")
          ? "miscalculation"
          : lower.includes("concept") || lower.includes("definition")
            ? "conceptual_misunderstanding"
            : "other"

    return {
      subject: lower.includes("chem") ? "Chemistry" : lower.includes("math") ? "Mathematics" : "General",
      question_type: lower.includes("essay") ? "Essay" : lower.includes("mc") ? "Multiple choice" : "Short answer",
      cause,
      additional_tags: ["sample", "auto-tag"]
    }
  }

  const analyzeError = async (onToast: (msg: string) => void) => {
    if (!errorDescription.trim()) {
      onToast("Please describe the error first")
      return
    }

    setIsAnalyzing(true)
    setUsingSampleData(false)

    try {
      const response = await fetch("/api/errors/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: errorDescription.trim(),
          context: errorContext.trim() || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(errorData.detail || "Failed to analyze error")
      }

      const data = await response.json()

      setSelectedSubject(data.suggested_category?.subject || "")
      setSelectedQuestionType(data.suggested_category?.question_type || "")
      setSelectedCause(data.suggested_category?.cause || "conceptual_misunderstanding")
      setAdditionalTags(data.suggested_category?.additional_tags || [])

      setResult({
        error_id: data.error_id || `err_${Date.now()}`,
        original_description: errorDescription.trim(),
        suggested_category: data.suggested_category,
        analytics_updated: false
      })
      setShowResults(true)
      onToast("Error analyzed - review and confirm tags")
    } catch (err) {
      const sample = buildSampleSuggestion()
      setSelectedSubject(sample.subject || "")
      setSelectedQuestionType(sample.question_type || "")
      setSelectedCause(sample.cause)
      setAdditionalTags(sample.additional_tags || [])

      setResult({
        error_id: `err_${Date.now()}`,
        original_description: errorDescription.trim(),
        suggested_category: sample,
        analytics_updated: false
      })
      setShowResults(true)
      setUsingSampleData(true)
      const message = err instanceof Error ? err.message : "Error analyzing error"
      onToast(`Using sample response (${message})`)
      console.error("Categorization error:", err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // user confirms the suggested tags — send them to the server so analytics update
  const confirmCategory = async (onToast: (msg: string) => void) => {
    if (!result) {
      onToast("No error to confirm")
      return
    }

    setIsAnalyzing(true)

    try {
      if (usingSampleData) {
        setResult(prev => prev ? { ...prev, analytics_updated: true } : null)
        onToast("Category confirmed (sample mode)")
        return
      }

      const response = await fetch("/api/errors/confirm-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_id: result.error_id,
          category: {
            subject: selectedSubject || undefined,
            question_type: selectedQuestionType || undefined,
            cause: selectedCause,
            additional_tags: additionalTags.length ? additionalTags : undefined
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(errorData.detail || "Failed to confirm category")
      }

      const data = await response.json()
      setResult(prev => prev ? { ...prev, analytics_updated: true } : null)
      onToast(data.message || "Category confirmed and analytics updated")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error confirming category"
      onToast(message)
      console.error("Confirmation error:", err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const reset = () => {
    setErrorDescription("")
    setErrorContext("")
    setResult(null)
    setShowResults(false)
    setSelectedSubject("")
    setSelectedQuestionType("")
    setSelectedCause("conceptual_misunderstanding")
    setAdditionalTags([])
    setUsingSampleData(false)
  }

  return {
    errorDescription,
    setErrorDescription,
    errorContext,
    setErrorContext,
    isAnalyzing,
    result,
    showResults,
    setShowResults,
    selectedSubject,
    setSelectedSubject,
    selectedQuestionType,
    setSelectedQuestionType,
    selectedCause,
    setSelectedCause,
    additionalTags,
    setAdditionalTags,
    usingSampleData,
    analyzeError,
    confirmCategory,
    reset
  }
}
