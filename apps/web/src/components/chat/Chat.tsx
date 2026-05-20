import { useState, useEffect } from 'react'
import { FloatingChatButton } from './FloatingChatButton'
import { ChatPanel } from './ChatPanel'
import { useChat } from '../../contexts'

export function Chat() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const { connect, disconnect } = useChat()

  // open the websocket when the chat panel opens, close it when the panel closes
  useEffect(() => {
    if (isPanelOpen) {
      console.log('Chat panel opened - connecting WebSocket')
      connect()
    }
    return () => {
      if (isPanelOpen) {
        console.log('Chat panel closed - disconnecting WebSocket')
        disconnect()
      }
    }
  }, [isPanelOpen])

  return (
    <>
      <FloatingChatButton
        onClick={() => setIsPanelOpen(true)}
        isOpen={isPanelOpen}
      />
      <ChatPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </>
  )
}
