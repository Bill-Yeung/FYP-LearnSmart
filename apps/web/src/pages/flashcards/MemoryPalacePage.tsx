import { useRef, useState } from "react"
import { Card, Button } from "../../components"

function isVisionOS(): boolean {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  return /xros|visionOS/i.test(ua)
}

export function MemoryPalacePage() {
  const [linkStatus, setLinkStatus] = useState<"idle" | "trying" | "failed">("idle")
  const anchorRef = useRef<HTMLAnchorElement>(null)
  const onVisionOS = isVisionOS()

  // Use a hidden <a> tag click — required so Safari on visionOS allows the
  // custom URL scheme to fire (window.location.href assignment is blocked
  // without a real user-gesture-originated navigation in some builds).
  const handleEnterImmersive = () => {
    setLinkStatus("trying")
    anchorRef.current?.click()
    setTimeout(() => setLinkStatus("failed"), 3000)
  }

  if (!onVisionOS) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
          <Card title="Memory Palace" subtitle="AR & VR immersive memory experiences">
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-4 space-y-1">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Apple Vision Pro only</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Memory Palace is an immersive AR/VR experience that only runs on Apple Vision Pro.
                Open this page in Safari on your Vision Pro (real device or simulator) to launch the app.
              </p>
            </div>
          </Card>

          <Card title="Launch App" subtitle="Already on Vision Pro? Tap below to enter the experience">
            <div className="space-y-3">
              {/* Hidden anchor for reliable custom URL scheme triggering in visionOS Safari */}
              <a ref={anchorRef} href="memorypalace://open" className="hidden" aria-hidden="true" tabIndex={-1}>open</a>

              <Button onClick={handleEnterImmersive} disabled={linkStatus === "trying"}>
                {linkStatus === "trying" ? "Opening…" : "Enter Immersive Experience"}
              </Button>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                If you are on Vision Pro but were not auto-detected, use this button to launch the app directly.
              </p>

              {linkStatus === "failed" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3 space-y-2">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Could not open the Memory Palace app</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Make sure the Memory Palace app is installed and running, then try again.
                  </p>
                  <button
                    type="button"
                    className="text-xs font-medium text-amber-700 dark:text-amber-300 underline"
                    onClick={() => setLinkStatus("idle")}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Card title="Memory Palace" subtitle="AR & VR immersive memory experiences">
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>Overview:</strong> Place flashcards or 3D objects into a real AR scene or a virtual VR world — using space and interaction to make recall easier.</p>
            <p><strong>How it works:</strong> Sign in, choose AR or VR, place anchors or objects, interact with the scene, and your progress is saved automatically.</p>
          </div>
        </Card>

        <Card title="Launch App" subtitle="Tap below to enter the immersive experience">
          <div className="space-y-3">
            {/* Hidden anchor — clicking it triggers the custom URL scheme reliably in visionOS Safari */}
            <a ref={anchorRef} href="memorypalace://open" className="hidden" aria-hidden="true" tabIndex={-1}>open</a>

            <Button onClick={handleEnterImmersive} disabled={linkStatus === "trying"}>
              {linkStatus === "trying" ? "Opening…" : "Enter Immersive Experience"}
            </Button>

            {linkStatus === "idle" && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Vision Pro detected — tap the button to launch the Memory Palace app.
              </p>
            )}

            {linkStatus === "failed" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Could not open the Memory Palace app</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Make sure the Memory Palace app is installed and running, then try again.
                </p>
                <button
                  type="button"
                  className="text-xs font-medium text-amber-700 dark:text-amber-300 underline"
                  onClick={() => setLinkStatus("idle")}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}

export default MemoryPalacePage
