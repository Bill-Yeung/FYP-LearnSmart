import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useGuidedBrainstorm } from "../../../hooks/useGuidedBrainstorm"
import { callAiJson } from "../../../lib/aiCall"

vi.mock("../../../lib/aiCall", () => ({
  callAiJson: vi.fn(),
}))

describe("useGuidedBrainstorm", () => {
  const mockedCallAiJson = vi.mocked(callAiJson)
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
  })

  it("builds markdown from the current brainstorm state", () => {
    const { result } = renderHook(() => useGuidedBrainstorm())

    act(() => {
      result.current.setTopic("Photosynthesis")
      result.current.setContext("Exam prep")
      result.current.setResponse("what", "Plants turn light into chemical energy.")
      result.current.addBullet("what", "Occurs in chloroplasts")
      result.current.addBullet("what", "Produces glucose")
      result.current.moveBullet("what", 1, -1)
    })

    expect(result.current.markdown).toContain("# Photosynthesis")
    expect(result.current.markdown).toContain("**Context:** Exam prep")
    expect(result.current.markdown).toContain("## What")
    expect(result.current.markdown).toContain("Plants turn light into chemical energy.")
    expect(result.current.markdown).toContain("- Produces glucose")
    expect(result.current.markdown.indexOf("- Produces glucose")).toBeLessThan(
      result.current.markdown.indexOf("- Occurs in chloroplasts")
    )
  })

  it("requires a topic or context before generating structured notes", async () => {
    const toast = vi.fn()
    const { result } = renderHook(() => useGuidedBrainstorm())

    await act(async () => {
      await result.current.generateStructuredNotes(toast)
    })

    expect(mockedCallAiJson).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith("Add a topic or context first")
  })

  it("generates structured notes and supports copying", async () => {
    mockedCallAiJson.mockResolvedValue({
      title: "Photosynthesis notes",
      summary: "Plants convert light into stored chemical energy.",
      sections: [
        {
          heading: "What",
          content: "Photosynthesis captures light energy.",
          bullets: ["Occurs in chloroplasts"],
        },
      ],
      next_steps: ["Revise the light-dependent reactions"],
    })

    const toast = vi.fn()
    const { result } = renderHook(() => useGuidedBrainstorm())

    act(() => {
      result.current.setTopic("Photosynthesis")
      result.current.addBullet("what", "Occurs in chloroplasts")
    })

    await act(async () => {
      await result.current.generateStructuredNotes(toast, { subjectName: "Biology" })
    })

    expect(result.current.structuredNotes).toContain("# Photosynthesis notes")
    expect(result.current.structuredNotes).toContain("## What")
    expect(result.current.structuredNotes).toContain("- Occurs in chloroplasts")
    expect(result.current.structuredNotes).toContain("## Next steps")
    expect(toast).toHaveBeenCalledWith("Structured notes generated")

    await act(async () => {
      await result.current.copyMarkdown(toast)
      await result.current.copyStructuredNotes(toast)
    })

    expect(writeText).toHaveBeenNthCalledWith(1, expect.stringContaining("# Photosynthesis"))
    expect(writeText).toHaveBeenNthCalledWith(2, expect.stringContaining("# Photosynthesis notes"))
  })
})
