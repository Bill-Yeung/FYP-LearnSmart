import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { AiGenerationNotice } from "../ui/AiGenerationNotice"
import { ConceptSelector } from "../form/ConceptSelector"
import { ComprehensionSourcePicker } from "./ComprehensionSourcePicker"
import { ComprehensionHistoryPanel } from "./ComprehensionHistoryPanel"
import { useComprehensionWorkspace } from "../../hooks/useComprehensionWorkspace"
import { useAnalogiesMetaphors, type AnalogyDomain, type AudienceLevel, type OutputLanguage, type OutputStyle } from "../../hooks/useAnalogiesMetaphors"

type Props = { onToast: (m: string) => void }

const DOMAIN_OPTIONS: { value: AnalogyDomain; label: string; hint: string }[] = [
  { value: "everyday", label: "Everyday", hint: "Toolbox, daily routines, common experiences" },
  { value: "cooking", label: "Cooking", hint: "Recipes, ingredients, steps, outcomes" },
  { value: "sports", label: "Sports", hint: "Training, drills, coaching, feedback" },
  { value: "travel", label: "Travel", hint: "Routes, checkpoints, detours, constraints" },
  { value: "music", label: "Music", hint: "Rhythm, patterns, variations, breaks" },
  { value: "nature", label: "Nature", hint: "Rivers, flows, bottlenecks, tributaries" },
  { value: "tech", label: "Tech", hint: "Pipelines, stages, debugging, propagation" },
  { value: "money", label: "Money", hint: "Budgets, priorities, trade-offs, hidden costs" }
]

const STYLE_OPTIONS: { value: OutputStyle; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "analogy", label: "Analogy" },
  { value: "metaphor", label: "Metaphor" }
]

const AUDIENCE_OPTIONS: { value: AudienceLevel; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "Short and concrete" },
  { value: "intermediate", label: "Intermediate", hint: "Balanced detail" },
  { value: "advanced", label: "Advanced", hint: "Trade-offs and failure modes" }
]

const LANG_OPTIONS: { value: OutputLanguage; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "english", label: "English" },
  { value: "chinese", label: "Chinese" }
]

export function AnalogiesMetaphors({ onToast }: Props) {
  const {
    concept, setConcept,
    context, setContext,
    domain, setDomain,
    audience, setAudience,
    style, setStyle,
    language, setLanguage,
    isLoading,
    results,
    showResults, setShowResults,
    generate,
    reset,
    storedExplanations,
    restoreExplanation,
    removeExplanation,
    clearExplanations,
    copy,
    copyAll
  } = useAnalogiesMetaphors()

  const workspace = useComprehensionWorkspace()

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
        title="Analogies & Metaphors"
        subtitle="Explain your concept with a domain and audience you choose."
        rightSlot={
          showResults && results.length > 0 ? (
            <Button variant="ghost" onClick={() => copyAll(onToast)}>Copy all</Button>
          ) : null
        }
      >
        <div className="space-y-5">
        {isLoading && (
          <AiGenerationNotice
            title="Framing a clearer explanation"
            description="The page is building an explanation that matches your chosen audience, domain, and language."
          />
        )}
        {!showResults && (
          <div className="space-y-4">
            <ComprehensionSourcePicker
              workspace={workspace}
              onUseConcept={setConcept}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <ConceptSelector
                label="Concept"
                value={concept}
                onChange={setConcept}
                placeholder="e.g., entropy, recursion, opportunity cost..."
                extraConcepts={workspace.documentConceptLabels}
              />

              <label className="block">
                <span className="text-xs text-gray-600 dark:text-gray-400">Domain</span>
                <select
                  value={domain}
                  onChange={(event) => setDomain(event.target.value as AnalogyDomain)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                >
                  {DOMAIN_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                  {DOMAIN_OPTIONS.find((item) => item.value === domain)?.hint}
                </span>
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-gray-600 dark:text-gray-400">Context (optional)</span>
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Add a sentence or paragraph so the analogy matches your use case."
                rows={5}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Output</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStyle(option.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        style === option.value
                          ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Audience</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {AUDIENCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAudience(option.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        audience === option.value
                          ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700"
                      }`}
                      title={option.hint}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {AUDIENCE_OPTIONS.find((item) => item.value === audience)?.hint}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Language</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {LANG_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLanguage(option.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        language === option.value
                          ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generate(onToast, sourceContext)} disabled={isLoading || !concept.trim()} className="w-full sm:w-auto">
                {isLoading ? "Preparing..." : "Generate explanation"}
              </Button>
              <Button variant="secondary" onClick={handleReset} disabled={isLoading} className="w-full sm:w-auto">
                Clear
              </Button>
            </div>
          </div>
        )}

        {showResults && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Explanation set</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Domain: {DOMAIN_OPTIONS.find((item) => item.value === domain)?.label} • Audience: {AUDIENCE_OPTIONS.find((item) => item.value === audience)?.label}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setShowResults(false)} className="w-full sm:w-auto">Edit</Button>
                <Button onClick={() => generate(onToast, sourceContext)} disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? "Preparing..." : "Regenerate"}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.title}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {result.kind} • {result.audience} • {result.language}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => copy(result.id, onToast)}>Copy</Button>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {result.text}
                  </p>

                  {result.mapping.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        Mapping
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {result.mapping.map((pair, index) => (
                          <div
                            key={`${result.id}-pair-${index}`}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300"
                          >
                            <span className="font-medium text-gray-900 dark:text-gray-100">{pair.left}</span>
                            {" -> "}
                            <span>{pair.right}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.notes.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        Notes
                      </p>
                      <ul className="mt-2 space-y-2">
                        {result.notes.map((note, index) => (
                          <li
                            key={`${result.id}-note-${index}`}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300"
                          >
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button variant="secondary" onClick={handleReset} className="w-full sm:w-auto">Start over</Button>
            </div>
          </div>
        )}
        </div>
      </Card>

      <ComprehensionHistoryPanel
        items={storedExplanations}
        emptyText="Enter a concept or generate explanations to save them here."
        onRestore={(item) => restoreExplanation(item, onToast)}
        onRemove={(id) => void removeExplanation(id)}
        onClearAll={() => void clearExplanations()}
      />
    </div>
  )
}
