import { Button } from "../ui/Button"

export type FlashcardsHeaderProps = {
  appName: string
  userEmail: string
  logoUrl?: string
  isDark: boolean
  onToggleTheme?: () => void
  onSignOut?: () => void
  onToast?: (msg: string) => void
  navigate: (path: string) => void
}

export function FlashcardsHeader({
  appName,
  userEmail,
  logoUrl,
  isDark,
  onToggleTheme,
  onSignOut,
  onToast,
  navigate
}: FlashcardsHeaderProps) {
  const handleThemeToggle = () => {
    onToggleTheme?.()
    onToast?.(isDark ? "Switched to light mode" : "Switched to dark mode")
  }

  const handleSignOut = () => {
    onSignOut?.()
    onToast?.("Signed out (UI only)")
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={`${appName} logo`} className="h-9 w-9 rounded-xl" />
          ) : (
            <div className="h-9 w-9 rounded-xl border bg-gray-100 dark:border-gray-800 dark:bg-gray-900" />
          )}
          <div>
            <div className="text-sm font-semibold tracking-tight">{appName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {userEmail} • Flashcards & Memory Module
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleThemeToggle}>
            {isDark ? "Light" : "Dark"}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
          <Button variant="secondary" onClick={() => navigate("/application/teach-back")}>
            Application
          </Button>
          <Button variant="secondary" onClick={() => navigate("/assessment")}>
            Assessment
          </Button>
          <Button variant="secondary" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
