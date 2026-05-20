import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { ComprehensionSourcePicker } from "./ComprehensionSourcePicker"
import { ComprehensionHistoryPanel } from "./ComprehensionHistoryPanel"
import { useComprehensionWorkspace } from "../../hooks/useComprehensionWorkspace"
import { useSimplifyPassage, type RewriteLanguage, type RewriteLevel } from "../../hooks/useSimplifyPassage"

type Props = {
  onToast: (message: string) => void
}

const LEVELS: { value: RewriteLevel; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Minor edits, keep structure" },
  { value: "standard", label: "Standard", hint: "Shorter sentences, simpler words" },
  { value: "strong", label: "Strong", hint: "Most simplified, very direct" }
]

const LANGS: { value: RewriteLanguage; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "english", label: "English" },
  { value: "chinese", label: "Chinese" }
]

export function SimplifyPassage({ onToast }: Props) {
  const {
    passage,
    setPassage,
    language,
    setLanguage,
    level,
    setLevel,
    isLoading,
    result,
    showResults,
    setShowResults,
    rewrite,
    reset,
    storedRewrites,
    restoreRewrite,
    removeRewrite,
    clearRewrites,
    copy
  } = useSimplifyPassage()

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
        title="Simplify Passages"
        subtitle="Rewrite a passage with optional linked document context."
      >
        <div className="space-y-4">
        {!showResults && (
          <div className="space-y-3">
            <ComprehensionSourcePicker workspace={workspace} />

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Passage
              </label>
              <textarea
                value={passage}
                onChange={(event) => setPassage(event.target.value)}
                placeholder="Paste the passage you want to simplify."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                rows={8}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Language
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {LANGS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setLanguage(item.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        language === item.value
                          ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Simplification strength
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {LEVELS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLevel(option.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        level === option.value
                          ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                      }`}
                      title={option.hint}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {LEVELS.find((item) => item.value === level)?.hint}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => rewrite(onToast, sourceContext)}
                disabled={isLoading || !passage.trim()}
                className="w-full sm:w-auto"
              >
                {isLoading ? "Simplifying..." : "Simplify passage"}
              </Button>
              {passage.trim() && (
                <Button variant="secondary" onClick={handleReset} className="w-full sm:w-auto">
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {showResults && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                    Simplified Result
                  </p>
                  <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                    {result?.language === "chinese" ? "Chinese" : "English"} rewrite ready
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setShowResults(false)} className="w-full sm:w-auto">Edit</Button>
                  <Button variant="ghost" onClick={() => copy("simplified", onToast)} className="w-full sm:w-auto">Copy simplified</Button>
                  <Button variant="ghost" onClick={() => copy("both", onToast)} className="w-full sm:w-auto">Copy both</Button>
                  <Button variant="ghost" onClick={handleReset} className="w-full sm:w-auto">Start over</Button>
                </div>
              </div>
            </div>

            {result && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Original passage</p>
                    <Button variant="ghost" onClick={() => copy("original", onToast)}>Copy</Button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {result.original}
                  </p>
                </div>

                <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Simplified passage</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Level: {result.level} • Language: {result.language}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => copy("simplified", onToast)}>Copy</Button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {result.simplified}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </Card>

      <ComprehensionHistoryPanel
        items={storedRewrites}
        emptyText="Paste a passage or generate a rewrite to save it here."
        onRestore={(item) => restoreRewrite(item, onToast)}
        onRemove={(id) => void removeRewrite(id)}
        onClearAll={() => void clearRewrites()}
      />
    </div>
  )
}
