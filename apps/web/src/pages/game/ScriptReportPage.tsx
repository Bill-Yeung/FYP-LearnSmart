import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { EditableNoteModal } from "../../components/shared/EditableNoteModal"
import * as api from "../../api/playGame"
import { BarChart3, TrendingUp, BookOpen, Target, Zap, CalendarDays, CheckCircle2, Eye, FileText, AlertTriangle, GraduationCap, ArrowUpRight, Clipboard, Lightbulb, Code2, Database, Settings, Shield, Cpu, Network, Lock, Wrench, Brain, Zap as Zap2, Layers, Cog } from "lucide-react"
import type { ScriptReportDTO } from "../../types/game.dto"

function getConceptIcon(emojiOrName: string | null | undefined): React.ReactNode {
  if (!emojiOrName) return <BookOpen className="w-4 h-4" />
  
  const iconMap: { [key: string]: React.ReactNode } = {
    "🔑": <Lightbulb className="w-4 h-4 text-amber-500" />,
    "🌿": <Brain className="w-4 h-4 text-emerald-500" />,
    "⚙️": <Cog className="w-4 h-4 text-slate-600" />,
    "🛡️": <Shield className="w-4 h-4 text-sky-500" />,
    "💾": <Database className="w-4 h-4 text-indigo-500" />,
    "🔧": <Wrench className="w-4 h-4 text-orange-500" />,
    "📡": <Network className="w-4 h-4 text-purple-500" />,
    "🔐": <Lock className="w-4 h-4 text-red-500" />,
    "⚡": <Zap2 className="w-4 h-4 text-yellow-500" />,
    "💡": <Lightbulb className="w-4 h-4 text-amber-500" />,
    "📚": <BookOpen className="w-4 h-4 text-blue-500" />,
    "🎯": <Target className="w-4 h-4 text-rose-500" />,
    "⚙": <Settings className="w-4 h-4 text-slate-600" />,
    "🏗️": <Layers className="w-4 h-4 text-teal-500" />,
    "🖥️": <Cpu className="w-4 h-4 text-gray-600" />,
    "🔀": <Code2 className="w-4 h-4 text-cyan-500" />,
    "key": <Lightbulb className="w-4 h-4 text-amber-500" />,
    "concept": <Brain className="w-4 h-4 text-emerald-500" />,
    "setting": <Cog className="w-4 h-4 text-slate-600" />,
    "security": <Shield className="w-4 h-4 text-sky-500" />,
    "database": <Database className="w-4 h-4 text-indigo-500" />,
    "tool": <Wrench className="w-4 h-4 text-orange-500" />,
    "network": <Network className="w-4 h-4 text-purple-500" />,
    "lock": <Lock className="w-4 h-4 text-red-500" />,
  }
  
  return iconMap[emojiOrName] || <BookOpen className="w-4 h-4" />
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (accuracy >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function getReasonText(reason: string): string {
  const reasonMap: { [key: string]: string } = {
    high_error_rate: "High Error Rate",
    low_accuracy: "Low Accuracy",
    hints_heavy: "Hints Dependent",
    needs_practice: "Needs Practice"
  }
  return reasonMap[reason] || reason
}

function getPriorityBadge(priority: number) {
  const colors = [
    "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    "bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-200",
    "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200",
    "bg-orange-200 text-orange-800 dark:bg-orange-700 dark:text-orange-200",
    "bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-200"
  ]
  const priorityLabels = ["None", "Low", "Medium", "High", "Critical"]
  return {
    color: colors[Math.min(priority - 1, 4)] || colors[0],
    label: priorityLabels[priority] || "Unknown"
  }
}

function getMasteryColor(masteryLevel: number): { bg: string; text: string; dot: string } {
  if (masteryLevel >= 90) return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" }
  if (masteryLevel >= 75) return { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" }
  if (masteryLevel >= 60) return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" }
  if (masteryLevel >= 40) return { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" }
  return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" }
}

function getDaysUntilForget(lastAttemptDate: string | null | undefined): { days: number; label: string; color: string } {
  if (!lastAttemptDate) return { days: 0, label: "Never attempted", color: "text-slate-500" }
  
  const last = new Date(lastAttemptDate)
  const now = new Date()
  const daysAgo = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysAgo < 1) return { days: daysAgo, label: "Today", color: "text-emerald-600" }
  if (daysAgo < 3) return { days: daysAgo, label: `${daysAgo} days ago`, color: "text-sky-600" }
  if (daysAgo < 7) return { days: daysAgo, label: `${daysAgo} days ago`, color: "text-amber-600" }
  return { days: daysAgo, label: `${daysAgo} days ago`, color: "text-red-600" }
}

export function ScriptReportPage() {
  const { scriptId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const stateDocumentName = (location.state as any)?.documentName
  const [script, setScript] = useState<ScriptReportDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNote, setSelectedNote] = useState<{title: string, content: string, knowledgeId?: string} | null>(null)

  useEffect(() => {
    if (!scriptId) return
    api.getScriptReport(scriptId)
      .then(res => {
        setScript(res)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError("Failed to load script report.")
        setLoading(false)
      })
  }, [scriptId])

  const totalTimeLabel = useMemo(
    () => (script ? minutesToTime(script.stats.totalTimeMinutes) : "0m"),
    [script?.stats.totalTimeMinutes],
  )

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-slate-500">Loading your learning report...</div>
      </div>
    )
  }

  if (error || !script) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-red-500">{error || "Report not found"}</div>
      </div>
    )
  }

  const maxActivity = Math.max(...(script.stats.activity?.length ? script.stats.activity : [1]))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      
      {/* Background Gradient */}
      <div className="w-full bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 rounded-b-[3rem] shadow-sm pt-8 pb-16 px-6 relative z-0">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
            <div className="text-white min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight break-words leading-tight">
                <span className="inline-flex items-center gap-2"><BarChart3 className="w-7 h-7" />{(stateDocumentName || script.documentName) ? `${(stateDocumentName || script.documentName)} - ${script.moduleName || script.name}` : script.moduleName || script.name}</span>
              </h1>
              <p className="mt-2 flex items-center gap-2 text-blue-100 font-medium">
                Personalized learning report and review plan
              </p>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <button 
                onClick={() => navigate(`/game/play?scriptId=${scriptId}`, { state: { scriptId: scriptId } })}
                className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 font-medium text-white backdrop-blur-md transition-colors hover:bg-white/30 whitespace-nowrap"
              >
                <Target className="w-5 h-5" />
                Play Again
              </button>
              <button 
                onClick={() => navigate('/flashcards')}
                className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 font-medium text-white backdrop-blur-md transition-colors hover:bg-white/30 whitespace-nowrap"
              >
                <BookOpen className="w-5 h-5" />
                Review Flashcards
              </button>
              <button 
                onClick={() => navigate(`/game/my-scripts`)}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-blue-600 shadow-sm transition-all hover:bg-blue-50 whitespace-nowrap"
              >
                <ArrowUpRight className="w-5 h-5" />
                Back to Scripts
              </button>
            </div>
          </header>
        </div>
      </div>
      
      <main className="relative z-10 mx-auto max-w-7xl px-4 md:px-6 -mt-4 pt-6 pb-20">

        {/* Phase 1: Learning progress and answer performance */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 mb-6 mt-4">
          {/* Learning statistics */}
          <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 min-h-[300px]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <TrendingUp className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                <span>Learning Statistics</span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Current session metrics</span>
            </div>
            <div className="flex-1 space-y-4 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Current Session</div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Session Time</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-500">{totalTimeLabel}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Session Completion</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-500">{script.stats.completionRate}%</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Session Count</div>
                <div className="text-lg font-bold text-sky-600 dark:text-sky-500">{script.stats.sessions}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Last Review</div>
                <div className="text-sm font-bold text-violet-600 dark:text-violet-500">{script.stats.lastReviewed}</div>
              </div>
            </div>
          </section>

          {/* Cumulative historical progress */}
          <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 min-h-[300px]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <BookOpen className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                <span>Historical Progress</span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">All-time cumulative</span>
            </div>
            <div className="flex-1 space-y-4 px-4 py-4">
              {script.historyStats ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Overall Completion</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-500">{script.historyStats.completionRate}%</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Total Sessions</div>
                    <div className="text-lg font-bold text-sky-600 dark:text-sky-500">{script.historyStats.sessions}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Last Review</div>
                    <div className="text-sm font-bold text-violet-600 dark:text-violet-500">{script.historyStats.lastReviewed}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">All-time Learning Time</div>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-500">{minutesToTime(script.historyStats.totalTimeMinutes)}</div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                  Historical completion data will appear here after multiple review sessions.
                </div>
              )}
            </div>
          </section>

           {/* Answer performance stats - Phase 1 */}
           <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 min-h-[300px]">
             <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
               <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                 <Target className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                  <span>Answer Performance</span>
               </h3>
             </div>
             <div className="flex-1 space-y-4 px-4 py-4">
               <div className="flex items-center justify-between rounded-xl border-l-4 border-l-blue-400 bg-blue-50/60 p-3 dark:border-l-blue-500 dark:bg-blue-900/10">
                 <div className="flex flex-col">
                   <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Accuracy</div>
                   <div className="mt-0.5 text-[10px] text-slate-400">{script.performance.correctAnswers}/{script.performance.totalQuestions} correct</div>
                 </div>
                 <div className={`text-xl font-bold ${getAccuracyColor(script.performance.accuracy)}`}>
                  {script.performance.accuracy.toFixed(1)}%
                </div>
               </div>
               <div className="flex items-center justify-between rounded-xl border-l-4 border-l-indigo-400 bg-indigo-50/60 p-3 dark:border-l-indigo-500 dark:bg-indigo-900/10">
                 <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">First Attempt</div>
                 <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{script.performance.firstAttemptAccuracy.toFixed(1)}%</div>
               </div>
               <div className="flex items-center justify-between rounded-xl border-l-4 border-l-emerald-400 bg-emerald-50/60 p-3 dark:border-l-emerald-500 dark:bg-emerald-900/10">
                 <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Improvement</div>
                 <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {script.performance.improvementRate > 0 ? '+' : ''}{script.performance.improvementRate.toFixed(1)}%
                </div>
               </div>
               <div className="flex items-center justify-between rounded-xl border-l-4 border-l-purple-400 bg-purple-50/60 p-3 dark:border-l-purple-500 dark:bg-purple-900/10">
                 <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Hints Usage</div>
                 <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{script.performance.hintsUsageRate.toFixed(1)}%</div>
               </div>
             </div>
           </section>

          {/* Learning efficiency - Combine speed & answers details */}
          <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 min-h-[300px]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Zap className="w-5 h-5" />
                <span>Learning Efficiency</span>
              </h3>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-6 px-5 py-5">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Avg Time Per Question</div>
                <div className="text-4xl font-bold text-slate-800 dark:text-slate-100">{script.performance.averageTimePerQuestion.toFixed(1)}s</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Correct</div>
                  <div className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-500">{script.performance.correctAnswers}</div>
                </div>
                <div className="text-slate-300 dark:text-slate-700">/</div>
                <div className="flex-1 text-center rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Wrong</div>
                  <div className="mt-1 text-xl font-bold text-rose-500 dark:text-rose-500">{script.performance.wrongAnswers}</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Learning activity chart */}
        <section className="mb-6 flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <CalendarDays className="w-5 h-5" />
              <span>Learning Activity (Last 7 Days)</span>
            </h3>
          </div>
          <div className="px-4 py-4">
            {script.stats.activity.length > 0 ? (
              <div className="space-y-2">
                <div className="relative h-44 overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2">
                  <div className="absolute inset-0 grid grid-rows-4">
                    {[...Array(4)].map((_, idx) => (
                      <div key={idx} className="border-t border-dashed border-slate-200 dark:border-slate-700"></div>
                    ))}
                  </div>
                  <div className="relative z-10 h-full grid grid-cols-7 gap-2 items-end">
                    {script.stats.activity.map((val, idx) => {
                      const heightPercent = maxActivity > 0 ? (val / maxActivity) * 100 : 0
                      const displayHeight = Math.max(heightPercent, 8)
                      return (
                        <div key={idx} className="flex h-full flex-col items-center justify-end gap-1">
                          <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">{val}m</span>
                          <div className="flex h-full w-full items-end">
                            <div
                              className="w-full rounded-t-lg bg-gradient-to-t from-violet-700 to-violet-400 dark:from-violet-300 dark:to-violet-500 transition-all"
                              style={{ height: `${displayHeight}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-[10px] text-slate-500">
                  {script.stats.activity.map((_, idx) => {
                    const label = idx === script.stats.activity.length - 1 ? "Today" : `${script.stats.activity.length - idx - 1}d`
                    return (
                      <span key={idx} className="text-center text-xs">{label}</span>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex w-full items-center justify-center py-8 text-sm text-slate-400">No activity data for last 7 days</div>
            )}
          </div>
        </section>

        {/* Phase 2: Concept mastery and review recommendations */}
        <div className="grid gap-5 md:grid-cols-2 mb-6">
          {/* Concept mastery details */}
          <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                <span>Key Concepts Mastered</span>
              </h3>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {script.keyConcepts.filter(c => c.isMastered).length} / {script.keyConcepts.length}
              </span>
            </div>
            <div className="flex-1 space-y-2.5 px-4 py-4 max-h-96 overflow-y-auto">
              {script.keyConcepts.map((concept, idx) => {
                const masteryColor = getMasteryColor(concept.masteryLevel || 0)
                const forgetInfo = getDaysUntilForget(concept.lastAttemptDate)
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-lg border ${masteryColor.bg} border-slate-200 p-3 dark:border-slate-600 dark:bg-slate-900/40 transition-all hover:shadow-sm`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/60 text-sm dark:bg-slate-800">
                      {getConceptIcon(concept.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-100">
                          {concept.text}
                        </span>
                        {concept.isMastered && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      {concept.totalAttempts !== undefined && concept.totalAttempts > 0 && (
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {concept.correctCount}/{concept.totalAttempts} correct
                          {concept.hintsUsed !== undefined && concept.hintsUsed > 0 && (
                            <span className="inline-flex items-center gap-1">
                              Hints×{concept.hintsUsed >= 999 ? <><Eye className="w-3 h-3" />Viewed</> : concept.hintsUsed}
                            </span>
                          )}
                        </div>
                      )}
                      {concept.masteryLevel !== undefined && concept.masteryLevel > 0 && (
                        <div className="mt-1.5 w-full bg-slate-200/50 rounded-full h-1.5 dark:bg-slate-700/50">
                          <div 
                            className={`${masteryColor.dot} h-1.5 rounded-full transition-all`}
                            style={{ width: `${concept.masteryLevel}%` }}
                          ></div>
                        </div>
                      )}
                      {concept.personalNotes && (
                        <div className="mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (concept.personalNotes) {
                                setSelectedNote({ title: concept.text || "Concept", content: concept.personalNotes, knowledgeId: concept.knowledgeId });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View My Notes
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="text-right">
                        <div className={`text-xl font-bold ${masteryColor.text}`}>
                          {concept.masteryLevel || 0}%
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">mastery</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-medium ${forgetInfo.color}`}>
                          {forgetInfo.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">last review</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Common mistakes - Phase 2 */}
          <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <AlertTriangle className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                <span>Common Mistakes {script.wrongAnswerConcepts && `(${script.wrongAnswerConcepts.length})`}</span>
              </h3>
            </div>
            {!script.wrongAnswerConcepts || script.wrongAnswerConcepts.length === 0 ? (
              <div className="m-4 flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-center dark:border-slate-800">
                <Target className="w-10 h-10 text-slate-500 mb-2" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Excellent! No common mistakes recorded.</p>
              </div>
            ) : (
              <div className="flex-1 space-y-2 px-4 py-4 max-h-96 overflow-y-auto">
                {script.wrongAnswerConcepts.map((concept, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded border-l-4 border-orange-400 bg-orange-50 p-3 dark:border-orange-600 dark:bg-orange-900/20"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-lg">
                      {getConceptIcon(concept.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {concept.conceptName}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="inline-block bg-red-200 text-red-800 px-2 py-0.5 rounded dark:bg-red-900/40 dark:text-red-300">
                          Errors×{concept.errorCount}
                        </span>
                        {concept.hintsUsedTotal > 0 && (
                          <span className="text-slate-500">
                            Hints×{concept.hintsUsedTotal >= 999 ? <><Eye className="w-3 h-3 inline-block mr-1" />Viewed</> : concept.hintsUsedTotal}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Last error: {concept.lastErrorDate}
                      </div>
                      {concept.personalNotes && (
                        <div className="mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (concept.personalNotes) {
                                setSelectedNote({ title: concept.conceptName || "Concept", content: concept.personalNotes, knowledgeId: concept.knowledgeId });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View My Notes
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/game/learn-more?id=${concept.knowledgeId}`, { state: { scriptId: script.scriptId } })}
                      className="ml-2 flex items-center justify-center rounded-lg bg-orange-100 p-2 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60 transition-colors"
                      title="Review Concept"
                    >
                      <span className="text-sm"><ArrowUpRight className="w-4 h-4 inline-block" /></span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Review recommendations - Phase 2 */}
        <section className="mb-6 flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <GraduationCap className="w-5 h-5" />
              <span>Personalized Review Recommendations</span>
            </h3>
          </div>
          {!script.reviewRecommendations || script.reviewRecommendations.length === 0 ? (
             <div className="m-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-10 text-center dark:border-slate-800">
               <GraduationCap className="w-12 h-12 text-amber-500 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">You have no specific areas to review!</p>
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">Keep up the good work and challenge yourself with a new script.</p>
             </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              {script.reviewRecommendations.map((rec, idx) => {
                const badge = getPriorityBadge(rec.priority)
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700 dark:bg-slate-900/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {rec.conceptName}
                        </span>
                        <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                        <span className="inline-block bg-slate-200 text-slate-800 px-2 py-1 rounded text-xs dark:bg-slate-700 dark:text-slate-200">
                          Reason: {getReasonText(rec.reason)}
                        </span>
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {rec.suggestedResources && rec.suggestedResources.length > 0 ? (
                          rec.suggestedResources.map((resource, rIdx) => (
                            <button
                              key={rIdx}
                              onClick={() => navigate(`/game/learn-more?id=${rec.conceptId}`, { state: { scriptId: script.scriptId } })}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors"
                            >
                              {resource.type === "flashcard" ? <><Clipboard className="w-4 h-4 inline-block mr-1" /> Review Flashcards</> : <><FileText className="w-4 h-4 inline-block mr-1" /> Practice Similar</> } <ArrowUpRight className="w-4 h-4 inline-block" />
                            </button>
                          ))
                        ) : (
                          <button 
                            onClick={() => navigate(`/game/learn-more?id=${rec.conceptId}`, { state: { scriptId: script.scriptId } })}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300"
                          >
                            <Clipboard className="w-4 h-4 inline-block mr-1" /> Start Review <ArrowUpRight className="w-4 h-4 inline-block" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <EditableNoteModal
        isOpen={!!selectedNote}
        onClose={() => setSelectedNote(null)}
        title={`My Notes: ${selectedNote?.title}`}
        initialContent={selectedNote?.content}
        onSave={async (newContent) => {
          if (selectedNote?.knowledgeId) {
            try {
              await api.updateLearningProgress({
                knowledgeId: selectedNote.knowledgeId,
                scriptId: scriptId!,
                personalNotes: newContent,
              });
              
              if (script.keyConcepts) {
                setScript(prev => {
                  if (!prev) return null
                  const updatedConcepts = prev.keyConcepts.map(concept => 
                    concept.knowledgeId === selectedNote.knowledgeId 
                    ? { ...concept, personalNotes: newContent } 
                    : concept
                  );
                  return { ...prev, keyConcepts: updatedConcepts }
                })
              }
              
              setSelectedNote(prev => prev ? { ...prev, content: newContent } : null)
            } catch (error) {
              console.error("Failed to save notes:", error)
            }
          }
        }}
      />
    </div>
  )
}
