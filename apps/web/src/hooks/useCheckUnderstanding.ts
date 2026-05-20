import { useState } from "react"

export type FlaggedSegment = {
  phrase: string
  issue: string
  severity: "critical" | "major" | "minor"
  fix?: string
}

export type StyleSuggestion = {
  phrase?: string
  suggestion: string
}

export type UnderstandingResult = {
  original: string
  concept: string
  conceptDefinition?: string
  flagged: FlaggedSegment[]
  styleSuggestions: StyleSuggestion[]
  verdict: "clear" | "needs_clarification"
  confidence: number
  follow_up_questions?: string[]
}

type UseCheckUnderstandingReturn = {
  concept: string
  setConcept: (value: string) => void
  conceptDefinition: string
  setConceptDefinition: (value: string) => void
  conceptsList: Array<{ id?: string; name: string; definition?: string }>
  addConcept: (name: string) => void
  removeConcept: (index: number) => void
  updateConceptDefinitionInList: (index: number, def: string) => void
  explanation: string
  setExplanation: (value: string) => void
  strictness: string
  setStrictness: (value: string) => void
  isLoading: boolean
  result: UnderstandingResult | null
  showResults: boolean
  setShowResults: (value: boolean) => void
  checkUnderstanding: (onToast: (msg: string) => void) => Promise<void>
  submitFollowup: (question: string, answer: string, onToast: (msg: string) => void) => Promise<void>
  lookupConceptDefinition: (name: string, onToast?: (msg: string) => void) => Promise<void>
  reset: () => void
}

