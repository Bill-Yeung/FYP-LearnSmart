import { useMemo, useState } from "react"
import { AiGenerationNotice } from "../ui/AiGenerationNotice"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { TextField } from "../form/TextField"
import { ConceptSelector } from "../form/ConceptSelector"
import { ComprehensionSourcePicker } from "./ComprehensionSourcePicker"
import { ComprehensionHistoryPanel } from "./ComprehensionHistoryPanel"
import { useComprehensionWorkspace } from "../../hooks/useComprehensionWorkspace"
import { useGuidedBrainstorm, type BrainstormSection } from "../../hooks/useGuidedBrainstorm"

type Props = { onToast: (m: string) => void }

const SECTIONS: { key: BrainstormSection; label: string; hint: string }[] = [
  { key: "who", label: "Who", hint: "People, roles, stakeholders" },
  { key: "what", label: "What", hint: "Core idea, parts, examples" },
  { key: "why", label: "Why", hint: "Purpose, cause, limits" },
  { key: "how", label: "How", hint: "Process, verification, application" }
]

export function GuidedBrainstorm({ onToast }: Props) {
  const {
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
  } = useGuidedBrainstorm()

  const workspace = useComprehensionWorkspace()
  const active = state.active
  const activePrompts = prompts[active]
  const sectionState = state[active]

  const [bulletDraft, setBulletDraft] = useState("")

  const addDraft = () => {
    addBullet(active, bulletDraft)
    setBulletDraft("")
  }

  const sectionLabel = useMemo(() => SECTIONS.find((section) => section.key === active)?.label ?? "What", [active])

  const sourceContext = {
    subjectName: workspace.subjects.find((subject) => subject.id === workspace.selectedSubjectId)?.name,
    documentId: workspace.selectedDocument?.id,
    documentName: workspace.selectedDocument?.document_name,
    documentConcepts: workspace.documentConceptLabels
  }

  const handleReset = () => {
    workspace.setSelectedSubjectId("")
    workspace.setSelectedDocumentId("")
    reset()
  }

  return (
    <div className="space-y-4">
      <Card
        title="Guided Brainstorming"
        subtitle="Build notes manually, then turn them into structured study notes."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => copyMarkdown(onToast)} className="w-full sm:w-auto">Copy notes</Button>
            <Button variant="secondary" onClick={handleReset} className="w-full sm:w-auto">Reset</Button>
          </div>
        }
      >
        <div className="space-y-5">
        {isLoading && (
          <AiGenerationNotice
            title="Organising your notes"
            description="The page is turning your brainstorm into a cleaner study outline while keeping your own ideas intact."
          />
        )}
        <ComprehensionSourcePicker
          workspace={workspace}
          onUseConcept={setTopic}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <ConceptSelector
            label="Topic"
            value={state.topic}
            onChange={setTopic}
            placeholder="e.g., Backpropagation, Hash tables, Supply and demand..."
            extraConcepts={workspace.documentConceptLabels}
          />
          <TextField
            label="Context (optional)"
            placeholder="e.g., For exam revision, project work, or peer teaching..."
            value={state.context}
            onChange={(event) => setContext(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setActive(section.key)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                active === section.key
                  ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                  : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700"
              }`}
              title={section.hint}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sectionLabel} prompts</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Pick a prompt and answer in your own words.</p>
                </div>
                <Button
                  onClick={() => generateStructuredNotes(onToast, sourceContext)}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? "Preparing..." : "Generate structured notes"}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {activePrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() =>
                      setResponse(active, `${sectionState.response ? `${sectionState.response}\n\n` : ""}${prompt}\n`)
                    }
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:border-gray-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs text-gray-600 dark:text-gray-400">{sectionLabel} response</span>
              <textarea
                value={sectionState.response}
                onChange={(event) => setResponse(active, event.target.value)}
                rows={7}
                placeholder={`Write your ${sectionLabel.toLowerCase()} explanation here...`}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
            </label>

            <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Key bullets</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Capture your strongest points as short bullets.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={bulletDraft}
                  onChange={(event) => setBulletDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addDraft()
                    }
                  }}
                  placeholder="Add a bullet..."
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                />
                <Button onClick={addDraft} disabled={!bulletDraft.trim()} className="w-full sm:w-auto">Add</Button>
              </div>

              <div className="mt-3 space-y-2">
                {sectionState.bullets.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No bullets yet.</p>
                )}

                {sectionState.bullets.map((bullet, index) => (
                  <div key={`${index}-${bullet}`} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{bullet}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => moveBullet(active, index, -1)}>Up</Button>
                      <Button variant="ghost" onClick={() => moveBullet(active, index, 1)}>Down</Button>
                      <Button variant="ghost" onClick={() => removeBullet(active, index)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your brainstorm draft</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">This stays editable and reflects your own notes.</p>

              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-200">
{markdown}
              </pre>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Structured notes</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Generated from your current draft and linked study context.
                  </p>
                </div>
                {structuredNotes && (
                  <Button variant="ghost" onClick={() => copyStructuredNotes(onToast)} className="w-full sm:w-auto">Copy structured notes</Button>
                )}
              </div>

              {structuredNotes ? (
                <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-100">
{structuredNotes}
                </pre>
              ) : (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Generate structured notes when you want the current brainstorm tightened into a study-ready outline.
                </p>
              )}
            </div>
          </div>
        </div>
        </div>
      </Card>

      <ComprehensionHistoryPanel
        items={storedBrainstorms}
        emptyText="Add a topic, notes, or structured output to save this brainstorm."
        onRestore={(item) => restoreBrainstorm(item, onToast)}
        onRemove={(id) => void removeBrainstorm(id)}
        onClearAll={() => void clearBrainstorms()}
      />
    </div>
  )
}
