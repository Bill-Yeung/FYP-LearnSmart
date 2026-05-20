import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSocraticDialogue } from "../../../hooks/useSocraticDialogue"
import { callAiJson, callAiText } from "../../../lib/aiCall"

vi.mock("../../../lib/aiCall", () => ({
  callAiJson: vi.fn(),
  callAiText: vi.fn(),
}))

describe("useSocraticDialogue", () => {
  const mockedCallAiJson = vi.mocked(callAiJson)
  const mockedCallAiText = vi.mocked(callAiText)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts with a system guide message", () => {
    const { result } = renderHook(() => useSocraticDialogue())

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({
      role: "assistant",
      tag: "system",
    })
  })

  it("appends a user turn and assistant follow-up when sending a response", async () => {
    mockedCallAiJson.mockResolvedValue({
      assistant_message: "What causes the concentration difference?",
    })

    const toast = vi.fn()
    const { result } = renderHook(() => useSocraticDialogue())

    act(() => {
      result.current.setConcept("Osmosis")
      result.current.setDraft("Water moves across a membrane.")
    })

    await act(async () => {
      await result.current.send(toast, { subjectName: "Biology" })
    })

    expect(result.current.messages).toHaveLength(3)
    expect(result.current.messages[1]).toMatchObject({
      role: "user",
      tag: "question",
      text: "Water moves across a membrane.",
    })
    expect(result.current.messages[2]).toMatchObject({
      role: "assistant",
      tag: "question",
      text: "What causes the concentration difference?",
    })
    expect(result.current.draft).toBe("")
    expect(toast).toHaveBeenCalledWith("Generated next Socratic turn")
  })

  it("requires a learner answer before generating feedback", async () => {
    const toast = vi.fn()
    const { result } = renderHook(() => useSocraticDialogue())

    await act(async () => {
      await result.current.addFeedback(toast)
    })

    expect(mockedCallAiJson).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith("Write at least one answer first")
  })

  it("falls back to plain text AI output when JSON parsing fails", async () => {
    mockedCallAiJson.mockRejectedValue(new Error("Invalid JSON"))
    mockedCallAiText.mockResolvedValue("Try defining entropy in one sentence.")

    const toast = vi.fn()
    const { result } = renderHook(() => useSocraticDialogue())

    await act(async () => {
      await result.current.addHint(toast)
    })

    expect(mockedCallAiJson).toHaveBeenCalledTimes(1)
    expect(mockedCallAiText).toHaveBeenCalledTimes(1)
    expect(result.current.messages.at(-1)).toMatchObject({
      role: "assistant",
      tag: "hint",
      text: "Try defining entropy in one sentence.",
    })
    expect(toast).toHaveBeenCalledWith("Hint generated")
  })
})
