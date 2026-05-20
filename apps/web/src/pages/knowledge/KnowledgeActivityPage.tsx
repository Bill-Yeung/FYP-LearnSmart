import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"

type ActivityItem = {
  id: string
  type: string
  title: string
  message: string
  document_name?: string
  document_type?: string
  document_id?: string
  timestamp: string
  is_read: boolean
}

function getActivityIcon(type: string) {
  if (type.includes("upload")) return { icon: "U", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" }
  if (type.includes("processing") || type.includes("started")) return { icon: "P", color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" }
  if (type.includes("completed") || type.includes("success")) return { icon: "C", color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" }
  if (type.includes("failed") || type.includes("error")) return { icon: "X", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" }
  if (type.includes("delete")) return { icon: "D", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }
  return { icon: "A", color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" }
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function KnowledgeActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 50

  useEffect(() => {
    loadActivity()
  }, [offset])

  async function loadActivity() {
    try {
      const data = await apiClient.get<{ activities: ActivityItem[] }>(
        `/api/notifications/activity?limit=${limit}&offset=${offset}`
      )
      if (offset === 0) {
        setActivities(data?.activities || [])
      } else {
        setActivities(prev => [...prev, ...(data?.activities || [])])
      }
    } catch (err) {
      console.error("Failed to load activity:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiClient.post("/api/notifications/mark-all-read")
      setActivities(prev => prev.map(a => ({ ...a, is_read: true })))
    } catch (err) {
      console.error("Failed to mark all read:", err)
    }
  }

  if (loading && offset === 0) {
    return (
      <div className="mx-auto max-w-3xl flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Activity</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Timeline of document processing events</p>
        </div>
        <Button variant="secondary" onClick={handleMarkAllRead} className="text-sm">
          Mark All Read
        </Button>
      </div>

      {activities.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            No activity yet
          </div>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-4">
            {activities.map(activity => {
              const { icon, color } = getActivityIcon(activity.type)
              return (
                <div key={activity.id} className="relative flex gap-4 pl-1">
                  {/* Icon */}
                  <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold", color)}>
                    {icon}
                  </div>

                  {/* Content */}
                  <Card className={cn("flex-1", !activity.is_read && "border-l-2 border-l-blue-500")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{activity.message}</p>
                        {activity.document_name && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Document: {activity.document_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!activity.is_read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>

          {/* Load More */}
          {activities.length >= limit + offset && (
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={() => setOffset(prev => prev + limit)}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
