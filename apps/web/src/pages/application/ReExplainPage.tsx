import React, { useState } from "react"
import { useReExplainCorrectly } from "../../hooks/useReExplainCorrectly"

function ReExplainInner() {
  const {
    items,
    selectedId,
    setSelectedId,
    explanation,
    setExplanation,
    result,
    loading,
    submit,
    markReviewLater,
    sampleMode,
  } = useReExplainCorrectly()

  const [stage, setStage] = useState<"view" | "explain">("view")

  const current = items.find(i => i.id === selectedId)
  const isEvaluating = result.status === "evaluating"

  function handleSelectItem(id: string) {
    setSelectedId(id)
    setStage("view")
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Re-explain Correctly</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Explain the correct answer in your own words to confirm mastery.
        </p>
      </div>

      {/* Sample mode notice */}
      {sampleMode && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200">
          Sample mode: no errors found in your error book yet. Complete some quizzes and get questions wrong — they will appear here automatically. Data shown below resets on refresh.
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading your errors…
        </div>
      ) : (
        <>
          {/* Item picker */}
          <div className="flex flex-col gap-2 mb-5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Pick an item</label>
            <select
              value={selectedId}
              onChange={e => handleSelectItem(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600"
            >
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.prompt}
                </option>
              ))}
            </select>
            {current?.concept && (
              <span className="text-xs text-gray-400 dark:text-gray-500">Topic: {current.concept}</span>
            )}
          </div>

          {/* Step 1 — Reference answer */}
          <div className="mb-4">
            {stage === "view" ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Step 1 of 2</div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Correct answer (reference)</div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    onClick={() => setStage("explain")}
                  >
                    Next: explain
                  </button>
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded p-3 leading-relaxed">
                  {current?.correctAnswer ?? "—"}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Read the reference answer, then click "Next" to explain the concept yourself.
                </p>
              </>
            ) : (
              <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                Reference hidden to encourage recall.{" "}
                <button
                  className="font-semibold text-gray-900 dark:text-gray-100 underline"
                  onClick={() => setStage("view")}
                >
                  Back to reference
                </button>
              </div>
            )}
          </div>

          {/* Step 2 — Write explanation */}
          {stage === "explain" && (
            <>
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Step 2 of 2 — Explain it in your own words
                </label>
                <textarea
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  placeholder="Write your explanation here…"
                  rows={5}
                  disabled={isEvaluating}
                  className="mt-2 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600 disabled:opacity-50"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isEvaluating || !explanation.trim()}
                  onClick={() => void submit()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded font-medium text-sm hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isEvaluating ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Checking…
                    </span>
                  ) : "Submit explanation"}
                </button>
                <button
                  type="button"
                  disabled={isEvaluating}
                  onClick={markReviewLater}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
                >
                  Review later
                </button>
              </div>
            </>
          )}

          {/* AI result */}
          {result.status !== "idle" && result.status !== "evaluating" && (
            <div className="mt-5">
              <div
                className={`rounded-lg border px-4 py-3 ${
                  result.status === "aligned"
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                    : result.status === "needs_review"
                      ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                      : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold text-white ${
                      result.status === "aligned"
                        ? "bg-emerald-600"
                        : result.status === "needs_review"
                          ? "bg-amber-500"
                          : "bg-gray-500"
                    }`}
                  >
                    {result.status === "aligned" ? "✓ Understood" : result.status === "needs_review" ? "Needs review" : "Skipped"}
                  </span>
                  {result.confidence !== undefined && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Confidence: {Math.round(result.confidence * 100)}%
                    </span>
                  )}
                </div>
                <p className={`text-sm ${
                  result.status === "aligned"
                    ? "text-emerald-800 dark:text-emerald-200"
                    : result.status === "needs_review"
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-gray-700 dark:text-gray-300"
                }`}>
                  {result.feedback}
                </p>
                {result.gaps && result.gaps.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Gaps to address:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {result.gaps.map((g, i) => (
                        <li key={i} className="text-xs text-gray-700 dark:text-gray-300">{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.status !== "skipped" && (
                  <button
                    type="button"
                    className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
                    onClick={() => {
                      setExplanation("")
                      setStage("view")
                      handleSelectItem(selectedId)
                    }}
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ReExplainPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <ReExplainInner />
      </main>
    </div>
  )
}

export default ReExplainPage
