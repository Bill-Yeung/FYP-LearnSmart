import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"

type ToastContextType = {
  message: string | null
  showToast: (message: string) => void
  dismissToast: () => void
}

const ToastContext = createContext<ToastContextType | null>(null)

type ToastProviderProps = {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
  }, [])

  const dismissToast = useCallback(() => {
    setMessage(null)
  }, [])

  const value = useMemo<ToastContextType>(() => ({
    message,
    showToast,
    dismissToast
  }), [message, showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
