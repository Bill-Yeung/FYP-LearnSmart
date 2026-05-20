import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { manageSeedCards } from "../../configs/flashcardsData"
import { Card } from "../../components"
import { ManageFlashcardsSection } from "../../components/flashcards/ManageFlashcardsSection"

export function FlashcardsManagePage() {
  const [toast, setToast] = useState<string | null>(null)
  const navigate = useNavigate()



  function handleToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Card title="Manage & Enrich Flashcards" subtitle="Create, edit, and attach enrichments to your flashcards.">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Create or import flashcards, then enrich them with tips, mnemonics, and media for multisensory learning.</p>
            <div className="mt-3 rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Main Features</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li><strong>Quick actions:</strong> Browse decks, search & filter by tags/deck/text, edit or delete cards, and perform bulk operations (tag/move/delete).</li>
                <li><strong>Re-scheduling & review control:</strong> Use <em>Review now</em> to immediately add a card to your session or manually reschedule next review dates.</li>
                <li><strong>Organization:</strong> Use short tags (e.g., mnemonic, tips, subject, concept, document) and focused decks for better study sessions.</li>
                <li><strong>Editing best practices:</strong> Keep edits minimal to preserve spaced-repetition history; create a new card if the concept changes.</li>
                <li><strong>Export & backup:</strong> Export decks or selected cards (CSV/JSON) for backup or sharing.</li>
                <li><strong>Tips:</strong> Tag cards with `mnemonic` or `tips` and use filters to build focused review sessions.</li>
              </ul>
            </div>
          </div>
        </Card>

        <ManageFlashcardsSection seedCards={manageSeedCards} onToast={handleToast} />

        {toast && (
          <div className="fixed bottom-4 right-4 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
            {toast}
          </div>
        )}
      </main>
    </div>
  )
}

export default FlashcardsManagePage
