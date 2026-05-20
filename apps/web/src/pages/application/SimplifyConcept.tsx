import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { useSimplifyExplanation } from "../../hooks/useSimplifyExplanation"

type Props = {
  onToast: (message: string) => void
}

const GRADE_LEVELS = [
  { value: "6",          label: "Beginner",     desc: "Simple words, no jargon" },
  { value: "9",          label: "Intermediate", desc: "Some technical terms" },
  { value: "12",         label: "Advanced",     desc: "Full technical depth" },
  { value: "University", label: "University",   desc: "Research-level, maximum rigour" },
]

export function SimplifyConcept({ onToast }: Props) {
  const {
    explanation,
    setExplanation,
    selectedGradeLevel,
    setSelectedGradeLevel,
    isLoading,
    result,
    showComparison,
    setShowComparison,
    simplify,
    reset
  } = useSimplifyExplanation()

  const handleSimplify = () => simplify(onToast)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    onToast("Copied to clipboard")
  }

  const handleReset = () => {
    reset()
  }

  const handleUseSimplified = () => {
    setExplanation(result?.simplified || "")
    setShowComparison(false)
    onToast("Switched to simplified version")
  }

  return (
    <Card
      title="Adjust Explanation Level"
      subtitle="Rewrite your explanation at any level — simplify for a younger audience or make it harder with full technical rigour"
    >
      <div className="space-y-4">

        {/* How it works */}
        {!showComparison && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p className="font-semibold text-gray-700 dark:text-gray-300">How to use this tool:</p>
            <p>1. Write your explanation in your own words below</p>
            <p>2. Choose the target level — Beginner = simple words, University = research-level rigour</p>
            <p>3. Click Rewrite — you'll see your version vs. the rewritten version side by side</p>
          </div>
        )}

        {/* Input Section */}
        {!showComparison ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Your Explanation
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Write your explanation in your own words — AI will rewrite it at the level you choose.</p>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="e.g. HTTP is how computers talk to each other on the web. When you type a URL, your browser sends a request and the server sends back the page..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                rows={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Level
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Pick the level to rewrite at — lower levels simplify, higher levels add technical rigour.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADE_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setSelectedGradeLevel(level.value)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedGradeLevel === level.value
                        ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                        : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                    }`}
                  >
                    <div className="text-sm font-medium">{level.label}</div>
                    <div className="text-xs opacity-70">{level.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSimplify}
                disabled={isLoading || !explanation.trim()}
              >
                {isLoading ? "Rewriting..." : "Rewrite"}
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

        {/* Comparison Section */}
        {showComparison && result && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Original */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Your Version</h3>
                  <button
                    onClick={() => handleCopy(result.original)}
                    className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.original}
                </p>
              </div>

              {/* Simplified */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                    {GRADE_LEVELS.find(l => l.value === result.gradLevel)?.label ?? result.gradLevel} Level
                  </h3>
                  <button
                    onClick={() => handleCopy(result.simplified)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
                  {result.simplified}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> The rewritten version may simplify or expand details depending on the level chosen. Review carefully to ensure key concepts are preserved.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleUseSimplified}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
              >
                Use This Version
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowComparison(false)}
              >
                Edit & Try Again
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

export default SimplifyConcept
