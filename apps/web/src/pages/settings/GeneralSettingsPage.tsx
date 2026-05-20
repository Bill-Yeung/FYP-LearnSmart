import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useNavigate } from "react-router-dom"
import { useTheme, useToast } from "../../contexts"
import { THEME_MODE_INFO } from "../../../../../shared/types"
import type { ThemeMode } from "../../../../../shared/types"
import { cn } from "../../../../../shared/utils"

export function GeneralSettingsPage() {
  const { isDark, toggleColorScheme } = useTheme()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const modes: { mode: ThemeMode; href?: string }[] = [
    { mode: "normal" },
    { mode: "classroom", href: "/classroom" },
    { mode: "detective", href: "/detective" },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">General Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Appearance and learning mode</p>
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Appearance</h3>
        <div className="flex gap-2 mb-6">
          <Button variant={isDark ? "secondary" : "primary"} onClick={() => !isDark || toggleColorScheme()}>Light</Button>
          <Button variant={isDark ? "primary" : "secondary"} onClick={() => isDark || toggleColorScheme()}>Dark</Button>
        </div>

        <h3 className="text-lg font-semibold mb-4">Learning Mode</h3>
        <div className="grid grid-cols-3 gap-3">
          {modes.map(({ mode, href }) => {
            const info = THEME_MODE_INFO[mode]
            const isActive = !href
            return (
              <button
                key={mode}
                onClick={() => {
                  if (href) {
                    navigate(href)
                  } else {
                    showToast("You are already in Normal mode")
                  }
                }}
                className={cn(
                  "rounded-lg border p-4 text-left",
                  isActive ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white"
                )}
              >
                <div className={cn("font-medium", isActive ? "text-purple-700" : "text-gray-900")}>{info.name}</div>
                <div className="text-xs text-gray-500 mt-1">{info.description}</div>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

export default GeneralSettingsPage
