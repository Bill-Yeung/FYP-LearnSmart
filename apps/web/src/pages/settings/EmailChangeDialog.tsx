import { useState } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"

type Step = "request" | "verify"

type EmailChangeDialogProps = {
  open: boolean
  onClose: () => void
  onSuccess: (newEmail: string) => void | Promise<void>
}

export function EmailChangeDialog({
  open,
  onClose,
  onSuccess
}: EmailChangeDialogProps) {
  const [step, setStep] = useState<Step>("request")
  const [newEmail, setNewEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function reset() {
    setStep("request")
    setNewEmail("")
    setOtp("")
    setError(null)
    setBusy(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function submitRequest() {
    setBusy(true)
    setError(null)

    try {
      await apiClient.post("/api/users/me/email-change/request", {
        new_email: newEmail.trim()
      })
      setStep("verify")
    } catch (e: any) {
      setError(e?.message || "Failed to send code")
    } finally {
      setBusy(false)
    }
  }

  async function submitVerify() {
    setBusy(true)
    setError(null)

    try {
      const email = newEmail.trim()
      await apiClient.post("/api/users/me/email-change/verify", { otp })
      await onSuccess(email)
      reset()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Invalid code")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Change Email
          </h3>

          {step === "request" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New email address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="you@example.com"
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={close} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={submitRequest}
                  disabled={busy || !newEmail.includes("@")}
                >
                  {busy ? "Sending..." : "Send Code"}
                </Button>
              </div>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We sent a 6-digit code to <strong>{newEmail}</strong>. Enter it below.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-lg tracking-widest dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="000000"
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={close} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={submitVerify}
                  disabled={busy || otp.length !== 6}
                >
                  {busy ? "Verifying..." : "Verify"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
