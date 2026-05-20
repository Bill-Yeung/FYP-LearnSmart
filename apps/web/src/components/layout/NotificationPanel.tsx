import { Bell, X, CheckCircle2 } from "lucide-react"
import { useNotifications } from "../../contexts"
import { cn } from "../../../../../shared/utils";

export function NotificationPanel() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications()

  const bellNotifications = notifications.filter(n => n.type !== 'chat.new_message')
  const unreadNotifications = bellNotifications.filter(n => !n.is_read)

  if (!bellNotifications.length) {
    return null
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 whitespace-nowrap"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
        {bellNotifications.slice(0, 10).map((notif) => (
          <div
            key={notif.id}
            className={cn(
              'rounded-lg p-3 text-sm transition-colors',
              notif.is_read
                ? 'bg-white/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-blue-200 dark:border-blue-800'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium">{notif.data?.title || 'Notification'}</p>
                <p className="text-xs mt-1 opacity-80">
                  {notif.data?.message || notif.data?.body || ''}
                </p>
                {notif.timestamp && (
                  <p className="text-xs mt-1 opacity-60">
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
              {!notif.is_read && (
                <button
                  onClick={() => markAsRead(notif.id || '')}
                  className="flex-shrink-0 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Mark as read"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {bellNotifications.length > 10 && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 text-center">
          +{bellNotifications.length - 10} more notification{bellNotifications.length - 10 !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
