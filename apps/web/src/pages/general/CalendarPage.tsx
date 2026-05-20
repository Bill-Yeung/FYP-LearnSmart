import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import { ChevronLeft, ChevronRight, Clock, ExternalLink, Calendar, Bell, BookOpen, List } from "lucide-react"


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

type ScheduledCard = {
  id: string
  front: string
  next_due: string | null
  last_review_date?: string | null
  created_at?: string | null
  status?: string
}

type ReviewNotification = {
  id: string
  count: number
  title: string
  body: string
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function utcToLocal(ev: CalendarEvent): CalendarEvent {
  if (!ev.time || !ev.date) return ev
  const utc = new Date(`${ev.date}T${ev.time}:00Z`)
  return {
    ...ev,
    date: toISODate(utc),
    time: `${String(utc.getHours()).padStart(2, "0")}:${String(utc.getMinutes()).padStart(2, "0")}`,
  }
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  try {
    const date = new Date(dateStr)
    const todayISO = toISODate(new Date())
    return toISODate(date) < todayISO
  } catch { return false }
}

function getCardStatus(card: any): string {
  if (isOverdue(card.next_due ?? card.nextDue)) return "overdue"
  const last = card.last_review_date ?? card.lastReviewDate ?? null
  if (!last) {
    const created = card.created_at ?? card.createdAt ?? null
    if (created) {
      const days = (Date.now() - Date.parse(created)) / (1000 * 60 * 60 * 24)
      return days <= 7 ? "new" : "scheduled"
    }
    return "new"
  }
  return "scheduled"
}

const EVENT_STYLES: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
  flashcard:    { dot: "bg-blue-500",   bg: "bg-blue-50 dark:bg-blue-500/10",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-200 dark:border-blue-800",   label: "Flashcard Review" },
  mentorship:   { dot: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800", label: "Mentorship" },
  assignment:   { dot: "bg-red-500",    bg: "bg-red-50 dark:bg-red-500/10",     text: "text-red-700 dark:text-red-300",     border: "border-red-200 dark:border-red-800",     label: "Assignment" },
  error_review: { dot: "bg-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800", label: "Error Review" },
  challenge:    { dot: "bg-amber-500",  bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800", label: "Challenge" },
}

const CARD_STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  overdue:   { dot: "bg-red-500",   label: "Overdue" },
  new:       { dot: "bg-green-500", label: "New" },
  scheduled: { dot: "bg-blue-400",  label: "Scheduled" },
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function getStyle(type: string) {
  return EVENT_STYLES[type] || { dot: "bg-gray-500", bg: "bg-gray-50 dark:bg-gray-500/10", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-800", label: type }
}


export function CalendarPage() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [cards, setCards] = useState<ScheduledCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<{ iso: string; events: CalendarEvent[]; cards: ScheduledCard[] } | null>(null)
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")
  const [notification, setNotification] = useState<ReviewNotification | null>(null)
  const [showNotification, setShowNotification] = useState(false)

  // pull events for the visible month range (padded out to whole weeks)
  const fetchEvents = useCallback(async () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0)
    start.setDate(start.getDate() - start.getDay())
    end.setDate(end.getDate() + (6 - end.getDay()))
    try {
      const data = await apiClient.get<{ events: CalendarEvent[] }>(`/api/calendar/events?start=${toISODate(start)}&end=${toISODate(end)}`)
      setEvents((data?.events ?? []).map(utcToLocal))
    } catch {
      setEvents([])
    }
  }, [currentMonth])

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/flashcards/schedule")
      if (!res.ok) return
      const data = await res.json()
      const mapped: ScheduledCard[] = data.map((d: any) => ({
        id: d.id,
        front: d.front ?? d.front_content ?? "Untitled",
        next_due: d.next_due ?? d.nextDue ?? null,
        last_review_date: d.last_review_date ?? d.lastReviewDate ?? null,
        created_at: d.created_at ?? d.createdAt ?? null,
        status: getCardStatus(d),
      }))
      setCards(mapped)

      // Build notification for overdue/due today
      const todayISO = toISODate(new Date())
      const overdue = mapped.filter(c => c.status === "overdue")
      const dueToday = mapped.filter(c => c.status !== "overdue" && c.next_due?.startsWith(todayISO))
      const count = overdue.length + dueToday.length
      if (count > 0) {
        setNotification({
          id: "",
          count,
          title: overdue.length > 0 ? `${overdue.length} overdue card(s) waiting` : `${dueToday.length} card(s) due today`,
          body: overdue.length > 0
            ? "You have overdue flashcards. Catch up now to maintain your learning progress!"
            : "Take a few minutes to review your scheduled flashcards and keep on track!",
        })
        setShowNotification(true)
      }
    } catch { }
  }, [])

  // refetch events + schedule whenever the visible month changes
  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEvents(), fetchSchedule()]).finally(() => setLoading(false))
  }, [fetchEvents, fetchSchedule])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()

  const cells: Array<{ date: Date; iso: string; day: number; isCurrentMonth: boolean }> = []
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -startDow + i + 1)
    cells.push({ date: d, iso: toISODate(d), day: d.getDate(), isCurrentMonth: false })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    cells.push({ date, iso: toISODate(date), day: d, isCurrentMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, cells.length - startDow - lastDay.getDate() + 1)
    cells.push({ date: d, iso: toISODate(d), day: d.getDate(), isCurrentMonth: false })
  }

  const eventsByDate: Record<string, CalendarEvent[]> = {}
  events.forEach(e => {
    if (e.date) { eventsByDate[e.date] = eventsByDate[e.date] ?? []; eventsByDate[e.date].push(e) }
  })
  const cardsByDate: Record<string, ScheduledCard[]> = {}
  cards.forEach(c => {
    if (c.next_due) {
      const key = toISODate(new Date(c.next_due))
      cardsByDate[key] = cardsByDate[key] ?? []
      cardsByDate[key].push(c)
    }
  })

  const todayISO = toISODate(new Date())
  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const todayEvents = eventsByDate[todayISO] ?? []
  const todayCards = cardsByDate[todayISO] ?? []
  const upcomingEvents = events
    .filter(e => e.date > todayISO)
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
    .slice(0, 5)

  const sortedCards = [...cards].sort((a, b) => {
    const aD = new Date(a.next_due || "9999-12-31").getTime()
    const bD = new Date(b.next_due || "9999-12-31").getTime()
    return aD - bD
  })

  function formatDate(d: string | null) {
    if (!d) return "N/A"
    return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar & Schedule</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">All your activities and flashcard due dates in one place</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
          <button
            onClick={() => setViewMode("calendar")}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "calendar"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            )}
          >
            <Calendar className="h-4 w-4" /> Calendar
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "list"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            )}
          >
            <List className="h-4 w-4" /> List
          </button>
        </div>
      </div>

      {showNotification && notification && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          <Bell className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{notification.title}</p>
            <p className="text-sm opacity-80">{notification.body}</p>
          </div>
          <button onClick={() => navigate("/flashcards/review")} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Review now
          </button>
          <button onClick={() => setShowNotification(false)} className="shrink-0 text-blue-400 hover:text-blue-600">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : viewMode === "list" ? (
        (() => {
          type ListItem =
            | { kind: "event"; date: string; data: CalendarEvent }
            | { kind: "card"; date: string; data: ScheduledCard }

          const allItems: ListItem[] = [
            ...events.map(e => ({ kind: "event" as const, date: e.date, data: e })),
            ...cards.filter(c => c.next_due).map(c => ({ kind: "card" as const, date: toISODate(new Date(c.next_due!)), data: c })),
          ].sort((a, b) => a.date.localeCompare(b.date))

          const groups: Record<string, ListItem[]> = {}
          allItems.forEach(item => {
            groups[item.date] = groups[item.date] ?? []
            groups[item.date].push(item)
          })
          const sortedDates = Object.keys(groups).sort()

          if (sortedDates.length === 0) return (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
              <BookOpen className="h-10 w-10" />
              <p className="text-sm">No events or scheduled cards found.</p>
            </div>
          )

          return (
            <div className="space-y-4">
              {sortedDates.map(dateISO => {
                const isToday = dateISO === todayISO
                const isPast = dateISO < todayISO
                const dateLabel = new Date(dateISO + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                const daysUntil = Math.ceil((new Date(dateISO).getTime() - new Date(todayISO).getTime()) / (1000 * 60 * 60 * 24))

                return (
                  <div key={dateISO} className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950 overflow-hidden">
                    <div className={cn("flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800",
                      isToday ? "bg-blue-50 dark:bg-blue-900/10" : isPast ? "bg-gray-50/60 dark:bg-gray-900/40" : ""
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                          isToday ? "bg-blue-600 text-white" : isPast ? "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        )}>
                          {new Date(dateISO + "T00:00:00").getDate()}
                        </div>
                        <span className={cn("text-sm font-semibold", isToday ? "text-blue-700 dark:text-blue-300" : isPast ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100")}>
                          {dateLabel}
                        </span>
                      </div>
                      <span className={cn("text-xs font-medium",
                        isToday ? "text-blue-600 dark:text-blue-400"
                        : isPast ? "text-red-500 dark:text-red-400"
                        : "text-gray-400 dark:text-gray-500"
                      )}>
                        {isToday ? "Today" : isPast ? `${Math.abs(daysUntil)}d ago` : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                      </span>
                    </div>

                    <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                      {groups[dateISO].map((item, idx) => {
                        if (item.kind === "event") {
                          const e = item.data
                          const s = getStyle(e.type)
                          return (
                            <div key={`e-${e.id}`} className={cn("flex items-center gap-3 px-5 py-3 transition-colors", e.link && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50")} onClick={() => { if (e.link) navigate(e.link) }}>
                              <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", s.dot)} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.title}</span>
                                {e.time && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{e.time}</span>}
                              </div>
                              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.bg, s.text, s.border, "border")}>{s.label}</span>
                              {e.status && <span className="shrink-0 text-xs text-gray-400 capitalize">{e.status}</span>}
                            </div>
                          )
                        } else {
                          const c = item.data
                          const statusStyle = CARD_STATUS_STYLE[c.status ?? "scheduled"] ?? CARD_STATUS_STYLE.scheduled
                          return (
                            <div key={`c-${c.id}`} className="flex items-center gap-3 px-5 py-3">
                              <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", statusStyle.dot)} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{c.front}</span>
                              </div>
                              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                c.status === "overdue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : c.status === "new" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              )}>{statusStyle.label}</span>
                              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">Flashcard</span>
                            </div>
                          )
                        }
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{monthLabel}</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={() => setCurrentMonth(new Date())} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
                    Today
                  </button>
                  <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="px-4 pb-4">
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map(d => (
                    <div key={d} className="py-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      <span className="hidden sm:inline">{d}</span>
                      <span className="sm:hidden">{d[0]}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell, i) => {
                    const isToday = cell.iso === todayISO
                    const dayEvents = eventsByDate[cell.iso] ?? []
                    const dayCards = cardsByDate[cell.iso] ?? []
                    const hasContent = dayEvents.length > 0 || dayCards.length > 0
                    const hasOverdue = dayCards.some(c => c.status === "overdue")

                    return (
                      <div
                        key={i}
                        onClick={() => { if (hasContent) setSelectedDay({ iso: cell.iso, events: dayEvents, cards: dayCards }) }}
                        className={cn(
                          "relative min-h-[52px] sm:min-h-[100px] rounded-xl p-1 sm:p-2 transition-all duration-150",
                          cell.isCurrentMonth ? "bg-gray-50/50 dark:bg-gray-900/50" : "opacity-40",
                          hasContent && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:shadow-sm",
                          isToday && "ring-2 ring-blue-500/40 bg-blue-50/50 dark:bg-blue-500/5",
                        )}
                      >
                        <div className={cn(
                          "inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm",
                          isToday ? "bg-blue-600 font-semibold text-white"
                          : cell.isCurrentMonth ? "font-medium text-gray-700 dark:text-gray-300"
                          : "text-gray-400 dark:text-gray-600",
                        )}>
                          {cell.day}
                        </div>

                        {hasContent && (
                          <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                            {dayCards.slice(0, 2).map((c, ci) => (
                              <span key={ci} className={cn("h-1.5 w-1.5 rounded-full", CARD_STATUS_STYLE[c.status ?? "scheduled"]?.dot ?? "bg-blue-400")} />
                            ))}
                            {dayEvents.slice(0, 2).map(e => (
                              <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", getStyle(e.type).dot)} />
                            ))}
                          </div>
                        )}

                        <div className="mt-1 space-y-0.5 hidden sm:block">
                          {dayCards.slice(0, 2).map((c, ci) => (
                            <div key={ci} className={cn(
                              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-tight border",
                              hasOverdue
                                ? "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-800"
                                : c.status === "new"
                                  ? "bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-800"
                                  : "bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-800"
                            )}>
                              <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", CARD_STATUS_STYLE[c.status ?? "scheduled"]?.dot ?? "bg-blue-400")} />
                              <span className={cn("truncate font-medium",
                                hasOverdue ? "text-red-700 dark:text-red-300"
                                : c.status === "new" ? "text-green-700 dark:text-green-300"
                                : "text-blue-700 dark:text-blue-300"
                              )}>{c.front.substring(0, 18)}</span>
                            </div>
                          ))}
                          {dayEvents.slice(0, Math.max(0, 3 - dayCards.length)).map(e => {
                            const s = getStyle(e.type)
                            return (
                              <div key={e.id} className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-tight border", s.bg, s.border)}>
                                <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", s.dot)} />
                                <span className={cn("truncate font-medium", s.text)}>{e.title}</span>
                              </div>
                            )
                          })}
                          {dayCards.length + dayEvents.length > 3 && (
                            <div className="px-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                              +{dayCards.length + dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-3">
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {Object.entries(EVENT_STYLES).map(([type, s]) => (
                    <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />{s.label}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />Overdue Card
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />New Card
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Today</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>

              {todayCards.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Flashcards due</div>
                  <div className="space-y-1.5">
                    {todayCards.map(c => {
                      const s = CARD_STATUS_STYLE[c.status ?? "scheduled"]
                      return (
                        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                          <span className={cn("h-2 w-2 rounded-full flex-shrink-0", s.dot)} />
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{c.front}</span>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => navigate("/flashcards/review")} className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
                    Start review
                  </button>
                </div>
              )}

              {todayEvents.length === 0 && todayCards.length === 0 ? (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-5 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nothing scheduled today</p>
                </div>
              ) : todayEvents.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Events</div>
                  <div className="space-y-2">
                    {todayEvents.map(e => {
                      const s = getStyle(e.type)
                      return (
                        <div key={e.id} className={cn("flex items-start gap-2.5 rounded-xl border p-3 transition-colors", s.border, s.bg, e.link && "cursor-pointer hover:opacity-80")} onClick={() => { if (e.link) navigate(e.link) }}>
                          <span className={cn("mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0", s.dot)} />
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm font-medium truncate", s.text)}>{e.title}</p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{s.label}</span>
                              {e.time && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{e.time}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {upcomingEvents.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Coming Up</div>
                <div className="space-y-2">
                  {upcomingEvents.map(e => {
                    const s = getStyle(e.type)
                    const evDate = new Date(e.date + "T00:00:00")
                    const dayLabel = evDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                    return (
                      <div key={e.id} className={cn("flex items-start gap-2.5 rounded-xl border border-gray-100 dark:border-gray-800 p-3 transition-colors", e.link && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800")} onClick={() => { if (e.link) navigate(e.link) }}>
                        <span className={cn("mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0", s.dot)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{e.title}</p>
                          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{dayLabel}{e.time && ` · ${e.time}`}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedDay(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {new Date(selectedDay.iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedDay.events.length + selectedDay.cards.length} item{(selectedDay.events.length + selectedDay.cards.length) !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-2">
              {selectedDay.cards.length > 0 && (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Flashcards ({selectedDay.cards.length})</div>
                  {selectedDay.cards.map(c => {
                    const s = CARD_STATUS_STYLE[c.status ?? "scheduled"]
                    return (
                      <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                        <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", s.dot)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{c.front}</p>
                          <p className="text-xs text-gray-500">{s.label}{c.last_review_date && ` · Last reviewed ${formatDate(c.last_review_date)}`}</p>
                        </div>
                      </div>
                    )
                  })}
                  <button onClick={() => { setSelectedDay(null); navigate("/flashcards/review") }} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors mt-1">
                    Start review
                  </button>
                </>
              )}
              {selectedDay.events.length > 0 && (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-3 mb-1">Events ({selectedDay.events.length})</div>
                  {selectedDay.events.map(e => {
                    const s = getStyle(e.type)
                    return (
                      <div key={e.id} className={cn("flex items-start gap-3 rounded-xl border p-4 transition-colors", s.border, s.bg, e.link && "cursor-pointer hover:opacity-80")} onClick={() => { if (e.link) { setSelectedDay(null); navigate(e.link) } }}>
                        <span className={cn("mt-1 h-3 w-3 rounded-full flex-shrink-0", s.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-medium", s.text)}>{e.title}</span>
                            {e.status && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", s.bg, s.text, s.border)}>{e.status}</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className={cn("font-medium", s.text)}>{s.label}</span>
                            {e.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.time}</span>}
                          </div>
                        </div>
                        {e.link && <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400 mt-1" />}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
