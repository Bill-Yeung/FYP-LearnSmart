import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { ToastProvider, useToast } from "../../../contexts/ToastContext"

function ToastConsumer() {
  const { message, showToast, dismissToast } = useToast()
  return (
    <div>
      <span data-testid="message">{message ?? "none"}</span>
      <button data-testid="show" onClick={() => showToast("Hello!")}>Show</button>
      <button data-testid="dismiss" onClick={dismissToast}>Dismiss</button>
    </div>
  )
}

describe("ToastContext", () => {

  it("starts with no message", () => {
    render(<ToastProvider><ToastConsumer /></ToastProvider>)
    expect(screen.getByTestId("message")).toHaveTextContent("none")
  })

  it("shows a toast message", async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastConsumer /></ToastProvider>)

    await user.click(screen.getByTestId("show"))
    expect(screen.getByTestId("message")).toHaveTextContent("Hello!")
  })

  it("dismisses a toast message", async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastConsumer /></ToastProvider>)

    await user.click(screen.getByTestId("show"))
    expect(screen.getByTestId("message")).toHaveTextContent("Hello!")

    await user.click(screen.getByTestId("dismiss"))
    expect(screen.getByTestId("message")).toHaveTextContent("none")
  })

  it("throws when useToast is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<ToastConsumer />)).toThrow("useToast must be used within a ToastProvider")
    spy.mockRestore()
  })
})
