import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { AiGenerationNotice } from "../ui/AiGenerationNotice"
import { ConceptSelector } from "../form/ConceptSelector"
import { ComprehensionSourcePicker } from "./ComprehensionSourcePicker"
import { ComprehensionHistoryPanel } from "./ComprehensionHistoryPanel"
import { useComprehensionWorkspace } from "../../hooks/useComprehensionWorkspace"
import { useWhyHowQuestions, type Difficulty } from "../../hooks/useWhyHowQuestions"

type Props = {
  onToast: (msg: string) => void
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
]

export function WhyHowQuestionGenerator({ onToast }: Props) {
  const {
    sourceText,
    setSourceText,
    focusConcept,
    setFocusConcept,
    detectedKeywords,
    difficulty,
    setDifficulty,
    count,
    setCount,
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
  } = useWhyHowQuestions()

  const workspace = useComprehensionWorkspace()

  const mergedKeywords = Array.from(
    new Set([...workspace.documentConceptLabels, ...detectedKeywords])
  )

  const resetAll = () => {
    workspace.setSelectedSubjectId("")
    workspace.setSelectedDocumentId("")
    reset()
  }

  const sourceContext = {
    subjectName: workspace.subjects.find((subject) => subject.id === workspace.selectedSubjectId)?.name,
    documentId: workspace.selectedDocument?.id,
    documentName: workspace.selectedDocument?.document_name,
    documentConcepts: workspace.documentConceptLabels
  }

  return (
    <div className="space-y-4">
      <Card
        title="Why/How Question Generator"
        subtitle="Generate comprehension questions grounded in your own topic or linked document."
      >
        <div className="space-y-4">
        {isLoading && (
          <AiGenerationNotice
            title="Building your question set"
            description="The page is shaping why and how prompts from your notes, difficulty choices, and linked study context."
          />
        )}
        {!showResults && (
          <div className="space-y-3">
            <ComprehensionSourcePicker
              workspace={workspace}
              onUseConcept={setFocusConcept}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <ConceptSelector
                label="Focus concept (optional)"
                value={focusConcept}
                onChange={setFocusConcept}
                placeholder="e.g., Photosynthesis"
                extraConcepts={mergedKeywords}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Difficulty
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {DIFFICULTIES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDifficulty(item.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        difficulty === item.value
                          ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIncludeWhy(!includeWhy)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      includeWhy
                        ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/20 dark:text-rose-200"
                        : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                    }`}
                  >
                    Why
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncludeHow(!includeHow)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      includeHow
                        ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700/60 dark:bg-blue-900/20 dark:text-blue-200"
                        : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                    }`}
                  >
                    How
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Source content
                </label>
                <textarea
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder="Paste notes, a textbook excerpt, or a transcript..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  rows={8}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Number of questions
                </label>
                <input
                  type="number"
                  min={includeWhy && includeHow ? 2 : 1}
                  max={20}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  onBlur={() => {
                    if (includeWhy && includeHow && count < 2) {
                      setCount(2)
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {includeWhy && includeHow ? "Pick 2 to 20" : "Pick 1 to 20"}
                </p>

                <div className="mt-4 space-y-2">
                  <Button
                    onClick={() => generate(onToast, sourceContext)}
                    disabled={isLoading || !sourceText.trim()}
                    fullWidth
                  >
                    {isLoading ? "Generating..." : "Generate questions"}
                  </Button>
                  <Button variant="secondary" onClick={resetAll} disabled={isLoading} fullWidth>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showResults && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                    Questions Generated
                  </p>
                  <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                    {questions.length} question{questions.length !== 1 ? "s" : ""} ready
                  </p>
                  <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
                    Review the follow-up prompts and refine the input if you want a different mix.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setShowResults(false)} className="w-full sm:w-auto">
                    Edit inputs
                  </Button>
                  <Button variant="ghost" onClick={() => copyAll(onToast)} className="w-full sm:w-auto">
                    Copy all
                  </Button>
                  <Button variant="ghost" onClick={resetAll} className="w-full sm:w-auto">
                    Start over
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      {index + 1}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                        question.type === "why"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-200"
                          : "bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                      }`}
                    >
                      {question.type === "why" ? "Why" : "How"}
                    </span>
                    <span className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-200">
                      {question.difficulty}
                    </span>
                    {question.focus && (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        {question.focus}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                    {question.question}
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{question.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </Card>

      <ComprehensionHistoryPanel
        items={storedQuestionSets}
        emptyText="Generate questions or enter source content to save this question set."
        onRestore={(item) => restoreQuestionSet(item, onToast)}
        onRemove={(id) => void removeQuestionSet(id)}
        onClearAll={() => void clearQuestionSets()}
      />
    </div>
  )
}
