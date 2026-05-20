import { useMemo, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, useToast } from "../../contexts"

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function Sparkline({ data }: { data: number[] }) {
  const w = 160
  const h = 44
  const pad = 4
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1

  const points = data
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / (data.length - 1)
      const y = pad + (1 - (v - min) / span) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-gray-900/80 dark:text-gray-100/80"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MiniBars({ data }: { data: number[] }) {
  const max = Math.max(...data) || 1
  return (
    <div className="flex h-20 items-end gap-2">
      {data.map((v, i) => {
        const heightPct = (v / max) * 100
        return (
          <div key={i} className="flex-1">
            <div
              className="w-full rounded-md bg-gray-900/80 dark:bg-gray-100/80"
              style={{ height: `${clamp(heightPct, 6, 100)}%` }}
              title={`${v}`}
            />
          </div>
        )
      })}
    </div>
  )
}

function StatCard({
  title,
  value,
  note,
  right,
}: {
  title: string
  value: string
  note: string
  right?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {value}
          </div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{note}</div>
        </div>
        {right}
      </div>
    </div>
  )
}

const ACTIVITY_LEGEND: { type: string; dot: string; label: string }[] = [
  { type: "flashcard",    dot: "bg-blue-500",   label: "Flashcard" },
  { type: "error_review", dot: "bg-orange-500", label: "Error Review" },
  { type: "mentorship",   dot: "bg-purple-500", label: "Mentorship" },
  { type: "assignment",   dot: "bg-red-500",    label: "Assignment" },
  { type: "study_plan",   dot: "bg-green-500",  label: "Study Plan" },
  { type: "challenge",    dot: "bg-amber-500",  label: "Challenge" },
]

function ActivityTracker({
  eventsByDate,
  streak,
  monthDate,
}: {
  eventsByDate: Record<string, Set<string>>
  streak: number
  monthDate: Date
}) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const daysInMonth = last.getDate()
  const startDow = first.getDay()

  const cells: Array<{ iso: string | null; day: number | null }> = []

  for (let i = 0; i < startDow; i++) cells.push({ iso: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISODate(new Date(year, month, d))
    cells.push({ iso, day: d })
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null })

  const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const todayISO = toISODate(new Date())

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Activity Tracker
          </div>
          <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{monthLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""}` : "—"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {streak > 0 ? "current streak" : "no streak yet"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        {weekdays.map((w, idx) => (
          <div key={idx} className="text-center">{w}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          const types = c.iso ? eventsByDate[c.iso] : undefined
          const isToday = c.iso === todayISO
          return (
            <div
              key={idx}
              className={[
                "aspect-square rounded-lg border p-1 text-xs flex flex-col items-start",
                "dark:border-gray-800",
                c.day ? "bg-gray-50 dark:bg-gray-900" : "bg-transparent border-transparent",
                isToday ? "ring-2 ring-blue-400/50 dark:ring-blue-500/40" : "",
              ].join(" ")}
              title={c.iso ? `${c.iso}${types ? `: ${[...types].join(", ")}` : ""}` : ""}
            >
              <span
                className={[
                  "text-xs leading-none",
                  isToday ? "font-bold text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300",
                  !c.day ? "opacity-0" : "",
                ].join(" ")}
              >
                {c.day ?? ""}
              </span>
              {types && (
                <div className="flex flex-wrap gap-[3px] mt-auto">
                  {[...types].slice(0, 4).map(t => {
                    const style = CALENDAR_EVENT_STYLES[t]
                    return (
                      <span
                        key={t}
                        className={`h-1.5 w-1.5 rounded-full ${style?.dot ?? "bg-gray-400"}`}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {ACTIVITY_LEGEND.map(l => (
          <div key={l.type} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className={`h-2 w-2 rounded-full ${l.dot}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}


function RoleBadge({ role }: { role: string }) {
  const colors = {
    student: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    teacher: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[role as keyof typeof colors] || colors.student}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}


type PatternStats = {
  by_category: { error_category: string; category_label: string | null; count: number }[]
  by_topic: { topic: string; count: number }[]
  weekly: { day: string; count: number }[]
}

