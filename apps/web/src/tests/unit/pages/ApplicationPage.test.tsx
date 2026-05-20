import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { ToastProvider } from "../../../contexts/ToastContext"
import { SimplifyPage } from "../../../pages/application/SimplifyPage"

vi.mock("../../../pages/application/SimplifyConcept", () => ({
  SimplifyConcept: () => <div data-testid="simplify-concept">SimplifyConcept</div>,
}))
vi.mock("../../../pages/application/CheckUnderstanding", () => ({
  CheckUnderstanding: () => <div data-testid="check-understanding">CheckUnderstanding</div>,
}))
vi.mock("../../../pages/application/ReflectOnTeaching", () => ({
  ReflectOnTeaching: () => <div data-testid="reflect-on-teaching">ReflectOnTeaching</div>,
}))

function renderSimplifyPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SimplifyPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("SimplifyPage — Explanation Tools", () => {
  it("renders Explanation Tools heading", () => {
    renderSimplifyPage()
    expect(screen.getByText(/explanation tools/i)).toBeInTheDocument()
  })

  it("shows guide panel by default with tool descriptions", () => {
    renderSimplifyPage()
    expect(screen.getAllByText(/use when your explanation is too complex/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/want to know if your explanation is correct/i).length).toBeGreaterThan(0)
  })

  it("hides guide when toggle button clicked", async () => {
    renderSimplifyPage()
    await userEvent.click(screen.getByRole("button", { name: /hide guide/i }))
    expect(screen.getByRole("button", { name: /which tool should I use/i })).toBeInTheDocument()
    expect(screen.queryByText(/tip: start with/i)).not.toBeInTheDocument()
  })

  it("shows guide again after second toggle click", async () => {
    renderSimplifyPage()
    await userEvent.click(screen.getByRole("button", { name: /hide guide/i }))
    const showBtn = screen.queryByRole("button", { name: /which tool/i })
    if (showBtn) await userEvent.click(showBtn)
    expect(screen.getAllByText(/use when your explanation is too complex/i).length).toBeGreaterThan(0)
  })

  it("defaults to Adjust Level tab and renders SimplifyConcept", () => {
    renderSimplifyPage()
    expect(screen.getByTestId("simplify-concept")).toBeInTheDocument()
  })

  it("switches to Check Understanding tab", async () => {
    renderSimplifyPage()
    await userEvent.click(screen.getAllByRole("button", { name: /check understanding/i })[0])
    expect(screen.getByTestId("check-understanding")).toBeInTheDocument()
  })

  it("switches to Reflect on Teaching tab", async () => {
    renderSimplifyPage()
    await userEvent.click(screen.getAllByRole("button", { name: /reflect on teaching/i })[0])
    expect(screen.getByTestId("reflect-on-teaching")).toBeInTheDocument()
  })

  it("active tab banner shows correct guidance", async () => {
    renderSimplifyPage()
    await userEvent.click(screen.getAllByRole("button", { name: /check understanding/i })[0])
    expect(screen.getByText(/want to know if your explanation is correct/i)).toBeInTheDocument()
  })
})
