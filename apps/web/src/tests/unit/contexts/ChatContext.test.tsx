import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ChatProvider, useChat } from "../../../contexts/ChatContext"
import { AuthProvider } from "../../../contexts/AuthContext"
import type { User } from "@shared/types"

const mockUser: User = {
  id: "u1", username: "tester", email: "t@t.com", role: "student",
  display_name: null, preferred_language: "en", is_active: true,
  email_verified: true, domain_level: "beginner",
  difficulty_preference: "medium", ai_assistance_level: "moderate",
  created_at: "2024-01-01T00:00:00Z", last_login: null,
}

class MockWebSocket {
  static instances: MockWebSocket[] = []
  readyState = 1 // OPEN
  onopen: ((ev: any) => void) | null = null
  onmessage: ((ev: any) => void) | null = null
  onerror: ((ev: any) => void) | null = null
  onclose: ((ev: any) => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    setTimeout(() => this.onopen?.({} as any), 0)
  }
  send(data: string) { this.sent.push(data) }
  close() {
    this.readyState = 3
    this.onclose?.({ code: 1000, reason: "", wasClean: true } as any)
  }
  static OPEN = 1
  static CLOSED = 3
}

function ChatConsumer() {
  const { isConnected, connectionError, connect, disconnect, subscribeToRoom, unsubscribeFromRoom } = useChat()
  return (
    <div>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="error">{connectionError ?? "none"}</span>
      <button data-testid="connect" onClick={connect}>Connect</button>
      <button data-testid="disconnect" onClick={disconnect}>Disconnect</button>
      <button data-testid="subscribe" onClick={() => subscribeToRoom({ roomId: "room-1" })}>Subscribe</button>
      <button data-testid="unsubscribe" onClick={() => unsubscribeFromRoom("room-1")}>Unsubscribe</button>
    </div>
  )
}

function renderWithAuth(authenticated: boolean) {
  if (authenticated) {
    localStorage.setItem("learnsmart-auth", JSON.stringify(mockUser))
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockUser), { status: 200 })
    )
  }
  return render(
    <AuthProvider>
      <ChatProvider>
        <ChatConsumer />
      </ChatProvider>
    </AuthProvider>
  )
}

describe("ChatContext", () => {

  beforeEach(() => {
    vi.restoreAllMocks()
    MockWebSocket.instances = []
    ;(globalThis as any).WebSocket = MockWebSocket
  })

  it("starts disconnected", () => {
    renderWithAuth(false)
    expect(screen.getByTestId("connected")).toHaveTextContent("false")
    expect(screen.getByTestId("error")).toHaveTextContent("none")
  })

  it("throws when useChat is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<ChatConsumer />)).toThrow("useChat must be used within ChatProvider")
    spy.mockRestore()
  })

  it("connect does nothing without authenticated user", async () => {
    const user = userEvent.setup()
    renderWithAuth(false)
    await user.click(screen.getByTestId("connect"))
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it("connect creates WebSocket when authenticated", async () => {
    const user = userEvent.setup()
    renderWithAuth(true)
    await user.click(screen.getByTestId("connect"))
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1)
  })

  it("disconnect closes WebSocket", async () => {
    const user = userEvent.setup()
    renderWithAuth(true)
    await user.click(screen.getByTestId("connect"))
    await user.click(screen.getByTestId("disconnect"))
    expect(screen.getByTestId("connected")).toHaveTextContent("false")
  })

  it("subscribe and unsubscribe do not throw", async () => {
    const user = userEvent.setup()
    renderWithAuth(true)
    await user.click(screen.getByTestId("subscribe"))
    await user.click(screen.getByTestId("unsubscribe"))
    expect(screen.getByTestId("error")).toHaveTextContent("none")
  })
})
