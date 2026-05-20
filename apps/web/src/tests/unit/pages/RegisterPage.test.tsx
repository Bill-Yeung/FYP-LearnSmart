import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "../../../contexts/ThemeContext"
import { ToastProvider } from "../../../contexts/ToastContext"
import { RegisterPage } from "../../../pages/auth/RegisterPage"

// Mock the apiClient module so we can control the register call
vi.mock("../../../lib/api", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

import { apiClient } from "../../../lib/api"

function renderRegisterPage() {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <RegisterPage />
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe("RegisterPage", () => {

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    vi.mocked(apiClient.post).mockReset()
  })

  it("renders registration form with all required fields", () => {
    renderRegisterPage()

    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("johndoe")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    expect(passwordFields).toHaveLength(2)
  })

  it("renders role selection with Learner and Teacher options", () => {
    renderRegisterPage()

    expect(screen.getByText("I am a")).toBeInTheDocument()
    expect(screen.getByText("Learner")).toBeInTheDocument()
    expect(screen.getByText("Teacher")).toBeInTheDocument()
  })

  it("disables submit button when required fields are empty", () => {
    renderRegisterPage()

    const submitButton = screen.getByRole("button", { name: "Create Account" })
    expect(submitButton).toBeDisabled()
  })

  it("shows validation error for short username", async () => {
    const user = userEvent.setup()

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText("johndoe"), "ab")
    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "Test1234")
    await user.type(passwordFields[1], "Test1234")
    const submitButton = screen.getByRole("button", { name: "Create Account" })
    expect(submitButton).toBeDisabled()
  })

  it("shows validation error for invalid email format on submit", async () => {
    const user = userEvent.setup()

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText("johndoe"), "testuser")
    await user.type(screen.getByPlaceholderText("name@example.com"), "not-an-email")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "Test1234")
    await user.type(passwordFields[1], "Test1234")

    const form = screen.getByRole("button", { name: "Create Account" })
    await user.click(form)

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument()
    })
  })

  it("shows validation error for weak password", async () => {
    const user = userEvent.setup()

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText("johndoe"), "testuser")
    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "weakpass")
    await user.type(passwordFields[1], "weakpass")

    const submitButton = screen.getByRole("button", { name: "Create Account" })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Password must contain at least one uppercase letter")).toBeInTheDocument()
    })
  })

  it("shows validation error when passwords do not match", async () => {
    const user = userEvent.setup()

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText("johndoe"), "testuser")
    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "Test1234")
    await user.type(passwordFields[1], "Test5678")
    const submitButton = screen.getByRole("button", { name: "Create Account" })
    expect(submitButton).toBeDisabled()
  })

  it("calls register API on valid submit", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockResolvedValueOnce({})

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText("johndoe"), "testuser")
    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "Test1234")
    await user.type(passwordFields[1], "Test1234")

    const submitButton = screen.getByRole("button", { name: "Create Account" })
    await user.click(submitButton)

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/api/auth/register", {
        username: "testuser",
        email: "test@example.com",
        password: "Test1234",
        role: "student",
      })
    })
  })

  it("handles registration API error", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("Email already registered"))

    renderRegisterPage()

    await user.type(screen.getByPlaceholderText("johndoe"), "testuser")
    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "Test1234")
    await user.type(passwordFields[1], "Test1234")

    await user.click(screen.getByRole("button", { name: "Create Account" }))

    await waitFor(() => {
      expect(screen.getByText("Email already registered")).toBeInTheDocument()
    })
  })

  it("has link to sign in page", () => {
    renderRegisterPage()

    const signInLink = screen.getByRole("link", { name: "Sign in" })
    expect(signInLink).toBeInTheDocument()
    expect(signInLink).toHaveAttribute("href", "/login")
  })

  it("allows switching role to Teacher", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockResolvedValueOnce({})

    renderRegisterPage()

    await user.click(screen.getByText("Teacher"))

    await user.type(screen.getByPlaceholderText("johndoe"), "teacheruser")
    await user.type(screen.getByPlaceholderText("name@example.com"), "teacher@example.com")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "Test1234")
    await user.type(passwordFields[1], "Test1234")

    await user.click(screen.getByRole("button", { name: "Create Account" }))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
        role: "teacher",
      }))
    })
  })
})
