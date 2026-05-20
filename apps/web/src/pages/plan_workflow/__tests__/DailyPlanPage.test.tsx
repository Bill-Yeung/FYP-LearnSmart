import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"

import { DailyPlanPage } from "../DailyPlanPage"
import * as planWorkflowApi from "../../../api/planWorkflow"

vi.mock("../../../api/planWorkflow", () => ({
  getDailyPlanTasks: vi.fn(),
  createDailyTask: vi.fn(),
  updateDailyTask: vi.fn(),
}))

vi.mock("../../../contexts/TimerContext", () => ({
  useTimer: () => ({
    loadTasks: vi.fn().mockResolvedValue(undefined),
    selectTask: vi.fn(),
    tasks: [],
    loading: false,
    error: null,
    activeTask: null,
    isRunning: false,
    isWorkSession: true,
    sessionCount: 1,
    timeLeft: 1500,
    totalFocusSeconds: 0,
    reflectionOpen: false,
    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    skipSession: vi.fn(),
    submitReflection: vi.fn(),
    cancelReflection: vi.fn(),
    updateTasks: vi.fn(),
  }),
}))

const mockTasks = [
  {
    id: "task-1",
    title: "Review TCP/IP",
    type: "memory",
    status: "pending",
    durationMinutes: 30,
    userId: "user-1",
  },
] as any

const mockedDaily = planWorkflowApi as unknown as {
  getDailyPlanTasks: any
  createDailyTask: any
  updateDailyTask: any
}

describe("DailyPlanPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(planWorkflowApi.getDailyPlanTasks).mockResolvedValue(mockTasks)
    vi.mocked(planWorkflowApi.createDailyTask).mockResolvedValue({
      id: "task-2",
      title: "New goal",
      type: "logic",
      status: "pending",
      durationMinutes: 25,
      userId: "user-1",
    })
    vi.mocked(planWorkflowApi.updateDailyTask).mockResolvedValue({
      id: "task-1",
      title: "Review TCP/IP updated",
      type: "memory",
      status: "pending",
      durationMinutes: 40,
      userId: "user-1",
    })
  })

  it("loads daily tasks and shows task titles", async () => {
    render(
      <MemoryRouter initialEntries={["/plan-workflow/daily-plan?day=Monday"]}>
        <DailyPlanPage />
      </MemoryRouter>
    )

    expect(screen.getByText("Loading tasks...")).toBeInTheDocument()

    await waitFor(() => expect(mockedDaily.getDailyPlanTasks).toHaveBeenCalledWith("Monday"))

    expect(screen.getAllByText(/Review TCP\/IP/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/30 min/i)[0]).toBeInTheDocument()
  })

  it("shows validation error when adding a task with empty title", async () => {
    render(
      <MemoryRouter initialEntries={["/plan-workflow/daily-plan?day=Monday"]}>
        <DailyPlanPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(mockedDaily.getDailyPlanTasks).toHaveBeenCalled())

    await userEvent.click(screen.getByRole("button", { name: /Add goal/i }))

    await userEvent.click(screen.getByRole("button", { name: /Add task/i }))

    const errors = await screen.findAllByText("Task title cannot be empty")
    expect(errors.length).toBeGreaterThan(0)
  })

  it("can add a new task successfully", async () => {
    render(
      <MemoryRouter initialEntries={["/plan-workflow/daily-plan?day=Monday"]}>
        <DailyPlanPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(planWorkflowApi.getDailyPlanTasks).toHaveBeenCalled())

    await userEvent.click(screen.getByRole("button", { name: /Add goal/i }))
    await waitFor(() => expect(screen.getByText("Add new task")).toBeInTheDocument())

    const titleInput = screen.getByPlaceholderText(/Understanding TCP protocol/i)
    const durationInput = screen.getAllByRole("spinbutton")[0]
    const typeSelect = screen.getAllByRole("combobox")[0]

    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, "New goal")
    await userEvent.clear(durationInput)
    await userEvent.type(durationInput, "25")
    await userEvent.selectOptions(typeSelect, "logic")

    await userEvent.click(screen.getByRole("button", { name: /Add task/i }))

    expect(screen.queryByText("Task title cannot be empty")).not.toBeInTheDocument()
  })

  it("can edit an existing task", async () => {
    render(
      <MemoryRouter initialEntries={["/plan-workflow/daily-plan?day=Monday"]}>
        <DailyPlanPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(planWorkflowApi.getDailyPlanTasks).toHaveBeenCalled())

    const editButtons = screen.getAllByRole("button", { name: /Edit/i })
    await userEvent.click(editButtons[editButtons.length - 1])

    await waitFor(() => expect(screen.getByText("Edit task")).toBeInTheDocument())

    const titleInput = screen.getByPlaceholderText(/Understanding TCP protocol/i)
    const durationInput = screen.getAllByRole("spinbutton")[0]

    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, "Review TCP/IP updated")
    await userEvent.clear(durationInput)
    await userEvent.type(durationInput, "40")

    await userEvent.click(screen.getByRole("button", { name: /Save changes/i }))

    expect(screen.queryByText("Task title cannot be empty")).not.toBeInTheDocument()
  })

  it("opens add-task modal and closes with cancel", async () => {
    render(
      <MemoryRouter initialEntries={["/plan-workflow/daily-plan?day=Monday"]}>
        <DailyPlanPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(planWorkflowApi.getDailyPlanTasks).toHaveBeenCalled())

    await userEvent.click(screen.getByRole("button", { name: /Add goal/i }))
    await waitFor(() => expect(screen.getByText("Add new task")).toBeInTheDocument())

    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }))
    await waitFor(() => expect(screen.queryByText("Add new task")).not.toBeInTheDocument())
  })

  it("opens edit-task modal and closes with cancel", async () => {
    render(
      <MemoryRouter initialEntries={["/plan-workflow/daily-plan?day=Monday"]}>
        <DailyPlanPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(planWorkflowApi.getDailyPlanTasks).toHaveBeenCalled())

    const editButtons = screen.getAllByRole("button", { name: /Edit/i })
    await userEvent.click(editButtons[editButtons.length - 1])

    await waitFor(() => expect(screen.getByText("Edit task")).toBeInTheDocument())

    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }))
    await waitFor(() => expect(screen.queryByText("Edit task")).not.toBeInTheDocument())
  })
})
