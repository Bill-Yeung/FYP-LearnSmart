import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "../../../contexts/AuthContext"
import { ThemeProvider } from "../../../contexts/ThemeContext"
import { ToastProvider } from "../../../contexts/ToastContext"
import { NotificationProvider } from "../../../contexts/NotificationContext"
import { LoginPage } from "../../../pages/auth/LoginPage"

// Mock EventSource which is not available in happy-dom
class MockEventSource {
  onopen: (() => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onerror: (() => void) | null = null
  close() {}
}
vi.stubGlobal("EventSource", MockEventSource)

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

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <LoginPage />
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe("LoginPage", () => {

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    vi.stubGlobal("EventSource", MockEventSource)
  })

  it("renders login form with email and password fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument()
  })

  it("renders learning mode selector with three modes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    expect(screen.getByText("Learning Mode")).toBeInTheDocument()
    expect(screen.getByText("Normal")).toBeInTheDocument()
    expect(screen.getByText("Classroom")).toBeInTheDocument()
    expect(screen.getByText("Detective")).toBeInTheDocument()
  })

  it("disables submit button when fields are empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    const submitButton = screen.getByRole("button", { name: "Sign in" })
    expect(submitButton).toBeDisabled()
  })

  it("enables submit button when email and password are filled", async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.type(screen.getByPlaceholderText("••••••••"), "password123")

    const submitButton = screen.getByRole("button", { name: "Sign in" })
    expect(submitButton).toBeEnabled()
  })

  it("calls login API on form submit with correct payload", async () => {
    const user = userEvent.setup()

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }))

    renderLoginPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.type(screen.getByPlaceholderText("••••••••"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      const loginCall = fetchSpy.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("/api/auth/login")
      )
      expect(loginCall).toBeDefined()
      const body = JSON.parse((loginCall![1] as any).body)
      expect(body.email).toBe("test@example.com")
      expect(body.password).toBe("password123")
    })
  })

  it("shows error message on login failure", async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Invalid credentials" }), { status: 401 })
      )

    renderLoginPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "bad@example.com")
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpass")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument()
    })
  })

  it("has link to create account (register page)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument()
  })

  it("has link to forgot password page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument()
  })

  it("renders quick demo login buttons for each role", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    expect(screen.getByRole("button", { name: "Student" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Teacher" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument()
  })

  it("renders OAuth login buttons for Google and GitHub", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), { status: 200 })
    )

    renderLoginPage()

    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "GitHub" })).toBeInTheDocument()
  })

  it("shows 'Signing in...' text while loading", async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      .mockImplementationOnce(() => new Promise(() => {}))

    renderLoginPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.type(screen.getByPlaceholderText("••••••••"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument()
    })
  })
})
