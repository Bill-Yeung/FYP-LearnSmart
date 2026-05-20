import { TextField } from "../form/TextField"
import { cn } from "../../../../../shared/utils"
import { useConfirmDialog } from "../general/ConfirmDialog"
import type {
  TargetLevel,
  ContentSource,
  QuizCountOption,
  PassScoreOption,
  QuizSourceOption,
  QuizMode,
  ManualQuizConfig,
} from "../../../../../shared/types"

import type { SubjectOption } from "../../api/gameTemplates"

import {
  TARGET_LEVEL_OPTIONS,
  CONTENT_SOURCE_OPTIONS,
  QUIZ_COUNT_OPTIONS,
  PASS_SCORE_OPTIONS,
  QUIZ_SOURCE_OPTIONS,
  QUIZ_MODE_OPTIONS,
} from "../../configs/gameTemplateOptions"

type BasicInfoSectionProps = {
  templateName: string
  templateNameError?: string | null
  setTemplateName: (v: string) => void
  targetLevel: TargetLevel
  setTargetLevel: (v: TargetLevel) => void
  description: string
  setDescription: (v: string) => void
}

// template name, target level, description
export function BasicInfoSection({
  templateName,
  templateNameError,
  setTemplateName,
  targetLevel,
  setTargetLevel,
  description,
  setDescription,
}: BasicInfoSectionProps) {
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <legend className="px-1 text-sm font-semibold text-amber-600 dark:text-amber-300">
        Basic Information
      </legend>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <TextField
            label="Template name"
            placeholder="e.g. ITP4507 Factory Patterns · Mystery Mode"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            error={templateNameError}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Target student level
          </label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value as TargetLevel)}
          >
            {TARGET_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Match script complexity to the learner’s ability.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Description
        </label>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="What learning goal does this template support? What style/tone should the script have?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </section>
  )
}

export type ContentInfoSectionProps = {
  contentSource: ContentSource
  setContentSource: React.Dispatch<React.SetStateAction<ContentSource>>
  subjectOptions: SubjectOption[]
  subjectName: string
  setSubjectName: React.Dispatch<React.SetStateAction<string>>
  subjectCode: string
  setSubjectCode: React.Dispatch<React.SetStateAction<string>>
}

// pick subject + content source, with a confirm prompt when the name is edited
export function ContentInfoSection(props: ContentInfoSectionProps) {
  const {
    contentSource,
    setContentSource,
    subjectOptions,
    subjectName,
    setSubjectName,
    subjectCode,
    setSubjectCode,
  } = props;
  const { confirm, dialogProps, ConfirmDialog } = useConfirmDialog();

  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <legend className="px-1 text-sm font-semibold text-amber-600 dark:text-amber-300">
        Content &amp; Subject
      </legend>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content Source
          </label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={contentSource}
            onChange={(e) => setContentSource(e.target.value as ContentSource)}
          >
            {CONTENT_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Quick select
          </label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={subjectCode}
            onChange={(e) => {
              const value = e.target.value
              setSubjectCode(value)

              const selected = subjectOptions.find((s) => s.id === value)
              if (selected) {
                setSubjectName(selected.name || selected.code)
                setSubjectCode(selected.code)
              }
            }}
          >
            <option value="">Custom / not set</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} {s.name ? `– ${s.name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Subject Code
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="e.g. ITP4507 or custom subject code"
            value={subjectCode}
            onChange={(e) => {
              setSubjectCode(e.target.value)
              const existing = subjectOptions.find((s) => s.code.toLowerCase() === e.target.value.toLowerCase())
              if (existing) {
                setSubjectName(existing.name || "")
              }
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Subject Name
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="e.g. Software Engineering"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            onBlur={async () => {
              const existing = subjectOptions.find((s) => s.code.toLowerCase() === subjectCode.toLowerCase())
              if (existing && existing.name !== subjectName) {
                const result = await confirm({
                  title: "Confirmation",
                  message: `Update subject name \"${existing.name}\" to \"${subjectName}\"?`,
                  confirmLabel: "Update",
                  cancelLabel: "Cancel",
                  variant: "info"
                })
                if (!result) {
                  setSubjectName(existing.name || "")
                }
              }
            }}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Help the script fully match the chosen subject.
          </p>
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </section>
  )
}

type DifficultySectionProps = {
  puzzleMcq: number
  setPuzzleMcq: (v: number) => void
  puzzleSorting: number
  setPuzzleSorting: (v: number) => void
  puzzleFill: number
  setPuzzleFill: (v: number) => void
}

