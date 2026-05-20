import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { cn } from "../../../../../shared/utils"
import { Bell, ChevronLeft, ChevronRight, X, Calendar, BookOpen, Settings } from "lucide-react"

type ScheduledItem = {
  id: string
  front: string
  next_due: string | null
  last_review_date?: string | null
  created_at?: string | null
  status?: string
}

type SelectedDay = {
  date: Date
  iso: string
  items: ScheduledItem[]
}

type ReviewNotification = {
  id: string
  count: number
  isToday: boolean
  title?: string
  body?: string
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  try {
    const date = new Date(dateStr)
    return toISODate(date) === toISODate(new Date())
  } catch {
    return false
  }
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  try {
    const date = new Date(dateStr)
    return date < new Date() && !isToday(dateStr)
  } catch {
    return false
  }
}

export function SchedulePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ScheduledItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [notifications, setNotifications] = useState<ReviewNotification | null>(null)
  const [showNotification, setShowNotification] = useState(false)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)

  async function fetchSchedule() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/flashcards/schedule')
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const data = await res.json()
      const mapped = data.map((d: any) => {
        const last = d.last_review_date ?? d.lastReviewDate ?? null
        const created = d.created_at ?? d.createdAt ?? null

        let status = d.status ?? 'scheduled'
        if (isOverdue(d.next_due ?? d.nextDue)) {
          status = 'overdue'
        } else if (last == null) {
          if (created) {
            const createdTs = Date.parse(created)
            if (!isNaN(createdTs)) {
              const days = (Date.now() - createdTs) / (1000 * 60 * 60 * 24)
              status = days <= 7 ? 'new' : 'scheduled'
            } else {
              status = 'new'
            }
          } else {
            status = 'new'
          }
        }

        return {
          id: d.id,
          front: d.front ?? d.front_content ?? 'Untitled',
          next_due: d.next_due ?? d.nextDue ?? null,
          last_review_date: last,
          created_at: created,
          status,
        }
      })
      setItems(mapped)

      try {
        const todayISO = toISODate(new Date())

        const overdueItems = mapped.filter((item: ScheduledItem) => item.status === 'overdue')
        const dueToday = mapped.filter((item: ScheduledItem) =>
          item.status !== 'overdue' &&
          item.next_due && item.next_due.startsWith(todayISO)
        )
        const dueCount = overdueItems.length + dueToday.length

        let apiNotifId = ''
        try {
          const notifRes = await fetch('/api/notifications?limit=20&is_read=false')
          if (notifRes.ok) {
            const notifData = await notifRes.json()
            const allNotifs: any[] = notifData.notifications || notifData || []
            const reviewNotif = allNotifs.find((n: any) =>
              (n.title || '').match(/overdue|due today/i)
            )
            if (reviewNotif) apiNotifId = reviewNotif.id
          }
        } catch {
        }

        if (dueCount > 0) {
          const isOverdueOnly = overdueItems.length > 0 && dueToday.length === 0
          setNotifications({
            id: apiNotifId,
            count: dueCount,
            isToday: true,
            title: overdueItems.length > 0
              ? `${overdueItems.length} overdue card(s) waiting`
              : `${dueToday.length} card(s) due today`,
            body: isOverdueOnly
              ? 'You have overdue flashcards. Catch up now to maintain your learning progress!'
              : 'Take a few minutes to review your scheduled flashcards and keep on track!'
          })
          setShowNotification(true)
        }
      } catch (notifErr: any) {
        console.warn('[SchedulePage] Failed to check notifications:', notifErr)
      }
    } catch (err: any) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function dismissNotification(notificationId: string) {
    if (notificationId) {
      try {
        await fetch(`/api/notifications/mark-read/${notificationId}`, {
          method: 'POST'
        })
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
      }
    }
    setShowNotification(false)
  }

  // poll every minute so the due counts stay fresh
  useEffect(() => {
    fetchSchedule()
    const interval = setInterval(fetchSchedule, 60000)
    return () => clearInterval(interval)
  }, [])

  function formatDate(d: string | null) {
    if (!d) return 'N/A'
    try {
      const date = new Date(d)
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return d
    }
  }

  function formatDateShort(d: string | null) {
    if (!d) return 'N/A'
    try {
      const date = new Date(d)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return d
    }
  }

  function getItemsByDate(): Record<string, ScheduledItem[]> {
    if (!items) return {}
    const grouped: Record<string, ScheduledItem[]> = {}
    items.forEach(item => {
      if (item.next_due) {
        const key = toISODate(new Date(item.next_due))
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(item)
      }
    })
    return grouped
  }

  function getCalendarDays() {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const daysInMonth = last.getDate()
    const startDow = first.getDay()

    const cells: Array<{ date: Date | null; iso: string | null; day: number | null }> = []
    for (let i = 0; i < startDow; i++) cells.push({ date: null, iso: null, day: null })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      cells.push({ date, iso: toISODate(date), day: d })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null, day: null })
    return cells
  }

  const itemsByDate = getItemsByDate()
  const calendarDays = getCalendarDays()
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayISO = toISODate(new Date())

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Review Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">Plan your study sessions with a calendar view</p>
        </div>
        <button
          onClick={() => navigate('/settings/memorize')}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Settings className="h-4 w-4" />
          Algorithm settings
        </button>
      </div>

      {/* Notification Banner */}
      {showNotification && notifications?.isToday && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          <Bell className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{notifications.title || 'Great job! You have ' + notifications.count + ' review(s) scheduled for today'}</p>
            <p className="text-sm">{notifications.body || 'Keep up with your spaced repetition schedule!'}</p>
          </div>
          <button
            onClick={() => dismissNotification(notifications.id)}
            className="text-blue-900 dark:text-blue-200 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setViewMode('calendar')}
          className={cn(
            'px-4 py-2 rounded border transition-colors',
            viewMode === 'calendar'
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
        >
          Calendar View
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={cn(
            'px-4 py-2 rounded border transition-colors',
            viewMode === 'list'
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
        >
          List View
        </button>
        <button onClick={fetchSchedule} className="ml-auto px-4 py-2 rounded border hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {loading ? (
        <Card>
          <div className="text-sm text-gray-600">Loading schedule...</div>
        </Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-600">Error loading schedule: {error}</div>
        </Card>
      ) : !items || items.length === 0 ? (
        <Card>
          <div className="text-sm text-gray-600">No scheduled items found.</div>
        </Card>
      ) : viewMode === 'calendar' ? (
        <Card>
          <div className="p-6">
            {/* Calendar Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{monthLabel}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-gray-600">
              {weekdays.map((wd, idx) => (
                <div key={idx}>{wd}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((cell, idx) => {
                const itemsForDay = cell.iso ? itemsByDate[cell.iso] || [] : []
                const isCurrentDay = cell.iso === todayISO
                const hasOverdue = itemsForDay.some(item => item.status === 'overdue')

                return (
                  <div
                    key={idx}
                    className={cn(
                      'min-h-24 rounded-lg border p-2 text-xs',
                      cell.day
                        ? 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 cursor-pointer'
                        : 'bg-gray-50 dark:bg-gray-950 border-transparent',
                      isCurrentDay && 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                    )}
                    onClick={() => {
                      if (cell.day && cell.date && cell.iso) {
                        setSelectedDay({
                          date: cell.date,
                          iso: cell.iso,
                          items: itemsForDay,
                        })
                      }
                    }}
                  >
                    {cell.day && (
                      <>
                        <div
                          className={cn(
                            'font-semibold mb-1',
                            isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'
                          )}
                        >
                          {cell.day}
                        </div>
                        <div className="space-y-1">
                          {itemsForDay.slice(0, 2).map(item => (
                            <div
                              key={item.id}
                              className={cn(
                                'px-1.5 py-0.5 rounded truncate text-xs font-medium text-white',
                                hasOverdue
                                  ? 'bg-red-500'
                                  : item.status === 'new'
                                    ? 'bg-green-500'
                                    : 'bg-blue-500'
                              )}
                              title={item.front}
                            >
                              {item.front.substring(0, 15)}...
                            </div>
                          ))}
                          {itemsForDay.length > 2 && (
                            <div className="text-gray-600 dark:text-gray-400 font-medium">
                              +{itemsForDay.length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-8 flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-500"></div>
                <span>Overdue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-blue-500"></div>
                <span>Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-500"></div>
                <span>New</span>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 bg-gray-50">
                  <th className="px-3 py-3 font-semibold">Card</th>
                  <th className="px-3 py-3 font-semibold">Next Review</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Days Until Due</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .sort((a, b) => {
                    const aDate = new Date(a.next_due || '9999-12-31')
                    const bDate = new Date(b.next_due || '9999-12-31')
                    return aDate.getTime() - bDate.getTime()
                  })
                  .map(item => {
                    const daysUntilDue = item.next_due
                      ? Math.ceil((new Date(item.next_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null
                    const isTodayReview = isToday(item.next_due)

                    return (
                      <tr key={item.id} className={cn(
                        'border-t',
                        isTodayReview && 'bg-blue-50'
                      )}>
                        <td className="px-3 py-3 align-top max-w-xl">
                          <div className="font-medium text-gray-900">{item.front}</div>
                        </td>
                        <td className="px-3 py-3 align-top">{formatDate(item.next_due)}</td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                              item.status === 'overdue'
                                ? 'bg-red-100 text-red-800'
                                : item.status === 'new'
                                  ? 'bg-green-100 text-green-800'
                                  : isTodayReview
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                            )}
                          >
                            {item.status ?? 'Scheduled'}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-gray-600">
                          {daysUntilDue !== null ? (
                            daysUntilDue === 0 ? (
                              <span className="font-semibold text-blue-600">Today</span>
                            ) : daysUntilDue === 1 ? (
                              <span className="font-semibold text-yellow-600">Tomorrow</span>
                            ) : daysUntilDue < 0 ? (
                              <span className="font-semibold text-red-600">{Math.abs(daysUntilDue)} days ago</span>
                            ) : (
                              <span>{daysUntilDue} days</span>
                            )
                          ) : (
                            'N/A'
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Day Detail Modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedDay.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            {selectedDay.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-gray-500">
                <BookOpen className="h-10 w-10 text-gray-300" />
                <p className="text-sm">No cards scheduled for this day.</p>
                <p className="text-xs text-gray-400">No cards scheduled for this day.</p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                  {selectedDay.items.length} card{selectedDay.items.length !== 1 ? 's' : ''} to review
                </p>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {selectedDay.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600"
                    >
                      <span
                        className={cn(
                          'inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full',
                          item.status === 'overdue'
                            ? 'bg-red-500'
                            : item.status === 'new'
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {item.front}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.status === 'overdue' ? 'Overdue' : item.status === 'new' ? 'New card' : 'Scheduled'}
                          {item.last_review_date && ` · Last reviewed ${formatDateShort(item.last_review_date)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary bar */}
                <div className="mt-4 flex gap-4 rounded-lg bg-gray-50 p-3 text-xs font-medium dark:bg-gray-700">
                  {selectedDay.items.filter(i => i.status === 'overdue').length > 0 && (
                    <span className="text-red-600">{selectedDay.items.filter(i => i.status === 'overdue').length} overdue</span>
                  )}
                  {selectedDay.items.filter(i => i.status === 'new').length > 0 && (
                    <span className="text-green-600">{selectedDay.items.filter(i => i.status === 'new').length} new</span>
                  )}
                  {selectedDay.items.filter(i => i.status === 'scheduled').length > 0 && (
                    <span className="text-blue-600">{selectedDay.items.filter(i => i.status === 'scheduled').length} scheduled</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SchedulePage
