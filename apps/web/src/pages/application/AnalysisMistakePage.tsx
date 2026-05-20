import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { useAnalysisMistake } from "../../hooks/useAnalysisMistake"

type Props = {
  onToast: (message: string) => void
}

function AnalysisMistakeInner({ onToast }: Props) {
  const {
    errorContext,
    setErrorContext,
    whyWrong,
    setWhyWrong,
    avoidNextTime,
    setAvoidNextTime,
    isPrivate,
    setIsPrivate,
    isSaving,
    result,
    showSummary,
    setShowSummary,
    saveReflection,
    skipReflection,
    reset
  } = useAnalysisMistake()

  const handleSave = () => saveReflection(onToast)
  const handleSkip = () => skipReflection(onToast)

  return (
    <Card
      title="Analyze Mistake"
      subtitle="Reflect on why the error happened and how to prevent it next time"
    >
      <div className="space-y-4">
        {!showSummary && (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Error Context (optional)
              </label>
              <input
                type="text"
                value={errorContext}
                onChange={e => setErrorContext(e.target.value)}
                placeholder="e.g., History exam Q5, Allied victory"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Why was this wrong?
              </label>
              <textarea
                value={whyWrong}
                onChange={e => setWhyWrong(e.target.value)}
                placeholder="e.g., I misread the question and skipped the economic angle"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                rows={4}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                How can I avoid it next time?
              </label>
              <textarea
                value={avoidNextTime}
                onChange={e => setAvoidNextTime(e.target.value)}
                placeholder="e.g., underline command words, plan the two economic factors first"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                id="reflection-private"
                type="checkbox"
                checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <label htmlFor="reflection-private">
                Keep reflection private (default)
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={isSaving || (!whyWrong.trim() && !avoidNextTime.trim())}>
                {isSaving ? "Saving..." : "Save Reflection"}
              </Button>
              <Button variant="secondary" onClick={handleSkip}>
                Skip
              </Button>
              {(whyWrong || avoidNextTime || errorContext) && (
                <Button variant="ghost" onClick={reset}>
                  Clear
                </Button>
              )}
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Reflections are personal by default and are not shared publicly unless you opt in.
              </p>
            </div>
          </div>
        )}

        {showSummary && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                    Reflection Saved
                  </p>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    ID: {result.reflection_id}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-800/60">
                  {result.is_private ? "Private" : "Shared"}
                </span>
              </div>
              {result.error_context && (
                <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
                  Context: {result.error_context}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Why was this wrong?</h3>
              <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {result.why_wrong || "(left blank)"}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">How can I avoid it next time?</h3>
              <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {result.avoid_next_time || "(left blank)"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setShowSummary(false)}>
                Edit Reflection
              </Button>
              <Button variant="ghost" onClick={reset}>
                Start New
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function AnalysisMistakePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <AnalysisMistakeInner onToast={() => {}} />
      </main>
    </div>
  )
}

export default AnalysisMistakePage
