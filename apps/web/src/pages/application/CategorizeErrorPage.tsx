import { useState } from "react"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { useCategorizeError } from "../../hooks/useCategorizeError"
import type { ErrorCategory } from "../../hooks/useCategorizeError"

type Props = {
  onToast: (message: string) => void
}

const ERROR_CAUSES: Array<{ value: ErrorCategory["cause"]; label: string }> = [
  { value: "conceptual_misunderstanding", label: "Conceptual Misunderstanding" },
  { value: "miscalculation", label: "Miscalculation" },
  { value: "time_pressure", label: "Time Pressure" },
  { value: "careless_mistake", label: "Careless Mistake" },
  { value: "incomplete_knowledge", label: "Incomplete Knowledge" },
  { value: "other", label: "Other" }
]

function CategorizeErrorInner({ onToast }: Props) {
  const {
    errorDescription,
    setErrorDescription,
    errorContext,
    setErrorContext,
    isAnalyzing,
    result,
    showResults,
    setShowResults,
    selectedSubject,
    setSelectedSubject,
    selectedQuestionType,
    setSelectedQuestionType,
    selectedCause,
    setSelectedCause,
    additionalTags,
    setAdditionalTags,
    usingSampleData,
    analyzeError,
    confirmCategory,
    reset
  } = useCategorizeError()

  const [newTag, setNewTag] = useState("")

  const handleAnalyze = () => analyzeError(onToast)
  const handleConfirm = () => confirmCategory(onToast)

  const addTag = () => {
    if (newTag.trim() && !additionalTags.includes(newTag.trim())) {
      setAdditionalTags([...additionalTags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tag: string) => {
    setAdditionalTags(additionalTags.filter(t => t !== tag))
  }

  const causeColor = (cause: ErrorCategory["cause"]) => {
    if (cause === "conceptual_misunderstanding") return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
    if (cause === "miscalculation") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
    if (cause === "time_pressure") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
    if (cause === "careless_mistake") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
    if (cause === "incomplete_knowledge") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200"
    return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-200"
  }

  return (
    <Card
      title="Categorize Error"
      subtitle="AI tags errors by subject, question type, and cause to enable targeted review"
    >
      <div className="space-y-4">
        {!showResults && (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Error Description
              </label>
              <textarea
                value={errorDescription}
                onChange={e => setErrorDescription(e.target.value)}
                placeholder="Describe what went wrong (e.g., 'Confused oxidation and reduction in electrochemistry problem')"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                rows={4}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Context (optional)
              </label>
              <input
                type="text"
                value={errorContext}
                onChange={e => setErrorContext(e.target.value)}
                placeholder="e.g., Chemistry exam Q5, Redox reactions chapter"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAnalyze} disabled={isAnalyzing || !errorDescription.trim()}>
                {isAnalyzing ? "Analyzing..." : "Analyze Error"}
              </Button>
              {errorDescription && (
                <Button variant="secondary" onClick={reset}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {showResults && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-200">
                    Error Record
                  </p>
                  <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                    ID: {result.error_id}
                  </p>
                </div>
                {result.analytics_updated && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                    Analytics Updated
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-rose-800 dark:text-rose-200">
                {result.original_description}
              </p>
            </div>

            {usingSampleData && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200">
                Showing sample response because the backend is unavailable.
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Review and Modify Tags
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                    placeholder="e.g., Chemistry, Mathematics"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Question Type
                  </label>
                  <input
                    type="text"
                    value={selectedQuestionType}
                    onChange={e => setSelectedQuestionType(e.target.value)}
                    placeholder="e.g., Multiple choice, Essay, Calculation"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Error Cause
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ERROR_CAUSES.map(cause => (
                    <button
                      key={cause.value}
                      onClick={() => setSelectedCause(cause.value)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        selectedCause === cause.value
                          ? `${causeColor(cause.value)} border-current`
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      {cause.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Additional Tags
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder="Add custom tag"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    onKeyDown={e => e.key === "Enter" && addTag()}
                  />
                  <Button variant="secondary" onClick={addTag} disabled={!newTag.trim()}>
                    Add
                  </Button>
                </div>
                {additionalTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {additionalTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Review the AI-suggested tags and modify them if they don't match your perception. Confirming will update your analytics.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleConfirm} disabled={isAnalyzing || result.analytics_updated}>
                {isAnalyzing ? "Confirming..." : result.analytics_updated ? "Confirmed" : "Confirm Category"}
              </Button>
              <Button variant="secondary" onClick={() => setShowResults(false)}>
                Edit Error
              </Button>
              <Button variant="ghost" onClick={reset}>
                Start Over
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function CategorizeErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <CategorizeErrorInner onToast={() => {}} />
      </main>
    </div>
  )
}

export default CategorizeErrorPage
