import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"

type SystemStatus = "operational" | "degraded" | "down" | "checking"

type ServiceStatus = {
  name: string
  status: SystemStatus
  lastChecked: string
  responseTime?: number
}

type PlatformStats = {
  total_users: number
  total_documents: number
  total_discussions: number
  total_communities: number
  total_flashcards: number
  total_questions: number
  ai_tokens_used_this_month: number
  ai_token_usage_records_this_month?: number
}

export function SystemSettingsPage() {
  const { showToast } = useToast()
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Database", status: "checking", lastChecked: "—" },
    { name: "AI Service", status: "checking", lastChecked: "—" },
  ])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
    checkServices()
  }, [])

  async function loadSettings() {
    try {
      const res = await apiClient.get<{ stats: PlatformStats }>("/api/admin/settings")
      if (res?.stats) {
        setStats(res.stats)
      }
    } catch {
      showToast("Failed to load platform stats")
    } finally {
      setLoading(false)
    }
  }

  // ping db and ai endpoints, time the responses, and update each row's status
  async function checkServices() {
    const now = new Date().toLocaleTimeString("en-US")

    const dbStart = Date.now()
    try {
      await apiClient.get("/api/admin/settings")
      setServices(prev => prev.map(s =>
        s.name === "Database"
          ? { ...s, status: "operational" as SystemStatus, lastChecked: now, responseTime: Date.now() - dbStart }
          : s
      ))
    } catch {
      setServices(prev => prev.map(s =>
        s.name === "Database" ? { ...s, status: "down" as SystemStatus, lastChecked: now } : s
      ))
    }

    const aiStart = Date.now()
    try {
      const res = await apiClient.get<{ status: string }>("/api/ai/health")
      setServices(prev => prev.map(s =>
        s.name === "AI Service"
          ? { ...s, status: res?.status === "ok" ? "operational" as SystemStatus : "degraded" as SystemStatus, lastChecked: now, responseTime: Date.now() - aiStart }
          : s
      ))
    } catch {
      setServices(prev => prev.map(s =>
        s.name === "AI Service" ? { ...s, status: "down" as SystemStatus, lastChecked: now } : s
      ))
    }
  }

  async function handleRefreshStatus() {
    setServices(prev => prev.map(s => ({ ...s, status: "checking" as SystemStatus })))
    await Promise.all([checkServices(), loadSettings()])
    showToast("System status refreshed")
  }

  function getStatusColor(status: SystemStatus) {
    const colors: Record<SystemStatus, string> = {
      operational: "text-green-600 dark:text-green-400",
      degraded: "text-yellow-600 dark:text-yellow-400",
      down: "text-red-600 dark:text-red-400",
      checking: "text-gray-400 dark:text-gray-500"
    }
    return colors[status]
  }

  function getStatusDotColor(status: SystemStatus) {
    const colors: Record<SystemStatus, string> = {
      operational: "bg-green-500",
      degraded: "bg-yellow-500",
      down: "bg-red-500",
      checking: "bg-gray-400 animate-pulse"
    }
    return colors[status]
  }

  function getStatusLabel(status: SystemStatus) {
    const labels: Record<SystemStatus, string> = {
      operational: "Operational",
      degraded: "Degraded",
      down: "Down",
      checking: "Checking..."
    }
    return labels[status]
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading system settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Status</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor system health and platform statistics
        </p>
      </div>

      {/* Service Status */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Service Status</h2>
          <Button variant="secondary" onClick={handleRefreshStatus}>
            Refresh
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <div
              key={service.name}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-900 dark:text-white">{service.name}</div>
                <div className={cn("h-3 w-3 rounded-full", getStatusDotColor(service.status))} />
              </div>
              <div className={cn("text-sm font-medium mb-1", getStatusColor(service.status))}>
                {getStatusLabel(service.status)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                {service.responseTime !== undefined && (
                  <div>Response: {service.responseTime}ms</div>
                )}
                <div>Last checked: {service.lastChecked}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Platform Overview */}
      {stats && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Platform Overview</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total_users}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Active Users</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.total_documents}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Documents</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.total_flashcards}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Flashcards</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.total_questions}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Questions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.total_discussions}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Discussions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.total_communities}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Communities</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.ai_tokens_used_this_month > 1000000
                  ? `${(stats.ai_tokens_used_this_month / 1000000).toFixed(1)}M`
                  : stats.ai_tokens_used_this_month > 1000
                    ? `${(stats.ai_tokens_used_this_month / 1000).toFixed(1)}K`
                    : stats.ai_tokens_used_this_month}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">AI Tokens (Month)</div>
            </div>
          </div>
        </Card>
      )}

    </div>
  )
}
