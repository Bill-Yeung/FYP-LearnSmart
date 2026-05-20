import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import type { User, NavItem } from "../../../../../shared/types"
import { USER_MENU_ITEMS, APP_NAME } from "../../../../../shared/constants"
import { cn, canUserSeeNavItem } from "../../../../../shared/utils"
import { Logo } from "../ui/Logo"

type Props = {
  user?: User | null
  collapsed?: boolean
  onToggleCollapse?: () => void
  isMobile?: boolean
  isSidebarOpen?: boolean
  onMobileClose?: () => void
}

export default Sidebar

export function Sidebar({ user, collapsed = false, onToggleCollapse, isMobile = false, isSidebarOpen = true, onMobileClose }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const effectiveUser = user ?? ({ role: "student" } as any)

  const visibleItems = USER_MENU_ITEMS.filter(item => item.href !== "/assessment").filter(item => canUserSeeNavItem(item, effectiveUser))

  // auto-expand menu groups whose child matches the current route
  useEffect(() => {
    USER_MENU_ITEMS.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child =>
          location.pathname === child.href || location.pathname.startsWith(child.href + "/")
        )
        if (hasActiveChild) {
          setExpandedItems(prev => {
            if (prev.has(item.href)) return prev
            return new Set([...prev, item.href])
          })
        }
      }
    })
  }, [location.pathname])

  function toggleExpand(href: string) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(href)) {
        next.delete(href)
      } else {
        next.add(href)
      }
      return next
    })
  }

  function isItemActive(item: NavItem): boolean {
    if (location.pathname === item.href) return true
    if (item.children) {
      return item.children.some(child =>
        location.pathname === child.href || location.pathname.startsWith(child.href + "/")
      )
    }
    return false
  }

  // recursive render for a nav item and its children
  function renderNavItem(item: NavItem, depth: number = 0) {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.href)
    const isActive = isItemActive(item)
    const isDirectActive = location.pathname === item.href

    const visibleChildren = hasChildren
      ? item.children!.filter(child => canUserSeeNavItem(child, effectiveUser))
      : []

    return (
      <div key={item.href}>
        <button
          onClick={() => {
            if (hasChildren && !collapsed) {
              toggleExpand(item.href)
            } else {
              navigate(item.href)
            }
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            depth > 0 && "ml-4 text-[13px]",
            isDirectActive || (isActive && !hasChildren)
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
              : isActive && hasChildren
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          )}
          title={collapsed ? item.label : undefined}
        >
          <NavIcon icon={item.icon} className="h-5 w-5 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {hasChildren && (
                <ChevronIcon
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isExpanded && "rotate-90"
                  )}
                />
              )}
            </>
          )}
        </button>

        {hasChildren && isExpanded && !collapsed && (
          <div className="mt-1 space-y-1">
            {visibleChildren.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen overflow-x-hidden border-r bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-950",
        !isMobile && (collapsed ? "w-16" : "w-64"),
        isMobile && (isSidebarOpen ? "w-64" : "-translate-x-full w-64"),
        isMobile && !isSidebarOpen && "hidden md:block"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4 dark:border-gray-800">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 font-bold text-xl"
        >
          <Logo size="md" />
          {(!collapsed || (isMobile && isSidebarOpen)) && (
            <span className="text-gray-900 dark:text-white">
              {APP_NAME}
            </span>
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-4" style={{ maxHeight: "calc(100vh - 120px)" }}>
        {visibleItems.map(item => renderNavItem(item))}

      </nav>

      <div className="absolute bottom-4 left-0 right-0 px-2">
        <button
          onClick={isMobile ? onMobileClose : onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          title={isMobile ? "Close sidebar" : (collapsed ? "Expand sidebar" : "Collapse sidebar")}
        >
          <CollapseIcon className={cn("h-5 w-5 transition-transform", !isMobile && collapsed && "rotate-180")} />
          {(!collapsed || isMobile) && <span>{isMobile ? "Close" : "Collapse"}</span>}
        </button>
      </div>

    </aside>
  )
}

function NavIcon({ icon, className }: { icon?: string; className?: string }) {
  switch (icon) {
    case "layout":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case "workflow":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    case "target":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    case "file":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case "brain":
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 4a3 3 0 00-3 3v1a2 2 0 00-2 2v1a2 2 0 001 1.732V15a3 3 0 003 3h1"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 4a3 3 0 013 3v1a2 2 0 012 2v1a2 2 0 01-1 1.732V15a3 3 0 01-3 3h-1"
          />
        </svg>
      )
    case "cards":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="6" width="16" height="12" rx="2" />
          <path d="M6 2h12a2 2 0 012 2v12" />
        </svg>
      )
    case "users":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    case "plus":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )
    case "shield":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    case "settings":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case "book":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    case "upload":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      )
    case "tag":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    case "map":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    case "chart":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    case "user":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case "game":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8a4 4 0 014-4h8a4 4 0 014 4v4a4 4 0 01-4 4h-1l-2 2-2-2H8a4 4 0 01-4-4V8z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 9H8m1-1v2" />
          <circle cx="16" cy="9" r="1" />
          <circle cx="18" cy="11" r="1" />
        </svg>
      )
    case "calendar":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      )
    case "timer":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="14" r="7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4l2 2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6" />
        </svg>
      )
    
    case "heart":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      )
    case "activity":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      )
    case "award":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="8" r="7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
        </svg>
      )
    case "trophy":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2M6 3h12v6a6 6 0 01-12 0V3zM9 21h6M12 15v6" />
        </svg>
      )
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
  }
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function CollapseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  )
}
