import { useCallback, useMemo, useState } from "react"
import { apiClient } from "../lib/api"
import { useComprehensionHistory, type ComprehensionHistoryRecord } from "./useComprehensionHistory"

export type QuestionType = "why" | "how"
export type Difficulty = "easy" | "medium" | "hard"

export type GeneratedQuestion = {
  id: string
  type: QuestionType
  difficulty: Difficulty
  question: string
  rationale: string
  focus?: string
}

export type WhyHowSnapshot = {
  sourceText: string
  focusConcept: string
  difficulty: Difficulty
  count: number
  includeWhy: boolean
  includeHow: boolean
  questions: GeneratedQuestion[]
  showResults: boolean
}

type WhyHowRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

type UseWhyHowQuestionsReturn = {
  sourceText: string
  setSourceText: (v: string) => void
  focusConcept: string
  setFocusConcept: (v: string) => void
  detectedKeywords: string[]
  difficulty: Difficulty
  setDifficulty: (v: Difficulty) => void
  count: number
  setCount: (v: number) => void
  includeWhy: boolean
  setIncludeWhy: (v: boolean) => void
  includeHow: boolean
  setIncludeHow: (v: boolean) => void
  isLoading: boolean
  questions: GeneratedQuestion[]
  showResults: boolean
  setShowResults: (v: boolean) => void
  generate: (onToast: (msg: string) => void, context?: WhyHowRequestContext) => Promise<void>
  reset: () => void
  storedQuestionSets: ComprehensionHistoryRecord<WhyHowSnapshot>[]
  restoreQuestionSet: (item: ComprehensionHistoryRecord<WhyHowSnapshot>, onToast: (msg: string) => void) => void
  removeQuestionSet: (id: string) => Promise<void>
  clearQuestionSets: () => Promise<void>
  copyAll: (onToast: (msg: string) => void) => Promise<void>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim()
}

function pickKeywords(text: string) {
  const t = normalizeText(text)

  const hasSpaces = /\s/.test(t)
  if (!hasSpaces) {
    const chunk = t.slice(0, 24)
    return chunk ? [chunk] : []
  }

  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "as", "is", "are", "was", "were",
    "be", "been", "being", "this", "that", "these", "those", "it", "its", "they", "their", "we", "you", "i",
    "from", "by", "at", "into", "over", "under", "than", "then", "because", "therefore", "thus", "so"
  ])

  const words = t
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stop.has(word))

  const freq = new Map<string, number>()
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5)
}

