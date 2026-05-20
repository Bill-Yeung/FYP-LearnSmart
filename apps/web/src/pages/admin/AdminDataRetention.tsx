import { useState, useEffect } from "react"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"

type RetentionPolicy = {
  key: string
  retain_days: number
  description: string
  updated_at: string
}

export function AdminDataRetention() {
  const { showToast } = useToast()
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadPolicies()
  }, [])

  async function loadPolicies() {
    try {
      const res = await apiClient.get<{ policies: RetentionPolicy[] }>("/api/admin/data-retention")
      if (res?.policies) {
        setPolicies(res.policies)
      }
    } catch {
      showToast("Failed to load retention policies")
    } finally {
      setLoading(false)
    }
  }

  // push the new retention days for one policy and patch local state without a refetch
  async function handleUpdatePolicy(key: string, days: number) {
    setSaving(key)
    try {
      await apiClient.put(`/api/admin/data-retention/${key}`, { retain_days: days })
      setPolicies(prev => prev.map(p =>
        p.key === key ? { ...p, retain_days: days, updated_at: new Date().toISOString() } : p
      ))
      showToast("Retention policy updated")
    } catch {
      showToast("Failed to update policy")
    } finally {
      setSaving(null)
    }
  }

  function getPolicyLabel(key: string): string {
    const labels: Record<string, string> = {
      audit_log: "Audit Log",
      user_sessions: "User Sessions",
    }
    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading retention policies...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Retention</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure how long different types of data are retained before automatic deletion
        </p>
      </div>

      {/* Retention Policies */}
      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Retention Periods</h2>
        {policies.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No retention policies configured
          </p>
        ) : (
          <div className="space-y-3">
            {policies.map(policy => (
              <div
                key={policy.key}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {getPolicyLabel(policy.key)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {policy.description || `Retention period for ${policy.key}`}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <select
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    value={policy.retain_days}
                    onChange={(e) => handleUpdatePolicy(policy.key, parseInt(e.target.value))}
                    disabled={saving === policy.key}
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">6 months</option>
                    <option value="365">1 year</option>
                    <option value="730">2 years</option>
                    <option value="1095">3 years</option>
                    <option value="0">Forever</option>
                  </select>
                  {saving === policy.key && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Notice */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Data older than the retention period is automatically purged by scheduled background jobs.
              Ensure backups are in place before reducing retention periods.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
