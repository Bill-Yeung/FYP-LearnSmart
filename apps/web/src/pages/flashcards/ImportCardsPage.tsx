import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../../contexts"

type ImportFailure = { front: string; reason: string }
type ImportResult = { saved: number; total: number; failures: ImportFailure[] }

export default function ImportCardsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)

  // handles quoted fields and "" escapes
  function parseCsvLine(line: string): string[] {
    const result: string[] = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
      } else if (ch === ',' && !inQuotes) { result.push(cur); cur = "" } else { cur += ch }
    }
    result.push(cur)
    return result.map((s) => s.trim())
  }

  function importCsvFromText(text: string) {
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!rows.length) { showToast('No CSV rows found'); return }
    const headerFields = parseCsvLine(rows[0]).map((h) => h.toLowerCase())
    const hasHeader = headerFields.includes('question') || headerFields.includes('type')
    const dataRows = hasHeader ? rows.slice(1) : rows
    const parsed: any[] = []
    let skipped = 0
    dataRows.forEach((line, idx) => {
      const fields = parseCsvLine(line)
      if (hasHeader) {
        const map: Record<string, string> = {}
        for (let i = 0; i < headerFields.length; i++) map[headerFields[i]] = fields[i] ?? ''
        const type = (map['type'] || '').toLowerCase() || 'standard'
        const question = (map['question'] || map['front'] || '').trim()
        const answer = (map['answer'] || map['back'] || '').trim()
        if (type === 'mcq') {
          const choicesRaw = map['choices'] || ''
          const choices = (choicesRaw || '').toString().split(/\||;|,/).map((s) => s.trim()).filter(Boolean)
          const correct = map['correct_answer'] || map['correctanswer'] || ''
          let derivedBack = answer || ''
          if (!derivedBack || !derivedBack.trim()) {
            if (choices.length) derivedBack = choices.map((ch) => (ch === correct && correct ? `✓ ${ch}` : ch)).join(' | ')
            else if (correct) derivedBack = correct
          }
          if (!question || !derivedBack) { skipped++; return }
          const tags = (map['tags'] || '').split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean)
          parsed.push({ front: question, back: derivedBack, tags })
        } else {
          if (!question || !answer) { skipped++; return }
          const tags = (map['tags'] || '').split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean)
          parsed.push({ front: question, back: answer, tags })
        }
      } else {
        const front = (fields[0] ?? '').trim()
        const back = (fields[1] ?? '').trim()
        if (!front || !back) { skipped++; return }
        parsed.push({ front, back })
      }
    })
    if (!parsed.length) { showToast('No valid CSV rows found'); return }
    persistCards(parsed)
  }

  function importJsonFromText(text: string) {
    let data: any = null
    try { data = JSON.parse(text) } catch (err) { showToast('Invalid JSON file'); return }
    let items: any[] = []
    if (Array.isArray(data)) items = data
    else if (data && Array.isArray(data.cards)) items = data.cards
    else if (data && Array.isArray(data.flashcards)) items = data.flashcards
    else if (data && Array.isArray(data.data)) items = data.data
    else { showToast("JSON must be an array of cards or contain a 'cards' array"); return }

    const parsed: any[] = []
    items.forEach((it: any) => {
      const type = (it.type || it.card_type || 'standard').toLowerCase()
      const question = (it.question || it.front || '').trim()
      const answer = (it.answer || it.back || '').trim()
      const tagsRaw = it.tags || it.tag || it.tags_list || ''
      if (type === 'mcq') {
        const choicesArr = Array.isArray(it.choices) ? it.choices : (it.choices ? String(it.choices).split(/\||;|,/).map((s: string) => s.trim()).filter(Boolean) : [])
        const correct = it.correct_answer || it.correctAnswer || ''
        let derivedBack = answer || ''
        if (!derivedBack || !String(derivedBack).trim()) {
          if (choicesArr && choicesArr.length) derivedBack = choicesArr.map((ch: string) => (ch === correct && correct ? `✓ ${ch}` : ch)).join(' | ')
          else if (correct) derivedBack = correct
        }
        if (!question || !derivedBack) return
        const tagsArr = Array.isArray(tagsRaw) ? tagsRaw.map((t: any) => String(t)) : (typeof tagsRaw === 'string' ? String(tagsRaw).split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean) : [])
        parsed.push({ front: question, back: derivedBack, tags: tagsArr })
      } else {
        if (!question || !answer) return
        parsed.push({ front: question, back: answer, tags: Array.isArray(tagsRaw) ? tagsRaw.map((t: any) => String(t)) : (typeof tagsRaw === 'string' ? String(tagsRaw).split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean) : []) })
      }
    })

    if (!parsed.length) { showToast('No valid JSON cards found'); return }
    persistCards(parsed)
  }

  async function persistCards(parsed: any[]) {
    setImporting(true)
    setImportResult(null)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const stored = localStorage.getItem('learnsmart-tokens')
    const tokens = stored ? (() => { try { return JSON.parse(stored) } catch { return null } })() : null
    if (tokens?.access_token) headers['Authorization'] = `Bearer ${tokens.access_token}`

    const results = await Promise.all(
      parsed.map(async item => {
        try {
          const r = await fetch('/api/flashcards/create', {
            method: 'POST', headers,
            body: JSON.stringify({ ...item, card_type: 'standard' })
          })
          if (r.ok) return { ok: true as const }
          const err = await r.json().catch(() => ({ detail: `HTTP ${r.status}` }))
          return { ok: false as const, front: item.front, reason: err?.detail || `HTTP ${r.status}` }
        } catch (e) {
          return { ok: false as const, front: item.front, reason: e instanceof Error ? e.message : 'Network error' }
        }
      })
    )

    const saved = results.filter(r => r.ok).length
    const failures: ImportFailure[] = results
      .filter((r): r is { ok: false; front: string; reason: string } => !r.ok)
      .map(r => ({ front: r.front, reason: r.reason }))

    setImportResult({ saved, total: parsed.length, failures })
    setImporting(false)
    if (failures.length === 0) {
      showToast(`All ${saved} cards imported successfully`)
      navigate('/flashcards/manage')
    } else {
      showToast(`${saved} of ${parsed.length} cards saved — ${failures.length} failed`)
    }
  }

  function handleFile(file: File | null) {
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || "")
      const name = file.name.toLowerCase()
      if (name.endsWith('.json') || file.type.includes('json')) importJsonFromText(text)
      else importCsvFromText(text)
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="text-lg font-semibold">Import CSV / JSON (local)</h2>
        <p className="text-sm text-gray-600 mt-1">Upload a CSV or JSON file to import cards. The file will be imported automatically after upload.</p>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg p-6 border-dashed border-gray-300">
            <div className="text-sm font-medium">Drop CSV or JSON here to import</div>
            <div className="text-xs text-gray-500">or click to choose a file (CSV or JSON)</div>
            <input ref={(r) => (fileInputRef.current = r)} type="file" accept=".csv,.json,application/json,text/csv" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
            <div className="mt-2">
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1 bg-blue-600 text-white rounded">Choose file</button>
            </div>
            {csvFileName && <div className="mt-2 text-xs text-gray-500">Selected: {csvFileName}</div>}
          {importing && <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">Importing cards...</div>}
          </div>

          {importResult && importResult.failures.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 space-y-2">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                {importResult.saved} of {importResult.total} cards saved — {importResult.failures.length} failed:
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {importResult.failures.map((f, i) => (
                  <li key={i} className="text-xs text-red-700 dark:text-red-300">
                    <span className="font-medium">"{f.front.length > 40 ? f.front.slice(0, 40) + '…' : f.front}"</span>
                    {" — "}{f.reason}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/flashcards/manage')}
                className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              >
                View imported cards anyway
              </button>
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-1">Back</button>
          </div>
        </div>
      </main>
    </div>
  )
}
