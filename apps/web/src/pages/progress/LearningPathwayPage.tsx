import { useMemo, useState } from "react"
import { Button, Card } from "../../components"
import { AiGenerationNotice } from "../../components/ui/AiGenerationNotice"
import { apiClient } from "../../lib/api"
import { useProgressSignals } from "../../hooks/useProgressSignals"

type GoalKey = "Exam prep" | "Project mastery" | "Skill building"

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

type PathwayResult = {
  session_plan: string[]
  rationale: string
  recommended_order: string[]
  watchouts: string[]
}

export function LearningPathwayPage() {
  const {
    loading,
    patterns,
    allErrors,
    dueErrors,
    flashcards,
    questionCount,
    learningPaths
  } = useProgressSignals()

  const [goal, setGoal] = useState<GoalKey>("Exam prep")
  const [timeBudget, setTimeBudget] = useState<number>(45)
  const [targetDifficulty, setTargetDifficulty] = useState<"Adaptive" | "Easier" | "Harder">("Adaptive")
  const [isGenerating, setIsGenerating] = useState(false)
  const [pathway, setPathway] = useState<PathwayResult | null>(null)

  // pick the five lowest-mastery topics to feed into the pathway prompt
  const weakTopics = useMemo(() => {
    if (!patterns) return []

    return patterns.by_topic
      .map((topicEntry) => {
        const total = topicEntry.count
        const mastered = allErrors.filter(
          (error) => error.topic === topicEntry.topic && error.is_mastered
        ).length
        const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0

        return {
          topic: topicEntry.topic,
          errors: total,
          masteredPct
        }
      })
      .sort((a, b) => a.masteredPct - b.masteredPct)
      .slice(0, 5)
  }, [patterns, allErrors])

  const scaledBudget = clamp(timeBudget, 10, 180)

  // call the AI endpoint to draft a session plan from the chosen settings
  const generatePathway = async () => {
    setIsGenerating(true)
    try {
      const data = await apiClient.post<Partial<PathwayResult>>(
        "/api/progress-ai/learning-pathway",
        {
          goal,
          timeBudget: scaledBudget,
          targetDifficulty,
          weakTopics,
          dueErrors: dueErrors.length,
          scheduledFlashcards: flashcards.length,
          questionCount,
          savedLearningPaths: learningPaths.map((path) => path.title).slice(0, 5)
        }
      )

      setPathway({
        session_plan: Array.isArray(data.session_plan) ? data.session_plan.filter(Boolean).map((item) => String(item)) : [],
        rationale: data.rationale?.trim() || "No rationale returned.",
        recommended_order: Array.isArray(data.recommended_order)
          ? data.recommended_order.filter(Boolean).map((item) => String(item))
          : [],
        watchouts: Array.isArray(data.watchouts) ? data.watchouts.filter(Boolean).map((item) => String(item)) : []
      })
    } catch (error) {
      console.error(error)
      setPathway(null)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learning pathway</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Build the next session from live progress signals.
        </p>
      </div>

      {isGenerating && (
        <AiGenerationNotice
          title="Designing your next study session"
          description="The page is weighing your weak topics, review load, flashcards, and saved pathways to shape a realistic plan."
          steps={["Reviewing progress signals", "Balancing your session", "Arranging the best order"]}
        />
      )}

      <Card title="Pathway settings" subtitle="Tune the pathway constraints before generating the plan.">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Goal</div>
            <select
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
              value={goal}
              onChange={(event) => setGoal(event.target.value as GoalKey)}
            >
              {(["Exam prep", "Project mastery", "Skill building"] as GoalKey[]).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Time budget (min)</div>
            <input
              type="number"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
              value={timeBudget}
              onChange={(event) => setTimeBudget(parseInt(event.target.value || "0", 10))}
              min={10}
              max={180}
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Difficulty</div>
            <select
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
              value={targetDifficulty}
              onChange={(event) => setTargetDifficulty(event.target.value as "Adaptive" | "Easier" | "Harder")}
            >
              <option>Adaptive</option>
              <option>Easier</option>
              <option>Harder</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={generatePathway} disabled={loading || isGenerating} className="w-full sm:w-auto">
            {isGenerating ? "Preparing..." : "Generate pathway"}
          </Button>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          This action creates a fresh next-session plan from your current weak topics, due review load, flashcards, question bank, and saved pathway titles.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Weak topics in scope" subtitle="Lowest mastery topics derived from the current error book.">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading topic coverage...</p>
          ) : weakTopics.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No weak topics available yet.</p>
          ) : (
            <div className="space-y-3">
              {weakTopics.map((topic) => (
                <div key={topic.topic} className="rounded-2xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{topic.topic}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{topic.masteredPct}% mastered</div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {topic.errors} logged error{topic.errors !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Plan inputs" subtitle="These are the signals the generator will use.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Due errors
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{dueErrors.length}</p>
            </div>
            <div className="rounded-2xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Scheduled flashcards
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{flashcards.length}</p>
            </div>
            <div className="rounded-2xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Question bank
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{questionCount}</p>
            </div>
            <div className="rounded-2xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Existing pathways
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{learningPaths.length}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              Existing pathway titles used as context
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {learningPaths.length > 0 ? learningPaths.slice(0, 5).map((path) => (
                <span key={path.id} className="rounded-full border bg-gray-50 px-3 py-1 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                  {path.title}
                </span>
              )) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No saved pathway titles returned yet.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {pathway && (
        <Card title="Generated study plan" subtitle="Built from the current pathway settings and progress signals.">
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <p className="text-sm text-emerald-950 dark:text-emerald-100">{pathway.rationale}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Session plan
                </p>
                <div className="mt-2 space-y-2">
                  {pathway.session_plan.length > 0 ? pathway.session_plan.map((step, index) => (
                    <div key={`${step}-${index}`} className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                      {step}
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No session steps returned.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Recommended order
                </p>
                <div className="mt-2 space-y-2">
                  {pathway.recommended_order.length > 0 ? pathway.recommended_order.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                      {item}
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No ordering guidance returned.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Watchouts
                </p>
                <div className="mt-2 space-y-2">
                  {pathway.watchouts.length > 0 ? pathway.watchouts.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                      {item}
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No watchouts returned.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
