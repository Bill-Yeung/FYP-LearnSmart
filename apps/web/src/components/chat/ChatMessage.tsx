import { useEffect, useRef } from 'react'
import { CheckCheck } from 'lucide-react'
import { formatTime } from '@shared/utils'
import type { ChatMessage as Message } from '@shared/types'
import { ChatAttachments } from './ChatAttachments'

interface ChatMessageProps {
  message: Message
  isOwnMessage: boolean
  isDirectChat?: boolean
  onReadReceipt: () => void
}

export function ChatMessage({ message, isOwnMessage, isDirectChat = false, onReadReceipt }: ChatMessageProps) {
  const messageRef = useRef<HTMLDivElement>(null)

  const readByObj = typeof message.read_by === 'string'
    ? JSON.parse(message.read_by)
    : (message.read_by || {})
  const isRead = Object.keys(readByObj).length > 0

  const reactionsObj = typeof message.reactions === 'string'
    ? JSON.parse(message.reactions)
    : (message.reactions || {})
  const hasReactions = Object.keys(reactionsObj).length > 0 &&
    Object.values(reactionsObj).some((users: any) => Array.isArray(users) && users.length > 0)

  const onReadReceiptRef = useRef(onReadReceipt)
  onReadReceiptRef.current = onReadReceipt

  // mark the message as read when it scrolls into view
  useEffect(() => {
    if (!isOwnMessage && messageRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onReadReceiptRef.current()
            observer.disconnect()
          }
        },
        { threshold: 0.5 }
      )

      observer.observe(messageRef.current)

      return () => observer.disconnect()
    }
  }, [isOwnMessage])

  return (
    <div
      ref={messageRef}
      className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
    >
      {/* Avatar for others' messages */}
      {!isOwnMessage && !isDirectChat && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md">
          {(message.display_name || message.username)?.[0]?.toUpperCase()}
        </div>
      )}

      <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Sender name */}
        {!isOwnMessage && !isDirectChat && (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 px-3">
            {message.display_name || message.username}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={`
            px-4 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all
            ${isOwnMessage
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-md'
              : 'bg-white dark:bg-gray-800 dark:text-white rounded-bl-md border border-gray-200 dark:border-gray-700'
            }
          `}
        >
          {message.content && (
            <p className={`break-words ${isOwnMessage ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
              {message.content}
            </p>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <ChatAttachments attachments={message.attachments} isOwnMessage={isOwnMessage} />
          )}

          {/* Reactions with vibrant colors */}
          {hasReactions && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {Object.entries(reactionsObj)
                .filter(([_, users]) => Array.isArray(users) && users.length > 0)
                .map(([emoji, users]) => (
                  <button
                    key={emoji}
                    className="
                      px-2 py-1 rounded-full text-xs font-medium
                      bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30
                      hover:from-purple-200 hover:to-pink-200 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50
                      flex items-center gap-1
                      transition-all hover:scale-110
                      border border-purple-200 dark:border-purple-800
                    "
                  >
                    <span className="text-sm">{emoji}</span>
                    <span className="text-purple-700 dark:text-purple-300">{(users as string[]).length}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Timestamp and status */}
        <div className="flex items-center gap-2 px-3">
          <span className="text-[10px] text-gray-500 dark:text-gray-500 font-medium">
            {formatTime(message.created_at)}
          </span>

          {message.is_edited && (
            <span className="text-[10px] text-gray-500 dark:text-gray-500 italic">edited</span>
          )}

          {/* Read receipt */}
          {isOwnMessage && (
            <div className="flex items-center" title={isRead ? "Read" : "Delivered"}>
              {isRead ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Avatar for own messages */}
      {isOwnMessage && !isDirectChat && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md">
          You
        </div>
      )}
    </div>
  )
}
