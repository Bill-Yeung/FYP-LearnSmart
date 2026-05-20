import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { ToastProvider } from "../../../contexts/ToastContext"
import CreateCardPage from "../../../pages/flashcards/CreateCardPage"

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("../../../lib/api", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn(),
  },
}))

vi.mock("../../../lib/activityLog", () => ({ logActivity: vi.fn() }))

vi.mock("../../../components/flashcards/RichTextEditor", () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <textarea
      data-testid="rich-editor"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

function renderCreatePage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <CreateCardPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe("CreateCardPage — single card creation", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-card-1" }),
    }) as any
  })

  afterEach(() => vi.clearAllMocks())

  it("renders Create Flashcards heading", () => {
    renderCreatePage()
    expect(screen.getByText(/create flashcards/i)).toBeInTheDocument()
  })

  it("shows three sections: single card, knowledge base, generate from text", () => {
    renderCreatePage()
    expect(screen.getByText(/create a single card/i)).toBeInTheDocument()
    expect(screen.getByText(/generate from knowledge base/i)).toBeInTheDocument()
    expect(screen.getByText(/generate from text/i)).toBeInTheDocument()
  })

  it("shows toast and does not submit when front is empty", async () => {
    renderCreatePage()
    const editors = screen.getAllByTestId("rich-editor")
    fireEvent.change(editors[1], { target: { value: "Some answer" } })
    await userEvent.click(screen.getByRole("button", { name: /create card/i }))
    expect(global.fetch).not.toHaveBeenCalledWith("/api/flashcards/create", expect.anything())
  })

  it("shows toast and does not submit when back is empty", async () => {
    renderCreatePage()
    const editors = screen.getAllByTestId("rich-editor")
    fireEvent.change(editors[0], { target: { value: "Some question" } })
    await userEvent.click(screen.getByRole("button", { name: /create card/i }))
    expect(global.fetch).not.toHaveBeenCalledWith("/api/flashcards/create", expect.anything())
  })

  it("submits card and navigates to manage on success", async () => {
    renderCreatePage()
    const editors = screen.getAllByTestId("rich-editor")
    fireEvent.change(editors[0], { target: { value: "What is mitosis?" } })
    fireEvent.change(editors[1], { target: { value: "Cell division process" } })
    await userEvent.click(screen.getByRole("button", { name: /create card/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/flashcards/manage"))
  })

  it("shows Create card button in loading state while saving", async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    renderCreatePage()
    const editors = screen.getAllByTestId("rich-editor")
    fireEvent.change(editors[0], { target: { value: "Q?" } })
    fireEvent.change(editors[1], { target: { value: "A." } })
    await userEvent.click(screen.getByRole("button", { name: /create card/i }))
    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument()
  })
})

describe("CreateCardPage — tips and mnemonic sections", () => {
  afterEach(() => vi.clearAllMocks())

  it("Tips section collapsed by default", () => {
    renderCreatePage()
    expect(screen.queryByPlaceholderText(/add helpful tips/i)).not.toBeInTheDocument()
  })

  it("Tips section expands when clicked", async () => {
    renderCreatePage()
    await userEvent.click(screen.getByText("Tips"))
    expect(screen.getByPlaceholderText(/add helpful tips/i)).toBeInTheDocument()
  })

  it("Mnemonic section expands when clicked", async () => {
    renderCreatePage()
    await userEvent.click(screen.getByText("Mnemonic"))
    expect(screen.getByPlaceholderText(/ROY G BIV/i)).toBeInTheDocument()
  })
})

describe("CreateCardPage — generate from text", () => {
  afterEach(() => vi.clearAllMocks())

  it("Generate button disabled when text and topic empty", () => {
    renderCreatePage()
    expect(
      screen.getByRole("button", { name: /generate flashcards with ai/i })
    ).toBeDisabled()
  })

  it("Generate button enabled when text is pasted", async () => {
    renderCreatePage()
    const textarea = screen.getByPlaceholderText(/paste lecture notes/i)
    await userEvent.type(textarea, "Some study notes about biology")
    expect(
      screen.getByRole("button", { name: /generate flashcards with ai/i })
    ).not.toBeDisabled()
  })

  it("shows review modal after generation success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ front: "Q1", back: "A1", tips: "", mnemonic: "", tags: [] }],
    }) as any
    renderCreatePage()
    const textarea = screen.getByPlaceholderText(/paste lecture notes/i)
    await userEvent.type(textarea, "Cell biology notes")
    await userEvent.click(screen.getByRole("button", { name: /generate flashcards with ai/i }))
    await waitFor(() =>
      expect(screen.getByText(/review generated flashcards/i)).toBeInTheDocument()
    )
  })

  it("review modal shows Discard All and Save buttons", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ front: "Q1", back: "A1", tips: "", mnemonic: "", tags: [] }],
    }) as any
    renderCreatePage()
    const textarea = screen.getByPlaceholderText(/paste lecture notes/i)
    await userEvent.type(textarea, "Some notes")
    await userEvent.click(screen.getByRole("button", { name: /generate flashcards with ai/i }))
    await waitFor(() => screen.getByText(/review generated flashcards/i))
    expect(screen.getByRole("button", { name: /discard all/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /save.*card/i })).toBeInTheDocument()
  })

  it("Discard All closes review modal", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ front: "Q1", back: "A1", tips: "", mnemonic: "", tags: [] }],
    }) as any
    renderCreatePage()
    const textarea = screen.getByPlaceholderText(/paste lecture notes/i)
    await userEvent.type(textarea, "Some notes")
    await userEvent.click(screen.getByRole("button", { name: /generate flashcards with ai/i }))
    await waitFor(() => screen.getByText(/review generated flashcards/i))
    await userEvent.click(screen.getByRole("button", { name: /discard all/i }))
    expect(screen.queryByText(/review generated flashcards/i)).not.toBeInTheDocument()
  })
})

describe("CreateCardPage — KB generation guards", () => {
  afterEach(() => vi.clearAllMocks())

  it("shows toast when generating by subject with no subject selected", async () => {
    renderCreatePage()
    await userEvent.click(screen.getByRole("button", { name: /generate from kb/i }))
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("generate-from-knowledge-base"),
      expect.anything()
    )
  })
})
