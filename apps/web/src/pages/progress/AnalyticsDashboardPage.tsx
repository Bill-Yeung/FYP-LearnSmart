import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useProgressSignals } from "../../hooks/useProgressSignals"

type TabId = "overview" | "topics" | "workload" | "data"

type GapRow = {
  topic: string
  coveragePct: number
  masteredCount: number
  totalCount: number
}

type IntegrationRow = {
  name: string
  records: number
  detail: string
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// count consecutive days from today backwards that had any study activity
function computeStreak(weekly: Array<{ day: string; count: number }>): number {
  const countMap = new Map(weekly.map((entry) => [entry.day, entry.count]))
  const today = new Date()
  let streak = 0

  for (let index = 0; index < 56; index++) {
    const date = new Date(today)
    date.setDate(date.getDate() - index)
    const iso = toISODate(date)
    if ((countMap.get(iso) ?? 0) > 0) {
      streak += 1
    } else {
      break
    }
  }

  return streak
}

function intensityLevel(count: number): number {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

function Heatmap({ values }: { values: Array<{ iso: string; v: number }> }) {
  const map = useMemo(() => new Map(values.map((value) => [value.iso, value.v])), [values])
  const today = useMemo(() => new Date(), [])
  const cells: Array<{ iso: string; v: number }> = []

  for (let index = 55; index >= 0; index--) {
    const date = new Date(today)
    date.setDate(date.getDate() - index)
    const iso = toISODate(date)
    cells.push({ iso, v: map.get(iso) ?? 0 })
  }

  return (
    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-14">
      {cells.map((cell) => {
        const level = clamp(cell.v, 0, 4)
        const levelClass = [
          "border-[#d0d7de] bg-[#ebedf0] dark:border-[#223049] dark:bg-[#0f172a]",
          "border-[#b7d97d] bg-[#c6e48b] dark:border-[#1d5b35] dark:bg-[#143d24]",
          "border-[#68b55e] bg-[#7bc96f] dark:border-[#2a8553] dark:bg-[#1f6f43]",
          "border-[#1f8733] bg-[#239a3b] dark:border-[#3bb264] dark:bg-[#2fa856]",
          "border-[#6a4f36] bg-[#7d6247] dark:border-[#a28158] dark:bg-[#8c6f4d]"
        ][level]

        return (
          <div
            key={cell.iso}
            title={cell.iso}
            className={`h-4 rounded-[6px] border ${levelClass} sm:h-5`}
          />
        )
      })}
    </div>
  )
}

function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string; note: string }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">{item.value}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.note}</p>
        </div>
      ))}
    </div>
  )
}

function BrowserTabs({
  activeTab,
  onChange,
}: {
  activeTab: TabId
  onChange: (tab: TabId) => void
}) {
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "topics", label: "Topics" },
    { id: "workload", label: "Workload" },
    { id: "data", label: "Data" }
  ]

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-2 pt-2 dark:border-gray-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            "rounded-t-2xl border border-b-0 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "border-gray-200 bg-white text-gray-950 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
              : "border-transparent bg-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function MeterList({
  rows,
  max,
}: {
  rows: Array<{ label: string; value: number; meta?: string }>
  max: number
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-sm text-gray-500 dark:text-gray-400">No data available yet.</p>
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {rows.map((row) => {
        const pct = clamp((row.value / Math.max(max, 1)) * 100, 0, 100)
        return (
          <div key={`${row.label}-${row.meta || ""}`} className="grid gap-3 py-4 sm:grid-cols-[180px_minmax(0,1fr)_56px] sm:items-center">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.label}</p>
              {row.meta && <p className="text-xs text-gray-500 dark:text-gray-400">{row.meta}</p>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 sm:text-right">{row.value}</div>
          </div>
        )
      })}
    </div>
  )
}

