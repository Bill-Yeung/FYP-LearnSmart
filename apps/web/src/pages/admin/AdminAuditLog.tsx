import { useState, useEffect } from "react"
import { apiClient } from "../../lib/api"
import { useToast } from "../../contexts"
import { DateInput } from "../../components/ui/DateInput"

type AuditLogEntry = {
  id: string
  actor_id: string | null
  actor_email: string | null
  actor_name: string | null
  action_type: string
  module: string
  resource_type: string | null
  resource_id: string | null
  before_state: any
  after_state: any
  created_at: string
}

export function AdminAuditLog() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState("")
  const [moduleFilter, setModuleFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    loadLogs()
  }, [actionFilter, moduleFilter, dateFrom, dateTo])

  async function loadLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.append("action_type", actionFilter)
      if (moduleFilter) params.append("module", moduleFilter)
      if (dateFrom) params.append("date_from", dateFrom)
      if (dateTo) params.append("date_to", dateTo)
      params.append("limit", "100")

      const data = await apiClient.get<{ logs: AuditLogEntry[] }>(`/api/admin/audit-log?${params}`)
      setLogs(data?.logs || [])
    } catch (e: any) {
      showToast(e?.message || "Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  }

  function getActionColor(action: string) {
    const colors: Record<string, string> = {
      create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      approve: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      reject: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    }
    const key = Object.keys(colors).find(k => action.toLowerCase().includes(k))
    return key ? colors[key] : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
  }

  const actionOptions = [
    { value: "approve", label: "Approve" },
    { value: "reject", label: "Reject" },
    { value: "delete", label: "Delete" },
    { value: "activate_user", label: "Activate User" },
    { value: "deactivate_user", label: "Deactivate User" },
    { value: "create_global_tag", label: "Create Tag" },
    { value: "delete_global_tag", label: "Delete Tag" },
    { value: "update_data_retention", label: "Update Retention" },
  ]

  const moduleOptions = [
    { value: "content_moderation", label: "Content Moderation" },
    { value: "user_management", label: "User Management" },
    { value: "compliance", label: "Compliance" },
    { value: "import_export", label: "Import/Export" },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View all admin actions and system changes
        </p>
      </div>

      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">All Actions</option>
            {actionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="">All Modules</option>
            {moduleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <DateInput
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="From date"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <DateInput
            value={dateTo}
            onChange={setDateTo}
            placeholder="To date"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading audit logs...</span>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Timestamp</th>
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Actor</th>
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Action</th>
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Module</th>
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Resource</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="p-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{log.actor_name || "System"}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{log.actor_email || "-"}</div>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getActionColor(log.action_type)}`}>
                          {log.action_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {log.module.replace(/_/g, " ")}
                      </td>
                      <td className="p-3 text-sm text-gray-500 dark:text-gray-400">
                        {log.resource_type && log.resource_id
                          ? `${log.resource_type}/${log.resource_id.slice(0, 8)}...`
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
