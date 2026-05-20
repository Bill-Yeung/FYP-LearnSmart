import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { apiClient } from '../../lib/api'
import { useNotifications } from '../../contexts/NotificationContext'

interface FloatingChatButtonProps {
  onClick: () => void
  isOpen: boolean
}

export function FloatingChatButton({ onClick, isOpen }: FloatingChatButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const { notifications } = useNotifications()

  // tally the unread count across all rooms to show on the floating badge
  const fetchUnreadCount = async () => {
    try {
      const response = await apiClient.get<{ rooms: any[] }>('/api/chat/rooms')
      if (response) {
        const totalUnread = response.rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0)
        setUnreadCount(totalUnread)
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  useEffect(() => {
    fetchUnreadCount()
  }, [])

  useEffect(() => {
    const latestNotification = notifications[0]
    if (latestNotification?.type === 'chat.new_message') {
      if (!isOpen) {
        setUnreadCount(prev => prev + 1)
      }
    }
  }, [notifications, isOpen])

  useEffect(() => {
    if (isOpen) {
      return () => {
        fetchUnreadCount()
      }
    }
  }, [isOpen])

  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50
        w-12 h-12 sm:w-14 sm:h-14 rounded-full
        bg-blue-600 hover:bg-blue-700
        text-white shadow-lg hover:shadow-xl
        transition-all duration-200
        flex items-center justify-center
        ${isOpen ? 'scale-0' : 'scale-100'}
      `}
      aria-label="Open chat"
    >
      <MessageCircle className="w-6 h-6" />

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span className="
          absolute -top-1 -right-1
          w-6 h-6 rounded-full
          bg-red-500 text-white text-xs
          flex items-center justify-center
          font-semibold
        ">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