function DataRows({ rows }: { rows: IntegrationRow[] }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {rows.map((row) => (
        <div key={row.name} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_90px]">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{row.detail}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.records}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              {row.records > 0 ? "Available" : "Empty"}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsDashboardPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const {
    loading,
    patterns,
    allErrors,
    dueErrors,
    masteredCount,
    flashcards,
    questionCount,
    documentsTotal,
    learningPaths,
    classes
  } = useProgressSignals()

  // recompute the user's review streak whenever weekly patterns change
  const streak = useMemo(() => (patterns ? computeStreak(patterns.weekly) : 0), [patterns])
  const totalErrors = allErrors.length
  const masteryRate = totalErrors > 0 ? Math.round((masteredCount / totalErrors) * 100) : 0
  const todayISO = useMemo(() => toISODate(new Date()), [])

  const flashcardsDueNow = useMemo(
    () =>
      flashcards.filter((flashcard) =>
        flashcard.status === "overdue" || Boolean(flashcard.next_due?.startsWith(todayISO))
      ).length,
    [flashcards, todayISO]
  )

  // turn the raw weekly counts into intensity-tier heatmap cells
  const heatmapValues = useMemo(() => {
    if (!patterns) return []
    return patterns.weekly.map((entry) => ({
      iso: entry.day,
      v: intensityLevel(entry.count)
    }))
  }, [patterns])

  // pick the top six topics and categories to display in the meter lists
  const topTopics = useMemo(() => (patterns ? [...patterns.by_topic].slice(0, 6) : []), [patterns])
  const topCategories = useMemo(() => (patterns ? [...patterns.by_category].slice(0, 6) : []), [patterns])
  const maxTopicCount = useMemo(() => Math.max(...topTopics.map((topic) => topic.count), 1), [topTopics])
  const maxCategoryCount = useMemo(
    () => Math.max(...topCategories.map((category) => category.count), 1),
    [topCategories]
  )

  // build the topics-to-work-on table by joining patterns with mastery state
  const gapRows = useMemo<GapRow[]>(() => {
    if (!patterns) return []

    return patterns.by_topic
      .map((topicEntry) => {
        const total = topicEntry.count
        const mastered = allErrors.filter(
          (error) => error.topic === topicEntry.topic && error.is_mastered
        ).length
        const coveragePct = total > 0 ? Math.round((mastered / total) * 100) : 0
        return {
          topic: topicEntry.topic,
          coveragePct,
          masteredCount: mastered,
          totalCount: total
        }
      })
      .sort((a, b) => {
        if (a.coveragePct !== b.coveragePct) return a.coveragePct - b.coveragePct
        return b.totalCount - a.totalCount
      })
      .slice(0, 8)
  }, [patterns, allErrors])

  const weakestTopic = gapRows[0] ?? null

  const flashcardStatusRows = useMemo(() => {
    const buckets = new Map<string, number>()
    flashcards.forEach((flashcard) => {
      const label = flashcard.status || "scheduled"
      buckets.set(label, (buckets.get(label) || 0) + 1)
    })

    return [...buckets.entries()]
      .map(([label, value]) => ({ label, value, meta: "Flashcards" }))
      .sort((a, b) => b.value - a.value)
  }, [flashcards])

  const categoryRows = useMemo(
    () =>
      topCategories.map((category) => ({
        label: category.category_label || category.error_category,
        value: category.count,
        meta: "Error type"
      })),
    [topCategories]
  )

  // summarise record counts across the connected study data sources
  const integrations = useMemo<IntegrationRow[]>(
    () => [
      { name: "Error book", records: totalErrors, detail: "Mistakes and reviews you have logged." },
      { name: "Flashcards", records: flashcards.length, detail: "Cards currently in your schedule." },
      { name: "Question bank", records: questionCount, detail: "Practice questions available." },
      { name: "Documents", records: documentsTotal, detail: "Study documents available in knowledge base." },
      { name: "Study plans", records: learningPaths.length, detail: "Saved pathway records." },
      { name: "Classes", records: classes.length, detail: "Groups available for class-level views." }
    ],
    [classes.length, documentsTotal, flashcards.length, learningPaths.length, questionCount, totalErrors]
  )

  const metricItems = [
    {
      label: "Review streak",
      value: streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""}` : "No streak",
      note: "Days in a row with study activity."
    },
    {
      label: "Due now",
      value: String(dueErrors.length + flashcardsDueNow),
      note: "Items waiting for review."
    },
    {
      label: "Mastery",
      value: totalErrors > 0 ? `${masteryRate}%` : "No data",
      note: "How much of your error log is marked mastered."
    },
    {
      label: "Weakest topic",
      value: weakestTopic?.topic || "No data",
      note: weakestTopic ? `${weakestTopic.coveragePct}% mastered so far.` : "No topic pattern yet."
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-500 dark:text-gray-400">
        Loading analytics...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
          Progress overview
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          See what needs attention and where you are improving.
        </p>
      </div>

      <MetricStrip items={metricItems} />

      <section className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <BrowserTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="px-5 py-6 sm:px-6">
          {activeTab === "overview" && (
            <div className="grid gap-8 xl:grid-cols-[1.1fr_.9fr]">
              <div>
                <div className="mb-3 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span>Study activity</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Last 8 weeks</span>
                </div>
                <Heatmap values={heatmapValues} />
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => navigate("/application/schedule-review")}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-200 px-4 py-4 text-left transition-colors hover:border-gray-900 dark:border-gray-800 dark:hover:border-gray-200"
                >
                  <div>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Review what is due</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Clear your backlog first.</p>
                  </div>
                  <span className="text-sm font-medium text-sky-700 dark:text-sky-300">Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/progress/pathway")}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-200 px-4 py-4 text-left transition-colors hover:border-gray-900 dark:border-gray-800 dark:hover:border-gray-200"
                >
                  <div>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Make a study plan</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Turn weak topics into your next session.</p>
                  </div>
                  <span className="text-sm font-medium text-sky-700 dark:text-sky-300">Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/progress/group")}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-200 px-4 py-4 text-left transition-colors hover:border-gray-900 dark:border-gray-800 dark:hover:border-gray-200"
                >
                  <div>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Check group progress</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">See the class-level view when needed.</p>
                  </div>
                  <span className="text-sm font-medium text-sky-700 dark:text-sky-300">Open</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "topics" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Most missed topics</h2>
                <div className="mt-3">
                  <MeterList
                    rows={topTopics.map((topic) => ({ label: topic.topic, value: topic.count, meta: "Mistakes logged" }))}
                    max={maxTopicCount}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Topics to work on next</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[520px] w-full text-sm">
                    <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-[0.16em] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      <tr>
                        <th className="pb-3 pr-4">Topic</th>
                        <th className="pb-3 pr-4">Mastered</th>
                        <th className="pb-3">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapRows.map((row) => (
                        <tr key={row.topic} className="border-b border-gray-100 dark:border-gray-900">
                          <td className="py-4 pr-4 font-medium text-gray-900 dark:text-gray-100">{row.topic}</td>
                          <td className="py-4 pr-4 text-gray-700 dark:text-gray-300">{row.coveragePct}%</td>
                          <td className="py-4 text-gray-600 dark:text-gray-400">
                            {row.masteredCount} of {row.totalCount} errors mastered
                          </td>
                        </tr>
                      ))}
                      {gapRows.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-sm text-gray-500 dark:text-gray-400">
                            No topic data available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "workload" && (
            <div className="grid gap-8 xl:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Flashcard queue</h2>
                <div className="mt-3">
                  <MeterList rows={flashcardStatusRows} max={Math.max(...flashcardStatusRows.map((row) => row.value), 1)} />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Error types</h2>
                <div className="mt-3">
                  <MeterList rows={categoryRows} max={maxCategoryCount} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Available study data</h2>
              <div className="mt-3">
                <DataRows rows={integrations} />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
