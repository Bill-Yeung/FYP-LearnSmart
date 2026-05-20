import { render, screen, act, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NotificationProvider, useNotifications } from "../../../contexts/NotificationContext"
import { AuthProvider } from "../../../contexts/AuthContext"
import { ToastProvider } from "../../../contexts/ToastContext"

class MockEventSource {
  static instances: MockEventSource[] = []
  onopen: ((ev: any) => void) | null = null
  onmessage: ((ev: any) => void) | null = null
  onerror: ((ev: any) => void) | null = null
  readyState = 0

  constructor(public url: string, public options?: any) {
    MockEventSource.instances.push(this)
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.({} as any)
    }, 0)
  }
  close() { this.readyState = 2 }
}

function NotificationConsumer() {
  const { notifications, unreadCount, isConnected, markAsRead, markAllRead, clearNotifications } = useNotifications()
  return (
    <div>
      <span data-testid="count">{notifications.length}</span>
      <span data-testid="unread">{unreadCount}</span>
      <span data-testid="connected">{String(isConnected)}</span>
      <button data-testid="mark-read" onClick={() => markAsRead("n1")}>Mark Read</button>
      <button data-testid="mark-all" onClick={markAllRead}>Mark All</button>
      <button data-testid="clear" onClick={clearNotifications}>Clear</button>
    </div>
  )
}

describe("NotificationContext", () => {

  beforeEach(() => {
    vi.restoreAllMocks()
    MockEventSource.instances = []
    ;(globalThis as any).EventSource = MockEventSource
    // Mock fetch for apiClient.get("/api/notifications")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ notifications: [], unread_count: 0 }), { status: 200 })
    )
  })

  it("starts with empty notifications", () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider><NotificationConsumer /></NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    )
    expect(screen.getByTestId("count")).toHaveTextContent("0")
    expect(screen.getByTestId("unread")).toHaveTextContent("0")
  })

  it("throws when useNotifications is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<NotificationConsumer />)).toThrow(
      "useNotifications must be used within a NotificationProvider"
    )
    spy.mockRestore()
  })

  it("clears all notifications", async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider><NotificationConsumer /></NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    )
    await user.click(screen.getByTestId("clear"))
    expect(screen.getByTestId("count")).toHaveTextContent("0")
    expect(screen.getByTestId("unread")).toHaveTextContent("0")
  })

  it("markAllRead resets unread count to 0", async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider><NotificationConsumer /></NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    )
    await user.click(screen.getByTestId("mark-all"))
    expect(screen.getByTestId("unread")).toHaveTextContent("0")
  })

  it("markAsRead decrements unread count (floor 0)", async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider><NotificationConsumer /></NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    )
    await user.click(screen.getByTestId("mark-read"))
    expect(screen.getByTestId("unread")).toHaveTextContent("0")
  })
})
