import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"

const ALGO_INFO: Record<string, { name: string; short: string; details: string; usage: string }> = {
  sm2: {
    name: "SM-2",
    short: "Classic SM-2 spaced repetition",
    details:
      "SM-2 schedules items based on graded recall — rate each review and the interval adapts. It's great for long-term retention of factual items.",
    usage: "Use when you want proven, algorithmic spacing. Grade recall honestly (0-5) for best results."
  },
  leitner: {
    name: "Leitner",
    short: "Box-based Leitner system",
    details:
      "Cards move between boxes representing increasing review intervals. Correct answers move a card forward; incorrect ones move it back.",
    usage: "Good for learners who like a simple visual box system and manual control over review frequency."
  },
  simple: {
    name: "Simple",
    short: "Basic fixed-interval scheduling",
    details: "Schedules reviews at fixed intervals (e.g., 1 day, 3 days, 7 days). Easier to predict but less adaptive.",
    usage: "Use for short-term cramming or very small decks where adaptive spacing is unnecessary."
  },
  fsrs: {
    name: "FSRS",
    short: "Forgetting-curve based scheduling",
    details:
      "FSRS models forgetting curves to choose optimal review times. It's more experimental but can offer improved efficiency for some learners.",
    usage: "Try FSRS if you want a more modern, probabilistic scheduler that adapts to forgetting curves."
  }
}

type AlgoKey = "sm2" | "leitner" | "simple" | "fsrs"

export function MemorizePage() {
  const { showToast } = useToast()
  const [algo, setAlgo] = useState<AlgoKey>("sm2")
  const [savedAlgo, setSavedAlgo] = useState<AlgoKey>("sm2")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiClient.get<{ algorithm: string }>('/api/flashcards/algorithm')
      .then(data => {
        const a = data?.algorithm as AlgoKey
        if (a && ['sm2', 'leitner', 'simple', 'fsrs'].includes(a)) {
          setAlgo(a)
          setSavedAlgo(a)
          localStorage.setItem('flashcards-default-algorithm', a)
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  // persist the chosen algorithm both server-side and in localStorage, then toast the user
  async function handleSave() {
    setSaving(true)
    try {
      await apiClient.post('/api/flashcards/algorithm', { algorithm: algo })
      setSavedAlgo(algo)
      localStorage.setItem('flashcards-default-algorithm', algo)
      showToast(`Algorithm set to ${ALGO_INFO[algo].name}`)
    } catch {
      showToast("Failed to save — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Memorize</h1>
        <p className="text-sm text-gray-500">Choose the default algorithm used for memorization reviews</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <label className="block text-sm font-medium">Available algorithms</label>

            {loading ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['sm2', 'leitner', 'simple', 'fsrs'] as const).map((key) => (
                  <button
                    key={key}
                    className={cn(
                      "rounded-lg border p-3 text-left relative",
                      algo === key ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                    )}
                    onClick={() => setAlgo(key)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">
                        {ALGO_INFO[key].name}
                        {key === 'sm2' && <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">(recommended)</span>}
                      </div>
                      {savedAlgo === key && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ALGO_INFO[key].short}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-gray-500">
                Active default: <span className="font-semibold text-gray-800 dark:text-gray-200">{ALGO_INFO[savedAlgo]?.name ?? savedAlgo}</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || loading || savedAlgo === algo}
                className={cn(
                  "px-4 py-1.5 rounded text-sm font-medium",
                  savedAlgo === algo || loading
                    ? "bg-gray-100 text-gray-400 cursor-default dark:bg-gray-800"
                    : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-gray-900"
                )}
              >
                {saving ? 'Saving...' : savedAlgo === algo ? 'Saved' : 'Set as default'}
              </button>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-lg font-semibold mb-2">About {ALGO_INFO[algo].name}</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300">{ALGO_INFO[algo].short}</div>
              <div className="mt-3 text-sm text-gray-700 dark:text-gray-200">{ALGO_INFO[algo].details}</div>
              <div className="mt-3 text-sm">
                <strong>How to use:</strong>
                <div className="mt-1 text-gray-600 dark:text-gray-300">{ALGO_INFO[algo].usage}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default MemorizePage
