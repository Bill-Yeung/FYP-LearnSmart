import type {
  TargetLevel,
  ContentSource,
  QuizCountOption,
  PassScoreOption,
  QuizSourceOption,
  QuizMode
} from "../../../../shared/types"

export const TARGET_LEVEL_OPTIONS: { value: TargetLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "standard", label: "Standard" },
  { value: "advanced", label: "Advanced" },
  { value: "all", label: "All Levels" }
]

export const CONTENT_SOURCE_OPTIONS: { value: ContentSource; label: string }[] = [
  { value: "system", label: "System (predefined modules)" },
  { value: "upload", label: "Upload document" }
]

export const QUIZ_COUNT_OPTIONS: { value: QuizCountOption; label: string }[] = [
  { value: "4-6", label: "4–6 questions" },
  { value: "6-8", label: "6–8 questions" },
  { value: "8-10", label: "8–10 questions" },
  { value: "10-12", label: "10–12 questions" }
]

export const PASS_SCORE_OPTIONS: { value: PassScoreOption; label: string }[] = [
  { value: 60, label: "60%" },
  { value: 70, label: "70%" },
  { value: 80, label: "80%" },
  { value: 90, label: "90%" }
]

export const QUIZ_SOURCE_OPTIONS: { value: QuizSourceOption; label: string }[] = [
  { value: "doc_only", label: "From document only" },
  { value: "doc_ai", label: "Doc + AI assistance" },
  { value: "ai_only", label: "AI only" }
]

export const QUIZ_MODE_OPTIONS: { value: QuizMode; label: string }[] = [
  { value: "ai", label: "AI auto-generate" },
  { value: "manual", label: "Manual question set" }
]