export function useCheckUnderstanding(): UseCheckUnderstandingReturn {
  const [concept, setConcept] = useState("")
  const [conceptDefinition, setConceptDefinition] = useState("")
  const [conceptsList, setConceptsList] = useState<Array<{ id?: string; name: string; definition?: string }>>([])
  const [explanation, setExplanation] = useState("")
  const [strictness, setStrictness] = useState("standard")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<UnderstandingResult | null>(null)
  const [showResults, setShowResults] = useState(false)

  const normalizeSeverity = (value?: string): FlaggedSegment["severity"] => {
    if (value === "critical") return "critical"
    if (value === "major") return "major"
    return "minor"
  }

  // send the user's explanation to the ai checker
  const checkUnderstanding = async (onToast: (msg: string) => void) => {
    if (!explanation.trim()) {
      onToast("Please paste your explanation first")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/explanations/check-understanding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explanation: explanation.trim(),
          concept: (conceptsList && conceptsList.length) ? (conceptsList[0].name || concept.trim() || "Unspecified concept") : (concept.trim() || "Unspecified concept"),
          conceptDefinition: (conceptsList && conceptsList.length) ? conceptsList.map(c => c.definition || c.name).join("\n\n") : (conceptDefinition.trim() || undefined),
          strictness,
          returnStyleNotes: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(errorData.detail || "Failed to check understanding")
      }

      const data = await response.json()
      const followUpQuestions = Array.isArray(data.follow_up_questions) ? data.follow_up_questions : undefined
      const flagged = Array.isArray(data.flagged)
        ? data.flagged.map((item: any) => ({
            phrase: item?.phrase || "(no phrase provided)",
            issue: item?.issue || "Unspecified issue",
            severity: normalizeSeverity(item?.severity),
            fix: item?.fix
          }))
        : []

      const styleSuggestions = Array.isArray(data.styleSuggestions)
        ? data.styleSuggestions.map((item: any) => ({
            phrase: item?.phrase,
            suggestion: item?.suggestion || item?.message || "Clarify wording"
          }))
        : []

      const verdict = (data.verdict as UnderstandingResult["verdict"]) || (flagged.length ? "needs_clarification" : "clear")
      const confidence = typeof data.confidence === "number" ? data.confidence : flagged.length ? 62 : 86

      setResult({
        original: explanation.trim(),
        concept: (conceptsList && conceptsList.length) ? (conceptsList[0].name) : (concept.trim() || data.concept || "Unspecified concept"),
        conceptDefinition: data.conceptDefinition || ((conceptsList && conceptsList.length) ? conceptsList.map(c => c.definition || c.name).join("\n\n") : conceptDefinition.trim() || undefined),
        flagged,
        styleSuggestions,
        verdict,
        confidence
        ,
        follow_up_questions: followUpQuestions
      })
      setShowResults(true)
      onToast(flagged.length ? "Flagged unclear or incorrect sections" : "No misunderstandings detected")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete understanding check"
      onToast(message)
      console.error("Understanding check error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const submitFollowup = async (question: string, answer: string, onToast: (msg: string) => void) => {
    if (!question || !answer) {
      onToast("Please provide an answer")
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch("/api/explanations/check-understanding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explanation: explanation.trim(),
          concept: (conceptsList && conceptsList.length) ? (conceptsList[0].name || concept.trim() || "Unspecified concept") : (concept.trim() || "Unspecified concept"),
          conceptDefinition: (conceptsList && conceptsList.length) ? conceptsList.map(c => c.definition || c.name).join("\n\n") : (conceptDefinition.trim() || undefined),
          strictness,
          follow_up: { question, answer },
          returnStyleNotes: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(errorData.detail || "Failed to submit follow-up answer")
      }

      const data = await response.json()
      const flagged = Array.isArray(data.flagged)
        ? data.flagged.map((item: any) => ({
            phrase: item?.phrase || "(no phrase provided)",
            issue: item?.issue || "Unspecified issue",
            severity: normalizeSeverity(item?.severity),
            fix: item?.fix
          }))
        : []

      const styleSuggestions = Array.isArray(data.styleSuggestions)
        ? data.styleSuggestions.map((item: any) => ({
            phrase: item?.phrase,
            suggestion: item?.suggestion || item?.message || "Clarify wording"
          }))
        : []

      const verdict = (data.verdict as UnderstandingResult["verdict"]) || (flagged.length ? "needs_clarification" : "clear")
      const confidence = typeof data.confidence === "number" ? data.confidence : flagged.length ? 62 : 86
      const followUpQuestions = Array.isArray(data.follow_up_questions) ? data.follow_up_questions : undefined

      setResult(prev => ({
        original: explanation.trim(),
        concept: prev?.concept || (conceptsList && conceptsList.length ? conceptsList[0].name : concept.trim() || data.concept || "Unspecified concept"),
        conceptDefinition: data.conceptDefinition || prev?.conceptDefinition || ((conceptsList && conceptsList.length) ? conceptsList.map(c => c.definition || c.name).join("\n\n") : conceptDefinition.trim() || undefined),
        flagged,
        styleSuggestions,
        verdict,
        confidence,
        follow_up_questions: followUpQuestions
      }))
      onToast("Follow-up submitted")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit follow-up"
      onToast(message)
      console.error("Follow-up submit error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const lookupConceptDefinition = async (name: string, onToast?: (msg: string) => void) => {
    const q = name.trim()
    if (!q) return

    try {
      const resp = await fetch(`/api/concepts/search?query=${encodeURIComponent(q)}`)
      if (!resp.ok) return
      const data = await resp.json().catch(() => null)
      if (!data) return

      const first = Array.isArray(data) ? data[0] : data
      const id = first?.id
      const title = first?.title || first?.name || q
      const definition = first?.description || first?.definition || first?.concept_definition

      setConceptsList(prev => {
        const idx = prev.findIndex(item => item.name.toLowerCase() === title.toLowerCase() || (id && item.id === id))
        const newItem = { id, name: title, definition: definition || undefined }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], ...newItem }
          return next
        }
        return [...prev, newItem]
      })
      if (definition) {
        setConceptDefinition(prev => {
          if (!prev || prev.trim() === "") return definition
          return `${prev}\n\nSource (${q}): ${definition}`
        })
        onToast?.("Loaded concept definition from database")
      }
    } catch (err) {
      console.debug("Concept lookup failed:", err)
    }
  }

  const reset = () => {
    setConcept("")
    setConceptDefinition("")
    setConceptsList([])
    setExplanation("")
    setStrictness("standard")
    setResult(null)
    setShowResults(false)
  }

  return {
    concept,
    setConcept,
    conceptDefinition,
    setConceptDefinition,
    conceptsList,
    addConcept: (name: string) => setConceptsList(prev => [...prev, { name }]),
    removeConcept: (index: number) => setConceptsList(prev => prev.filter((_, i) => i !== index)),
    updateConceptDefinitionInList: (index: number, def: string) => setConceptsList(prev => prev.map((it, i) => i === index ? { ...it, definition: def } : it)),
    explanation,
    setExplanation,
    strictness,
    setStrictness,
    isLoading,
    result,
    showResults,
    setShowResults,
    checkUnderstanding,
    lookupConceptDefinition,
    reset
  }
}
