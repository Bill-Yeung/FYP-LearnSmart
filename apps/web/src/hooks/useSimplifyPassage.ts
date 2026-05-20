import { useCallback, useMemo, useState } from "react"
import { apiClient } from "../lib/api"
import { useComprehensionHistory, type ComprehensionHistoryRecord } from "./useComprehensionHistory"

export type RewriteLanguage = "auto" | "english" | "chinese"
export type RewriteLevel = "light" | "standard" | "strong"

export type RewriteResult = {
  original: string
  simplified: string
  language: "english" | "chinese"
  level: RewriteLevel
}

export type SimplifyPassageSnapshot = {
  passage: string
  language: RewriteLanguage
  level: RewriteLevel
  result: RewriteResult | null
  showResults: boolean
}

type SimplifyRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

type UseSimplifyPassageReturn = {
  passage: string
  setPassage: (value: string) => void
  language: RewriteLanguage
  setLanguage: (value: RewriteLanguage) => void
  level: RewriteLevel
  setLevel: (value: RewriteLevel) => void
  isLoading: boolean
  result: RewriteResult | null
  showResults: boolean
  setShowResults: (value: boolean) => void
  rewrite: (onToast: (msg: string) => void, context?: SimplifyRequestContext) => Promise<void>
  reset: () => void
  storedRewrites: ComprehensionHistoryRecord<SimplifyPassageSnapshot>[]
  restoreRewrite: (item: ComprehensionHistoryRecord<SimplifyPassageSnapshot>, onToast: (msg: string) => void) => void
  removeRewrite: (id: string) => Promise<void>
  clearRewrites: () => Promise<void>
  copy: (which: "original" | "simplified" | "both", onToast: (msg: string) => void) => Promise<void>
}

function normalizeText(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim()
}

function detectLanguage(text: string): "english" | "chinese" {
  return /[\u4e00-\u9fff]/.test(text) ? "chinese" : "english"
}

export function useSimplifyPassage(): UseSimplifyPassageReturn {
  const [passage, setPassage] = useState("")
  const [language, setLanguage] = useState<RewriteLanguage>("auto")
  const [level, setLevel] = useState<RewriteLevel>("standard")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<RewriteResult | null>(null)
  const [showResults, setShowResults] = useState(false)

  const resolvedLanguage = useMemo(() => {
    const cleaned = normalizeText(passage)
    if (!cleaned) return "english" as const
    if (language === "auto") return detectLanguage(cleaned)
    return language
  }, [passage, language])

  const snapshot = useMemo<SimplifyPassageSnapshot>(
    () => ({
      passage,
      language,
      level,
      result,
      showResults
    }),
    [language, level, passage, result, showResults]
  )

  const shouldStore = useCallback((item: SimplifyPassageSnapshot) => (
    Boolean(item.passage.trim() || item.result?.simplified.trim())
  ), [])

  const getTitle = useCallback((item: SimplifyPassageSnapshot) => (
    normalizeText(item.result?.original || item.passage).slice(0, 56) || "Untitled rewrite"
  ), [])

  const getPreview = useCallback((item: SimplifyPassageSnapshot) => (
    item.result?.simplified.trim() || normalizeText(item.passage).slice(0, 140) || "No rewrite saved yet"
  ), [])

  const getMeta = useCallback((item: SimplifyPassageSnapshot) => [
    item.level,
    item.language,
    item.result ? "Rewrite ready" : "Input saved"
  ], [])

  const {
    storedItems: storedRewrites,
    markRestoredSession,
    startNewSession,
    removeSavedItem: removeRewrite,
    clearSavedItems: clearRewrites
  } = useComprehensionHistory<SimplifyPassageSnapshot>({
    moduleKey: "simplify-passage",
    payload: snapshot,
    shouldStore,
    getTitle,
    getPreview,
    getMeta
  })

  // send the passage to the server for a rewrite at the chosen difficulty level
  const rewrite = async (onToast: (msg: string) => void, context?: SimplifyRequestContext) => {
    const original = normalizeText(passage)
    if (!original) {
      onToast("Please paste a passage first")
      return
    }

    setIsLoading(true)
    try {
      const data = await apiClient.post<Partial<RewriteResult>>(
        "/api/comprehension/simplify/rewrite",
        {
          original,
          language: resolvedLanguage,
          level,
          context
        }
      )
      const simplified = data?.simplified?.trim()
      if (!simplified) {
        throw new Error("AI did not return a simplified passage")
      }

      setResult({
        original: data?.original?.trim() || original,
        simplified,
        language: data?.language === "chinese" ? "chinese" : resolvedLanguage,
        level: data?.level === "light" || data?.level === "strong" ? data.level : level
      })
      setShowResults(true)
      onToast("Simplified version generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not simplify the passage")
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    startNewSession()
    setPassage("")
    setLanguage("auto")
    setLevel("standard")
    setResult(null)
    setShowResults(false)
  }

  const restoreRewrite = (
    item: ComprehensionHistoryRecord<SimplifyPassageSnapshot>,
    onToast: (msg: string) => void
  ) => {
    markRestoredSession(item.sessionId)
    const saved = item.payload
    setPassage(saved.passage)
    setLanguage(saved.language)
    setLevel(saved.level)
    setResult(saved.result)
    setShowResults(saved.showResults && Boolean(saved.result))
    setIsLoading(false)
    onToast("Restored saved rewrite")
  }

  const copy = async (which: "original" | "simplified" | "both", onToast: (msg: string) => void) => {
    if (!result) return
    const payload =
      which === "original"
        ? result.original
        : which === "simplified"
          ? result.simplified
          : `Original:\n${result.original}\n\nSimplified:\n${result.simplified}`

    await navigator.clipboard.writeText(payload)
    onToast(which === "both" ? "Copied original and simplified text" : `Copied ${which}`)
  }

  return {
    passage,
    setPassage,
    language,
    setLanguage,
    level,
    setLevel,
    isLoading,
    result,
    showResults,
    setShowResults,
    rewrite,
    reset,
    storedRewrites,
    restoreRewrite,
    removeRewrite,
    clearRewrites,
    copy
  }
}
