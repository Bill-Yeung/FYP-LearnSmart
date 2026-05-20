import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect } from "vitest"
import { ThemeProvider, useTheme } from "../../../contexts/ThemeContext"

function ThemeConsumer() {
  const { colorScheme, isDark, toggleColorScheme, setColorScheme } = useTheme()
  return (
    <div>
      <span data-testid="scheme">{colorScheme}</span>
      <span data-testid="dark">{String(isDark)}</span>
      <button data-testid="toggle" onClick={toggleColorScheme}>Toggle</button>
      <button data-testid="set-dark" onClick={() => setColorScheme("dark")}>Dark</button>
    </div>
  )
}

describe("ThemeContext", () => {

  it("provides default light color scheme", () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(screen.getByTestId("scheme")).toHaveTextContent("light")
    expect(screen.getByTestId("dark")).toHaveTextContent("false")
  })

  it("toggles color scheme", async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)

    expect(screen.getByTestId("scheme")).toHaveTextContent("light")
    await user.click(screen.getByTestId("toggle"))
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark")
    expect(screen.getByTestId("dark")).toHaveTextContent("true")
  })

  it("sets color scheme directly", async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)

    await user.click(screen.getByTestId("set-dark"))
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark")
  })

  it("persists color scheme to localStorage", async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)

    await user.click(screen.getByTestId("set-dark"))
    expect(localStorage.getItem("learnsmart-theme")).toBe("dark")
  })

  it("restores color scheme from localStorage", () => {
    localStorage.setItem("learnsmart-theme", "dark")
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark")
  })

  it("throws when useTheme is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<ThemeConsumer />)).toThrow("useTheme must be used within a ThemeProvider")
    spy.mockRestore()
  })

  it("toggles back to light from dark", async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)

    await user.click(screen.getByTestId("toggle"))
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark")
    await user.click(screen.getByTestId("toggle"))
    expect(screen.getByTestId("scheme")).toHaveTextContent("light")
  })
})