// number of each puzzle type in the script
export function DifficultySection({
  puzzleMcq,
  setPuzzleMcq,
  puzzleSorting,
  setPuzzleSorting,
  puzzleFill,
  setPuzzleFill,
}: DifficultySectionProps) {
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <legend className="px-1 text-sm font-semibold text-amber-600 dark:text-amber-300">
        In-Game Script Puzzles Configuration
      </legend>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
        Define the exact puzzle count required to unlock clues during the script deduction gameplay.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            MCQ Puzzles
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={puzzleMcq}
            onChange={(e) => setPuzzleMcq(Number(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sorting Puzzles
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={puzzleSorting}
            onChange={(e) => setPuzzleSorting(Number(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Fill-in-blank Puzzles
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={puzzleFill}
            onChange={(e) => setPuzzleFill(Number(e.target.value) || 0)}
          />
        </div>
      </div>
    </section>
  )
}

type QuizConfigurationSectionProps = {
  enableQuiz: boolean
  setEnableQuiz: (updater: (prev: boolean) => boolean) => void

  quizCount: QuizCountOption
  setQuizCount: (v: QuizCountOption) => void
  passScore: PassScoreOption
  setPassScore: (v: PassScoreOption) => void
  quizSource: QuizSourceOption
  setQuizSource: (v: QuizSourceOption) => void
  quizMode: QuizMode
  setQuizMode: (v: QuizMode) => void

  manualQuizConfig: ManualQuizConfig
  handleManualQuizChange: <K extends keyof ManualQuizConfig>(key: K, value: number) => void
}

// optional quiz at the end of the script with manual or auto question mix
export function QuizConfigurationSection({
  enableQuiz,
  setEnableQuiz,
  quizCount,
  setQuizCount,
  passScore,
  setPassScore,
  quizSource,
  setQuizSource,
  quizMode,
  setQuizMode,
  manualQuizConfig,
  handleManualQuizChange,
}: QuizConfigurationSectionProps) {
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <legend className="px-1 text-sm font-semibold text-amber-600 dark:text-amber-300">
        Quiz Configuration
      </legend>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-medium">Include quiz after script?</p>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px]">
          <span className="text-amber-900 dark:text-amber-100">Off</span>
          <button
            type="button"
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full border border-amber-300 bg-amber-100 transition-colors",
              enableQuiz && "bg-amber-500 border-amber-500"
            )}
            onClick={() => setEnableQuiz((prev) => !prev)}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                enableQuiz && "translate-x-4"
              )}
            />
          </button>
          <span className="text-amber-900 dark:text-amber-100">On</span>
        </label>
      </div>

      {enableQuiz && (
        <>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quiz question count
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={quizCount}
                onChange={(e) => setQuizCount(e.target.value as QuizCountOption)}
              >
                {QUIZ_COUNT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pass score
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value) as PassScoreOption)}
              >
                {PASS_SCORE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quiz source
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={quizSource}
                onChange={(e) => setQuizSource(e.target.value as QuizSourceOption)}
              >
                {QUIZ_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Question Generation Mode
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                value={quizMode}
                onChange={(e) => setQuizMode(e.target.value as QuizMode)}
              >
                {QUIZ_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {quizMode === "manual" && (
            <div className="mt-4 space-y-3 rounded-md border border-dashed border-gray-300 p-3 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Manual question type distribution
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total: {Object.values(manualQuizConfig).reduce((sum, v) => sum + v, 0)} questions
                </p>
              </div>

              <div className="space-y-2">
                <ManualQuizRow
                  label="Multiple Choice"
                  value={manualQuizConfig.mcq}
                  onChange={(value) => handleManualQuizChange("mcq", value)}
                />
                <ManualQuizRow
                  label="Fill-in-the-Blank"
                  value={manualQuizConfig.fill}
                  onChange={(value) => handleManualQuizChange("fill", value)}
                />
                <ManualQuizRow
                  label="Code Snippet"
                  value={manualQuizConfig.code}
                  onChange={(value) => handleManualQuizChange("code", value)}
                />
                <ManualQuizRow
                  label="Sorting/Ordering"
                  value={manualQuizConfig.sort}
                  onChange={(value) => handleManualQuizChange("sort", value)}
                />
                <ManualQuizRow
                  label="Short Answer"
                  value={manualQuizConfig.short}
                  onChange={(value) => handleManualQuizChange("short", value)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

type ManualQuizRowProps = {
  label: string
  value: number
  onChange: (value: number) => void
}

function ManualQuizRow({ label, value, onChange }: ManualQuizRowProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex-1 text-sm text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type="number"
        min={0}
        className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  )
}
