import React, { useState, useEffect } from "react"
import { Button, Card } from ".."
import { TOKEN_STORAGE_KEY } from "../../../../../shared/constants"

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    const tokens = stored ? JSON.parse(stored) : null
    if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`
  } catch { }
  return headers
}

type Subject = {
  name: string
  count: number
  color?: string | null
}

type Flashcard = {
  id?: string
  front: string
  back: string
  topic?: string
  cross_topics?: string[]
  card_type?: string
  choices?: string[] | null
  correct_answer?: string
  tags?: string[]
  tips?: string
  mnemonic?: string
}

const QUICK_COUNTS = [3, 5, 10]

const MixStudyTopics: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [cardCount, setCardCount] = useState(3)
  const [customCount, setCustomCount] = useState("")
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [selectedForSave, setSelectedForSave] = useState<Set<number>>(new Set())

  // load the list of concepts from the knowledge map on mount
  useEffect(() => {
    let mounted = true
    setSubjectsLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/documents/knowledge-map/data", { headers: getAuthHeaders(), credentials: "include" })

        const concepts: Subject[] = res.ok
          ? ((await res.json()).concepts || []).map((c: any) => ({
              name: c.title || c.name || "Untitled",
              count: 0,
              color: c.color ?? null,
            }))
          : []

        if (!mounted) return
        setSubjects(concepts)
      } catch {
        if (mounted) setSubjects([])
      } finally {
        if (mounted) setSubjectsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const effectiveCount = customCount !== "" ? Math.max(1, Math.min(30, Number(customCount))) : cardCount

  const toggleSubject = (name: string) => {
    setSelectedSubjects(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    )
  }

  // ask the server to produce cross-topic cards for the selected subjects
  const generate = async (append = false) => {
    if (selectedSubjects.length < 2) return
    setIsLoading(true)
    setError(null)
    if (!append) {
      setFlashcards([])
      setCurrentIndex(0)
      setRevealed(false)
      setSelectedForSave(new Set())
      setIsPreview(true)
    }
    try {
      const res = await fetch("/api/flashcards/mix-topics", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ topics: selectedSubjects, card_count: effectiveCount }),
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Generation failed")
      }
      const data: Flashcard[] = await res.json()
      if (!data || data.length === 0) {
        setError("No flashcards were generated. Please try again.")
        return
      }
      setFlashcards(prev => append ? [...prev, ...data] : data)
      if (!append) { setCurrentIndex(0); setRevealed(false) }
      setIsPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCardSelection = (idx: number) => {
    const newSet = new Set(selectedForSave)
    if (newSet.has(idx)) {
      newSet.delete(idx)
    } else {
      newSet.add(idx)
    }
    setSelectedForSave(newSet)
  }

  const selectAllCards = () => {
    if (selectedForSave.size === flashcards.length) {
      setSelectedForSave(new Set())
    } else {
      setSelectedForSave(new Set(flashcards.map((_, i) => i)))
    }
  }

  const saveToDatabase = async () => {
    if (flashcards.length === 0 || selectedSubjects.length < 2) return
    
    const cardsToSave = selectedForSave.size > 0 
      ? flashcards.filter((_, i) => selectedForSave.has(i))
      : flashcards

    if (cardsToSave.length === 0) {
      setError("Please select at least one card to save.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/flashcards/mix-topics/save", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          topics: selectedSubjects, 
          cards: cardsToSave 
        }),
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Save failed")
      }
      const savedData = await res.json()
      setSaveMsg(`✓ Saved ${savedData.length} card${savedData.length !== 1 ? 's' : ''} to database!`)
      setFlashcards(savedData)
      setIsPreview(false)
      setSelectedForSave(new Set())
      setTimeout(() => setSaveMsg(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setIsSaving(false)
    }
  }

  const reset = () => {
    setSelectedSubjects([])
    setFlashcards([])
    setCurrentIndex(0)
    setRevealed(false)
    setError(null)
    setSaveMsg(null)
    setIsPreview(false)
    setSelectedForSave(new Set())
  }

  const goTo = (idx: number) => {
    setCurrentIndex(idx)
    setRevealed(false)
    setShowTips(false)
  }

  const currentCard = flashcards[currentIndex]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">

        {/* Subject selector */}
        <Card title="Mix Study Topics" subtitle="Select 2 or more topics — AI generates flashcards that connect them together.">
          <div className="mt-4 space-y-4">

            {subjectsLoading ? (
              <div className="text-sm text-gray-500">Loading concepts…</div>
            ) : subjects.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200 space-y-1">
                <p className="font-semibold">No concepts found.</p>
                <p>Upload documents to the Knowledge Base to generate concepts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {subjects.map(sub => {
                  const active = selectedSubjects.includes(sub.name)
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => toggleSubject(sub.name)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {sub.color && (
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                        )}
                        <span className="truncate">{sub.name}</span>
                      </span>
                      <span className="flex items-center gap-1 ml-1 shrink-0 text-xs text-gray-400">
                        {active && <span className="text-indigo-500">✓</span>}
                        {sub.count > 0 && (
                          <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">{sub.count}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Selected subjects preview */}
            {selectedSubjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedSubjects.map(s => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  >
                    {s}
                    <button type="button" onClick={() => toggleSubject(s)} className="opacity-60 hover:opacity-100 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}

            {selectedSubjects.length === 1 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Select at least 1 more concept.</p>
            )}

            {/* Card count */}
            {subjects.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-600 dark:text-gray-400 shrink-0">Cards to generate:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_COUNTS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setCardCount(n); setCustomCount("") }}
                      className={`rounded-full px-3 py-1 text-sm font-medium border transition ${
                        cardCount === n && customCount === ""
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={customCount}
                    onChange={e => { setCustomCount(e.target.value); if (e.target.value) setCardCount(0) }}
                    placeholder="Custom"
                    className="w-20 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  />
                </div>
              </div>
            )}

            {selectedSubjects.length >= 2 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Will generate <strong>{effectiveCount}</strong> cross-topic cards connecting:{" "}
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{selectedSubjects.join(" × ")}</span>
              </p>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generate(false)} disabled={selectedSubjects.length < 2 || isLoading}>
                {isLoading && flashcards.length === 0 ? "Generating…" : `Generate ${effectiveCount} Cross-Topic Cards`}
              </Button>
              {flashcards.length > 0 && (
                <Button variant="secondary" onClick={reset}>Clear</Button>
              )}
            </div>
          </div>
        </Card>

        {/* Generated flashcards */}
        {flashcards.length > 0 && (
          <Card title={`Cross-Topic Flashcards (${flashcards.length})${isPreview ? ' — Preview' : ''}`}>
            <div className="space-y-4 mt-2">

              {/* Preview mode banner */}
              {isPreview && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                  <p className="font-semibold mb-1">Preview Mode</p>
                  <p>Review the generated cards below. Select cards to save or approve all to save them to your database.</p>
                </div>
              )}

              {/* Progress + topics label */}
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Card {currentIndex + 1} of {flashcards.length}</span>
                {currentCard?.cross_topics && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    {currentCard.cross_topics.join(" × ")}
                  </span>
                )}
              </div>

              {/* Card face */}
              <div className="rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 dark:border-indigo-800 dark:from-indigo-950/30 dark:to-blue-950/30 min-h-[180px] flex flex-col justify-center">
                <p className="text-xs text-center text-gray-500 mb-2">Question</p>
                <p className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {currentCard?.front}
                </p>
              </div>

              {/* Answer */}
              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Show Answer
                </button>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Answer</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{currentCard?.back}</p>
                  {currentCard?.correct_answer && (
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">Correct: {currentCard.correct_answer}</p>
                  )}
                  {currentCard?.mnemonic && (
                    <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-2">
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-0.5">Mnemonic</p>
                      <p className="text-sm text-purple-800 dark:text-purple-200">{currentCard.mnemonic}</p>
                    </div>
                  )}
                  {currentCard?.tips && (
                    <div>
                      {!showTips ? (
                        <button
                          type="button"
                          onClick={() => setShowTips(true)}
                          className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          Show tips
                        </button>
                      ) : (
                        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-0.5">Tips</p>
                          <p className="text-sm text-amber-800 dark:text-amber-200">{currentCard.tips}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {currentCard?.tags && currentCard.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {currentCard.tags.map((tag, idx) => (
                        <span key={idx} className="rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5 text-xs dark:bg-indigo-900/30 dark:text-indigo-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Preview: card selection checkbox */}
              {isPreview && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    id={`card-${currentIndex}`}
                    checked={selectedForSave.has(currentIndex)}
                    onChange={() => toggleCardSelection(currentIndex)}
                    className="rounded"
                  />
                  <label htmlFor={`card-${currentIndex}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    {selectedForSave.has(currentIndex) ? "✓ Selected" : "Select this card"}
                  </label>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>Previous</Button>
                <div className="flex-1 flex justify-center gap-1 flex-wrap">
                  {flashcards.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      className={`w-6 h-6 rounded-full text-xs font-medium transition relative ${
                        i === currentIndex
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {i + 1}
                      {isPreview && selectedForSave.has(i) && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white dark:border-gray-900"></span>
                      )}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === flashcards.length - 1}>Next</Button>
              </div>

              {/* Preview: approval buttons */}
              {isPreview && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedForSave.size > 0 
                          ? `${selectedForSave.size} of ${flashcards.length} selected`
                          : "All cards will be saved"
                        }
                      </span>
                      <button
                        type="button"
                        onClick={selectAllCards}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {selectedForSave.size === flashcards.length ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={saveToDatabase}
                        disabled={isSaving}
                      >
                        {isSaving ? "Saving…" : "✓ Save to Database"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => generate(true)}
                        disabled={isLoading || selectedSubjects.length < 2}
                      >
                        {isLoading ? "Generating…" : "✎ Generate More"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={reset}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  {saveMsg && <p className="text-xs text-green-600 dark:text-green-400 mt-2">{saveMsg}</p>}
                </div>
              )}

              {/* Non-preview: Generate more button */}
              {!isPreview && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Want more cards?</span>
                  <Button
                    onClick={() => generate(true)}
                    disabled={isLoading || selectedSubjects.length < 2}
                  >
                    {isLoading ? "Generating…" : `+ Generate ${effectiveCount} More`}
                  </Button>
                  {saveMsg && <span className="text-xs text-green-600 dark:text-green-400">{saveMsg}</span>}
                </div>
              )}

            </div>
          </Card>
        )}
      </main>
    </div>
  )
}

export default MixStudyTopics
