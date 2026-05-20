import { useCallback, useMemo, useState } from "react"
import { apiClient } from "../lib/api"
import { useComprehensionHistory, type ComprehensionHistoryRecord } from "./useComprehensionHistory"

export type OutputStyle = "analogy" | "metaphor" | "both"
export type AudienceLevel = "beginner" | "intermediate" | "advanced"
export type OutputLanguage = "auto" | "english" | "chinese"

export type AnalogyDomain =
  | "everyday"
  | "cooking"
  | "sports"
  | "travel"
  | "music"
  | "nature"
  | "tech"
  | "money"

type AnalogyRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

export type MappingPair = { left: string; right: string }

export type AnalogyResult = {
  id: string
  kind: "analogy" | "metaphor"
  domain: AnalogyDomain
  title: string
  text: string
  mapping: MappingPair[]
  notes: string[]
  language: "english" | "chinese"
  audience: AudienceLevel
}

export type AnalogiesMetaphorsSnapshot = {
  concept: string
  context: string
  domain: AnalogyDomain
  audience: AudienceLevel
  style: OutputStyle
  language: OutputLanguage
  results: AnalogyResult[]
  showResults: boolean
}

type UseAnalogiesReturn = {
  concept: string
  setConcept: (v: string) => void
  context: string
  setContext: (v: string) => void
  domain: AnalogyDomain
  setDomain: (v: AnalogyDomain) => void
  audience: AudienceLevel
  setAudience: (v: AudienceLevel) => void
  style: OutputStyle
  setStyle: (v: OutputStyle) => void
  language: OutputLanguage
  setLanguage: (v: OutputLanguage) => void
  isLoading: boolean
  results: AnalogyResult[]
  showResults: boolean
  setShowResults: (v: boolean) => void
  generate: (onToast: (m: string) => void, source?: AnalogyRequestContext) => Promise<void>
  reset: () => void
  storedExplanations: ComprehensionHistoryRecord<AnalogiesMetaphorsSnapshot>[]
  restoreExplanation: (item: ComprehensionHistoryRecord<AnalogiesMetaphorsSnapshot>, onToast: (m: string) => void) => void
  removeExplanation: (id: string) => Promise<void>
  clearExplanations: () => Promise<void>
  copy: (id: string, onToast: (m: string) => void) => Promise<void>
  copyAll: (onToast: (m: string) => void) => Promise<void>
}

// pick chinese if the text contains cjk characters, else english
function detectLanguage(text: string): "english" | "chinese" {
  return /[\u4e00-\u9fff]/.test(text) ? "chinese" : "english"
}

