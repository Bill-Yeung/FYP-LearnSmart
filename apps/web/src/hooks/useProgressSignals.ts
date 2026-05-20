import { useCallback, useEffect, useMemo, useState } from "react"
import { apiClient } from "../lib/api"

export type ErrorRecord = {
  id: string
  question_stem?: string
  wrong_answer?: string
  correct_answer?: string
  next_review_time: string | null
  topic: string | null
  error_category?: string
  category_label?: string
  is_mastered: boolean
  review_count?: number
  explanation?: string
  reflection_notes?: string
}

export type TopicEntry = { topic: string; count: number }
export type CategoryEntry = { error_category: string; category_label: string; count: number }
export type WeeklyEntry = { day: string; count: number }

export type PatternStats = {
  by_topic: TopicEntry[]
  by_category: CategoryEntry[]
  weekly: WeeklyEntry[]
}

export type FlashcardScheduleItem = {
  id: string
  next_due: string | null
  status?: string
}

export type ProgressDocument = {
  id: string
  document_name: string
  subjects?: Array<{ id: string; code: string; name: string }>
}

export type LearningPathSummary = {
  id: string
  title: string
  description?: string | null
  target_concept_title?: string | null
  created_at?: string | null
}

export type ClassSummary = {
  id: string
  name: string
  description?: string | null
  course_code?: string | null
  student_count: number
}

type UseProgressSignalsReturn = {
  loading: boolean
  refresh: () => Promise<void>
  allErrors: ErrorRecord[]
  dueErrors: ErrorRecord[]
  patterns: PatternStats | null
  flashcards: FlashcardScheduleItem[]
  questionCount: number
  documentsTotal: number
  documents: ProgressDocument[]
  learningPaths: LearningPathSummary[]
  classes: ClassSummary[]
  masteredCount: number
}

export function useProgressSignals(): UseProgressSignalsReturn {
  const [loading, setLoading] = useState(true)
  const [allErrors, setAllErrors] = useState<ErrorRecord[]>([])
  const [dueErrors, setDueErrors] = useState<ErrorRecord[]>([])
  const [patterns, setPatterns] = useState<PatternStats | null>(null)
  const [flashcards, setFlashcards] = useState<FlashcardScheduleItem[]>([])
  const [questionCount, setQuestionCount] = useState(0)
  const [documents, setDocuments] = useState<ProgressDocument[]>([])
  const [documentsTotal, setDocumentsTotal] = useState(0)
  const [learningPaths, setLearningPaths] = useState<LearningPathSummary[]>([])
  const [classes, setClasses] = useState<ClassSummary[]>([])

  // load everything the progress page needs in one parallel batch, tolerating individual failures
  const refresh = useCallback(async () => {
    setLoading(true)

    const [
      patternsResult,
      allErrorsResult,
      dueErrorsResult,
      flashcardsResult,
      questionsResult,
      documentsResult,
      learningPathsResult,
      classesResult
    ] = await Promise.allSettled([
      apiClient.get<PatternStats>("/api/error-book/stats/patterns"),
      apiClient.get<{ errors?: ErrorRecord[] }>("/api/error-book?filter=all&limit=200"),
      apiClient.get<{ errors?: ErrorRecord[] }>("/api/error-book?filter=due&limit=200"),
      apiClient.get<FlashcardScheduleItem[]>("/api/flashcards/schedule"),
      apiClient.get<{ total?: number; questions?: unknown[] }>("/api/quiz/questions?limit=1"),
      apiClient.get<{ documents?: ProgressDocument[]; total?: number }>("/api/documents?page=1&page_size=5&status=completed"),
      apiClient.get<{ learning_paths?: LearningPathSummary[] }>("/api/learning-paths?page_size=10"),
      apiClient.get<{ classes?: ClassSummary[] }>("/api/classroom/my-classes")
    ])

    if (patternsResult.status === "fulfilled") {
      setPatterns(patternsResult.value ?? null)
    } else {
      setPatterns(null)
    }

    if (allErrorsResult.status === "fulfilled") {
      setAllErrors(allErrorsResult.value?.errors ?? [])
    } else {
      setAllErrors([])
    }

    if (dueErrorsResult.status === "fulfilled") {
      setDueErrors(dueErrorsResult.value?.errors ?? [])
    } else {
      setDueErrors([])
    }

    if (flashcardsResult.status === "fulfilled") {
      setFlashcards(Array.isArray(flashcardsResult.value) ? flashcardsResult.value : [])
    } else {
      setFlashcards([])
    }

    if (questionsResult.status === "fulfilled") {
      const data = questionsResult.value
      setQuestionCount(data?.total ?? data?.questions?.length ?? 0)
    } else {
      setQuestionCount(0)
    }

    if (documentsResult.status === "fulfilled") {
      setDocuments(documentsResult.value?.documents ?? [])
      setDocumentsTotal(documentsResult.value?.total ?? 0)
    } else {
      setDocuments([])
      setDocumentsTotal(0)
    }

    if (learningPathsResult.status === "fulfilled") {
      setLearningPaths(learningPathsResult.value?.learning_paths ?? [])
    } else {
      setLearningPaths([])
    }

    if (classesResult.status === "fulfilled") {
      setClasses(classesResult.value?.classes ?? [])
    } else {
      setClasses([])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const masteredCount = useMemo(
    () => allErrors.filter((error) => error.is_mastered).length,
    [allErrors]
  )

  return {
    loading,
    refresh,
    allErrors,
    dueErrors,
    patterns,
    flashcards,
    questionCount,
    documentsTotal,
    documents,
    learningPaths,
    classes,
    masteredCount
  }
}
