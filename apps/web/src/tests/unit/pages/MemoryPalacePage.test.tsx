import { render, screen, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryPalacePage } from "../../../pages/flashcards/MemoryPalacePage"

function mockUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  })
}

function renderPage() {
  return render(<MemoryPalacePage />)
}

describe("MemoryPalacePage — non-Vision Pro device", () => {
  beforeEach(() => {
    mockUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120"
    )
  })

  it("shows the page title", () => {
    renderPage()
    expect(screen.getByText("Memory Palace")).toBeInTheDocument()
  })

  it("does NOT show the Enter Immersive Experience button", () => {
    renderPage()
    expect(
      screen.queryByRole("button", { name: /enter immersive experience/i })
    ).not.toBeInTheDocument()
  })

  it("shows the Apple Vision Pro required message", () => {
    renderPage()
    expect(screen.getByText(/apple vision pro required/i)).toBeInTheDocument()
  })

  it("explains that Memory Palace only runs on Vision Pro", () => {
    renderPage()
    expect(screen.getByText(/only runs on apple vision pro/i)).toBeInTheDocument()
  })

  it("does not show the Vision Pro detected hint", () => {
    renderPage()
    expect(screen.queryByText(/vision pro detected/i)).not.toBeInTheDocument()
  })
})

describe("MemoryPalacePage — Vision Pro device", () => {
  beforeEach(() => {
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) visionOS/1.0"
    )
    vi.stubGlobal("location", { href: "" })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("shows the Enter Immersive Experience button", () => {
    renderPage()
    expect(
      screen.getByRole("button", { name: /enter immersive experience/i })
    ).toBeInTheDocument()
  })

  it("shows the Vision Pro detected hint", () => {
    renderPage()
    expect(screen.getByText(/vision pro detected/i)).toBeInTheDocument()
  })

  it("does NOT show the Vision Pro required warning", () => {
    renderPage()
    expect(screen.queryByText(/apple vision pro required/i)).not.toBeInTheDocument()
  })

  it("button changes to Opening… while trying", async () => {
    renderPage()
    const btn = screen.getByRole("button", { name: /enter immersive experience/i })
    await act(async () => { btn.click() })
    expect(screen.getByRole("button", { name: /opening/i })).toBeInTheDocument()
  })

  it("button is disabled while trying", async () => {
    renderPage()
    const btn = screen.getByRole("button", { name: /enter immersive experience/i })
    await act(async () => { btn.click() })
    expect(screen.getByRole("button", { name: /opening/i })).toBeDisabled()
  })

  it("shows failed state after 2 seconds if app not found", async () => {
    renderPage()
    const btn = screen.getByRole("button", { name: /enter immersive experience/i })
    await act(async () => { btn.click() })
    act(() => { vi.advanceTimersByTime(2001) })
    expect(screen.getByText(/could not open the memory palace app/i)).toBeInTheDocument()
  })

  it("shows Try again button after failure", async () => {
    renderPage()
    await act(async () => {
      screen.getByRole("button", { name: /enter immersive experience/i }).click()
    })
    act(() => { vi.advanceTimersByTime(2001) })
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("Try again resets to idle state", async () => {
    renderPage()
    await act(async () => {
      screen.getByRole("button", { name: /enter immersive experience/i }).click()
    })
    act(() => { vi.advanceTimersByTime(2001) })
    await act(async () => {
      screen.getByRole("button", { name: /try again/i }).click()
    })
    expect(
      screen.getByRole("button", { name: /enter immersive experience/i })
    ).toBeInTheDocument()
    expect(screen.queryByText(/could not open/i)).not.toBeInTheDocument()
  })

  it("sets window.location.href to the deep link on button click", async () => {
    renderPage()
    await act(async () => {
      screen.getByRole("button", { name: /enter immersive experience/i }).click()
    })
    expect((window.location as any).href).toBe("memorypalace://open")
  })
})

describe("MemoryPalacePage — xrOS user agent", () => {
  beforeEach(() => {
    mockUserAgent("Mozilla/5.0 (xrOS 1.1; like Mac OS X) AppleWebKit/605.1")
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("detects xrOS as Vision Pro and shows the button", () => {
    renderPage()
    expect(
      screen.getByRole("button", { name: /enter immersive experience/i })
    ).toBeInTheDocument()
  })
})

describe("MemoryPalacePage — content", () => {
  beforeEach(() => {
    mockUserAgent("Mozilla/5.0 Chrome/120")
  })

  it("shows the AR & VR subtitle", () => {
    renderPage()
    expect(screen.getByText(/AR & VR memory palace experiences/i)).toBeInTheDocument()
  })

  it("shows the overview section", () => {
    renderPage()
    expect(screen.getByText(/overview/i)).toBeInTheDocument()
  })

  it("shows the how it typically works section", () => {
    renderPage()
    expect(screen.getByText(/how it typically works/i)).toBeInTheDocument()
  })
})
