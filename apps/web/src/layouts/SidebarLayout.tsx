import { useState, useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { Sidebar } from "../components/layout/Sidebar"
import { NavBar } from "../components/layout/NavBar"
import { useAuth, useTheme, useToast } from "../contexts"
import { cn } from "../../../../shared/utils"

export function SidebarLayout() {

  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { colorScheme, isDark, toggleColorScheme } = useTheme()
  const { showToast } = useToast()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768)

  // collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      if (mobile) {
        setSidebarCollapsed(true)
        setIsSidebarOpen(false)
      } else {
        setSidebarCollapsed(false)
        setIsSidebarOpen(true)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 64 : 256)

  const handleSignOut = () => {
    logout()
    showToast("Signed out successfully")
    navigate("/")
  }

  const handleToggleColorScheme = () => {
    toggleColorScheme()
    showToast(isDark ? "Switched to light mode" : "Switched to dark mode")
  }

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen)
    } else {
      setSidebarCollapsed(!sidebarCollapsed)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 relative overflow-hidden">
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobile={isMobile}
        isSidebarOpen={isSidebarOpen}
        onMobileClose={() => setIsSidebarOpen(false)}
      />

      <NavBar
        user={user}
        colorScheme={colorScheme}
        onToggleColorScheme={handleToggleColorScheme}
        onLogin={() => navigate("/login")}
        onSignOut={handleSignOut}
        onNavigate={navigate}
        onToggleSidebar={handleToggleSidebar}
        variant="header"
        sidebarWidth={sidebarWidth}
        isMobile={isMobile}
      />

      <main
        className={cn(
          "min-h-screen pt-16 transition-all duration-300 relative z-10",
          !isMobile && (sidebarCollapsed ? "pl-16" : "pl-64")
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )

}
