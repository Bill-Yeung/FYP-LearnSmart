import { MessageCircle, Users, VolumeX } from 'lucide-react'
import { formatRelativeTime } from '@shared/utils'

interface ChatRoom {
  id: string
  room_type: string
  name: string | null
  last_message_preview: string | null
  last_message_at: string | null
  unread_count: number
  member_count: number
  is_muted: boolean
}

interface ChatRoomListProps {
  rooms: ChatRoom[]
  isLoading: boolean
  onSelectRoom: (room: ChatRoom) => void
  onRefresh: () => void
}

export function ChatRoomList({ rooms, isLoading, onSelectRoom }: ChatRoomListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
        <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-center">No conversations yet</p>
        <p className="text-sm text-center mt-2">Start a new conversation to get started</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room)}
          className="
            w-full p-4 border-b dark:border-gray-700
            hover:bg-gray-50 dark:hover:bg-gray-800
            transition-colors text-left
            flex items-start gap-3
          "
        >
          {/* Avatar */}
          <div className="flex-shrink-0">
            {room.room_type === 'direct' ? (
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {room.name?.[0]?.toUpperCase() || 'D'}
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white">
                <Users className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold dark:text-white truncate">
                {room.name || 'Direct Message'}
              </h3>
              {room.last_message_at && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                  {formatRelativeTime(room.last_message_at)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {room.last_message_preview || 'No messages yet'}
              </p>

              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {/* Muted indicator */}
                {room.is_muted && (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                )}

                {/* Unread badge */}
                {room.unread_count > 0 && (
                  <span className="
                    px-2 py-0.5 rounded-full
                    bg-blue-600 text-white text-xs font-semibold
                    min-w-[20px] text-center
                  ">
                    {room.unread_count > 99 ? '99+' : room.unread_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
