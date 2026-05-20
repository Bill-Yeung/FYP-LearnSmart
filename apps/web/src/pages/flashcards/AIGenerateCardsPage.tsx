import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../../contexts"

export default function AIGenerateCardsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [aiConcept, setAiConcept] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiTargetCount, setAiTargetCount] = useState<number | "">(3)
  const [aiTemplate, setAiTemplate] = useState("flashcard")

  async function generateAICards() {
    if (!aiConcept.trim()) {
      showToast("Enter a concept first")
      return
    }
    setAiLoading(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const stored = localStorage.getItem("learnsmart-tokens")
      const tokens = stored ? (() => { try { return JSON.parse(stored) } catch { return null } })() : null
      if (tokens?.access_token) headers["Authorization"] = `Bearer ${tokens.access_token}`

      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ topic: aiConcept.trim(), content: aiConcept.trim(), target_count: aiTargetCount || 3, template: aiTemplate })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(err.detail || "AI generation failed")
      }
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) throw new Error("AI returned no cards")

      const headers2: Record<string, string> = { "Content-Type": "application/json" }
      if (tokens?.access_token) headers2["Authorization"] = `Bearer ${tokens.access_token}`
      const results = await Promise.all(
        data.map((p: any) => {
          const body = { front: p.front || p.question || "", back: p.back || p.answer || "", card_type: 'standard', tags: p.tags }
          return fetch("/api/flashcards/create", { method: 'POST', headers: headers2, body: JSON.stringify(body) })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        })
      )
      const created = results.filter(Boolean)

      showToast(`Generated ${data.length} cards${created.length ? ` and saved ${created.length}` : ''}`)
      navigate('/flashcards/manage')
    } catch (err: any) {
      console.error(err)
      showToast(String(err).slice(0, 140) || 'AI generation failed')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="text-lg font-semibold">AI generate cards</h2>
        <p className="text-sm text-gray-600 mt-1">Generate multiple flashcards from a concept using the AI service.</p>

        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <input value={aiConcept} onChange={(e) => setAiConcept(e.target.value)} placeholder="Concept (e.g., Newton's laws)" className="w-full rounded border px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input type="number" min={1} value={aiTargetCount as any} onChange={(e) => setAiTargetCount(e.target.value === '' ? '' : Number(e.target.value))} className="w-24 rounded border px-2 py-1 text-sm" />
            <input value={aiTemplate} onChange={(e) => setAiTemplate(e.target.value)} className="flex-1 rounded border px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-1">Cancel</button>
            <button onClick={generateAICards} disabled={aiLoading} className="px-3 py-1 bg-blue-600 text-white rounded">{aiLoading ? 'Generating...' : 'Generate'}</button>
          </div>
        </div>
      </main>
    </div>
  )
}