export function useAnalogiesMetaphors(): UseAnalogiesReturn {
  const [concept, setConcept] = useState("")
  const [context, setContext] = useState("")
  const [domain, setDomain] = useState<AnalogyDomain>("everyday")
  const [audience, setAudience] = useState<AudienceLevel>("beginner")
  const [style, setStyle] = useState<OutputStyle>("both")
  const [language, setLanguage] = useState<OutputLanguage>("auto")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<AnalogyResult[]>([])
  const [showResults, setShowResults] = useState(false)

  const resolvedLanguage = useMemo(() => {
    const combined = `${concept}\n${context}`.trim()
    if (!combined) return "english" as const
    if (language === "auto") return detectLanguage(combined)
    return language
  }, [concept, context, language])

  const snapshot = useMemo<AnalogiesMetaphorsSnapshot>(
    () => ({
      concept,
      context,
      domain,
      audience,
      style,
      language,
      results,
      showResults
    }),
    [audience, concept, context, domain, language, results, showResults, style]
  )

  const shouldStore = useCallback((item: AnalogiesMetaphorsSnapshot) => (
    Boolean(item.concept.trim() || item.context.trim() || item.results.length)
  ), [])

  const getTitle = useCallback((item: AnalogiesMetaphorsSnapshot) => (
    item.concept.trim() || item.results[0]?.title || "Untitled explanation"
  ), [])

  const getPreview = useCallback((item: AnalogiesMetaphorsSnapshot) => (
    item.results[0]?.text || item.context.trim() || "No explanation text saved yet"
  ), [])

  const getMeta = useCallback((item: AnalogiesMetaphorsSnapshot) => [
    item.domain,
    item.audience,
    `${item.results.length} results`
  ], [])

  const {
    storedItems: storedExplanations,
    markRestoredSession,
    startNewSession,
    removeSavedItem: removeExplanation,
    clearSavedItems: clearExplanations
  } = useComprehensionHistory<AnalogiesMetaphorsSnapshot>({
    moduleKey: "analogies-metaphors",
    payload: snapshot,
    shouldStore,
    getTitle,
    getPreview,
    getMeta
  })

  // ask the server for analogies, then normalize each result before storing
  const generate = async (onToast: (m: string) => void, source?: AnalogyRequestContext) => {
    const trimmedConcept = concept.trim()
    if (!trimmedConcept) {
      onToast("Enter a concept first")
      return
    }

    setIsLoading(true)
    try {
      const data = await apiClient.post<{ results?: Array<Partial<AnalogyResult>> }>(
        "/api/comprehension/analogies/generate",
        {
          concept: trimmedConcept,
          context: context.trim(),
          domain,
          audience,
          style,
          language: resolvedLanguage,
          source
        }
      )
      const normalized: AnalogyResult[] = (data?.results ?? [])
        .filter((item) => item.title && item.text)
        .map((item, index) => ({
          id: item.id || `${item.kind || "analogy"}-${index}-${Date.now()}`,
          kind: item.kind === "metaphor" ? "metaphor" : "analogy" as AnalogyResult["kind"],
          domain,
          title: item.title?.trim() || "",
          text: item.text?.trim() || "",
          mapping: Array.isArray(item.mapping)
            ? item.mapping
                .filter((pair): pair is MappingPair => Boolean(pair?.left && pair?.right))
                .map((pair) => ({ left: pair.left, right: pair.right }))
            : [],
          notes: Array.isArray(item.notes) ? item.notes.filter(Boolean).map((note) => String(note)) : [],
          language: item.language === "chinese" ? "chinese" : resolvedLanguage,
          audience: item.audience === "advanced" || item.audience === "intermediate" ? item.audience : audience
        }))

      if (!normalized.length) {
        throw new Error("AI did not return any analogies or metaphors")
      }

      setResults(normalized)
      setShowResults(true)
      onToast("Generated analogies and metaphors")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate analogies")
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    startNewSession()
    setConcept("")
    setContext("")
    setDomain("everyday")
    setAudience("beginner")
    setStyle("both")
    setLanguage("auto")
    setResults([])
    setShowResults(false)
  }

  const restoreExplanation = (
    item: ComprehensionHistoryRecord<AnalogiesMetaphorsSnapshot>,
    onToast: (m: string) => void
  ) => {
    markRestoredSession(item.sessionId)
    const saved = item.payload
    setConcept(saved.concept)
    setContext(saved.context)
    setDomain(saved.domain)
    setAudience(saved.audience)
    setStyle(saved.style)
    setLanguage(saved.language)
    setResults(saved.results)
    setShowResults(saved.showResults && saved.results.length > 0)
    setIsLoading(false)
    onToast("Restored saved explanation")
  }

  // copy a single analogy to the clipboard in a readable text layout
  const copy = async (id: string, onToast: (m: string) => void) => {
    const item = results.find((result) => result.id === id)
    if (!item) return
    await navigator.clipboard.writeText(
      [
        item.title,
        "",
        item.text,
        "",
        ...item.mapping.map((pair) => `${pair.left} ↔ ${pair.right}`),
        "",
        ...item.notes
      ].join("\n")
    )
    onToast("Copied result")
  }

  const copyAll = async (onToast: (m: string) => void) => {
    if (!results.length) return
    await navigator.clipboard.writeText(
      results
        .map((item) => [item.title, item.text, ...item.notes].join("\n"))
        .join("\n\n")
    )
    onToast("Copied all results")
  }

  return {
    concept,
    setConcept,
    context,
    setContext,
    domain,
    setDomain,
    audience,
    setAudience,
    style,
    setStyle,
    language,
    setLanguage,
    isLoading,
    results,
    showResults,
    setShowResults,
    generate,
    reset,
    storedExplanations,
    restoreExplanation,
    removeExplanation,
    clearExplanations,
    copy,
    copyAll
  }
}
