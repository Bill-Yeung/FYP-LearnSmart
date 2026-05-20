import { useState, useEffect } from "react"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { useConfirmDialog } from "../../components/general/ConfirmDialog"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"


type UserRole = "student" | "teacher" | "admin"

type AdminUser = {
  id: string
  username: string
  email: string
  display_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  last_login: string | null
}

export function ManageUsersPage() {
  const { showToast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all")
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const { confirm, dialogProps, ConfirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await apiClient.get<AdminUser[]>("/api/users?limit=500")
      setUsers(data || [])
    } catch (e: any) {
      showToast(e?.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = searchQuery === "" ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.display_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && u.is_active) ||
      (statusFilter === "inactive" && !u.is_active)
    return matchesSearch && matchesRole && matchesStatus
  })

  // confirm with the admin then activate/deactivate the user and update local state
  async function handleToggleStatus(user: AdminUser) {
    const isDeactivating = user.is_active
    const actionWord = isDeactivating ? "deactivate" : "activate"
    const pastTense = isDeactivating ? "deactivated" : "activated"

    const confirmed = await confirm({
      title: `${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} User`,
      message: (
        <>
          Are you sure you want to {actionWord} <strong>{user.display_name || user.username}</strong>?
          {isDeactivating && (
            <p className="mt-2 text-sm">
              This user will no longer be able to access the platform until reactivated.
            </p>
          )}
        </>
      ),
      confirmLabel: actionWord.charAt(0).toUpperCase() + actionWord.slice(1),
      variant: isDeactivating ? "danger" : "info"
    })

    if (!confirmed) return

    setActionLoading(user.id)
    try {
      if (isDeactivating) {
        await apiClient.delete(`/api/users/${user.id}`)
      } else {
        await apiClient.post(`/api/users/${user.id}/activate`, {})
      }
      setUsers(prev => prev.map(u =>
        u.id === user.id ? { ...u, is_active: !u.is_active } : u
      ))
      showToast(`User ${user.display_name || user.username} has been ${pastTense}`)
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
      }
    } catch (e: any) {
      showToast(e?.message || `Failed to ${actionWord} user`)
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  function getStatusBadgeColor(isActive: boolean) {
    return isActive
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading users...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manage Users
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and manage all registered users
        </p>
      </div>

      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <TextField
              label=""
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Admins</option>
          </select>
          <select
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "active" | "inactive" | "all")}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">User</th>
                <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Role</th>
                <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Status</th>
                <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Last Login</th>
                <th className="p-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No users found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {(u.display_name || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{u.display_name || u.username}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {u.role}
                    </td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2 py-1 text-xs font-medium", getStatusBadgeColor(u.is_active))}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(u.last_login)}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setSelectedUser(u)}>
                          View
                        </Button>
                        <Button
                          variant={u.is_active ? "secondary" : "primary"}
                          onClick={() => handleToggleStatus(u)}
                          disabled={actionLoading === u.id}
                        >
                          {actionLoading === u.id ? "..." : u.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-2xl font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {(selectedUser.display_name || selectedUser.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedUser.display_name || selectedUser.username}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{selectedUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex gap-3 items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{selectedUser.role}</span>
                <span className={cn("rounded-full px-3 py-1 text-sm font-medium", getStatusBadgeColor(selectedUser.is_active))}>
                  {selectedUser.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Joined</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedUser.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Last Login</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedUser.last_login)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
