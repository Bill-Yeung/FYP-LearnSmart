import { useCallback, useMemo, useState } from "react"
import { apiClient } from "../lib/api"
import { useComprehensionHistory, type ComprehensionHistoryRecord } from "./useComprehensionHistory"

export type SocraticDifficulty = "guided" | "standard" | "challenge"
export type SocraticAction = "follow-up" | "hint" | "feedback" | "wrap-up"

export type DialogueRole = "assistant" | "user"

export type DialogueMessage = {
  id: string
  role: DialogueRole
  text: string
  createdAt: number
  tag?: "question" | "hint" | "feedback" | "wrapup" | "system"
}

export type SocraticDialogueSnapshot = {
  concept: string
  goal: string
  context: string
  difficulty: SocraticDifficulty
  messages: DialogueMessage[]
}

type SocraticRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function hasMeaningfulDialogue(snapshot: SocraticDialogueSnapshot) {
  return Boolean(
    snapshot.concept.trim() ||
    snapshot.goal.trim() ||
    snapshot.context.trim() ||
    snapshot.messages.some((message) => message.role === "user")
  )
}

function createIntroMessage(): DialogueMessage {
  return {
    id: uid(),
    role: "assistant",
    tag: "system",
    createdAt: Date.now(),
    text:
      "Write your explanation in the chat, then use hints, feedback, or wrap-up to keep the discussion moving."
  }
}

export function useSocraticDialogue() {
  const [concept, setConcept] = useState("")
  const [goal, setGoal] = useState("")
  const [context, setContext] = useState("")
  const [difficulty, setDifficulty] = useState<SocraticDifficulty>("standard")
  const [messages, setMessages] = useState<DialogueMessage[]>([createIntroMessage()])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const userTurns = useMemo(
    () => messages.filter((message) => message.role === "user").map((message) => message.text),
    [messages]
  )

  const snapshot = useMemo<SocraticDialogueSnapshot>(
    () => ({
      concept,
      goal,
      context,
      difficulty,
      messages
    }),
    [concept, context, difficulty, goal, messages]
  )

  const getTitle = useCallback((item: SocraticDialogueSnapshot) => (
    item.concept.trim() || "Untitled Socratic dialogue"
  ), [])

  const getPreview = useCallback((item: SocraticDialogueSnapshot) => {
    const lastMessage = [...item.messages].reverse().find((message) => message.text.trim())
    return lastMessage?.text.trim() || item.goal.trim() || item.context.trim() || "No chat text stored yet"
  }, [])

  const getMeta = useCallback((item: SocraticDialogueSnapshot) => {
    const userTurnCount = item.messages.filter((message) => message.role === "user").length
    const assistantTurnCount = item.messages.filter((message) => message.role === "assistant").length
    return [
      item.difficulty,
      `${userTurnCount} user turns`,
      `${assistantTurnCount} tutor turns`
    ]
  }, [])

  const {
    storedItems,
    markRestoredSession,
    startNewSession,
    removeSavedItem: removeConversation,
    clearSavedItems: clearConversations
  } = useComprehensionHistory<SocraticDialogueSnapshot>({
    moduleKey: "socratic-dialogue",
    payload: snapshot,
    shouldStore: hasMeaningfulDialogue,
    getTitle,
    getPreview,
    getMeta
  })

  // ask the backend for the next assistant turn (hint/feedback/follow-up/wrap-up)
  const getAssistantMessage = async (
    action: SocraticAction,
    source?: SocraticRequestContext,
    nextMessages?: DialogueMessage[]
  ) => {
    const data = await apiClient.post<{ assistant_message?: string }>(
      "/api/comprehension/dialogue/respond",
      {
        action,
        concept: concept.trim(),
        goal: goal.trim(),
        context: context.trim(),
        difficulty,
        messages: (nextMessages ?? messages).map((message) => ({
          role: message.role,
          tag: message.tag,
          text: message.text
        })),
        source
      }
    )
    return data?.assistant_message?.trim() || ""
  }

  // user submits their answer, then we fetch the ai's follow-up question
  const send = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    const trimmed = draft.trim()
    if (!trimmed) return

    const nextMessages: DialogueMessage[] = [
      ...messages,
      { id: uid(), role: "user", tag: "question", createdAt: Date.now(), text: trimmed }
    ]

    setMessages(nextMessages)
    setDraft("")
    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("follow-up", source, nextMessages)
      if (!assistantMessage) {
        throw new Error("AI did not return a follow-up question")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "question", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Generated next Socratic turn")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate the next turn")
    } finally {
      setIsLoading(false)
    }
  }

  // ask the ai for a hint and append it to the chat
  const addHint = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("hint", source)
      if (!assistantMessage) {
        throw new Error("AI did not return a hint")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "hint", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Hint generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate a hint")
    } finally {
      setIsLoading(false)
    }
  }

  // ask the ai for feedback on what the user has said so far
  const addFeedback = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    if (userTurns.length === 0) {
      onToast("Write at least one answer first")
      return
    }

    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("feedback", source)
      if (!assistantMessage) {
        throw new Error("AI did not return feedback")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "feedback", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Feedback generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate feedback")
    } finally {
      setIsLoading(false)
    }
  }

  // ask the ai to summarise/close the dialogue
  const wrapUp = async (onToast: (m: string) => void, source?: SocraticRequestContext) => {
    if (userTurns.length === 0) {
      onToast("Write at least one answer first")
      return
    }

    setIsLoading(true)
    try {
      const assistantMessage = await getAssistantMessage("wrap-up", source)
      if (!assistantMessage) {
        throw new Error("AI did not return a wrap-up")
      }
      setMessages((current) => [
        ...current,
        { id: uid(), role: "assistant", tag: "wrapup", createdAt: Date.now(), text: assistantMessage }
      ])
      onToast("Wrap-up generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate a wrap-up")
    } finally {
      setIsLoading(false)
    }
  }

  const clear = (onToast: (m: string) => void) => {
    startNewSession()
    setConcept("")
    setGoal("")
    setContext("")
    setDifficulty("standard")
    setMessages([createIntroMessage()])
    setDraft("")
    setIsLoading(false)
    onToast("Cleared")
  }

  const restoreConversation = (
    conversation: ComprehensionHistoryRecord<SocraticDialogueSnapshot>,
    onToast: (m: string) => void
  ) => {
    markRestoredSession(conversation.sessionId)
    const snapshot = conversation.payload
    setConcept(snapshot.concept)
    setGoal(snapshot.goal)
    setContext(snapshot.context)
    setDifficulty(snapshot.difficulty)
    setMessages(snapshot.messages.length ? snapshot.messages : [createIntroMessage()])
    setDraft("")
    setIsLoading(false)
    onToast("Restored stored conversation")
  }

  return {
    concept, setConcept,
    goal, setGoal,
    context, setContext,
    difficulty, setDifficulty,
    isLoading,
    messages,
    draft, setDraft,
    send,
    addHint,
    addFeedback,
    wrapUp,
    clear,
    storedConversations: storedItems,
    restoreConversation,
    removeConversation,
    clearConversations
  }
}
