import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSimplifyPassage } from "../../../hooks/useSimplifyPassage"
import { callAiJson } from "../../../lib/aiCall"

vi.mock("../../../lib/aiCall", () => ({
  callAiJson: vi.fn(),
}))

describe("useSimplifyPassage", () => {
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

  it("requires a passage before rewriting", async () => {
    const toast = vi.fn()
    const { result } = renderHook(() => useSimplifyPassage())

    await act(async () => {
      await result.current.rewrite(toast)
    })

    expect(mockedCallAiJson).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith("Please paste a passage first")
  })

  it("normalizes the AI result and shows the results panel", async () => {
    mockedCallAiJson.mockResolvedValue({
      simplified: "  Simpler explanation.  ",
      level: "strong",
    })

    const toast = vi.fn()
    const { result } = renderHook(() => useSimplifyPassage())

    act(() => {
      result.current.setPassage("  Original explanation.\n\n")
    })

    await act(async () => {
      await result.current.rewrite(toast, { subjectName: "Biology" })
    })

    expect(mockedCallAiJson).toHaveBeenCalledTimes(1)
    expect(result.current.result).toEqual({
      original: "Original explanation.",
      simplified: "Simpler explanation.",
      language: "english",
      level: "strong",
    })
    expect(result.current.showResults).toBe(true)
    expect(toast).toHaveBeenCalledWith("Simplified version generated")
  })

  it("copies the combined text and resets state", async () => {
    mockedCallAiJson.mockResolvedValue({
      original: "Original explanation.",
      simplified: "Simpler explanation.",
      language: "english",
      level: "light",
    })

    const toast = vi.fn()
    const { result } = renderHook(() => useSimplifyPassage())

    act(() => {
      result.current.setPassage("Original explanation.")
      result.current.setLevel("light")
    })

    await act(async () => {
      await result.current.rewrite(toast)
    })

    await act(async () => {
      await result.current.copy("both", toast)
    })

    expect(writeText).toHaveBeenCalledWith(
      "Original:\nOriginal explanation.\n\nSimplified:\nSimpler explanation."
    )
    expect(toast).toHaveBeenCalledWith("Copied original and simplified text")

    act(() => {
      result.current.reset()
    })

    expect(result.current.passage).toBe("")
    expect(result.current.language).toBe("auto")
    expect(result.current.level).toBe("standard")
    expect(result.current.result).toBeNull()
    expect(result.current.showResults).toBe(false)
  })
})
