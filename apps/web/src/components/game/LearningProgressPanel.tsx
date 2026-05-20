import { useEffect, useState } from "react"
import { Card } from "../../components"
import RichTextEditor from "../flashcards/RichTextEditor"
import * as api from "../../api/playGame"
import { FileText } from "lucide-react"

interface Props {
  knowledgeId: string
  scriptId?: string
  learningStepComplete?: {
    reviewedCore: boolean
    generatedAI: boolean
    quizPassed: boolean
  }
  notesInit: string
  onProgressUpdate: (notes: string) => void
}

export function LearningProgressPanel({ knowledgeId, scriptId, notesInit, onProgressUpdate }: Props) {
  const [notes, setNotes] = useState(notesInit)
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastSavedNotes, setLastSavedNotes] = useState(notesInit)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaved, setIsSaved] = useState(true)
  const draftStorageKey = `learning-progress-notes-${scriptId || 'global'}-${knowledgeId}`

  useEffect(() => {

    if (notesInit === lastSavedNotes) return

    const savedDraft = localStorage.getItem(draftStorageKey)
    if (savedDraft && savedDraft !== notesInit) {
      setNotes(savedDraft)
      setLastSavedNotes(notesInit)
      setIsDirty(true)
      setIsSaved(false)
    } else {
      setNotes(notesInit)
      setLastSavedNotes(notesInit)
      setIsDirty(false)
      setIsSaved(true)
    }
  }, [notesInit, draftStorageKey, lastSavedNotes])

  const saveNotesToServer = async (value: string) => {
    if (value === lastSavedNotes) {
      setIsDirty(false)
      setIsSaved(true)
      localStorage.removeItem(draftStorageKey)
      return
    }
    setIsUpdating(true)
    try {
      await api.updateLearningProgress({
        knowledgeId,
        scriptId,
        personalNotes: value
      })
      setLastSavedNotes(value)
      setIsDirty(false)
      setIsSaved(true)
      localStorage.removeItem(draftStorageKey)
      onProgressUpdate(value)
    } catch (err) {
      console.error("Failed to save notes:", err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleNotesChange = (val: string) => {
    setNotes(val)
    setIsDirty(val.trim() !== lastSavedNotes.trim())
    setIsSaved(false)
    localStorage.setItem(draftStorageKey, val)
  }

  const handleManualSave = () => {
    saveNotesToServer(notes)
  }

  const handleClearNotes = () => {
    setNotes('')
    setIsDirty('' !== lastSavedNotes.trim())
    setIsSaved('' === lastSavedNotes.trim())
    localStorage.setItem(draftStorageKey, '')
  }

  return (
    <Card className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 px-4 py-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-500" /> Notes
          </h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleManualSave} className="rounded-md px-3 py-1.5 text-indigo-600 dark:text-indigo-300 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition">Save</button>
            <button type="button" onClick={handleClearNotes} className="rounded-md px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">Clear</button>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between px-2">
          <span>{isDirty ? 'Unsaved changes' : isSaved ? 'Saved' : 'No changes'}</span>
          {isUpdating && <span className="text-green-600 animate-pulse">Saving...</span>}
        </div>
        <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
          <RichTextEditor
            value={notes}
            onChange={handleNotesChange}
            placeholder="Key insights or items to review next time..."
            minHeight="160px"
            dataTestId="learning-notes-editor"
          />
        </div>
      </div>
    </Card>
  )
}
