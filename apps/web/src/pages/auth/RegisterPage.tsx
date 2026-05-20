import { useMemo, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import type { UserRole } from "../../../../../shared/types"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Logo } from "../../components/ui/Logo"
import { TextField } from "../../components/form/TextField"
import { useTheme, useToast } from "../../contexts"
import { APP_NAME } from "../../../../../shared/constants"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"


export function RegisterPage() {
  const navigate = useNavigate()
  const { isDark, toggleColorScheme } = useTheme()
  const { showToast } = useToast()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState<UserRole>("student")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return (
      username.trim().length >= 3 &&
      email.trim().length > 0 &&
      password.length >= 8 &&
      password === confirmPassword &&
      !loading
    )
  }, [username, email, password, confirmPassword, loading])

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  function validatePassword(password: string): string | null {
    if (password.length < 8) return "Password must be at least 8 characters"
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter"
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter"
    if (!/[0-9]/.test(password)) return "Password must contain at least one number"
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters")
      return
    }

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address")
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      await apiClient.post("/api/auth/register", {
        username: username.trim(),
        email: email.trim(),
        password: password,
        role: role
      })

      showToast("Registration successful! Please sign in.")
      navigate("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
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
          <Card title="Create Account" subtitle="Sign up to start your learning journey.">
            <form className="space-y-4" onSubmit={submit}>
              <TextField
                label="Username"
                placeholder="johndoe"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                Min 8 characters with uppercase, lowercase, and number
              </p>

              <TextField
                label="Confirm Password"
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  I am a
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["student", "teacher"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "rounded-lg border p-3 text-center transition-all",
                        role === r
                          ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500/20 dark:border-purple-400 dark:bg-purple-900/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium",
                        role === r
                          ? "text-purple-700 dark:text-purple-300"
                          : "text-gray-900 dark:text-gray-100"
                      )}>
                        {r === "student" ? "Learner" : "Teacher"}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {r === "student" ? "I want to learn" : "I want to teach"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth disabled={!canSubmit}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-purple-600 hover:underline dark:text-purple-400"
                >
                  Sign in
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
