import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useWhyHowQuestions } from "../../../hooks/useWhyHowQuestions"
import { callAiJson } from "../../../lib/aiCall"

vi.mock("../../../lib/aiCall", () => ({
  callAiJson: vi.fn(),
}))

describe("useWhyHowQuestions", () => {
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

  it("requires at least one question type", async () => {
    const toast = vi.fn()
    const { result } = renderHook(() => useWhyHowQuestions())

    act(() => {
      result.current.setSourceText("Gravity keeps planets in orbit.")
      result.current.setIncludeWhy(false)
      result.current.setIncludeHow(false)
    })

    await act(async () => {
      await result.current.generate(toast)
    })

    expect(mockedCallAiJson).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith("Select at least one question type")
  })

  it("extracts keywords and normalizes generated questions", async () => {
    mockedCallAiJson.mockResolvedValue({
      questions: [
        {
          type: "how",
          question: " How does gravity keep planets in orbit? ",
          rationale: " It asks for the mechanism. ",
          focus: "gravity",
        },
        {
          type: "why",
          difficulty: "hard",
          question: "Why do tides happen?",
          rationale: "It asks for the cause.",
        },
        {
          question: "This item should be ignored",
        },
      ],
    })

    const toast = vi.fn()
    const { result } = renderHook(() => useWhyHowQuestions())

    act(() => {
      result.current.setSourceText(
        "Gravity keeps planets in orbit. Gravity also shapes tides and planetary motion."
      )
      result.current.setCount(2)
    })

    await waitFor(() => {
      expect(result.current.detectedKeywords).toContain("gravity")
    })

    await act(async () => {
      await result.current.generate(toast, { subjectName: "Physics" })
    })

    expect(mockedCallAiJson).toHaveBeenCalledTimes(1)
    expect(result.current.questions).toHaveLength(2)
    expect(result.current.questions[0]).toMatchObject({
      type: "how",
      difficulty: "medium",
      question: "How does gravity keep planets in orbit?",
      rationale: "It asks for the mechanism.",
      focus: "gravity",
    })
    expect(result.current.questions[1]).toMatchObject({
      type: "why",
      difficulty: "hard",
      question: "Why do tides happen?",
      rationale: "It asks for the cause.",
    })
    expect(result.current.showResults).toBe(true)
    expect(toast).toHaveBeenCalledWith("Generated 2 question(s)")
  })

  it("copies all generated questions", async () => {
    mockedCallAiJson.mockResolvedValue({
      questions: [
        {
          type: "why",
          question: "Why does gravity matter?",
          rationale: "It connects the idea to cause.",
        },
        {
          type: "how",
          question: "How does gravity affect motion?",
          rationale: "It explores the mechanism.",
        },
      ],
    })

    const toast = vi.fn()
    const { result } = renderHook(() => useWhyHowQuestions())

    act(() => {
      result.current.setSourceText("Gravity matters for motion and orbit.")
    })

    await act(async () => {
      await result.current.generate(toast)
    })

    await act(async () => {
      await result.current.copyAll(toast)
    })

    expect(writeText).toHaveBeenCalledWith(
      [
        "1. Why does gravity matter?\nIt connects the idea to cause.",
        "2. How does gravity affect motion?\nIt explores the mechanism.",
      ].join("\n\n")
    )
    expect(toast).toHaveBeenCalledWith("Copied questions")
  })
})
