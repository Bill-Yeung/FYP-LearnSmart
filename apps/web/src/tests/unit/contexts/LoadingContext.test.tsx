import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { LoadingProvider, useLoading } from "../../../contexts/LoadingContext"

function LoadingConsumer() {
  const { isLoading, startLoading, stopLoading } = useLoading()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <button data-testid="start" onClick={startLoading}>Start</button>
      <button data-testid="stop" onClick={stopLoading}>Stop</button>
    </div>
  )
}

describe("LoadingContext", () => {

  it("starts not loading", () => {
    render(<LoadingProvider><LoadingConsumer /></LoadingProvider>)
    expect(screen.getByTestId("loading")).toHaveTextContent("false")
  })

  it("starts loading", async () => {
    const user = userEvent.setup()
    render(<LoadingProvider><LoadingConsumer /></LoadingProvider>)

    await user.click(screen.getByTestId("start"))
    expect(screen.getByTestId("loading")).toHaveTextContent("true")
  })

  it("stops loading", async () => {
    const user = userEvent.setup()
    render(<LoadingProvider><LoadingConsumer /></LoadingProvider>)

    await user.click(screen.getByTestId("start"))
    expect(screen.getByTestId("loading")).toHaveTextContent("true")

    await user.click(screen.getByTestId("stop"))
    expect(screen.getByTestId("loading")).toHaveTextContent("false")
  })

  it("throws when useLoading is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<LoadingConsumer />)).toThrow("useLoading must be used within a LoadingProvider")
    spy.mockRestore()
  })
})
