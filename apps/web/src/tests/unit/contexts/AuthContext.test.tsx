import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AuthProvider, useAuth } from "../../../contexts/AuthContext"

const mockUser = {
  id: "user-123",
  username: "testuser",
  email: "test@example.com",
  role: "student" as const,
  display_name: "Test User",
  preferred_language: "en",
  is_active: true,
  email_verified: true,
  domain_level: "beginner" as const,
  difficulty_preference: "medium" as const,
  ai_assistance_level: "moderate" as const,
  created_at: "2024-01-01T00:00:00Z",
  last_login: null,
}

function AuthConsumer() {
  const { user, isAuthenticated, isLoading, error, login, logout, updateUser, clearError } = useAuth()
  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <span data-testid="username">{user?.username ?? "none"}</span>
      <span data-testid="role">{user?.role ?? "none"}</span>
      <button data-testid="login" onClick={() => login({ email: "test@example.com", password: "pass123" }).catch(() => {})}>Login</button>
      <button data-testid="logout" onClick={logout}>Logout</button>
      <button data-testid="update" onClick={() => updateUser({ display_name: "Updated Name" })}>Update</button>
      <button data-testid="clear-error" onClick={clearError}>Clear</button>
    </div>
  )
}

describe("AuthContext", () => {

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it("starts unauthenticated after bootstrap when no session exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    render(<AuthProvider><AuthConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false")
      expect(screen.getByTestId("username")).toHaveTextContent("none")
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })
  })

  it("hydrates user from cookie session on mount", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }))

    render(<AuthProvider><AuthConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
      expect(screen.getByTestId("username")).toHaveTextContent("testuser")
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })
  })

  it("loads user from localStorage on mount", async () => {
    localStorage.setItem("learnsmart-auth", JSON.stringify(mockUser))
    render(<AuthProvider><AuthConsumer /></AuthProvider>)

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
    expect(screen.getByTestId("username")).toHaveTextContent("testuser")
  })

  it("handles corrupted localStorage gracefully", async () => {
    localStorage.setItem("learnsmart-auth", "not-json")
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    render(<AuthProvider><AuthConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false")
    })
  })

  it("logs in successfully", async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "t" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }))

    render(<AuthProvider><AuthConsumer /></AuthProvider>)
    await user.click(screen.getByTestId("login"))

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
      expect(screen.getByTestId("username")).toHaveTextContent("testuser")
    })
  })

  it("handles login failure", async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ detail: "Invalid credentials" }),
        { status: 401 }
      ))

    render(<AuthProvider><AuthConsumer /></AuthProvider>)

    await user.click(screen.getByTestId("login"))

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Invalid credentials")
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false")
    })
  })

  it("logs out and clears state", async () => {
    const user = userEvent.setup()
    localStorage.setItem("learnsmart-auth", JSON.stringify(mockUser))

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 200 }))

    render(<AuthProvider><AuthConsumer /></AuthProvider>)
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true")

    await user.click(screen.getByTestId("logout"))

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false")
      expect(screen.getByTestId("username")).toHaveTextContent("none")
    })
  })

  it("updates user properties", async () => {
    const user = userEvent.setup()
    localStorage.setItem("learnsmart-auth", JSON.stringify(mockUser))

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockUser), { status: 200 })
    )

    render(<AuthProvider><AuthConsumer /></AuthProvider>)
    await user.click(screen.getByTestId("update"))

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
  })

  it("clears error", async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ detail: "Bad request" }),
        { status: 400 }
      ))

    render(<AuthProvider><AuthConsumer /></AuthProvider>)
    await user.click(screen.getByTestId("login"))

    await waitFor(() => {
      expect(screen.getByTestId("error")).not.toHaveTextContent("none")
    })

    await user.click(screen.getByTestId("clear-error"))
    expect(screen.getByTestId("error")).toHaveTextContent("none")
  })

  it("persists user to localStorage on login", async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }))

    render(<AuthProvider><AuthConsumer /></AuthProvider>)
    await user.click(screen.getByTestId("login"))

    await waitFor(() => {
      const stored = localStorage.getItem("learnsmart-auth")
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!).username).toBe("testuser")
    })
  })

  it("throws when useAuth is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<AuthConsumer />)).toThrow("useAuth must be used within an AuthProvider")
    spy.mockRestore()
  })
})
