import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Logo } from "../../components/ui/Logo"
import { TextField } from "../../components/form/TextField"
import { useTheme, useToast } from "../../contexts"
import { APP_NAME } from "../../../../../shared/constants"
import { apiClient } from "../../lib/api"


type Step = "email" | "otp" | "success"

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { isDark, toggleColorScheme } = useTheme()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // step 1: validate the email then ask the api to send a reset otp
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)
    try {
      await apiClient.post("/api/auth/password-reset/request", {
        email: email.trim()
      })

      showToast("OTP sent to your email!")
      setStep("otp")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }

  // step 2: check the otp + new password fields then submit the password reset
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter the 6-digit OTP")
      return
    }

    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      await apiClient.post("/api/auth/password-reset/verify", {
        email: email.trim(),
        otp: otp,
        new_password: newPassword
      })

      showToast("Password reset successfully!")
      setStep("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    setLoading(true)
    try {
      await apiClient.post("/api/auth/password-reset/request", {
        email: email.trim()
      })
      showToast("New OTP sent to your email!")
    } catch (err) {
      showToast("Failed to resend OTP")
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
          {step === "email" && (
            <Card title="Forgot Password" subtitle="Enter your email to receive a password reset code.">
              <form className="space-y-4" onSubmit={handleEmailSubmit}>
                <TextField
                  label="Email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth disabled={loading || !email.trim()}>
                  {loading ? "Sending..." : "Send Reset Code"}
                </Button>

                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Remember your password?{" "}
                  <Link
                    to="/login"
                    className="text-purple-600 hover:underline dark:text-purple-400"
                  >
                    Sign in
                  </Link>
                </div>
              </form>
            </Card>
          )}

          {step === "otp" && (
            <Card title="Reset Password" subtitle={`Enter the code sent to ${email} and your new password`}>
              <form className="space-y-4" onSubmit={handleOtpSubmit}>
                <TextField
                  label="Verification Code (OTP)"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                    setOtp(value)
                  }}
                  maxLength={6}
                />

                <TextField
                  label="New Password"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                  Min 8 characters
                </p>

                <TextField
                  label="Confirm New Password"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth disabled={loading || otp.length !== 6 || !newPassword || !confirmPassword}>
                  {loading ? "Resetting Password..." : "Reset Password"}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep("email")
                      setOtp("")
                      setError(null)
                    }}
                  >
                    Change email
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResendOtp}
                    disabled={loading}
                  >
                    Resend code
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {step === "success" && (
            <Card title="Password Reset Complete" subtitle="Your password has been reset successfully.">
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-950/40">
                  <p className="text-sm text-green-700 dark:text-green-200">
                    Your password has been changed successfully.
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-200 mt-2">
                    You can now sign in with your new password.
                  </p>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
                  <p className="text-sm text-blue-700 dark:text-blue-200">
                    A confirmation email has been sent to <strong>{email}</strong>.
                  </p>
                </div>

                <Button fullWidth onClick={() => navigate("/login")}>
                  Go to Sign In
                </Button>
              </div>
            </Card>
          )}

          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            {step === "otp"
              ? "Check your spam folder if you don't see the email."
              : "We'll send a verification code to your registered email."}
          </p>
        </div>
      </div>
    </div>
  )
}
