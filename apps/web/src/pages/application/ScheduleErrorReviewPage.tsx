import { useState } from "react"
import ScheduleErrorReview from "./ScheduleErrorReview"
import { ErrorPatternViz } from "./ErrorPatternViz"

type Tab = "review" | "patterns"

export function ScheduleErrorReviewPage() {
  const [tab, setTab] = useState<Tab>("review")

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 w-fit shadow-sm">
          {([
            { id: "review" as Tab, label: "Error Review", icon: (
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )},
            { id: "patterns" as Tab, label: "Error Patterns", icon: (
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 003 0v-13A1.5 1.5 0 0015.5 2zM9.5 6A1.5 1.5 0 008 7.5v9a1.5 1.5 0 003 0v-9A1.5 1.5 0 009.5 6zM3.5 10A1.5 1.5 0 002 11.5v5a1.5 1.5 0 003 0v-5A1.5 1.5 0 003.5 10z" />
              </svg>
            )},
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "review" && <ScheduleErrorReview />}
        {tab === "patterns" && <ErrorPatternViz />}

      </main>
    </div>
  )
}

export default ScheduleErrorReviewPage
