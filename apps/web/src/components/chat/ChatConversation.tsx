import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Send, Smile, MoreVertical, Paperclip, Users, X, Shield, Crown, UserCircle, FileText } from 'lucide-react'
import { apiClient } from '../../lib/api'
import { useChat } from '../../contexts'
import { useAuth } from '../../contexts/AuthContext'
import { ChatMessage } from './ChatMessage'
import { TypingIndicator } from './TypingIndicator'
import { EmojiPicker } from './EmojiPicker'
import { getChatDaySeparator } from '@shared/utils'
import type { ChatRoom, ChatMessage as Message } from '@shared/types'

interface ChatConversationProps {
  room: ChatRoom
  onBack: () => void
}

export function ChatConversation({ room, onBack }: ChatConversationProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()) // userId -> username
  const [showMenu, setShowMenu] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiButtonRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const isInitialLoad = useRef(true)

  // close the dropdown menu when the user clicks outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  // load the member list for the current room
  const fetchMembers = async () => {
    setIsLoadingMembers(true)
    try {
      const res = await apiClient.get<{ members: any[] }>(`/api/chat/rooms/${room.id}/members`)
      if (res?.members) setMembers(res.members)
    } catch (err) {
      console.error('Failed to fetch members:', err)
    } finally {
      setIsLoadingMembers(false)
    }
  }

  const handleShowMembers = () => {
    setShowMenu(false)
    setShowMembers(true)
    fetchMembers()
  }

  useEffect(() => {
    fetchMessages()
    isInitialLoad.current = true
  }, [room.id])

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom('auto')
      isInitialLoad.current = false
    }
  }, [messages])

  const fetchMessages = async (beforeMessageId?: string) => {
    if (!beforeMessageId) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const url = beforeMessageId
        ? `/api/chat/rooms/${room.id}/messages?before=${beforeMessageId}&limit=50`
        : `/api/chat/rooms/${room.id}/messages?limit=50`

      const response = await apiClient.get<{ messages: Message[] }>(url)
      if (response) {
        if (beforeMessageId) {
          setMessages(prev => [...response.messages, ...prev])
          setHasMore(response.messages.length === 50)
        } else {
          setMessages(response.messages)
          setHasMore(response.messages.length === 50)
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // when the user scrolls near the top, load older messages and keep their position
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const isAtTop = element.scrollTop < 100

    if (isAtTop && !isLoadingMore && hasMore && messages.length > 0) {
      const oldestMessageId = messages[0]?.id
      if (oldestMessageId) {

        const previousScrollHeight = element.scrollHeight

        fetchMessages(oldestMessageId).then(() => {
          requestAnimationFrame(() => {
            const newScrollHeight = element.scrollHeight
            element.scrollTop = newScrollHeight - previousScrollHeight
          })
        })
      }
    }
  }

  const handleNewMessage = useCallback((message: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) {
        return prev
      }
      return [...prev, message]
    })
    setTimeout(() => scrollToBottom(), 100)
  }, [])

  const handleTypingStart = useCallback((userId: string, username: string) => {
    if (userId !== user?.id) {
      setTypingUsers(prev => {
        const updated = new Map(prev)
        updated.set(userId, username)
        return updated
      })
    }
  }, [user?.id])

  const handleTypingStop = useCallback((userId: string) => {
    setTypingUsers(prev => {
      const updated = new Map(prev)
      updated.delete(userId)
      return updated
    })
  }, [])

  const handleReadReceipt = useCallback((messageId: string, userId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {

        const currentReadBy = typeof msg.read_by === 'string'
          ? JSON.parse(msg.read_by)
          : (msg.read_by || {})

        return {
          ...msg,
          read_by: {
            ...currentReadBy,
            [userId]: new Date().toISOString()
          }
        }
      }
      return msg
    }))
  }, [])

  const { subscribeToRoom, unsubscribeFromRoom, sendTypingStart, sendTypingStop, sendReadReceipt } = useChat()

  // subscribe to live updates for this room while it is open
  useEffect(() => {
    subscribeToRoom({
      roomId: room.id,
      onMessage: handleNewMessage,
      onTypingStart: handleTypingStart,
      onTypingStop: handleTypingStop,
      onReadReceipt: handleReadReceipt
    })
    return () => {
      unsubscribeFromRoom(room.id)
    }
  }, [room.id])

  // broadcast a typing indicator while the user is typing, stop after 2s idle
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
    sendTypingStart(room.id)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStop(room.id)
    }, 2000)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const valid: File[] = []
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds 10MB limit`)
        continue
      }
      valid.push(file)
    }
    setPendingFiles(prev => [...prev, ...valid])
    e.target.value = ''
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  // upload any pending files then post the message to the server
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if ((!newMessage.trim() && pendingFiles.length === 0) || isSending) return

    setIsSending(true)
    try {
      let attachments: Array<{ file_id: string; filename: string; file_size: number; file_url: string; content_type: string }> | undefined
      if (pendingFiles.length > 0) {
        setIsUploading(true)
        attachments = []
        for (const file of pendingFiles) {
          const formData = new FormData()
          formData.append('file', file)
          const uploadRes = await apiClient.upload<{ file_id: string; filename: string; file_size: number; file_url: string; content_type: string }>(`/api/chat/rooms/${room.id}/upload`, formData)
          if (uploadRes) attachments.push(uploadRes)
        }
        setIsUploading(false)
      }

      const hasAttachments = attachments && attachments.length > 0
      const messageType = hasAttachments ? (attachments!.every(a => a.content_type.startsWith('image/')) ? 'image' : 'file') : 'text'

      const response = await apiClient.post<{ message: Message }>(`/api/chat/rooms/${room.id}/messages`, {
        content: newMessage.trim() || (hasAttachments ? `Sent ${attachments!.length} file${attachments!.length > 1 ? 's' : ''}` : ''),
        message_type: messageType,
        ...(hasAttachments && { attachments })
      })

      if (response?.message) {
        setMessages(prev => [...prev, response.message])
        setTimeout(() => scrollToBottom(), 100)
      }

      setNewMessage('')
      setPendingFiles([])
      sendTypingStop(room.id)
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message')
    } finally {
      setIsSending(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 relative">
      {/* Modern Header with Glassmorphism */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 dark:text-gray-300" />
        </button>

        {/* Avatar with gradient */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg">
          {room.name?.[0]?.toUpperCase() || 'U'}
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white">
            {room.name || 'Direct Message'}
          </h3>
          {room.room_type === 'direct' && room.other_user_online !== undefined && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              {room.other_user_online ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Online</span>
                </>
              ) : (
                <span>Offline</span>
              )}
            </p>
          )}
          {room.room_type === 'group' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Group chat
            </p>
          )}
          {room.room_type === 'class' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Class chat
            </p>
          )}
          {room.room_type === 'mentorship' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Mentorship chat
            </p>
          )}
          {(room.room_type === 'community' || room.room_type === 'channel') && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Community chat
            </p>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all hover:scale-105"
          >
            <MoreVertical className="w-5 h-5 dark:text-gray-300" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
              {room.room_type !== 'direct' && (
                <button
                  onClick={handleShowMembers}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-sm transition-colors"
                >
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="dark:text-white">Members</span>
                </button>
              )}
              {room.room_type === 'direct' && (
                <button
                  onClick={handleShowMembers}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-sm transition-colors"
                >
                  <UserCircle className="w-4 h-4 text-blue-600" />
                  <span className="dark:text-white">View Profile</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Members Side Panel */}
      {showMembers && (
        <div className="absolute inset-0 z-30 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowMembers(false)} />

          {/* Panel sliding from right */}
          <div className="absolute right-0 top-0 h-full w-72 bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Members
                {!isLoadingMembers && (
                  <span className="text-xs font-normal text-gray-500">({members.length})</span>
                )}
              </h3>
              <button
                onClick={() => setShowMembers(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 dark:text-gray-300" />
              </button>
            </div>

            {/* Member List */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : (
                <div className="py-2">
                  {members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {(member.display_name || member.username)?.[0]?.toUpperCase() || 'U'}
                      </div>

                      {/* Name & role */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {member.display_name || member.username}
                          {member.user_id === user?.id && (
                            <span className="text-xs text-gray-400 ml-1">You</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{member.username}
                        </p>
                      </div>

                      {/* Role badge */}
                      {member.role === 'owner' && (
                        <span title="Owner"><Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" /></span>
                      )}
                      {member.role === 'admin' && (
                        <span title="Admin"><Shield className="w-4 h-4 text-blue-500 flex-shrink-0" /></span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages with pattern background */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] dark:bg-none">
        {/* Loading more indicator at top */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
              <Send className="w-10 h-10 text-white" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No messages yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
          
            const showDaySeparator = index === 0 ||
              new Date(messages[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString()

            return (
              <div key={message.id}>
                {/* Day separator */}
                {showDaySeparator && (
                  <div className="flex items-center justify-center my-4">
                    <div className="px-3 py-1 rounded-full bg-gray-200/80 dark:bg-gray-700/80 backdrop-blur-sm">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {getChatDaySeparator(message.created_at)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Message */}
                <div
                  className="animate-in slide-in-from-bottom-2 fade-in duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ChatMessage
                    message={message}
                    isOwnMessage={message.user_id === user?.id}
                    isDirectChat={room.room_type === 'direct'}
                    onReadReceipt={() => sendReadReceipt(room.id, message.id)}
                  />
                </div>
              </div>
            )
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <div className="px-4 py-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 animate-in slide-in-from-bottom-2 fade-in">
          <TypingIndicator users={Array.from(typingUsers.values())} />
        </div>
      )}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 flex gap-2 overflow-x-auto">
          {pendingFiles.map((file, index) => (
            <div key={index} className="relative flex-shrink-0 group">
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center p-1">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="text-[9px] text-gray-500 truncate w-full text-center mt-0.5">{file.name.split('.').pop()}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removePendingFile(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
              <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate block w-16 text-center">{file.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modern Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
          {/* Attachment button */}
          <button
            type="button"
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all hover:scale-110 active:scale-95 flex-shrink-0"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Message input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="
                w-full px-4 py-2.5 rounded-2xl
                bg-gray-100 dark:bg-gray-800
                border-2 border-transparent
                focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900
                dark:text-white placeholder-gray-400
                transition-all duration-200
                shadow-sm
              "
              disabled={isSending}
            />
          </div>

          {/* Emoji button */}
          <div ref={emojiButtonRef} className="relative flex-shrink-0">
            <button
              type="button"
              className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all hover:scale-110 active:scale-95"
              title="Add emoji"
              onClick={() => setShowEmojiPicker(prev => !prev)}
            >
              <Smile className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={(!newMessage.trim() && pendingFiles.length === 0) || isSending}
            className="
              p-2.5 rounded-xl flex-shrink-0
              bg-gradient-to-r from-blue-600 to-purple-600
              text-white font-medium
              hover:from-blue-700 hover:to-purple-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              hover:scale-105 active:scale-95
              shadow-lg hover:shadow-xl
              disabled:hover:scale-100
            "
            title="Send message"
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
