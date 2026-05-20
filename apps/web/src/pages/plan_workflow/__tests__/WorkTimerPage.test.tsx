import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import WorkTimerPage from "../WorkTimerPage"

const mockTimer = {
  tasks: [
    {
      id: "task-1",
      title: "Review TCP/IP",
      type: "memory",
      duration: 30,
      completed: false,
      active: true,
      tags: ["network"],
    },
  ],
  loading: false,
  error: null,
  activeTask: {
    id: "task-1",
    title: "Review TCP/IP",
    type: "memory",
    duration: 30,
    completed: false,
    active: true,
    tags: ["network"],
  },
  isRunning: false,
  isWorkSession: true,
  sessionCount: 1,
  timeLeft: 1500,
  totalFocusSeconds: 300,
  reflectionOpen: true,
  startTimer: vi.fn(),
  pauseTimer: vi.fn(),
  skipSession: vi.fn(),
  selectTask: vi.fn(),
  loadTasks: vi.fn(),
  submitReflection: vi.fn().mockResolvedValue(undefined),
  cancelReflection: vi.fn(),
  updateTasks: vi.fn(),
}

vi.mock("../../../contexts", () => ({
  useTimer: () => mockTimer,
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe("WorkTimerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTimer.startTimer = vi.fn()
    mockTimer.pauseTimer = vi.fn()
    mockTimer.skipSession = vi.fn()
    mockTimer.selectTask = vi.fn()
    mockTimer.loadTasks = vi.fn().mockResolvedValue(undefined)
    mockTimer.submitReflection = vi.fn().mockResolvedValue(undefined)
    mockTimer.cancelReflection = vi.fn()
  })

  it("renders tasks and timer status correctly", () => {
    render(<WorkTimerPage />)

    expect(screen.getByText(/Today\'s tasks/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Review TCP\/IP/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Focus timer/i)).toBeInTheDocument()
    expect(screen.getByText("25:00")).toBeInTheDocument() // 1500s => 25:00

    const startButton = screen.getByRole("button", { name: /Start focus/i })
    expect(startButton).toBeInTheDocument()

    userEvent.click(startButton)
    
    expect(startButton).toBeInTheDocument()
  })

  it("allows selecting ambient sound", async () => {
    render(<WorkTimerPage />)

    const soundRain = screen.getByRole("button", { name: /Rain/i })
    const soundCafe = screen.getByRole("button", { name: /Cafe/i })
    const soundWhite = screen.getByRole("button", { name: /White noise/i })

    await userEvent.click(soundRain)
    await waitFor(() => expect(soundRain.className).toContain("text-white"))

    await userEvent.click(soundCafe)
    await waitFor(() => expect(soundCafe.className).toContain("text-white"))

    await userEvent.click(soundWhite)
    await waitFor(() => expect(soundWhite.className).toContain("text-white"))
  })

})
