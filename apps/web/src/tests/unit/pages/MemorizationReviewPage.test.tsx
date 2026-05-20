import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BrowserRouter, MemoryRouter } from "react-router-dom"
import { FlashcardsReviewPage } from "../../../pages/flashcards/FlashcardsReviewPage"
import { ToastProvider } from "../../../contexts/ToastContext"

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("../../../lib/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { apiClient } from "../../../lib/api"

function renderReviewPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <FlashcardsReviewPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

const dueCard = {
  id: "card-1",
  front: "What is photosynthesis?",
  back: "Conversion of light to energy in plants",
  due_label: "Due today",
  interval_days: 1,
  reps: 0,
  ease_factor: 2.5,
}

describe("FlashcardsReviewPage — loading and stats", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({ algorithm: "sm2" })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading state initially", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    renderReviewPage()
    expect(screen.getByText(/loading cards/i)).toBeInTheDocument()
  })

  it("shows All caught up when no due cards returned", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    }) as any
    renderReviewPage()
    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument())
  })

  it("shows Start anyway button when no due cards", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [{ ...dueCard, due_label: "New" }],
    }) as any
    renderReviewPage()
    await waitFor(() => expect(screen.getByRole("button", { name: /start anyway/i })).toBeInTheDocument())
  })

  it("redirects to login on 401 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => [],
    }) as any
    renderReviewPage()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/login"))
  })

  it("shows error message when API fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => ({ detail: "Server error" }),
    }) as any
    renderReviewPage()
    await waitFor(() => expect(screen.getByText(/error loading cards/i)).toBeInTheDocument())
  })

  it("shows algorithm name in Start review button", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ algorithm: "fsrs" })
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [dueCard],
    }) as any
    renderReviewPage()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /start review.*fsrs/i })).toBeInTheDocument()
    )
  })

  it("shows How it works banner on load", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    }) as any
    renderReviewPage()
    await waitFor(() => expect(screen.getByText(/how it works/i)).toBeInTheDocument())
  })

  it("dismisses intro banner when clicking Dismiss", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    }) as any
    renderReviewPage()
    await waitFor(() => screen.getByText(/how it works/i))
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }))
    expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
  })

  it("opens intro modal when clicking Learn more", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    }) as any
    renderReviewPage()
    await waitFor(() => screen.getByText(/learn more/i))
    await userEvent.click(screen.getByText(/learn more/i))
    await waitFor(() =>
      expect(screen.getByText(/how this works/i)).toBeInTheDocument()
    )
  })
})
