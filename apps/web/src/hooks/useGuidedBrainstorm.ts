import { useCallback, useMemo, useState } from "react"
import { apiClient } from "../lib/api"
import { useComprehensionHistory, type ComprehensionHistoryRecord } from "./useComprehensionHistory"

export type BrainstormSection = "who" | "what" | "why" | "how"

export type BrainstormState = {
  topic: string
  context: string
  active: BrainstormSection
  who: { response: string; bullets: string[] }
  what: { response: string; bullets: string[] }
  why: { response: string; bullets: string[] }
  how: { response: string; bullets: string[] }
}

export type GuidedBrainstormSnapshot = {
  state: BrainstormState
  structuredNotes: string
}

type StructuredSection = {
  heading?: string
  content?: string
  bullets?: string[]
}

type BrainstormRequestContext = {
  subjectName?: string
  documentId?: string
  documentName?: string
  documentConcepts?: string[]
}

const DEFAULT_STATE: BrainstormState = {
  topic: "",
  context: "",
  active: "what",
  who: { response: "", bullets: [] },
  what: { response: "", bullets: [] },
  why: { response: "", bullets: [] },
  how: { response: "", bullets: [] }
}

// build a markdown document from the four brainstorm sections
function buildMarkdown(state: BrainstormState) {
  const title = state.topic.trim() || "Brainstorm Notes"
  const ctx = state.context.trim()

  const section = (label: string, content: { response: string; bullets: string[] }) => {
    const lines: string[] = []
    lines.push(`## ${label}`)
    if (content.response.trim()) lines.push(content.response.trim())
    if (content.bullets.length) {
      lines.push("")
      for (const bullet of content.bullets) {
        lines.push(`- ${bullet}`)
      }
    }
    return lines.join("\n")
  }

  return [
    `# ${title}`,
    ctx ? `**Context:** ${ctx}` : "",
    section("Who", state.who),
    section("What", state.what),
    section("Why", state.why),
    section("How", state.how)
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function useGuidedBrainstorm() {
  const [state, setState] = useState<BrainstormState>(DEFAULT_STATE)
  const [isLoading, setIsLoading] = useState(false)
  const [structuredNotes, setStructuredNotes] = useState("")

  const prompts = useMemo(() => {
    return {
      who: [
        "Who is involved (people, roles, stakeholders)?",
        "Who benefits or is impacted most?",
        "Who decides success or failure?",
        "Who might disagree, and why?"
      ],
      what: [
        "What is the core idea in one sentence?",
        "What are the key parts / components?",
        "What examples make it concrete?",
        "What common mistakes happen here?"
      ],
      why: [
        "Why does this matter (purpose, value)?",
        "Why does it work (cause -> effect)?",
        "Why might it fail (assumptions, limits)?",
        "Why is this approach chosen over alternatives?"
      ],
      how: [
        "How does it work step-by-step?",
        "How do you verify correctness?",
        "How do you apply it in your context?",
        "How do you debug when it goes wrong?"
      ]
    } as const
  }, [])

  const setTopic = (topic: string) => setState((current) => ({ ...current, topic }))
  const setContext = (context: string) => setState((current) => ({ ...current, context }))
  const setActive = (active: BrainstormSection) => setState((current) => ({ ...current, active }))

  const setResponse = (section: BrainstormSection, response: string) => {
    setState((current) => ({ ...current, [section]: { ...current[section], response } }))
  }

  const addBullet = (section: BrainstormSection, bullet: string) => {
    const trimmed = bullet.trim()
    if (!trimmed) return
    setState((current) => ({
      ...current,
      [section]: { ...current[section], bullets: [...current[section].bullets, trimmed] }
    }))
  }

  const removeBullet = (section: BrainstormSection, index: number) => {
    setState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        bullets: current[section].bullets.filter((_, bulletIndex) => bulletIndex !== index)
      }
    }))
  }

  const moveBullet = (section: BrainstormSection, index: number, dir: -1 | 1) => {
    setState((current) => {
      const bullets = [...current[section].bullets]
      const nextIndex = index + dir
      if (nextIndex < 0 || nextIndex >= bullets.length) return current
      const currentValue = bullets[index]
      bullets[index] = bullets[nextIndex]
      bullets[nextIndex] = currentValue
      return { ...current, [section]: { ...current[section], bullets } }
    })
  }

  const reset = () => {
    startNewSession()
    setState(DEFAULT_STATE)
    setStructuredNotes("")
  }

  const markdown = useMemo(() => buildMarkdown(state), [state])

  const snapshot = useMemo<GuidedBrainstormSnapshot>(
    () => ({ state, structuredNotes }),
    [state, structuredNotes]
  )

  const shouldStore = useCallback((item: GuidedBrainstormSnapshot) => (
    Boolean(
      item.state.topic.trim() ||
      item.state.context.trim() ||
      item.structuredNotes.trim() ||
      item.state.who.response.trim() ||
      item.state.what.response.trim() ||
      item.state.why.response.trim() ||
      item.state.how.response.trim() ||
      item.state.who.bullets.length ||
      item.state.what.bullets.length ||
      item.state.why.bullets.length ||
      item.state.how.bullets.length
    )
  ), [])

  const getTitle = useCallback((item: GuidedBrainstormSnapshot) => (
    item.state.topic.trim() || "Untitled brainstorm"
  ), [])

  const getPreview = useCallback((item: GuidedBrainstormSnapshot) => (
    item.structuredNotes.trim() ||
    buildMarkdown(item.state).replace(/\s+/g, " ").trim() ||
    "No brainstorm notes saved yet"
  ), [])

  const getMeta = useCallback((item: GuidedBrainstormSnapshot) => {
    const bulletCount =
      item.state.who.bullets.length +
      item.state.what.bullets.length +
      item.state.why.bullets.length +
      item.state.how.bullets.length

    return [
      `Active: ${item.state.active}`,
      `${bulletCount} bullets`,
      item.structuredNotes.trim() ? "Structured notes ready" : "Draft saved"
    ]
  }, [])

  const {
    storedItems: storedBrainstorms,
    markRestoredSession,
    startNewSession,
    removeSavedItem: removeBrainstorm,
    clearSavedItems: clearBrainstorms
  } = useComprehensionHistory<GuidedBrainstormSnapshot>({
    moduleKey: "guided-brainstorm",
    payload: snapshot,
    shouldStore,
    getTitle,
    getPreview,
    getMeta
  })

  const restoreBrainstorm = (
    item: ComprehensionHistoryRecord<GuidedBrainstormSnapshot>,
    onToast: (m: string) => void
  ) => {
    markRestoredSession(item.sessionId)
    setState(item.payload.state)
    setStructuredNotes(item.payload.structuredNotes)
    setIsLoading(false)
    onToast("Restored saved brainstorm")
  }

  // ask the server to turn the user's notes into a structured markdown document
  const generateStructuredNotes = async (
    onToast: (m: string) => void,
    context?: BrainstormRequestContext
  ) => {
    if (!state.topic.trim() && !state.context.trim()) {
      onToast("Add a topic or context first")
      return
    }

    setIsLoading(true)
    try {
      const data = await apiClient.post<{
        title?: string
        summary?: string
        sections?: StructuredSection[]
        next_steps?: string[]
      }>("/api/comprehension/brainstorm/structure", {
        topic: state.topic,
        context: state.context,
        active: state.active,
        markdown,
        source: context
      })
      const generated = [
        data?.title ? `# ${data.title}` : "",
        data?.summary ? data.summary.trim() : "",
        ...(data?.sections ?? []).flatMap((section) => {
          const heading = section.heading?.trim()
          const content = section.content?.trim()
          const bullets = Array.isArray(section.bullets) ? section.bullets.filter(Boolean) : []
          return [
            heading ? `## ${heading}` : "",
            content || "",
            ...bullets.map((bullet) => `- ${bullet}`)
          ].filter(Boolean)
        }),
        ...(Array.isArray(data?.next_steps) && data.next_steps.length
          ? ["## Next steps", ...data.next_steps.map((step) => `- ${step}`)]
          : [])
      ]
        .filter(Boolean)
        .join("\n\n")

      if (!generated.trim()) {
        throw new Error("AI did not return structured notes")
      }

      setStructuredNotes(generated)
      onToast("Structured notes generated")
    } catch (error) {
      console.error(error)
      onToast(error instanceof Error ? error.message : "Could not generate structured notes")
    } finally {
      setIsLoading(false)
    }
  }

  const copyMarkdown = async (onToast: (m: string) => void) => {
    await navigator.clipboard.writeText(markdown)
    onToast("Copied notes")
  }

  const copyStructuredNotes = async (onToast: (m: string) => void) => {
    if (!structuredNotes.trim()) return
    await navigator.clipboard.writeText(structuredNotes)
    onToast("Copied structured notes")
  }

  return {
    state,
    prompts,
    isLoading,
    structuredNotes,
    setTopic,
    setContext,
    setActive,
    setResponse,
    addBullet,
    removeBullet,
    moveBullet,
    reset,
    storedBrainstorms,
    restoreBrainstorm,
    removeBrainstorm,
    clearBrainstorms,
    markdown,
    generateStructuredNotes,
    copyMarkdown,
    copyStructuredNotes
  }
}
