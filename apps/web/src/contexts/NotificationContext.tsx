import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { apiClient } from "../lib/api"
import { useAuth } from "./AuthContext"
import { useToast } from "./ToastContext"

export type Notification = {
  type: string
  data: {
    document_id?: string
    title?: string
    status?: string
    message?: string
    error?: string
    [key: string]: unknown
  }
  timestamp: string
  id?: string
  is_read?: boolean
}

type NotificationContextType = {
  notifications: Notification[]
  unreadCount: number
  isConnected: boolean
  markAsRead: (notificationId: string) => void
  markAllRead: () => void
  clearNotifications: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

const NOTIFICATION_DEBUG = (import.meta as any)?.env?.DEV ?? false

function logNotifications(event: string, details?: Record<string, unknown>): void {
  if (!NOTIFICATION_DEBUG) return
  console.info(`[NotificationContext] ${new Date().toISOString()} ${event}`, details ?? {})
}

type NotificationProviderProps = {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {

  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : null
  const { showToast } = useToast()
  const shownFlashcardToastRef = useRef(false)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    logNotifications("provider-mounted")
    return () => {
      logNotifications("provider-unmounted")
    }
  }, [])

  useEffect(() => {
    logNotifications("auth-state-changed", {
      userId,
      role: user?.role ?? null
    })
  }, [userId, user?.role])

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      logNotifications("fetch-skipped", { reason: "missing-user-id" })
      return
    }

    try {
      logNotifications("fetch-start", { userId })
      if (user?.role === 'student') {
        try {
          await apiClient.get('/api/flashcards/schedule')
        } catch {
        }
      }

      const data = await apiClient.get<{ notifications: Notification[], unread_count: number }>("/api/notifications")
      if (data?.notifications) {
        setNotifications(data.notifications)
        setUnreadCount(data.unread_count || 0)
        logNotifications("fetch-success", {
          count: data.notifications.length,
          unreadCount: data.unread_count || 0
        })

        if (!shownFlashcardToastRef.current) {
          const flashcardNotif = data.notifications.find(
            n => !n.is_read && (n.data?.title as string || '').match(/overdue|due today/i)
          )
          if (flashcardNotif) {
            shownFlashcardToastRef.current = true
            showToast(String(flashcardNotif.data?.title || 'You have flashcards to review!'))
          }
        }
      }
    } catch {
      logNotifications("fetch-error", { userId })
    }
  }, [userId, user?.role, showToast])

  // open a live stream for new notifications
  const connect = useCallback(async () => {

    if (!userId) {
      logNotifications("connect-skipped", { reason: "missing-user-id" })
      return
    }

    logNotifications("connect-start", { userId })

    await fetchNotifications()

    if (eventSourceRef.current) {
      logNotifications("connect-closing-existing-stream")
      eventSourceRef.current.close()
    }

    const url = `/api/notifications/stream`
    const eventSource = new EventSource(url, {
      withCredentials: true
    })
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
      logNotifications("stream-open", { userId })
    }

    eventSource.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data)

        if (notification.type === "connection.established") {
          logNotifications("stream-handshake")
          return
        }

        if (notification.type?.startsWith("document.")) {
          logNotifications("document-notification-received", {
            type: notification.type,
            notificationId: notification.id ?? null,
            documentId: notification.data?.document_id ?? null,
            status: notification.data?.status ?? null
          })
        }

        setNotifications(prev => {
          const exists = notification.id && prev.some(n => n.id === notification.id)
          if (exists) return prev

          const isChatMessage = notification.type === "chat.new_message"
          if (!notification.is_read && !isChatMessage) {
            setUnreadCount(c => c + 1)
          }

          const title = notification.data?.title as string || ''
          if (!notification.is_read && title.match(/overdue|due today/i)) {
            showToast(title)
          }

          return [notification, ...prev].slice(0, 50)
        })
      } catch {
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      logNotifications("stream-error", { userId })
      eventSource.close()

      reconnectTimeoutRef.current = setTimeout(() => {
        logNotifications("reconnect-timer-fired", { userId })
        connect()
      }, 5000)
    }
  }, [userId, fetchNotifications])

  useEffect(() => {
    connect()

    const handleBeforeUnload = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (eventSourceRef.current) {
        logNotifications("effect-cleanup-closing-stream")
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, is_read: true } : n
    ))
    setUnreadCount(prev => Math.max(0, prev - 1))

    try {
      await apiClient.post(`/api/notifications/mark-read/${notificationId}`)
    } catch {
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)

    try {
      await apiClient.post("/api/notifications/mark-all-read")
    } catch {
    }
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isConnected,
      markAsRead,
      markAllRead,
      clearNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
