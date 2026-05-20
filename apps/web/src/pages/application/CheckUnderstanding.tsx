import { useState } from "react"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { useCheckUnderstanding } from "../../hooks/useCheckUnderstanding"
import FollowupChat from "../../components/chat/FollowupChat"

async function fetchRandomConcept(): Promise<string> {
  const res = await fetch("/api/documents/knowledge-map/data", { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load concepts")
  const data = await res.json()
  const concepts: string[] = (data.concepts || []).map((c: any) => c.title || c.name).filter(Boolean)
  if (concepts.length === 0) throw new Error("No concepts in your knowledge map")
  return concepts[Math.floor(Math.random() * concepts.length)]
}

const STRICTNESS_LEVELS = [
  { value: "lenient", label: "Lenient" },
  { value: "standard", label: "Standard" },
  { value: "strict", label: "Strict" }
]

type Props = {
  onToast: (message: string) => void
}

export function CheckUnderstanding({ onToast }: Props) {
  const {
    concept,
    setConcept,
    explanation,
    setExplanation,
    strictness,
    setStrictness,
    isLoading,
    result,
    showResults,
    setShowResults,
    submitFollowup,
    checkUnderstanding,
    lookupConceptDefinition,
    reset
  } = useCheckUnderstanding()

  const [showChat, setShowChat] = useState(true)
  const [suggestingConcept, setSuggestingConcept] = useState(false)

  async function suggestConcept() {
    setSuggestingConcept(true)
    try {
      const picked = await fetchRandomConcept()
      setConcept(picked)
      lookupConceptDefinition(picked, onToast)
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not suggest a concept")
    } finally {
      setSuggestingConcept(false)
    }
  }

  const handleCheck = () => checkUnderstanding(onToast)

  const handleCopyReport = () => {
    if (!result) return
    const flagLines = result.flagged.map(flag => `- (${flag.severity}) ${flag.phrase} → ${flag.issue}${flag.fix ? ` | fix: ${flag.fix}` : ""}`)
    const styleLines = result.styleSuggestions.map(note => `- ${note.phrase ? `${note.phrase}: ` : ""}${note.suggestion}`)
    const report = [
      `Concept: ${result.concept}`,
      result.conceptDefinition ? `Definition: ${result.conceptDefinition}` : null,
      `Verdict: ${result.verdict} (confidence ${result.confidence}%)`,
      "Flagged segments:",
      flagLines.length ? flagLines.join("\n") : "- None",
      "Style/clarity notes:",
      styleLines.length ? styleLines.join("\n") : "- None",
      "Original explanation:",
      result.original
    ]
      .filter(Boolean)
      .join("\n")

    navigator.clipboard.writeText(report)
    onToast("Report copied")
  }

  const severityBadge = (severity: "critical" | "major" | "minor") => {
    if (severity === "critical") return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-100"
    if (severity === "major") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100"
  }



  return (
    <Card
      title="Check Understanding"
      subtitle="AI flags unclear or incorrect parts of your explanation against the concept definition"
    >
      <div className="space-y-4">
        {!showResults && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Concept</label>
                <input
                  type="text"
                  value={concept}
                  onChange={e => setConcept(e.target.value)}
                  onBlur={e => lookupConceptDefinition(e.target.value, onToast)}
                  placeholder="e.g., Photosynthesis"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={suggestConcept}
                  disabled={suggestingConcept}
                  className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
                >
                  {suggestingConcept ? "Suggesting…" : "Suggest a concept for me"}
                </button>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Strictness</label>
                <div className="grid grid-cols-3 gap-2">
                  {STRICTNESS_LEVELS.map(level => (
                    <button
                      key={level.value}
                      onClick={() => setStrictness(level.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        strictness === level.value
                          ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Your explanation</label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                placeholder="Paste or type your explanation here"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                rows={6}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCheck} disabled={isLoading || !explanation.trim()}>
                {isLoading ? "Checking..." : "Check understanding"}
              </Button>
              {explanation && (
                <Button variant="secondary" onClick={reset}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {showResults && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700 dark:text-purple-200">Verdict</p>
                  <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                    {result.verdict === "clear" ? "Clear and correct" : "Needs clarification"}
                  </p>
                  <p className="text-sm text-purple-800/80 dark:text-purple-200/80">Confidence: {result.confidence}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-purple-700 dark:text-purple-200">Concept</p>
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">{result.concept}</p>
                </div>
              </div>
              {result.conceptDefinition && (
                <p className="mt-3 rounded-lg border border-purple-200 bg-white/70 px-3 py-2 text-sm text-gray-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-gray-100">
                  {result.conceptDefinition}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/40">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-100">Flagged misunderstandings</h3>
                <span className="text-xs font-medium text-rose-700 dark:text-rose-200">{result.flagged.length} flagged</span>
              </div>
              {result.flagged.length === 0 ? (
                <p className="text-sm text-rose-900/80 dark:text-rose-100/80">No incorrect or unclear segments detected.</p>
              ) : (
                <div className="space-y-3">
                  {result.flagged.map((flag, idx) => (
                    <div key={`${flag.phrase}-${idx}`} className="rounded-lg border border-rose-100 bg-white px-3 py-2 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{flag.phrase}</p>
                          <p className="text-xs text-gray-700 dark:text-gray-300">{flag.issue}</p>
                          {flag.fix ? (
                            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">Suggested fix: {flag.fix}</p>
                          ) : null}
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${severityBadge(flag.severity)}`}>
                          {flag.severity === "critical" ? "Critical" : flag.severity === "major" ? "Major" : "Minor"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/40">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Clarity and style notes</h3>
                <span className="text-xs font-medium text-blue-700 dark:text-blue-200">Separate from error flags</span>
              </div>
              {result.styleSuggestions.length === 0 ? (
                <p className="text-sm text-blue-900/80 dark:text-blue-100/80">No stylistic or clarity notes.</p>
              ) : (
                <ul className="space-y-2">
                  {result.styleSuggestions.map((note, idx) => (
                    <li key={`${note.suggestion}-${idx}`} className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-gray-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-gray-100">
                      <span className="font-medium text-blue-700 dark:text-blue-200">{note.phrase || "General"}:</span> {note.suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <details className="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary className="cursor-pointer select-none px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
                Original explanation
              </summary>
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{result.original}</p>
              </div>
            </details>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowResults(false)} variant="secondary">
                Edit and clarify
              </Button>
              <Button variant="ghost" onClick={handleCopyReport}>
                Copy flagged report
              </Button>
              <Button variant="ghost" onClick={reset}>
                Start over
              </Button>
            </div>
            {result.follow_up_questions && result.follow_up_questions.length > 0 && showChat && (
              <div className="mt-4">
                <FollowupChat
                  questions={result.follow_up_questions}
                  onSubmit={async (question, answer) => await submitFollowup(question, answer, onToast)}
                  onClose={() => setShowChat(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
