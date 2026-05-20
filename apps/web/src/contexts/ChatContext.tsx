import { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

interface ChatMessage {
  type: string
  room_id?: string
  [key: string]: any
}

interface RoomSubscription {
  roomId: string
  onMessage?: (message: any) => void
  onTypingStart?: (userId: string, username: string) => void
  onTypingStop?: (userId: string) => void
  onReadReceipt?: (messageId: string, userId: string) => void
}

interface ChatContextValue {
  isConnected: boolean
  connectionError: string | null
  connect: () => void
  disconnect: () => void
  subscribeToRoom: (subscription: RoomSubscription) => void
  unsubscribeFromRoom: (roomId: string) => void
  sendTypingStart: (roomId: string) => void
  sendTypingStop: (roomId: string) => void
  sendReadReceipt: (roomId: string, messageId: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: React.ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { user } = useAuth()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const subscriptionsRef = useRef<Map<string, RoomSubscription>>(new Map())

  const connect = useCallback(() => {
    if (!user) {
      console.log('WebSocket connect skipped - user not authenticated')
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected')
      return
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/api/chat/ws`

      console.log('Connecting to global WebSocket:', { wsUrl, user: user.username })

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('Global WebSocket connected')
        setIsConnected(true)
        setConnectionError(null)

        subscriptionsRef.current.forEach((sub, roomId) => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            room_id: roomId
          }))
        })
      }

      ws.onmessage = (event) => {
        try {
          const message: ChatMessage = JSON.parse(event.data)

          if (message.type === 'pong') {
            return
          }

          const roomId = message.room_id
          if (!roomId) {
            console.warn('Received message without room_id:', message)
            return
          }

          const subscription = subscriptionsRef.current.get(roomId)
          if (!subscription) {
            console.log('No subscription for room:', roomId)
            return
          }

          switch (message.type) {
            case 'new_message':
              subscription.onMessage?.(message.message)
              break
            case 'message_edited':
            case 'message_deleted':
            case 'reaction_added':
            case 'reaction_removed':
            case 'member_added':
            case 'member_removed':
              subscription.onMessage?.(message)
              break
            case 'typing_start':
              subscription.onTypingStart?.(message.user_id, message.username)
              break
            case 'typing_stop':
              subscription.onTypingStop?.(message.user_id)
              break
            case 'read_receipt':
              subscription.onReadReceipt?.(message.message_id, message.user_id)
              break
            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionError('WebSocket connection error')
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        })
        setIsConnected(false)
        wsRef.current = null

        if (user && event.code !== 1000 && event.code !== 1008) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...')
            connect()
          }, 3000)
        } else if (event.code === 1008) {
          console.error('WebSocket auth failed - will not reconnect')
          setConnectionError('Authentication failed')
        }
      }
    } catch (error) {
      console.error('Error creating WebSocket:', error)
      setConnectionError('Failed to create WebSocket connection')
    }
  }, [user])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'user_disconnect')
      wsRef.current = null
    }
    setIsConnected(false)
    setConnectionError(null)
    subscriptionsRef.current.clear()
  }, [])

  const subscribeToRoom = useCallback((subscription: RoomSubscription) => {
    const { roomId } = subscription

    console.log('Subscribing to room:', roomId)
    subscriptionsRef.current.set(roomId, subscription)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        room_id: roomId
      }))
    }
  }, [])

  const unsubscribeFromRoom = useCallback((roomId: string) => {
    console.log('Unsubscribing from room:', roomId)
    subscriptionsRef.current.delete(roomId)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        room_id: roomId
      }))
    }
  }, [])

  const sendTypingStart = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_start',
        room_id: roomId,
        username: user?.username || 'Unknown'
      }))
    }
  }, [user])

  const sendTypingStop = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_stop',
        room_id: roomId
      }))
    }
  }, [])

  const sendReadReceipt = useCallback((roomId: string, messageId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'read_receipt',
        room_id: roomId,
        message_id: messageId
      }))
    }
  }, [])

  // ping every 30s to keep the connection alive
  useEffect(() => {
    if (!isConnected) return

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    return () => clearInterval(pingInterval)
  }, [isConnected])

  const value: ChatContextValue = {
    isConnected,
    connectionError,
    connect,
    disconnect,
    subscribeToRoom,
    unsubscribeFromRoom,
    sendTypingStart,
    sendTypingStop,
    sendReadReceipt
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}
