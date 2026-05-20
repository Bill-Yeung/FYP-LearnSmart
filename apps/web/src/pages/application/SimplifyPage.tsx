import { useState } from "react"
import { SimplifyConcept } from "./SimplifyConcept"
import { CheckUnderstanding } from "./CheckUnderstanding"
import { ReflectOnTeaching } from "./ReflectOnTeaching"
import { useToast } from "../../contexts"

type Tab = "simplify" | "check" | "reflect"

const TABS: { id: Tab; label: string; when: string; what: string; example: string; color: string }[] = [
  {
    id: "simplify",
    label: "Adjust Level",
    when: "Use when your explanation is too complex or too simple",
    what: "Rewrites your explanation at the level you choose — from Beginner to University. Shows both versions side by side so you can compare.",
    example: "You wrote a university-level explanation but need to explain it to a 12-year-old, or vice versa.",
    color: "blue",
  },
  {
    id: "check",
    label: "Check Understanding",
    when: "Use when you want to know if your explanation is correct",
    what: "AI reads your explanation and highlights any wrong, missing, or unclear parts. Each issue is rated as Critical, Major, or Minor with a suggested fix.",
    example: "You explained Newton's First Law but forgot to mention inertia and AI will flag it.",
    color: "amber",
  },
  {
    id: "reflect",
    label: "Reflect on Teaching",
    when: "Use when you want to improve how you explain things",
    what: "AI acts as your student and gives structured feedback: what you did well, what gaps exist, and what to study next.",
    example: "You explained photosynthesis and AI tells you the strengths, missing links, and gives you follow-up questions to deepen understanding.",
    color: "purple",
  },
]

const COLOR_MAP: Record<string, { tab: string; card: string; badge: string; dot: string }> = {
  blue:   { tab: "bg-blue-600 text-white",   card: "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/10",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",   dot: "bg-blue-500" },
  amber:  { tab: "bg-amber-500 text-white",  card: "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", dot: "bg-amber-500" },
  purple: { tab: "bg-purple-600 text-white", card: "border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-900/10", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", dot: "bg-purple-500" },
}

export function SimplifyPage() {
  const [activeTab, setActiveTab] = useState<Tab>("simplify")
  const [showGuide, setShowGuide] = useState(true)
  const { showToast } = useToast()

  const current = TABS.find(t => t.id === activeTab)!
  const colors = COLOR_MAP[current.color]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Explanation Tools</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              3 tools to help you explain, verify, and improve your understanding of any concept.
            </p>
          </div>
          <button
            onClick={() => setShowGuide(v => !v)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 mt-1"
          >
            {showGuide ? "Hide guide" : "Which tool should I use?"}
          </button>
        </div>

        {/* How to choose guide */}
        {showGuide && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Which tool should I use?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TABS.map((tab, i) => {
                const c = COLOR_MAP[tab.color]
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setShowGuide(false) }}
                    className={`text-left rounded-xl border p-3 space-y-1.5 transition hover:shadow-sm ${c.card} ${activeTab === tab.id ? "ring-2 ring-offset-1 ring-indigo-400" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${c.dot}`}>{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tab.label}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{tab.when}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{tab.what}</p>
                    <p className="text-xs italic text-gray-400 dark:text-gray-500">{tab.example}</p>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
              Tip: Start with <strong>Check Understanding</strong> to find mistakes, then use <strong>Reflect on Teaching</strong> to improve, and <strong>Adjust Level</strong> to adapt for your audience.
            </p>
          </div>
        )}

        {/* Tab bar */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 flex gap-1">
          {TABS.map(tab => {
            const c = COLOR_MAP[tab.color]
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? c.tab
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200",
                ].join(" ")}
              >
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Active tab banner */}
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${colors.card}`}>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{current.label}: {current.when}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{current.what}</p>
            <p className="text-xs italic text-gray-400 dark:text-gray-500 mt-0.5">{current.example}</p>
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "simplify" && <SimplifyConcept onToast={showToast} />}
          {activeTab === "check"    && <CheckUnderstanding onToast={showToast} />}
          {activeTab === "reflect"  && <ReflectOnTeaching onToast={showToast} />}
        </div>

      </main>
    </div>
  )
}

export default SimplifyPage
