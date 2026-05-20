import { useMemo, useState, useRef, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import type { UserRole } from "../../../../../shared/types"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Logo } from "../../components/ui/Logo"
import { TextField } from "../../components/form/TextField"
import { useAuth, useTheme, useToast, useNotifications } from "../../contexts"
import { APP_NAME } from "../../../../../shared/constants"
import { cn } from "../../../../../shared/utils"

type LoginMode = "normal" | "classroom" | "detective"

const LOGIN_MODES: { mode: LoginMode; label: string; description: string; redirect: string }[] = [
  { mode: "normal", label: "Normal", description: "Standard UI", redirect: "/dashboard" },
  { mode: "classroom", label: "Classroom", description: "Interactive", redirect: "/classroom" },
  { mode: "detective", label: "Detective", description: "Mystery", redirect: "/detective" },
]

export function LoginPage() {
  const navigate = useNavigate()
  const { login, loginFromOAuth, error, clearError } = useAuth()
  const { isDark, toggleColorScheme } = useTheme()
  const { showToast } = useToast()
  const { unreadCount } = useNotifications()

  const [searchParams, setSearchParams] = useSearchParams()

  // when redirected back from oauth, finish the login flow or show an error toast
  useEffect(() => {
    const oauthStatus = searchParams.get("oauth")
    if (!oauthStatus) return

    setSearchParams({}, { replace: true })

    if (oauthStatus === "success") {
      navigate(".", { replace: true, state: { from: redirectPath } })
      loginFromOAuth()
        .then((loggedInUser) => {
          const destination = loggedInUser.role === "admin" ? "/dashboard" : redirectPath
          showToast("Signed in successfully!")
          navigate(destination, { replace: true })
        })
        .catch(() => {
          showToast("OAuth login failed. Please try again.")
        })
    } else if (oauthStatus === "error") {
      const message = searchParams.get("message") || "OAuth login failed"
      showToast(decodeURIComponent(message.replace(/\+/g, " ")))
    }
  }, [])

  const [selectedMode, setSelectedMode] = useState<LoginMode>("normal")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const isSubmittingRef = useRef(false)

  const redirectPath = LOGIN_MODES.find(m => m.mode === selectedMode)?.redirect ?? "/dashboard"

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading
  }, [email, password, loading])

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (loading || isSubmittingRef.current) {
      return
    }

    isSubmittingRef.current = true
    setLoading(true)

    navigate(".", { replace: true, state: { from: redirectPath } })

    try {
      const loggedInUser = await login({ email: email.trim(), password })

      const destination = loggedInUser.role === "admin" ? "/dashboard" : redirectPath
      showToast("Welcome back!")

      setTimeout(() => {
        if (unreadCount > 0) {
          showToast(`You have ${unreadCount} unread notification(s)`)
        }
      }, 500)

      navigate(destination, { replace: true })
    } catch (err) {
    } finally {
      setLoading(false)
      isSubmittingRef.current = false
    }
  }

  async function handleOAuthLogin(provider: "google" | "github") {
    try {
      const res = await fetch(`/api/auth/${provider}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to get OAuth URL")
      const data = await res.json()
      window.location.href = data.url
    } catch {
      showToast(`Failed to start ${provider} login`)
    }
  }

  // demo helper: log in with the seeded credentials for the chosen role
  async function quickLogin(role: UserRole) {
    clearError()
    setLoading(true)

    const destination = role === "admin" ? "/dashboard" : redirectPath

    navigate(".", { replace: true, state: { from: destination } })

    try {
      const credentials: Record<UserRole, { email: string; password: string }> = {
        student: { email: "student@hkive.com", password: "password123" },
        teacher: { email: "teacher@hkive.com", password: "password123" },
        admin: { email: "admin@learningplatform.com", password: "password123" },
      }
      await login(credentials[role])
      showToast(`Signed in as ${role} (demo)`)

      setTimeout(() => {
        if (unreadCount > 0) {
          showToast(`You have ${unreadCount} unread notification(s)`)
        }
      }, 500)

      navigate(destination, { replace: true })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="border-b bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 font-bold text-xl"
          >
            <Logo size="md" />
            <span className="text-gray-900 dark:text-white">{APP_NAME}</span>
          </button>

          <Button
            variant="secondary"
            onClick={() => {
              toggleColorScheme()
              showToast(isDark ? "Switched to light mode" : "Switched to dark mode")
            }}
            aria-label="Toggle theme"
            title="Toggle light/dark"
          >
            {isDark ? "Light" : "Dark"}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Card title="Sign in" subtitle="Enter your credentials to continue.">
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Learning Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LOGIN_MODES.map(({ mode, label, description }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelectedMode(mode)}
                      className={cn(
                        "rounded-lg border p-3 text-center transition-all",
                        selectedMode === mode
                          ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500/20 dark:border-purple-400 dark:bg-purple-900/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium",
                        selectedMode === mode
                          ? "text-purple-700 dark:text-purple-300"
                          : "text-gray-900 dark:text-gray-100"
                      )}>
                        {label}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <TextField
                label="Email"
                placeholder="name@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <TextField
                label="Password"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth disabled={!canSubmit}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <div className="relative border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="mb-3 text-center text-xs text-gray-500 dark:text-gray-400">
                  Or sign in with
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOAuthLogin("google")}
                    disabled={loading}
                    className="text-sm"
                  >
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOAuthLogin("github")}
                    disabled={loading}
                    className="text-sm"
                  >
                    GitHub
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="mb-2 text-center text-xs text-gray-500 dark:text-gray-400">
                  Quick demo login
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => quickLogin("student")}
                    disabled={loading}
                    className="text-xs"
                  >
                    Student
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => quickLogin("teacher")}
                    disabled={loading}
                    className="text-xs"
                  >
                    Teacher
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => quickLogin("admin")}
                    disabled={loading}
                    className="text-xs"
                  >
                    Admin
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <Button type="button" variant="ghost" onClick={() => { clearError(); navigate("/register") }}>
                  Create account
                </Button>
                <Button type="button" variant="ghost" onClick={() => { clearError(); navigate("/forgot-password") }}>
                  Forgot password?
                </Button>
              </div>
            </form>
          </Card>

          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Use demo buttons above to quickly sign in with seed accounts.
          </p>
        </div>
      </div>
    </div>
  )
}
