import { Navigate, useLocation } from "react-router-dom"
import type { UserRole } from "../../../../shared/types"
import { useAuth } from "../contexts/AuthContext"

type ProtectedRouteProps = {
  children: React.ReactNode
  requiresAuth?: boolean
  redirectIfAuth?: boolean
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({
  children,
  requiresAuth = false,
  redirectIfAuth = false,
  allowedRoles}: ProtectedRouteProps) {

  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (redirectIfAuth && isAuthenticated) {
    const from = (location.state as { from?: string })?.from || "/dashboard"
    return <Navigate to={from} replace />
  }

  if (requiresAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <UnauthorizedPage userRole={userRole} requiredRoles={allowedRoles} />
    }
  }

  return <>{children}</>

}

function UnauthorizedPage({
  userRole,
  requiredRoles}: {
  userRole?: UserRole
  requiredRoles: UserRole[]}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center max-w-md px-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Access Denied
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          You don't have permission to access this page.
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          <p>Your role: <span className="font-medium text-gray-700 dark:text-gray-300">{userRole || "none"}</span></p>
          <p>Required: <span className="font-medium text-gray-700 dark:text-gray-300">{requiredRoles.join(" or ")}</span></p>
        </div>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-medium hover:opacity-90 transition"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}
