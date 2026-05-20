import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import type { User, ColorScheme } from "../../../../../shared/types"
import { APP_NAME, NAV_ITEMS, USER_DROPDOWN_ITEMS } from "../../../../../shared/constants"
import { cn, canUserSeeNavItem } from "../../../../../shared/utils"
import { Logo } from "../ui/Logo"
import { useNotifications, type Notification } from "../../contexts"
import { apiClient } from "../../lib/api"

type Props = {
  user: User | null
  colorScheme: ColorScheme
  onToggleColorScheme: () => void
  onLogin: () => void
  onSignOut: () => void
  onNavigate: (href: string) => void
  onToggleSidebar?: () => void
  variant?: "full" | "header"
  pageTitle?: string
  sidebarWidth?: number
  isMobile?: boolean
}

export function NavBar({
  user,
  colorScheme,
  onToggleColorScheme,
  onLogin,
  onSignOut,
  onNavigate,
  onToggleSidebar,
  variant = "full",
  pageTitle,
  sidebarWidth = 0,
  isMobile = false
}: Props) {

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { notifications, unreadCount, markAllRead, clearNotifications } = useNotifications()

  const bellNotifications = notifications.filter(n => n.type !== 'chat.new_message')

  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [streakDays, setStreakDays] = useState<number>(0)
  const [nameColor, setNameColor] = useState<string | null>(null)
  const [profileBorder, setProfileBorder] = useState<string | null>(null)
  const [streakFreezeCount, setStreakFreezeCount] = useState<number>(0)
  const [activeBoost, setActiveBoost] = useState<{ multiplier: number; expires_at: string | null } | null>(null)

  const fetchPoints = useCallback(async () => {
    if (!user) return
    try {
      const data = await apiClient.get<{ balance: number; streak: { current: number }; cosmetics?: { name_color?: string; profile_border?: string }; streak_freeze_count?: number; active_boost?: { multiplier: number; expires_at: string | null } | null }>("/api/gamification/points/summary")
      if (data) {
        setPointsBalance(data.balance ?? 0)
        setStreakDays(data.streak?.current ?? 0)
        setNameColor(data.cosmetics?.name_color ?? null)
        setProfileBorder(data.cosmetics?.profile_border ?? null)
        setStreakFreezeCount(data.streak_freeze_count ?? 0)
        setActiveBoost(data.active_boost ?? null)
      }
    } catch { }
  }, [user])

  useEffect(() => { fetchPoints() }, [fetchPoints])

  // refresh points when other components fire the points-updated event
  useEffect(() => {
    const handler = () => fetchPoints()
    window.addEventListener("points-updated", handler)
    return () => window.removeEventListener("points-updated", handler)
  }, [fetchPoints])

  const isDark = colorScheme === "dark"
  const isHeader = variant === "header"

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => item.href !== "/assessment").filter(item => canUserSeeNavItem(item, user))
  }, [user])

  const visibleUserMenuItems = useMemo(() => {
    return USER_DROPDOWN_ITEMS.filter(item => canUserSeeNavItem(item, user))
  }, [user])

  // close all dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsUserMenuOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsUserMenuOpen(false)
    }, 150)
  }

  const handleModeMouseEnter = () => {
    if (modeTimeoutRef.current) {
      clearTimeout(modeTimeoutRef.current)
      modeTimeoutRef.current = null
    }
    setIsModeMenuOpen(true)
  }

  const handleModeMouseLeave = () => {
    modeTimeoutRef.current = setTimeout(() => {
      setIsModeMenuOpen(false)
    }, 150)
  }

  return (
    <nav
      className={cn(
        "fixed top-0 right-0 z-50 transition-all duration-300",
        "bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg shadow-sm",
        isHeader ? "border-b dark:border-gray-800" : "left-0"
      )}
      style={isHeader ? { left: sidebarWidth } : undefined}
    >
      <div className={cn(
        "px-4 sm:px-6",
        !isHeader && "max-w-7xl mx-auto lg:px-8"
      )}>
        <div className="flex items-center justify-between h-16">
          {/* Logo or Page Title */}
          {isHeader ? (
            <div>
              {pageTitle && (
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {pageTitle}
                </h1>
              )}
            </div>
          ) : (
            <button
              onClick={() => onNavigate("/")}
              className="flex items-center gap-2 font-bold text-xl"
            >
              <Logo size="md" />
              <span className="text-gray-900 dark:text-white">
                {APP_NAME}
              </span>
            </button>
          )}

          {/* Desktop Navigation */}
          {!isHeader && (
            <div className="hidden md:flex items-center gap-1">
              {visibleNavItems.map(item => (
                <button
                  key={item.href}
                  onClick={() => onNavigate(item.href)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            {user && user.role !== "admin" && (
              <div
                ref={modeMenuRef}
                className="relative"
                onMouseEnter={handleModeMouseEnter}
                onMouseLeave={handleModeMouseLeave}
              >
                <button
                  onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                  className="p-2 rounded-lg transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  title="Learning Mode"
                >
                  <ModeIcon mode="normal" />
                </button>

                {isModeMenuOpen && (
                  <div className="fixed left-2 right-2 sm:absolute sm:left-auto sm:right-0 sm:w-56 mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Learning Mode
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onNavigate("/classroom")
                        setIsModeMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ModeIcon mode="classroom" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Classroom</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Interactive classroom experience</p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        onNavigate("/detective")
                        setIsModeMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ModeIcon mode="detective" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Detective</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Mystery-solving learning adventure</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onToggleColorScheme}
              className="p-2 rounded-lg transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>

            {user && user.role !== "admin" && pointsBalance !== null && (
              <button
                onClick={() => onNavigate("/community/rewards")}
                className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Your points & streak"
              >
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <CoinIcon />
                  {pointsBalance.toLocaleString()}
                </span>
                {activeBoost && (
                  <span className="flex items-center gap-0.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 animate-pulse" title={`${activeBoost.multiplier}x XP Boost active${activeBoost.expires_at ? ` until ${new Date(activeBoost.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`}>
                    <BoltIcon />
                    {activeBoost.multiplier}x
                  </span>
                )}
                <span className={cn(
                  "flex items-center gap-0.5 font-medium",
                  streakDays > 0
                    ? "text-orange-500 dark:text-orange-400"
                    : "text-gray-400 dark:text-gray-500"
                )}>
                  <FireIcon />
                  {streakDays}
                </span>
                {streakFreezeCount > 0 && (
                  <span className="flex items-center gap-0.5 text-cyan-500 dark:text-cyan-400 font-medium" title={`${streakFreezeCount} Streak Freeze${streakFreezeCount > 1 ? "s" : ""} available`}>
                    <ShieldIcon />
                    {streakFreezeCount}
                  </span>
                )}
              </button>
            )}

            {user && (
              <div ref={notificationRef} className="relative">
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 rounded-lg transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  title="Notifications"
                >
                  <BellIcon />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationOpen && (
                  <NotificationDropdown
                    notifications={bellNotifications}
                    onClear={clearNotifications}
                    onMarkAllRead={markAllRead}
                  />
                )}
              </div>
            )}

            {user ? (
              <div
                ref={menuRef}
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium"
                    style={
                      profileBorder === "gold_border"
                        ? { boxShadow: "0 0 0 3px #facc15, 0 0 0 5px #f59e0b" }
                        : profileBorder === "diamond_border"
                          ? { boxShadow: "0 0 0 3px #60a5fa, 0 0 0 5px #3b82f6" }
                          : undefined
                    }
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-200"
                    style={nameColor ? { color: nameColor, textShadow: `0 0 8px ${nameColor}60, 0 0 16px ${nameColor}30` } : undefined}
                  >
                    {user.display_name || user.username}
                  </span>
                  <ChevronDownIcon className={cn(
                    "w-4 h-4 transition-transform text-gray-600 dark:text-gray-300",
                    isUserMenuOpen && "rotate-180"
                  )} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="font-medium" style={nameColor ? { color: nameColor, textShadow: `0 0 8px ${nameColor}60, 0 0 16px ${nameColor}30` } : undefined}>
                        {user.display_name || user.username}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>

                    {visibleUserMenuItems.map(item => (
                      <button
                        key={item.href}
                        onClick={() => {
                          onNavigate(item.href)
                          setIsUserMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        {item.label}
                      </button>
                    ))}

                    <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-2">
                      <button
                        onClick={() => {
                          onSignOut()
                          setIsUserMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition bg-gray-900 text-white hover:opacity-90 dark:bg-gray-100 dark:text-gray-900"
              >
                Sign in
              </button>
            )}

            {/* Mobile Menu Toggle */}
            {variant === "header" && isHeader && (
              <button
                onClick={onToggleSidebar}
                className="md:hidden p-2 rounded-lg transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                title="Toggle menu"
              >
                <MenuIcon />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200/20 dark:border-gray-800">
            {visibleNavItems.map(item => (
              <button
                key={item.href}
                onClick={() => {
                  onNavigate(item.href)
                  setIsMobileMenuOpen(false)
                }}
                className="block w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function CoinIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity={0.2} />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={2} />
      <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">$</text>
    </svg>
  )
}

function FireIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.07 2.1-6.28 4.2-8.42L9.5 4.3l.71.71C11.1 5.9 12 7.5 12 7.5s.9-1.6 1.79-2.49l.71-.71 2.3 2.28C18.9 8.72 21 11.93 21 15c0 4.42-4.03 8-9 8zm0-17.15C10.77 7.46 5 12.06 5 15c0 3.31 3.13 6 7 6s7-2.69 7-6c0-2.94-5.77-7.54-7-9.15z" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

type NotificationDropdownProps = {
  notifications: Notification[]
  onClear: () => void
  onMarkAllRead: () => void
}

function NotificationDropdown({ notifications, onClear, onMarkAllRead }: NotificationDropdownProps) {
  const { markAsRead } = useNotifications()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const unreadNotifications = notifications.filter(n => !n.is_read)

  return (
    <div className="fixed left-2 right-2 sm:absolute sm:left-auto sm:right-0 sm:w-96 mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</p>
        <div className="flex items-center gap-3">
          {unreadNotifications.length > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No notifications yet
          </div>
        ) : (
          notifications.map((n, i) => (
            <NotificationItem
              key={n.id || `${n.timestamp}-${i}`}
              notification={n}
              isExpanded={expandedId === (n.id || `${n.timestamp}-${i}`)}
              onToggleExpand={() => setExpandedId(
                expandedId === (n.id || `${n.timestamp}-${i}`) ? null : (n.id || `${n.timestamp}-${i}`)
              )}
              onMarkAsRead={() => n.id && markAsRead(n.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

type NotificationItemProps = {
  notification: Notification
  isExpanded: boolean
  onToggleExpand: () => void
  onMarkAsRead: () => void
}

function NotificationItem({ notification, isExpanded, onToggleExpand, onMarkAsRead }: NotificationItemProps) {
  const { type, data, timestamp, is_read } = notification

  const timeAgo = getTimeAgo(timestamp)

  const getIcon = () => {
    if (type.startsWith("document.")) {
      switch (data.status) {
        case "pending": return "📄"
        case "processing": return "⚙️"
        case "completed": return "✅"
        case "failed": return "❌"
        default: return "📄"
      }
    }
    return "🔔"
  }

  const getMessage = () => {
    if (data.message) return data.message
    if (data.error) return `Failed: ${data.error}`
    return type
  }

  const message = getMessage()
  const title = data.title || ""
  const isLongTitle = title.length > 40
  const isLongMessage = message.length > 80
  const hasLongContent = isLongTitle || isLongMessage

  return (
    <div className={cn(
      "px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 transition-colors",
      !is_read && "bg-blue-50/50 dark:bg-blue-900/10",
      "hover:bg-gray-50 dark:hover:bg-gray-800/50"
    )}>
      <div className="flex items-start gap-3">
        <span className="text-base mt-0.5">{getIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            {title && (
              <p className={cn(
                "text-sm font-medium text-gray-900 dark:text-white",
                !isExpanded && "truncate"
              )}>
                {title}
              </p>
            )}
            {!is_read && (
              <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-500" />
            )}
          </div>
          <p className={cn(
            "text-xs text-gray-600 dark:text-gray-400 mt-0.5",
            !isExpanded && "line-clamp-2"
          )}>
            {message}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {timeAgo}
            </span>
            {hasLongContent && (
              <button
                onClick={onToggleExpand}
                className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
            {!is_read && notification.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkAsRead()
                }}
                className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return "Just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  switch (mode) {
    case "classroom":
      return (
        <svg className={cn("w-5 h-5", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    case "detective":
      return (
        <svg className={cn("w-5 h-5", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    default:
      return (
        <svg className={cn("w-5 h-5", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}
