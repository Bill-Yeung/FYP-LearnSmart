import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"

type DistributionItem = { type?: string; level?: string; count: number }

type AnalyticsData = {
  total_concepts: number
  total_relationships: number
  processing_time_seconds: number | null
  concept_type_distribution: DistributionItem[]
  difficulty_distribution: DistributionItem[]
  relationship_type_distribution: DistributionItem[]
}

function BarChart({ items, labelKey, color }: { items: DistributionItem[]; labelKey: "type" | "level"; color: string }) {
  if (!items.length) return <p className="text-sm text-gray-400">No data</p>
  const max = Math.max(...items.map(i => i.count))

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const label = (labelKey === "type" ? item.type : item.level) || "Unknown"
        const pct = max > 0 ? (item.count / max) * 100 : 0
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="w-32 truncate text-sm text-gray-700 dark:text-gray-300 capitalize">{label}</span>
            <div className="flex-1 h-6 rounded bg-gray-100 dark:bg-gray-800">
              <div className={`h-6 rounded ${color} flex items-center px-2 text-xs font-medium text-white transition-all`} style={{ width: `${Math.max(pct, 8)}%` }}>
                {item.count}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DocumentAnalyticsPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (documentId) loadAnalytics()
  }, [documentId])

  async function loadAnalytics() {
    try {
      const data = await apiClient.get<AnalyticsData>(`/api/documents/${documentId}/analytics`)
      setAnalytics(data)
    } catch (err) {
      console.error("Failed to load analytics:", err)
      setError("Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <div className="py-8 text-center">
            <p className="text-red-500">{error || "Analytics not available"}</p>
            <Button variant="secondary" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/knowledge/documents/${documentId}`)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Document
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Analytics</h1>
      </div>

      {/* Summary Row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.total_concepts}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Concepts</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analytics.total_relationships}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Relationships</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {analytics.processing_time_seconds != null ? `${analytics.processing_time_seconds}s` : "N/A"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Processing Time</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Concept Type Distribution</h3>
          <BarChart items={analytics.concept_type_distribution} labelKey="type" color="bg-blue-500" />
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Difficulty Distribution</h3>
          <BarChart items={analytics.difficulty_distribution} labelKey="level" color="bg-amber-500" />
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Relationship Type Distribution</h3>
          <BarChart items={analytics.relationship_type_distribution} labelKey="type" color="bg-purple-500" />
        </Card>
      </div>
    </div>
  )
}
