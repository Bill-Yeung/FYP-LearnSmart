import { useState, useEffect, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { MemorizePage } from "./MemorizePage"
import { EmailChangeDialog } from "./EmailChangeDialog"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useConfirmDialog } from "../../components/general/ConfirmDialog"
import { useAuth, useTheme, useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"


type Session = {
  id: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
  last_activity: string
  isCurrent: boolean
}

type Prefs = {
  email_notifications: boolean
  push_notifications: boolean
  study_reminders: boolean
  community_updates: boolean
  profile_visibility: "public" | "friends" | "private"
  show_online_status: boolean
  allow_friend_requests: boolean
}

const DEFAULT_PREFS: Prefs = {
  email_notifications: true,
  push_notifications: true,
  study_reminders: true,
  community_updates: false,
  profile_visibility: "public",
  show_online_status: true,
  allow_friend_requests: true
}

const PREF_LABELS: Record<keyof Prefs, string> = {
  email_notifications: "Email notifications",
  push_notifications: "Push notifications",
  study_reminders: "Study reminders",
  community_updates: "Community updates",
  profile_visibility: "Profile visibility",
  show_online_status: "Online status",
  allow_friend_requests: "Friend requests"
}

type SettingsTab = "general" | "sessions" | "notifications" | "privacy" | "memorize"

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout, currentSessionId, refreshUser } = useAuth()
  const { isDark, toggleColorScheme } = useTheme()
  const { showToast } = useToast()
  const { confirm, dialogProps, ConfirmDialog } = useConfirmDialog()

  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)

  const FLASHCARDS_KEY = "flashcards-default-algorithm"
  const [defaultAlgo, setDefaultAlgo] = useState<"sm2" | "leitner" | "simple" | "fsrs">("sm2")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FLASHCARDS_KEY)
      if (stored === "sm2" || stored === "leitner" || stored === "simple" || stored === "fsrs") {
        setDefaultAlgo(stored as any)
      }
    } catch (e) {
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await apiClient.get<Prefs>("/api/users/me/preferences")
        if (!cancelled && p) setPrefs(p)
      } catch (e: any) {
        showToast(e?.message || "Failed to load preferences")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [showToast])

  useEffect(() => {
    if (activeTab !== "sessions") return

    let cancelled = false
    ;(async () => {
      try {
        const rows = await apiClient.get<Array<Omit<Session, "isCurrent">>>("/api/users/me/sessions")
        if (cancelled || !rows) return
        setSessions(rows.map(row => ({ ...row, isCurrent: row.id === currentSessionId })))
      } catch (e: any) {
        showToast(e?.message || "Failed to load sessions")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeTab, currentSessionId, showToast])

  async function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const previous = prefs[key]
    setPrefs(current => ({ ...current, [key]: value }))

    try {
      await apiClient.patch("/api/users/me/preferences", { [key]: value })
      showToast(`${PREF_LABELS[key]} updated`)
    } catch (e: any) {
      setPrefs(current => ({ ...current, [key]: previous }))
      showToast(e?.message || "Failed to save preference")
    }
  }

  async function handleRemoveSession(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    if (session.isCurrent) {
      showToast("Cannot remove current session. Use logout instead.")
      return
    }

    const confirmed = await confirm({
      title: "Remove Session",
      message: (
        <>
          Are you sure you want to remove the session on <strong>{formatSessionName(session)}</strong>?
          <p className="mt-2 text-sm">
            This will sign out that device immediately.
          </p>
        </>
      ),
      confirmLabel: "Remove",
      variant: "danger"
    })

    if (!confirmed) return

    setLoading(true)
    try {
      await apiClient.delete(`/api/users/me/sessions/${sessionId}`)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      showToast(`Session on ${formatSessionName(session)} has been removed`)
    } catch (e: any) {
      showToast(e?.message || "Failed to remove session")
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveAllOtherSessions() {
    const otherSessions = sessions.filter(s => !s.isCurrent)
    if (otherSessions.length === 0) {
      showToast("No other sessions to remove")
      return
    }

    const confirmed = await confirm({
      title: "Remove All Other Sessions",
      message: (
        <>
          Are you sure you want to remove all {otherSessions.length} other session(s)?
          <p className="mt-2 text-sm">
            This will sign out all other devices immediately.
          </p>
        </>
      ),
      confirmLabel: "Remove All",
      variant: "danger"
    })

    if (!confirmed) return

    setLoading(true)
    try {
      const res = await apiClient.delete<{ removed: number }>("/api/users/me/sessions")
      setSessions(prev => prev.filter(s => s.isCurrent))
      showToast(`Removed ${res?.removed ?? 0} other session(s)`)
    } catch (e: any) {
      showToast(e?.message || "Failed to remove sessions")
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    { id: "general", label: "General", icon: <SettingsIcon className="h-4 w-4" /> },
    { id: "sessions", label: "Sessions", icon: <DeviceIcon className="h-4 w-4" /> },
    { id: "notifications", label: "Notifications", icon: <BellIcon className="h-4 w-4" /> },
    { id: "privacy", label: "Privacy", icon: <ShieldIcon className="h-4 w-4" /> },
    { id: "memorize", label: "Memorize", icon: <MemorizeIcon className="h-4 w-4" /> }
  ]

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account preferences and security
        </p>
      </div>

      
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Appearance
            </h3>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Color Scheme
              </label>
              <div className="flex gap-2">
                <Button
                  variant={isDark ? "secondary" : "primary"}
                  onClick={() => !isDark || toggleColorScheme()}
                >
                  Light
                </Button>
                <Button
                  variant={isDark ? "primary" : "secondary"}
                  onClick={() => isDark || toggleColorScheme()}
                >
                  Dark
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Learning Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { label: "Normal", description: "Standard dashboard UI", href: undefined },
                  { label: "Classroom", description: "Interactive classroom experience", href: "/classroom" },
                  { label: "Detective", description: "Mystery-solving learning adventure", href: "/detective" },
                ] as const).map(({ label, description, href }) => {
                  const isActive = !href
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (href) {
                          navigate(href)
                        } else {
                          showToast("You are already in Normal mode")
                        }
                      }}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-all",
                        isActive
                          ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500/20 dark:border-purple-400 dark:bg-purple-900/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      )}
                    >
                      <div className={cn(
                        "font-medium",
                        isActive
                          ? "text-purple-700 dark:text-purple-300"
                          : "text-gray-900 dark:text-gray-100"
                      )}>
                        {label}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Account
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Email</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</div>
                </div>
                <Button variant="ghost" onClick={() => setEmailDialogOpen(true)}>
                  Change
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                <div>
                  <div className="font-medium text-red-700 dark:text-red-300">Delete Account</div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Deactivate your account and sign out all devices
                  </div>
                </div>
                <Button
                  variant="danger"
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: "Delete Account",
                      message: (
                        <>
                          Are you sure you want to delete your account?
                          <p className="mt-2 text-sm">
                            Your account will be deactivated and you will be signed out of all devices.
                            An admin can reverse this if you change your mind.
                          </p>
                        </>
                      ),
                      confirmLabel: "Delete",
                      variant: "danger"
                    })

                    if (!confirmed) return

                    try {
                      await apiClient.delete("/api/users/me")
                      showToast("Account deactivated")
                      await logout()
                      navigate("/login")
                    } catch (e: any) {
                      showToast(e?.message || "Failed to delete account")
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Active Sessions
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Devices where you're currently signed in
                </p>
              </div>
              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <Button
                  variant="danger"
                  onClick={handleRemoveAllOtherSessions}
                  disabled={loading}
                >
                  Sign Out All Others
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-4",
                    session.isCurrent
                      ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30"
                      : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      session.isCurrent
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-gray-200 dark:bg-gray-700"
                    )}>
                      <DeviceIcon className={cn(
                        "h-5 w-5",
                        session.isCurrent
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-500 dark:text-gray-400"
                      )} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatSessionName(session)}
                        </span>
                        {session.isCurrent && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        IP: {session.ip_address ?? "unknown"}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        Last active: {formatDateTime(session.last_activity)}
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      onClick={() => handleRemoveSession(session.id)}
                      disabled={loading}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {sessions.length === 0 && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  No active sessions found.
                </p>
              </div>
            )}

            {sessions.length === 1 && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This is your only active session. You're signed in on this device only.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Notification Preferences
            </h3>
            <div className="space-y-4">
              <ToggleSetting
                label="Email Notifications"
                description="Receive important updates via email"
                checked={prefs.email_notifications}
                onChange={(value) => updatePref("email_notifications", value)}
              />
              <ToggleSetting
                label="Push Notifications"
                description="Receive notifications in your browser"
                checked={prefs.push_notifications}
                onChange={(value) => updatePref("push_notifications", value)}
              />
              <ToggleSetting
                label="Study Reminders"
                description="Get reminders to review your flashcards"
                checked={prefs.study_reminders}
                onChange={(value) => updatePref("study_reminders", value)}
              />
              <ToggleSetting
                label="Community Updates"
                description="Notifications about community activities"
                checked={prefs.community_updates}
                onChange={(value) => updatePref("community_updates", value)}
              />
            </div>
          </Card>
        </div>
      )}

      {activeTab === "privacy" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Privacy Settings
            </h3>
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Profile Visibility
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                  {(["public", "friends", "private"] as const).map((visibility) => (
                    <button
                      key={visibility}
                      onClick={() => updatePref("profile_visibility", visibility)}
                      className={cn(
                        "rounded-lg border p-3 text-center transition-all",
                        prefs.profile_visibility === visibility
                          ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500/20 dark:border-purple-400 dark:bg-purple-900/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium capitalize",
                        prefs.profile_visibility === visibility
                          ? "text-purple-700 dark:text-purple-300"
                          : "text-gray-900 dark:text-gray-100"
                      )}>
                        {visibility}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <ToggleSetting
                label="Show Online Status"
                description="Let others see when you're online"
                checked={prefs.show_online_status}
                onChange={(value) => updatePref("show_online_status", value)}
              />
              <ToggleSetting
                label="Allow Friend Requests"
                description="Let others send you friend requests"
                checked={prefs.allow_friend_requests}
                onChange={(value) => updatePref("allow_friend_requests", value)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Memorize Settings */}
      {activeTab === "memorize" && (
        <div className="space-y-6">
          <MemorizePage />
        </div>
      )}

      <EmailChangeDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        onSuccess={async (newEmail) => {
          showToast(`Email changed to ${newEmail}`)
          await refreshUser()
        }}
      />
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}


function formatSessionName(session: Session): string {
  return session.user_agent ? shortUserAgent(session.user_agent) : "Unknown device"
}

function shortUserAgent(userAgent: string): string {
  const browser =
    /Edg\/[\d.]+/.test(userAgent) ? "Edge" :
    /Firefox\/[\d.]+/.test(userAgent) ? "Firefox" :
    /Chrome\/[\d.]+/.test(userAgent) ? "Chrome" :
    /Safari\/[\d.]+/.test(userAgent) ? "Safari" :
    null
  const os = /(Windows|Mac OS X|Linux|iPhone|Android)/.exec(userAgent)?.[1]
  return [browser, os].filter(Boolean).join(" - ") || userAgent.slice(0, 40)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  })
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  )
}


function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function MemorizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
