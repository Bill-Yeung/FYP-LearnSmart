import { useState } from "react"

export type SimplificationResult = {
  original: string
  simplified: string
  gradLevel: string
}

type UseSimplifyExplanationReturn = {
  explanation: string
  setExplanation: (text: string) => void
  selectedGradeLevel: string
  setSelectedGradeLevel: (level: string) => void
  isLoading: boolean
  result: SimplificationResult | null
  showComparison: boolean
  setShowComparison: (show: boolean) => void
  simplify: (onToast: (msg: string) => void) => Promise<void>
  reset: () => void
}

export function useSimplifyExplanation(): UseSimplifyExplanationReturn {
  const [explanation, setExplanation] = useState("")
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("6")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SimplificationResult | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  // send the user's explanation to the server and get a simpler version back
  const simplify = async (onToast: (msg: string) => void) => {
    if (!explanation.trim()) {
      if (onToast) onToast("Please enter an explanation to simplify")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/explanations/simplify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          explanation: explanation.trim(),
          targetGradeLevel: selectedGradeLevel,
          strictness: "gentle"
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(errorData.detail || "Failed to simplify explanation")
      }

      const data = await response.json()
      setResult({
        original: explanation.trim(),
        simplified: data.simplified,
        gradLevel: selectedGradeLevel
      })
      setShowComparison(true)
      if (onToast) onToast("Explanation simplified successfully")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error simplifying explanation. Please try again."
      if (onToast) onToast(errorMessage)
      console.error("Simplification error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setExplanation("")
    setResult(null)
    setShowComparison(false)
    setSelectedGradeLevel("6")
  }

  return {
    explanation,
    setExplanation,
    selectedGradeLevel,
    setSelectedGradeLevel,
    isLoading,
    result,
    showComparison,
    setShowComparison,
    simplify,
    reset
  }
}