type ErrorRecord = {
  id: string
  question_stem: string | null
  wrong_answer: string
  next_review_time: string | null
  topic: string | null
  category_label: string | null
  is_mastered: boolean
}

type CalendarEvent = {
  id: string
  type: string
  title: string
  date: string
  time: string | null
  color: string
  status: string | null
  link: string | null
  meta: Record<string, any> | null
}

const CALENDAR_EVENT_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  flashcard:     { dot: "bg-blue-500",   text: "text-blue-700 dark:text-blue-300",     label: "Flashcard" },
  mentorship:    { dot: "bg-purple-500", text: "text-purple-700 dark:text-purple-300",   label: "Mentorship" },
  assignment:    { dot: "bg-red-500",    text: "text-red-700 dark:text-red-300",       label: "Assignment" },
  study_plan:    { dot: "bg-green-500",  text: "text-green-700 dark:text-green-300",     label: "Study Plan" },
  error_review:  { dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-300",   label: "Error Review" },
  challenge:     { dot: "bg-amber-500",  text: "text-amber-700 dark:text-amber-300",     label: "Challenge" },
  event:         { dot: "bg-pink-500",   text: "text-pink-700 dark:text-pink-300",     label: "Event" },
  learning_path: { dot: "bg-teal-500",   text: "text-teal-700 dark:text-teal-300",     label: "Learning Path" },
  question:      { dot: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300",   label: "Question" },
}

function getCalStyle(type: string) {
  return CALENDAR_EVENT_STYLES[type] || { dot: "bg-gray-500", text: "text-gray-700 dark:text-gray-300", label: type }
}

function StudentDashboard({ navigate }: { navigate: (p: string) => void }) {
  const monthDate = useMemo(() => new Date(), [])

  const [dueErrors, setDueErrors] = useState<ErrorRecord[]>([])
  const [totalErrors, setTotalErrors] = useState(0)
  const [masteredCount, setMasteredCount] = useState(0)
  const [patterns, setPatterns] = useState<PatternStats | null>(null)
  const [questionCount, setQuestionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [calLoading, setCalLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      await Promise.allSettled([
        fetch('/api/error-book?filter=due&limit=5', { credentials: 'include' })
          .then(r => r.ok ? r.json() : { errors: [] })
          .then((d: { errors: ErrorRecord[] }) => setDueErrors(d.errors ?? [])),
        fetch('/api/error-book?filter=all&limit=200', { credentials: 'include' })
          .then(r => r.ok ? r.json() : { errors: [] })
          .then((d: { errors: ErrorRecord[] }) => {
            setTotalErrors(d.errors?.length ?? 0)
            setMasteredCount(d.errors?.filter(e => e.is_mastered).length ?? 0)
          }),
        fetch('/api/error-book/stats/patterns', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(d => setPatterns(d)),
        fetch('/api/quiz/questions?limit=1', { credentials: 'include' })
          .then(r => r.ok ? r.json() : { total: 0 })
          .then((d: { total?: number; questions?: unknown[] }) =>
            setQuestionCount(d.total ?? d.questions?.length ?? 0)
          ),
      ])
      setLoading(false)
    }
    void fetchAll()
  }, [])

  const [activityByDate, setActivityByDate] = useState<Record<string, Set<string>>>({})
  const [streak, setStreak] = useState(0)

  // pull this month's activity heatmap and current streak
  useEffect(() => {
    async function fetchActivity() {
      try {
        const today = new Date()
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        const res = await fetch(
          `/api/calendar/activity?start=${toISODate(monthStart)}&end=${toISODate(today)}`,
          { credentials: 'include' }
        )
        if (res.ok) {
          const data = await res.json()
          const days: Record<string, string[]> = data.days ?? {}
          const map: Record<string, Set<string>> = {}
          for (const [d, types] of Object.entries(days)) {
            map[d] = new Set(types as string[])
          }
          setActivityByDate(map)
          setStreak(data.streak ?? 0)
        }
      } catch { }
    }
    void fetchActivity()
  }, [])

  // grab events for the upcoming 7 days for the schedule panel
  useEffect(() => {
    async function fetchCalendar() {
      setCalLoading(true)
      try {
        const today = new Date()
        const futureEnd = new Date()
        futureEnd.setDate(futureEnd.getDate() + 6)

        const res = await fetch(
          `/api/calendar/events?start=${toISODate(today)}&end=${toISODate(futureEnd)}`,
          { credentials: 'include' }
        )
        if (res.ok) {
          const data = await res.json()
          setUpcomingEvents(data.events ?? [])
        }
      } catch { }
      setCalLoading(false)
    }
    void fetchCalendar()
  }, [])

  const topTopic = patterns?.by_topic[0]
  const topCategory = patterns?.by_category[0]
  const last28Total = patterns?.weekly.reduce((s, d) => s + d.count, 0) ?? 0
  const weeklyTrend = patterns?.weekly.slice(-7).map(d => d.count) ?? [0]

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Errors due today"
          value={loading ? "—" : String(dueErrors.length)}
          note={dueErrors.length > 0 ? "Needs review now" : "All caught up!"}
          right={
            dueErrors.length > 0 ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              </span>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
              </span>
            )
          }
        />
        <StatCard
          title="Total errors tracked"
          value={loading ? "—" : String(totalErrors)}
          note={`${masteredCount} mastered`}
          right={weeklyTrend.length > 1 ? <Sparkline data={weeklyTrend} /> : undefined}
        />
        <StatCard
          title="Activity streak"
          value={calLoading ? "—" : streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""}` : "None yet"}
          note="Consecutive days with activity"
        />
        <StatCard
          title="Question bank"
          value={loading ? "—" : String(questionCount)}
          note="Past paper questions imported"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">

        <ActivityTracker eventsByDate={activityByDate} streak={streak} monthDate={monthDate} />

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming Schedule</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {calLoading ? "Loading…" : `${upcomingEvents.length} event${upcomingEvents.length !== 1 ? "s" : ""} in the next 7 days`}
              </div>
            </div>
            <button
              onClick={() => navigate("/calendar")}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Calendar →
            </button>
          </div>

          {!calLoading && upcomingEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nothing scheduled this week.</p>
            </div>
          )}

          {!calLoading && upcomingEvents.length > 0 && (
            <div className="space-y-1.5">
              {upcomingEvents.slice(0, 6).map((ev) => {
                const s = getCalStyle(ev.type)
                const todayStr = toISODate(new Date())
                const isToday = ev.date === todayStr
                const evDate = new Date(ev.date + "T00:00:00")
                const dayLabel = isToday
                  ? "Today"
                  : evDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                return (
                  <div
                    key={ev.id}
                    className={[
                      "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                      "border-gray-100 dark:border-gray-800",
                      ev.link ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : "",
                    ].join(" ")}
                    onClick={() => { if (ev.link) navigate(ev.link) }}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{ev.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        <span className={s.text}>{s.label}</span>
                        {" · "}
                        {dayLabel}
                        {ev.time && ` · ${ev.time}`}
                        {ev.status && ` · ${ev.status}`}
                      </p>
                    </div>
                  </div>
                )
              })}
              {upcomingEvents.length > 6 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
                  +{upcomingEvents.length - 6} more — <button className="underline hover:text-indigo-600" onClick={() => navigate("/calendar")}>see all</button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weakest topic</div>
          {loading || !topTopic ? (
            <div className="text-sm text-gray-400">{loading ? "Loading…" : "No data yet"}</div>
          ) : (
            <>
              <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">{topTopic.topic}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{topTopic.count} error{topTopic.count !== 1 ? "s" : ""} logged</div>
            </>
          )}
          <button className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => navigate("/application/schedule-review")}>
            View patterns →
          </button>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Top error category</div>
          {loading || !topCategory ? (
            <div className="text-sm text-gray-400">{loading ? "Loading…" : "No data yet"}</div>
          ) : (
            <>
              <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                {topCategory.category_label ?? topCategory.error_category ?? "Unknown"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{topCategory.count} error{topCategory.count !== 1 ? "s" : ""} in this category</div>
            </>
          )}
          <button className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => navigate("/application/error-log")}>
            View error log →
          </button>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last 28 days</div>
          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : (
            <>
              <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">{last28Total} errors</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {masteredCount} mastered · {totalErrors - masteredCount} open
              </div>
            </>
          )}
          <button className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => navigate("/application/schedule-review")}>
            View full patterns →
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="text-sm font-semibold mb-4">Quick actions</div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {[
            { label: "Review due errors", desc: `${dueErrors.length} waiting`, path: "/application/schedule-review", color: "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/20" },
            { label: "Practice questions", desc: "Past paper bank", path: "/application/practice-exam", color: "bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/20" },
            { label: "Error log", desc: `${totalErrors} total errors`, path: "/application/error-log", color: "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/20" },
            { label: "Import past papers", desc: "Add questions via Excel", path: "/application/past-paper-import", color: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/20" },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`rounded-xl border p-4 text-left transition ${a.color}`}
            >
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{a.label}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{loading && a.desc.includes("waiting") ? "Loading…" : a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}


function TeacherDashboard({ showToast }: { showToast: (msg: string) => void }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      await Promise.allSettled([
        fetch("/api/classroom/teacher/classes", { credentials: "include" })
          .then(r => r.ok ? r.json() : { classes: [] })
          .then(d => setClasses(d.classes ?? [])),
        fetch("/api/classroom/teacher/students", { credentials: "include" })
          .then(r => r.ok ? r.json() : { students: [] })
          .then(d => setStudents(d.students ?? [])),
        fetch("/api/classroom/teacher/assignments", { credentials: "include" })
          .then(r => r.ok ? r.json() : { assignments: [] })
          .then(d => setAssignments(d.assignments ?? [])),
      ])
      setLoading(false)
    }
    void fetchAll()
  }, [])

  const totalStudents = students.length
  const totalPending = classes.reduce((s: number, c: any) => s + (c.pending_count || 0), 0)
  const totalAssignments = assignments.length
  const ungradedCount = assignments.reduce((s: number, a: any) => {
    const submitted = a.submission_count || 0
    return s + submitted
  }, 0)

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard title="Your Classes" value={loading ? "—" : String(classes.length)} note={`${classes.filter((c: any) => c.status === "active").length} active`} />
        <StatCard title="Total Students" value={loading ? "—" : String(totalStudents)} note={`Across ${classes.length} classes`} />
        <StatCard title="Assignments" value={loading ? "—" : String(totalAssignments)} note={`${ungradedCount} submissions`} />
        <StatCard title="Pending Enrollments" value={loading ? "—" : String(totalPending)} note={totalPending > 0 ? "Needs approval" : "All caught up"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Your Classes</div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Manage and monitor student progress</div>
            </div>
            <button onClick={() => navigate("/classroom/classes")} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View all →</button>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : classes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No classes yet</p>
            ) : (
              classes.slice(0, 5).map((cls: any) => (
                <button key={cls.id} className="w-full flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2.5 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800" onClick={() => navigate(`/classroom/classes/${cls.id}`)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{cls.class_code || cls.course_code || "—"}</span>
                    <span className="text-sm font-medium truncate">{cls.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{cls.student_count} students</span>
                    {cls.pending_count > 0 && (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{cls.pending_count} pending</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="text-sm font-semibold">Recent Assignments</div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Track student submissions</div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No assignments yet</p>
            ) : (
              assignments.slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {a.class_name || "—"} · {a.submission_count || 0}/{a.student_count || 0} submitted
                    </div>
                  </div>
                  {a.due_at && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                      Due {new Date(a.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="text-sm font-semibold mb-4">Quick Actions</div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {[
            { label: "Manage Classes", desc: `${classes.length} classes`, path: "/classroom/classes", color: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className={`rounded-xl border p-4 text-left transition hover:opacity-80 ${a.color}`}>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{a.label}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{loading ? "Loading…" : a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}


function AdminDashboard({ showToast, navigate }: { showToast: (msg: string) => void; navigate: (path: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      await Promise.allSettled([
        fetch("/api/admin/settings", { credentials: "include" })
          .then(r => r.ok ? r.json() : null)
          .then(d => setStats(d?.stats ?? d)),
        fetch("/api/admin/audit-log?limit=5", { credentials: "include" })
          .then(r => r.ok ? r.json() : { logs: [] })
          .then(d => setAuditLog(d.logs ?? d.entries ?? [])),
        fetch("/api/users?limit=500", { credentials: "include" })
          .then(r => r.ok ? r.json() : [])
          .then(d => setUsers(Array.isArray(d) ? d : d.users ?? [])),
      ])
      setLoading(false)
    }
    void fetchAll()
  }, [])

  const studentCount = users.filter((u: any) => u.role === "student").length
  const teacherCount = users.filter((u: any) => u.role === "teacher").length
  const adminCount = users.filter((u: any) => u.role === "admin").length

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard title="Total Users" value={loading ? "—" : String(stats?.total_users ?? users.length)} note={`${studentCount} students · ${teacherCount} teachers`} />
        <StatCard title="Documents" value={loading ? "—" : String(stats?.total_documents ?? 0)} note="Uploaded to platform" />
        <StatCard title="Communities" value={loading ? "—" : String(stats?.total_communities ?? 0)} note={`${stats?.total_discussions ?? 0} discussions`} />
        <StatCard title="Flashcards" value={loading ? "—" : String(stats?.total_flashcards ?? 0)} note={`${stats?.total_questions ?? 0} questions`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="text-sm font-semibold">Users by Role</div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Students</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{studentCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Teachers</span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-300">{teacherCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Admins</span>
                  <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{adminCount}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="text-sm font-semibold">Quick Actions</div>
          <div className="mt-4 space-y-2">
            <button className="w-full rounded-lg border bg-gray-50 p-3 text-left text-sm hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800" onClick={() => navigate("/admin/users")}>
              <div className="font-medium">Manage Users</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Add, edit, or remove users</div>
            </button>
            <button className="w-full rounded-lg border bg-gray-50 p-3 text-left text-sm hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800" onClick={() => navigate("/admin/content")}>
              <div className="font-medium">Content Moderation</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Review and moderate content</div>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Recent Admin Actions</div>
            <button onClick={() => navigate("/admin/audit-log")} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View all →</button>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : auditLog.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No recent actions</p>
            ) : (
              auditLog.slice(0, 5).map((log: any, i: number) => (
                <div key={i} className="border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                  <div className="text-sm font-medium">{log.action_type || log.action || "Action"}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {log.module || ""}{log.actor_name ? ` · ${log.actor_name}` : ""}
                    {log.created_at ? ` · ${new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {stats?.ai_tokens_used_this_month != null && (
        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="text-sm font-semibold">AI Usage This Month</div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {stats.ai_tokens_used_this_month.toLocaleString("en-US")} tokens
          </div>
        </div>
      )}
    </>
  )
}


export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const dashboardTitle = {
    student: "My Learning Dashboard",
    teacher: "Teacher Dashboard",
    admin: "Admin Dashboard"
  }

  const dashboardDescription = {
    student: "Track your learning progress, practice, and achievements.",
    teacher: "Manage your classes, students, and assessments.",
    admin: "Monitor platform health, users, and system settings."
  }

  const role = user?.role || "student"

  return (
    <>
      <div className="flex items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{dashboardTitle[role]}</h1>
            <RoleBadge role={role} />
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{dashboardDescription[role]}</p>
        </div>
        <div className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
          Last updated: just now
        </div>
      </div>

      {role === "student" && <StudentDashboard navigate={navigate} />}
      {role === "teacher" && <TeacherDashboard showToast={showToast} />}
      {role === "admin" && <AdminDashboard showToast={showToast} navigate={navigate} />}
    </>
  )
}
