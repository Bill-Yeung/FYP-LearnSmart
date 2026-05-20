import { useState } from "react"

export type ReflectionAnalysis = {
  strengths: string[]
  areas_for_improvement: string[]
  reflection_questions: string[]
  suggested_resources: string[]
  next_steps: string
  confidence_level: number
}

export type ReflectionResult = {
  original: string
  analysis: ReflectionAnalysis
  concept: string
}

type UseReflectionTeachingReturn = {
  explanation: string
  setExplanation: (text: string) => void
  concept: string
  setConcept: (text: string) => void
  targetLevel: string
  setTargetLevel: (level: string) => void
  isLoading: boolean
  result: ReflectionResult | null
  showAnalysis: boolean
  setShowAnalysis: (show: boolean) => void
  reflect: (onToast: (msg: string) => void) => Promise<void>
  reset: () => void
}

export function useReflectionTeaching(): UseReflectionTeachingReturn {
  const [explanation, setExplanation] = useState("")
  const [concept, setConcept] = useState("")
  const [targetLevel, setTargetLevel] = useState("intermediate")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ReflectionResult | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)

  // ask the server to critique the explanation and store the analysis
  const reflect = async (onToast: (msg: string) => void) => {
    if (!explanation.trim()) {
      if (onToast) onToast("Please enter an explanation")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/explanations/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          explanation: explanation.trim(),
          concept: concept.trim() || "Unspecified",
          target_level: targetLevel
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(errorData.detail || "Failed to analyze explanation")
      }

      const data = await response.json()
      setResult({
        original: explanation.trim(),
        analysis: data.analysis,
        concept: concept.trim() || "Unspecified"
      })
      setShowAnalysis(true)
      if (onToast) onToast("Analysis complete!")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error analyzing explanation. Please try again."
      if (onToast) onToast(errorMessage)
      console.error("Reflection error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setExplanation("")
    setConcept("")
    setResult(null)
    setShowAnalysis(false)
    setTargetLevel("intermediate")
  }

  return {
    explanation,
    setExplanation,
    concept,
    setConcept,
    targetLevel,
    setTargetLevel,
    isLoading,
    result,
    showAnalysis,
    setShowAnalysis,
    reflect,
    reset
  }
}
