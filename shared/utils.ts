import type { NavItem, User } from "./types"

export function formatRelativeTime(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date
  const now = new Date()

  const diffMs = now.getTime() - target.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) return "yesterday"
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`
  return `${Math.floor(diffDay / 365)}y ago`
}

export function formatTime(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date
  return target.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}

export function getChatDaySeparator(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date
  const now = new Date()

  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = todayDate.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return target.toLocaleDateString("en-US", { weekday: "long" })

  return target.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: target.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  })
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function canUserSeeNavItem(item: NavItem, user: User | null): boolean {
  if (item.requiresAuth && !user) {
    return false
  }
  if (item.allowedRoles && item.allowedRoles.length > 0) {
    if (!user || !item.allowedRoles.includes(user.role)) {
      return false
    }
  }
  return true
}
