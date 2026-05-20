import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useDocumentUpload } from "../../../hooks/useDocumentUpload"
import { ToastProvider, useToast } from "../../../contexts/ToastContext"

// Capture toast messages
let lastToast = ""
function ToastSpy() {
  const { message } = useToast()
  lastToast = message ?? ""
  return <span data-testid="toast">{message ?? "none"}</span>
}

function UploadConsumer() {
  const { files, validateFile, handleFileSelect, handleUpload } = useDocumentUpload()
  return (
    <div>
      <span data-testid="file-count">{files.length}</span>
      <button data-testid="add-valid" onClick={() => handleFileSelect([new File(["x"], "test.pdf", { type: "application/pdf" })])}>Add Valid</button>
      <button data-testid="add-large" onClick={() => {
        const bigFile = new File(["x".repeat(100)], "big.pdf", { type: "application/pdf" })
        Object.defineProperty(bigFile, "size", { value: 60 * 1024 * 1024 }) // 60MB
        handleFileSelect([bigFile])
      }}>Add Large</button>
      <button data-testid="upload-empty" onClick={() => handleUpload("file", {})}>Upload Empty</button>
      <button data-testid="upload-text-empty" onClick={() => handleUpload("text", { textContent: "" })}>Upload Text Empty</button>
      <button data-testid="upload-text-no-title" onClick={() => handleUpload("text", { textContent: "content", title: "" })}>Upload No Title</button>
      <button data-testid="validate-ok" onClick={() => {
        const r = validateFile(new File(["x"], "ok.pdf"))
        document.getElementById("validate-result")!.textContent = r ?? "valid"
      }}>Validate OK</button>
      <button data-testid="validate-big" onClick={() => {
        const f = new File(["x"], "big.pdf")
        Object.defineProperty(f, "size", { value: 60 * 1024 * 1024 })
        const r = validateFile(f)
        document.getElementById("validate-result")!.textContent = r ?? "valid"
      }}>Validate Big</button>
      <span id="validate-result" data-testid="validate-result"></span>
    </div>
  )
}

function renderUpload() {
  lastToast = ""
  return render(
    <ToastProvider>
      <ToastSpy />
      <UploadConsumer />
    </ToastProvider>
  )
}

describe("useDocumentUpload", () => {

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("starts with no files", () => {
    renderUpload()
    expect(screen.getByTestId("file-count")).toHaveTextContent("0")
  })

  it("adds valid files", async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.click(screen.getByTestId("add-valid"))
    expect(screen.getByTestId("file-count")).toHaveTextContent("1")
  })

  it("rejects files exceeding max size", async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.click(screen.getByTestId("add-large"))
    expect(screen.getByTestId("file-count")).toHaveTextContent("0")
    expect(screen.getByTestId("toast")).toHaveTextContent(/too large/i)
  })

  it("validates file size correctly", async () => {
    const user = userEvent.setup()
    renderUpload()

    await user.click(screen.getByTestId("validate-ok"))
    expect(screen.getByTestId("validate-result")).toHaveTextContent("valid")

    await user.click(screen.getByTestId("validate-big"))
    expect(screen.getByTestId("validate-result")).toHaveTextContent(/too large/i)
  })

  it("shows toast when uploading with no files", async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.click(screen.getByTestId("upload-empty"))
    expect(screen.getByTestId("toast")).toHaveTextContent(/select at least one file/i)
  })

  it("shows toast when uploading text without content", async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.click(screen.getByTestId("upload-text-empty"))
    expect(screen.getByTestId("toast")).toHaveTextContent(/enter some text/i)
  })

  it("shows toast when uploading text without title", async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.click(screen.getByTestId("upload-text-no-title"))
    expect(screen.getByTestId("toast")).toHaveTextContent(/enter a title/i)
  })

  it("accumulates multiple valid files", async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.click(screen.getByTestId("add-valid"))
    await user.click(screen.getByTestId("add-valid"))
    expect(screen.getByTestId("file-count")).toHaveTextContent("2")
  })
})
