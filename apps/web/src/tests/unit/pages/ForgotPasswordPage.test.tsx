import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "../../../contexts/ThemeContext"
import { ToastProvider } from "../../../contexts/ToastContext"
import { ForgotPasswordPage } from "../../../pages/auth/ForgotPasswordPage"

// Mock the apiClient module so we can control API calls
vi.mock("../../../lib/api", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

import { apiClient } from "../../../lib/api"

function renderForgotPasswordPage() {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <ForgotPasswordPage />
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe("ForgotPasswordPage", () => {

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    vi.mocked(apiClient.post).mockReset()
  })

  it("renders email input step initially", () => {
    renderForgotPasswordPage()

    expect(screen.getByText("Forgot Password")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send Reset Code" })).toBeInTheDocument()
  })

  it("disables send button when email is empty", () => {
    renderForgotPasswordPage()

    const sendButton = screen.getByRole("button", { name: "Send Reset Code" })
    expect(sendButton).toBeDisabled()
  })

  it("shows validation error for invalid email format", async () => {
    const user = userEvent.setup()

    renderForgotPasswordPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "not-an-email")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument()
    })
  })

  it("transitions to OTP step after successful email submission", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockResolvedValueOnce({})

    renderForgotPasswordPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument()
      expect(screen.getByPlaceholderText("123456")).toBeInTheDocument()
    })
  })

  it("calls password-reset/request API with correct email", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockResolvedValueOnce({})

    renderForgotPasswordPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/api/auth/password-reset/request", {
        email: "test@example.com",
      })
    })
  })

  it("handles email submission API error", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("User not found"))

    renderForgotPasswordPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "unknown@example.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    await waitFor(() => {
      expect(screen.getByText("User not found")).toBeInTheDocument()
    })
  })

  it("shows OTP step fields: verification code, new password, confirm password", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockResolvedValueOnce({})

    renderForgotPasswordPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("123456")).toBeInTheDocument()
      const passwordFields = screen.getAllByPlaceholderText("••••••••")
      expect(passwordFields).toHaveLength(2)
      expect(screen.getByRole("button", { name: "Reset Password" })).toBeInTheDocument()
    })
  })

  it("transitions to success step after valid OTP and password reset", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    renderForgotPasswordPage()

    // Step 1: email
    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    // Step 2: OTP + new password
    await waitFor(() => {
      expect(screen.getByPlaceholderText("123456")).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText("123456"), "123456")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "NewPass123")
    await user.type(passwordFields[1], "NewPass123")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    // Step 3: success
    await waitFor(() => {
      expect(screen.getByText("Password Reset Complete")).toBeInTheDocument()
      expect(screen.getByText("Your password has been changed successfully.")).toBeInTheDocument()
    })
  })

  it("handles OTP verification API error", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Invalid OTP"))

    renderForgotPasswordPage()

    // Step 1: email
    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    // Step 2: OTP
    await waitFor(() => {
      expect(screen.getByPlaceholderText("123456")).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText("123456"), "000000")
    const passwordFields = screen.getAllByPlaceholderText("••••••••")
    await user.type(passwordFields[0], "NewPass123")
    await user.type(passwordFields[1], "NewPass123")
    await user.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() => {
      expect(screen.getByText("Invalid OTP")).toBeInTheDocument()
    })
  })

  it("has link back to sign in page from email step", () => {
    renderForgotPasswordPage()

    const signInLink = screen.getByRole("link", { name: "Sign in" })
    expect(signInLink).toBeInTheDocument()
    expect(signInLink).toHaveAttribute("href", "/login")
  })

  it("shows 'Change email' and 'Resend code' buttons on OTP step", async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.post).mockResolvedValueOnce({})

    renderForgotPasswordPage()

    await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
    await user.click(screen.getByRole("button", { name: "Send Reset Code" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Change email" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Resend code" })).toBeInTheDocument()
    })
  })
})
