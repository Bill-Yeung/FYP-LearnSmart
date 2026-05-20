import { useEffect } from "react"

type Props = {
  message: string | null
  onDismiss: () => void
  ms?: number
}

export function Toast({ message, onDismiss, ms = 1800 }: Props) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDismiss, ms)
    return () => window.clearTimeout(t)
  }, [message, ms, onDismiss])

  if (!message) return null

  return (
    <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2">
      <div className="rounded-xl border bg-white px-4 py-2 text-sm shadow-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
        {message}
      </div>
    </div>
  )
}
