import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { AiGenerationNotice } from "../ui/AiGenerationNotice"
import { TextField } from "../form/TextField"
import { ConceptSelector } from "../form/ConceptSelector"
import { ComprehensionSourcePicker } from "./ComprehensionSourcePicker"
import { ComprehensionHistoryPanel } from "./ComprehensionHistoryPanel"
import { useComprehensionWorkspace } from "../../hooks/useComprehensionWorkspace"
import {
  useSocraticDialogue,
  type DialogueMessage,
  type SocraticDifficulty
} from "../../hooks/useSocraticDialogue"

type Props = { onToast: (m: string) => void }

function TagPill({ tag }: { tag?: DialogueMessage["tag"] }) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
  switch (tag) {
    case "hint":
      return <span className={`${base} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200`}>Hint</span>
    case "feedback":
      return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200`}>Feedback</span>
    case "wrapup":
      return <span className={`${base} border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/40 dark:bg-purple-900/20 dark:text-purple-200`}>Wrap-up</span>
    case "system":
      return <span className={`${base} border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300`}>Guide</span>
    default:
      return <span className={`${base} border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200`}>User turn</span>
  }
}

function Bubble({ message }: { message: DialogueMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "max-w-[88%] rounded-2xl border px-4 py-3 text-sm shadow-sm whitespace-pre-wrap " +
          (isUser
            ? "border-gray-200 bg-gray-900 text-white dark:border-gray-800 dark:bg-gray-100 dark:text-gray-900"
            : "border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100")
        }
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <TagPill tag={message.tag} />
          <span className="text-[11px] opacity-70">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div>{message.text}</div>
      </div>
    </div>
  )
}

export function SocraticDialogue({ onToast }: Props) {
  const {
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
    storedConversations,
    restoreConversation,
    removeConversation,
    clearConversations
  } = useSocraticDialogue()

  const workspace = useComprehensionWorkspace()

  const sourceContext = {
    subjectName: workspace.subjects.find((subject) => subject.id === workspace.selectedSubjectId)?.name,
    documentId: workspace.selectedDocument?.id,
    documentName: workspace.selectedDocument?.document_name,
    documentConcepts: workspace.documentConceptLabels
  }

  const difficultyOptions: { value: SocraticDifficulty; label: string; hint: string }[] = [
    { value: "guided", label: "Guided", hint: "Definitions and causal links first" },
    { value: "standard", label: "Standard", hint: "Mechanism, evidence, boundaries" },
    { value: "challenge", label: "Challenge", hint: "Assumptions, alternatives, stress tests" },
  ]

  return (
    <div className="space-y-4">
      {isLoading && (
        <AiGenerationNotice
          title="Continuing the conversation"
          description="The tutor is reading the dialogue so far and preparing the next reply."
          steps={["Reviewing the conversation", "Choosing the next prompt", "Writing a helpful response"]}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
        <Card
          title="Socratic Dialogue"
          subtitle="Capture your explanation and continue with guided tutoring responses."
          rightSlot={
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" onClick={() => clear(onToast)} className="w-full sm:w-auto">Clear</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <ComprehensionSourcePicker
              workspace={workspace}
              onUseConcept={setConcept}
            />

            <div className="max-h-[52vh] overflow-y-auto space-y-3 rounded-2xl border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
              {messages.map((message) => <Bubble key={message.id} message={message} />)}
            </div>

            <label className="block">
              <span className="text-xs text-gray-600 dark:text-gray-400">Your response</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                placeholder="Write your explanation or your next answer here..."
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => send(onToast, sourceContext)} disabled={isLoading || !draft.trim()} className="w-full sm:w-auto">
                {isLoading ? "Preparing..." : "Send response"}
              </Button>
              <Button variant="secondary" onClick={() => addHint(onToast, sourceContext)} disabled={isLoading} className="w-full sm:w-auto">
                Hint
              </Button>
              <Button variant="secondary" onClick={() => addFeedback(onToast, sourceContext)} disabled={isLoading} className="w-full sm:w-auto">
                Feedback
              </Button>
              <Button variant="secondary" onClick={() => wrapUp(onToast, sourceContext)} disabled={isLoading} className="w-full sm:w-auto">
                Wrap-up
              </Button>
            </div>
          </div>
        </Card>
        </div>

        <div className="space-y-4">
        <Card title="Session Setup" subtitle="Set the target concept and constraints for the dialogue.">
          <div className="space-y-4">
            <ConceptSelector
              label="Concept"
              value={concept}
              onChange={setConcept}
              placeholder="e.g., entropy, recursion, opportunity cost..."
              hint="Used to focus the next Socratic turn."
              extraConcepts={workspace.documentConceptLabels}
            />

            <TextField
              label="Goal (optional)"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="e.g., explain the mechanism clearly in 3 steps"
              hint="Used to steer feedback and wrap-up."
            />

            <label className="block">
              <span className="text-xs text-gray-600 dark:text-gray-400">Context (optional)</span>
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                rows={6}
                placeholder="Paste notes or a short excerpt you want the dialogue to reference..."
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
            </label>

            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Difficulty</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {difficultyOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDifficulty(option.value)}
                    className={
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors " +
                      (difficulty === option.value
                        ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                        : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700")
                    }
                    title={option.hint}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {difficultyOptions.find((item) => item.value === difficulty)?.hint}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
              {isLoading
                ? "The tutor is preparing the next response."
                : "Use hints, feedback, and wrap-up whenever you want more guidance from the current conversation."}
            </div>
          </div>
        </Card>
      </div>
    </div>

      <ComprehensionHistoryPanel
        items={storedConversations}
        emptyText="Send a response or enter a concept to save this conversation."
        onRestore={(item) => restoreConversation(item, onToast)}
        onRemove={(id) => void removeConversation(id)}
        onClearAll={() => void clearConversations()}
      />
    </div>
  )
}
