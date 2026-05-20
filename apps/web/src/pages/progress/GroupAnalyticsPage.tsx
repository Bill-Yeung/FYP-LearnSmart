import { useEffect, useMemo, useState } from "react"
import { Button, Card } from "../../components"
import { AiGenerationNotice } from "../../components/ui/AiGenerationNotice"
import { apiClient } from "../../lib/api"
import { useProgressSignals } from "../../hooks/useProgressSignals"

type Classmate = {
  id: string
  username: string
}

type Assignment = {
  id: string
  title: string
  assignment_type: string
  due_at: string | null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function SmallBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-20 items-end gap-2">
      {values.map((value, index) => (
        <div key={index} className="flex-1">
          <div
            className="w-full rounded-md bg-gray-900/80 dark:bg-gray-100/80"
            style={{ height: `${clamp((value / max) * 100, 6, 100)}%` }}
            title={`${value}`}
          />
        </div>
      ))}
    </div>
  )
}

type GroupAnalyticsResult = {
  summary: string
  privacy_check: string
  signals: string[]
  recommended_actions: string[]
}

export function GroupAnalyticsPage() {
  const { loading, classes } = useProgressSignals()
  const [cohortId, setCohortId] = useState("")
  const [range, setRange] = useState("30d")
  const [detailLoading, setDetailLoading] = useState(false)
  const [classmates, setClassmates] = useState<Classmate[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [summary, setSummary] = useState<GroupAnalyticsResult | null>(null)

  useEffect(() => {
    if (!cohortId && classes.length > 0) {
      setCohortId(classes[0].id)
    }
  }, [classes, cohortId])

  useEffect(() => {
    if (!cohortId) {
      setClassmates([])
      setAssignments([])
      return
    }

    let active = true

    // pull the classmates and assignment list for the selected cohort
    const loadDetail = async () => {
      setDetailLoading(true)
      try {
        const response = await apiClient.get<{
          classmates?: Classmate[]
          assignments?: Assignment[]
        }>(`/api/classroom/${cohortId}`)

        if (!active) return
        setClassmates(response?.classmates ?? [])
        setAssignments(response?.assignments ?? [])
      } catch {
        if (!active) return
        setClassmates([])
        setAssignments([])
      } finally {
        if (active) {
          setDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [cohortId])

  const selectedClass = classes.find((group) => group.id === cohortId) ?? null

  // count assignments whose due date falls inside the next seven days
  const dueSoonCount = useMemo(() => {
    const now = new Date()
    const nextWeek = new Date(now)
    nextWeek.setDate(now.getDate() + 7)

    return assignments.filter((assignment) => {
      if (!assignment.due_at) return false
      const due = new Date(assignment.due_at)
      return due >= now && due <= nextWeek
    }).length
  }, [assignments])

  // bucket assignments into a monday-first weekday histogram for the chart
  const dueByWeekday = useMemo(() => {
    const counts = Array.from({ length: 7 }, () => 0)
    assignments.forEach((assignment) => {
      if (!assignment.due_at) return
      const weekday = new Date(assignment.due_at).getDay()
      const mondayIndex = weekday === 0 ? 6 : weekday - 1
      counts[mondayIndex] += 1
    })
    return counts
  }, [assignments])

  // ask the AI endpoint to write a short cohort-level brief from the signals
  const generateSummary = async () => {
    if (!selectedClass) return

    setIsGenerating(true)
    try {
      const data = await apiClient.post<Partial<GroupAnalyticsResult>>(
        "/api/progress-ai/group-summary",
        {
          cohort: selectedClass.name,
          range,
          classmateCount: classmates.length,
          assignmentCount: assignments.length,
          dueSoonCount,
          dueByWeekday
        }
      )

      setSummary({
        summary: data.summary?.trim() || "No summary returned.",
        privacy_check: data.privacy_check?.trim() || "No privacy note returned.",
        signals: Array.isArray(data.signals) ? data.signals.filter(Boolean).map((item) => String(item)) : [],
        recommended_actions: Array.isArray(data.recommended_actions)
          ? data.recommended_actions.filter(Boolean).map((item) => String(item))
          : []
      })
    } catch (error) {
      console.error(error)
      setSummary(null)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Group analytics</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Use live classroom data to generate an anonymized cohort summary.
        </p>
      </div>

      {isGenerating && (
        <AiGenerationNotice
          title="Summarising the cohort"
          description="The page is condensing the class workload and timing patterns into a short, privacy-aware overview."
          steps={["Collecting class signals", "Checking summary tone", "Preparing the final brief"]}
        />
      )}

      <Card title="Cohort selection" subtitle="Pick the class you want summarised. This page stays at the aggregated class level.">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Cohort</div>
            <select
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
              value={cohortId}
              onChange={(event) => setCohortId(event.target.value)}
            >
              <option value="">Select a class</option>
              {classes.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.course_code ? `${group.course_code} - ${group.name}` : group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Time range</div>
            <select
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950"
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </label>

          <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Privacy</div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Summary generation should only be used when cohort size is at least 5.
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          The summary works even if only one cohort is available because it summarizes one selected class at a time. Multiple cohorts only give you more class options, not a required comparison mode.
        </div>
      </Card>

      {loading || detailLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-gray-500 dark:text-gray-400">
          Loading cohort data...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs text-gray-500 dark:text-gray-400">Classmates</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{classmates.length}</div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Visible roster entries for the selected class</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs text-gray-500 dark:text-gray-400">Assignments</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{assignments.length}</div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Assignments returned by the classroom detail API</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs text-gray-500 dark:text-gray-400">Due in 7 days</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{dueSoonCount}</div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Upcoming assignment pressure for the current class</div>
            </div>
          </div>

          <Card title="Assignment due distribution" subtitle="Count of assignment due dates by weekday.">
            <div className="rounded-xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <SmallBars values={dueByWeekday} />
              <div className="mt-3 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={generateSummary} disabled={!selectedClass || isGenerating} className="w-full sm:w-auto">
                {isGenerating ? "Preparing..." : "Generate summary"}
              </Button>
            </div>
          </Card>

          <Card title="Upcoming assignments" subtitle="Current class workload shown even before the summary runs.">
            <div className="space-y-3">
              {assignments.length > 0 ? assignments.slice(0, 6).map((assignment) => (
                <div key={assignment.id} className="rounded-xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                      {assignment.assignment_type}
                    </span>
                    {assignment.due_at && (
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                        Due {new Date(assignment.due_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{assignment.title}</p>
                </div>
              )) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No assignments returned for the selected class.</p>
              )}
            </div>
          </Card>

          <Card title="Cohort summary" subtitle="Generated from the selected class and assignment signals.">
            <div className="space-y-4">
              {classmates.length < 4 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-100">
                  Cohort size is currently small. The summary can still run, but you should treat the privacy note below seriously.
                </div>
              )}

              {summary ? (
                <>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                    <p className="text-sm text-emerald-950 dark:text-emerald-100">{summary.summary}</p>
                  </div>

                  <div className="rounded-xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Privacy check
                    </p>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{summary.privacy_check}</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        Signals
                      </p>
                      <div className="mt-2 space-y-2">
                        {summary.signals.length > 0 ? summary.signals.map((signal, index) => (
                          <div key={`${signal}-${index}`} className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                            {signal}
                          </div>
                        )) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No signals returned.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        Recommended actions
                      </p>
                      <div className="mt-2 space-y-2">
                        {summary.recommended_actions.length > 0 ? summary.recommended_actions.map((action, index) => (
                          <div key={`${action}-${index}`} className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                            {action}
                          </div>
                        )) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No actions returned.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                  <p>Generate a summary when you want the current classroom signals distilled into a cohort-level brief.</p>
                  <p className="mt-2">
                    Current inputs: {classmates.length} classmates, {assignments.length} assignments, {dueSoonCount} due within 7 days.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
