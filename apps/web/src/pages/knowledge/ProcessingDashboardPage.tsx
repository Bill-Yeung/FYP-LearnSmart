import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"

type ProcessingStats = {
  pending: number
  processing: number
  completed: number
  failed: number
}

type FailedDocument = {
  id: string
  document_name: string
  document_type: string
  error_message?: string
  uploaded_at: string
}

type ActivityItem = {
  id: string
  type: string
  title: string
  message: string
  document_name?: string
  timestamp: string
}

export function ProcessingDashboardPage() {
  const [stats, setStats] = useState<ProcessingStats | null>(null)
  const [failedDocs, setFailedDocs] = useState<FailedDocument[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  // fire stats, failed-doc list and recent activity in parallel and stitch the response
  async function loadData() {
    try {
      const [statsData, failedDocsData, activityData] = await Promise.all([
        apiClient.get<ProcessingStats>("/api/documents/processing/stats"),
        apiClient.get<{ documents: FailedDocument[]; total: number }>(
          "/api/documents?status=failed&page_size=10&sort=uploaded_at"
        ),
        apiClient.get<{ activities: ActivityItem[] }>("/api/notifications/activity?limit=10")
      ])
      if (statsData) setStats(statsData)
      if (failedDocsData) setFailedDocs(failedDocsData.documents)
      if (activityData) {
        setActivities(
          (activityData.activities || []).filter(
            activity => activity.type?.startsWith("document.") || Boolean(activity.document_name)
          )
        )
      }
    } catch (err) {
      console.error("Failed to load processing data:", err)
    } finally {
      setLoading(false)
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "pdf": return "PDF"
      case "word": return "DOC"
      case "excel": return "XLS"
      case "powerpoint": return "PPT"
      case "image": return "IMG"
      case "audio": return "AUD"
      case "video": return "VID"
      case "text": return "TXT"
      default: return "FILE"
    }
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

  function getActivityIcon(type: string) {
    if (type.includes("upload")) return { icon: "↑", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" }
    if (type.includes("processing") || type.includes("started")) return { icon: "⚙", color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" }
    if (type.includes("completed") || type.includes("success")) return { icon: "✓", color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" }
    if (type.includes("failed") || type.includes("error")) return { icon: "✗", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" }
    if (type.includes("delete")) return { icon: "🗑", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }
    return { icon: "•", color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  const totalDocs = stats ? stats.pending + stats.processing + stats.completed + stats.failed : 0

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Monitor your document processing status and activity</p>
      </div>

      {/* 1. Stats Cards */}
      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Card>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.processing}</p>
              {stats.processing > 0 && <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Processing</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
          </Card>
        </div>
      )}

      {/* 2. Processing Overview */}
      {stats && totalDocs > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Processing Overview</h2>
          <Card>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Completed</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{stats.completed} / {totalDocs}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-full bg-green-500" style={{ width: `${(stats.completed / totalDocs) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Processing</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{stats.processing} / {totalDocs}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-full bg-blue-500 animate-pulse" style={{ width: `${(stats.processing / totalDocs) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Pending</span>
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">{stats.pending} / {totalDocs}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-full bg-yellow-500" style={{ width: `${(stats.pending / totalDocs) * 100}%` }} />
                </div>
              </div>
              {stats.failed > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Failed</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{stats.failed} / {totalDocs}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className="h-full bg-red-500" style={{ width: `${(stats.failed / totalDocs) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* 3. Failed Documents */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Failed Documents</h2>
        <Card>
          {failedDocs.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              No failed documents
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {failedDocs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="text-2xl">{getTypeIcon(doc.document_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-white">{doc.document_name}</p>
                    {doc.error_message && (
                      <p className="text-xs text-red-600 dark:text-red-400">{doc.error_message}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(doc.uploaded_at)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="text-xs px-3 py-1"
                    onClick={async () => {
                      try {
                        await apiClient.post(`/api/documents/${doc.id}/retry`)
                        loadData()
                      } catch (err) {
                        console.error("Retry failed:", err)
                      }
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 4. Recent Activities */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Recent Activities</h2>
        <Card>
          {activities.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              No recent activity
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {activities.map(activity => {
                const { icon, color } = getActivityIcon(activity.type)
                return (
                  <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", color)}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{activity.message}</p>
                      {activity.document_name && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{activity.document_name}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