export function useWhyHowQuestions(): UseWhyHowQuestionsReturn {
  const [sourceText, setSourceText] = useState("")
  const [focusConcept, setFocusConcept] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [count, setCount] = useState(6)
  const [includeWhy, setIncludeWhy] = useState(true)
  const [includeHow, setIncludeHow] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [showResults, setShowResults] = useState(false)

  const keywords = useMemo(() => pickKeywords(sourceText), [sourceText])
  const setQuestionCount = useCallback((value: number) => {
    setCount(clamp(Number(value) || 1, 1, 20))
  }, [])

  const snapshot = useMemo<WhyHowSnapshot>(
    () => ({
      sourceText,
      focusConcept,
      difficulty,
      count,
      includeWhy,
      includeHow,
      questions,
      showResults
    }),
    [count, difficulty, focusConcept, includeHow, includeWhy, questions, showResults, sourceText]
  )

  const shouldStore = useCallback((item: WhyHowSnapshot) => (
    Boolean(item.sourceText.trim() || item.focusConcept.trim() || item.questions.length)
  ), [])

  const getTitle = useCallback((item: WhyHowSnapshot) => (
    item.focusConcept.trim() || normalizeText(item.sourceText).slice(0, 56) || "Untitled question set"
  ), [])

  const getPreview = useCallback((item: WhyHowSnapshot) => (
    item.questions[0]?.question || normalizeText(item.sourceText).slice(0, 140) || "No question text saved yet"
  ), [])

  const getMeta = useCallback((item: WhyHowSnapshot) => {
    const types = [
      item.includeWhy ? "Why" : "",
      item.includeHow ? "How" : ""
    ].filter(Boolean).join(" + ")

    return [
      item.difficulty,
      types || "No type selected",
      `${item.questions.length} questions`
    ]
  }, [])

  const {
    storedItems: storedQuestionSets,
    markRestoredSession,
    startNewSession,
    removeSavedItem: removeQuestionSet,
    clearSavedItems: clearQuestionSets
  } = useComprehensionHistory<WhyHowSnapshot>({
    moduleKey: "why-how-questions",
    payload: snapshot,
    shouldStore,
    getTitle,
    getPreview,
    getMeta
  })

  // call the ai to generate a batch of why/how questions and clean up the response
  const generate = async (onToast: (msg: string) => void, context?: WhyHowRequestContext) => {
    const text = normalizeText(sourceText)
    if (!text) {
      onToast("Paste some source content first")
      return
    }
    if (!includeWhy && !includeHow) {
      onToast("Select at least one question type")
      return
    }
    const requestedCount = Number(count) || 6
    if (requestedCount > 20) {
      onToast("Choose 20 questions or fewer")
      setQuestionCount(20)
      return
    }
    const normalizedCount = clamp(requestedCount, 1, 20)
    if (includeWhy && includeHow && normalizedCount < 2) {
      onToast("Choose at least 2 questions when both Why and How are selected")
      return
    }

    setIsLoading(true)
    try {
      const data = await apiClient.post<{ questions?: Array<Partial<GeneratedQuestion>> }>(
        "/api/comprehension/why-how/generate",
        {
          sourceText: text,
          focusConcept: focusConcept.trim(),
          difficulty,
          count: normalizedCount,
          includeWhy,
          includeHow,
          context
        }
      )
      const normalized: GeneratedQuestion[] = (data?.questions ?? [])
        .filter((item) => item.question && item.type)
        .slice(0, normalizedCount)
        .map((item, index) => ({
          id: `${item.type || "question"}-${index}-${Date.now()}`,
          type: item.type === "how" ? "how" : "why" as QuestionType,
          difficulty: item.difficulty === "easy" || item.difficulty === "hard" ? item.difficulty : difficulty,
          question: item.question?.trim() || "",
          rationale: item.rationale?.trim() || "",
          focus: item.focus?.trim() || undefined
        }))

      if (!normalized.length) {
        throw new Error("AI did not return any questions")
      }

      setQuestions(normalized)
      setShowResults(true)
      onToast(`Generated ${normalized.length} question(s)`)
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate questions")
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    startNewSession()
    setSourceText("")
    setFocusConcept("")
    setDifficulty("medium")
    setCount(6)
    setIncludeWhy(true)
    setIncludeHow(true)
    setQuestions([])
    setShowResults(false)
  }

  const restoreQuestionSet = (
    item: ComprehensionHistoryRecord<WhyHowSnapshot>,
    onToast: (msg: string) => void
  ) => {
    markRestoredSession(item.sessionId)
    const saved = item.payload
    setSourceText(saved.sourceText)
    setFocusConcept(saved.focusConcept)
    setDifficulty(saved.difficulty)
    setCount(saved.count)
    setIncludeWhy(saved.includeWhy)
    setIncludeHow(saved.includeHow)
    setQuestions(saved.questions)
    setShowResults(saved.showResults && saved.questions.length > 0)
    setIsLoading(false)
    onToast("Restored saved question set")
  }

  // copy every generated question + rationale to the clipboard
  const copyAll = async (onToast: (msg: string) => void) => {
    if (!questions.length) return
    await navigator.clipboard.writeText(
      questions
        .map((question, index) => `${index + 1}. ${question.question}\n${question.rationale}`.trim())
        .join("\n\n")
    )
    onToast("Copied questions")
  }

  return {
    sourceText,
    setSourceText,
    focusConcept,
    setFocusConcept,
    detectedKeywords: keywords,
    difficulty,
    setDifficulty,
    count,
    setCount: setQuestionCount,
    includeWhy,
    setIncludeWhy,
    includeHow,
    setIncludeHow,
    isLoading,
    questions,
    showResults,
    setShowResults,
    generate,
    reset,
    storedQuestionSets,
    restoreQuestionSet,
    removeQuestionSet,
    clearQuestionSets,
    copyAll
  }
}
