import { useState } from "react"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { ConceptSelector } from "../../components/form/ConceptSelector"
import { useReflectionTeaching } from "../../hooks/useReflectionTeaching"

async function fetchRandomConcept(): Promise<string> {
  const res = await fetch("/api/documents/knowledge-map/data", { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load concepts")
  const data = await res.json()
  const concepts: string[] = (data.concepts || []).map((c: any) => c.title || c.name).filter(Boolean)
  if (concepts.length === 0) throw new Error("No concepts in your knowledge map")
  return concepts[Math.floor(Math.random() * concepts.length)]
}

type Props = {
  onToast: (message: string) => void
}

const TARGET_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" }
]

export function ReflectOnTeaching({ onToast }: Props) {
  const {
    explanation,
    setExplanation,
    concept,
    setConcept,
    targetLevel,
    setTargetLevel,
    isLoading,
    result,
    showAnalysis,
    setShowAnalysis,
    reflect,
    reset
  } = useReflectionTeaching()

  const handleReflect = () => reflect(onToast)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    onToast("Copied to clipboard")
  }

  const handleReset = () => {
    reset()
  }

  const [suggestingConcept, setSuggestingConcept] = useState(false)

  async function suggestConcept() {
    setSuggestingConcept(true)
    try {
      const picked = await fetchRandomConcept()
      setConcept(picked)
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not suggest a concept")
    } finally {
      setSuggestingConcept(false)
    }
  }

  return (
    <Card
      title="Reflect on Teaching"
      subtitle="Write your explanation, then AI gives you feedback like a teacher — what you got right, what's missing, and what to study next"
    >
      <div className="space-y-4">

        {/* How it works */}
        {!showAnalysis && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p className="font-semibold text-gray-700 dark:text-gray-300">How to use this tool:</p>
            <p>1. Enter the concept name (e.g. "Newton's First Law")</p>
            <p>2. Write your explanation in your own words — imagine you're teaching a friend</p>
            <p>3. Click Get Feedback — AI will tell you your strengths, gaps, and what to study next</p>
            <p className="text-gray-400 dark:text-gray-500 italic">Tip: The more detail you write, the better the feedback.</p>
          </div>
        )}

        {/* Input Section */}
        {!showAnalysis ? (
          <div className="space-y-3">
            <ConceptSelector
              value={concept}
              onChange={setConcept}
              label="Concept (optional but recommended)"
              hint='Select from your knowledge map or type your own — e.g. "Photosynthesis", "Newton First Law"'
            />
            <button
              type="button"
              onClick={suggestConcept}
              disabled={suggestingConcept}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
            >
              {suggestingConcept ? "Suggesting…" : "Suggest a concept for me"}
            </button>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Your Explanation
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Write as if you're explaining to a friend. Don't worry about being perfect — the AI will help you improve.</p>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="e.g. Photosynthesis is when plants use sunlight to make food. They take in CO2 and water..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                rows={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Your Learning Level
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">This helps AI adjust the depth of feedback. Choose what matches your current knowledge.</p>
              <div className="grid grid-cols-3 gap-2">
                {TARGET_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setTargetLevel(level.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      targetLevel === level.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                        : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleReflect}
                disabled={isLoading || !explanation.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600"
              >
                {isLoading ? "Analyzing..." : "Get Feedback"}
              </Button>
              {explanation && (
                <Button
                  variant="secondary"
                  onClick={handleReset}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {/* Analysis Section */}
        {showAnalysis && result && (
          <div className="space-y-4">
            {/* Concept & Confidence */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">
                    Feedback on: {result.concept}
                  </h3>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                    Your Learning Level: <span className="font-medium">{targetLevel}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Confidence</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">
                    {result.analysis.confidence_level}%
                  </p>
                </div>
              </div>
            </div>

            {/* Strengths */}
            {result.analysis.strengths.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                  What you got right
                </h3>
                <ul className="space-y-1">
                  {result.analysis.strengths.map((strength, idx) => (
                    <li key={idx} className="text-sm text-emerald-800 dark:text-emerald-200">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Areas for Improvement */}
            {result.analysis.areas_for_improvement.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  What's missing or needs improvement
                </h3>
                <ul className="space-y-1">
                  {result.analysis.areas_for_improvement.map((area, idx) => (
                    <li key={idx} className="text-sm text-orange-800 dark:text-orange-200">
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reflection Questions */}
            {result.analysis.reflection_questions.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Questions to deepen your understanding
                </h3>
                <ul className="space-y-2">
                  {result.analysis.reflection_questions.map((question, idx) => (
                    <li key={idx} className="text-sm text-blue-800 dark:text-blue-200 flex gap-2">
                      <span className="font-medium text-blue-600 dark:text-blue-400 min-w-fit">{idx + 1}.</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested Resources */}
            {result.analysis.suggested_resources.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                  What to study next
                </h3>
                <ul className="space-y-1">
                  {result.analysis.suggested_resources.map((resource, idx) => (
                    <li key={idx} className="text-sm text-purple-800 dark:text-purple-200">
                      {resource}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {result.analysis.next_steps && (
              <div className="rounded-lg border border-gray-300 bg-gray-100 p-4 dark:border-gray-600 dark:bg-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Recommended next steps
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.analysis.next_steps}
                </p>
              </div>
            )}

            {/* Original Explanation */}
            <details className="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary className="cursor-pointer select-none px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
                Your Original Explanation
              </summary>
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.original}
                </p>
                <button
                  onClick={() => handleCopy(result.original)}
                  className="mt-2 text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Copy
                </button>
              </div>
            </details>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowAnalysis(false)}
              >
                Edit & Analyze Again
              </Button>
              <Button
                variant="ghost"
                onClick={handleReset}
              >
                Start Over
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
