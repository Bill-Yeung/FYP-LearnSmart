import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"

type ImportResult = {
  inserted: number
  errors: Array<{ row: number; error: string } | { index: number; error: string }>
}

type GenerateResult = {
  generated: number
  ids: string[]
  topic: string
}

type Subject = {
  id: string
  code: string
  name: string
}


export function PastPaperImportPage() {
  const navigate = useNavigate()

  const [genTopic, setGenTopic] = useState("")
  const [genSource, setGenSource] = useState("Mock")
  const [genYear, setGenYear] = useState(new Date().getFullYear())
  const [genCount, setGenCount] = useState(5)
  const [genDifficulty, setGenDifficulty] = useState(3)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  const [showTopicDropdown, setShowTopicDropdown] = useState(false)

  const [subjects, setSubjects] = useState<Subject[]>([])

  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [excelImportResult, setExcelImportResult] = useState<ImportResult | null>(null)
  const [excelImportError, setExcelImportError] = useState<string | null>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)

  const [textInput, setTextInput] = useState("")
  const [isImportingText, setIsImportingText] = useState(false)
  const [textImportError, setTextImportError] = useState<string | null>(null)
  const [textImportResult, setTextImportResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    fetch("/api/documents/concepts/all", { credentials: "include" })
      .then(r => r.ok ? r.json() : { concepts: [] })
      .then((d: { concepts?: { title: string }[] }) =>
        setAvailableTopics((d.concepts ?? []).map(c => c.title))
      )
      .catch(() => {})
    fetch("/api/quiz/subjects", { credentials: "include" })
      .then(r => r.ok ? r.json() : { subjects: [] })
      .then((d: { subjects?: Subject[] }) => setSubjects(d.subjects ?? []))
      .catch(() => {})
  }, [])

  const handleTextImport = async () => {
    if (!textInput.trim()) {
      setTextImportError("Please enter some text about past paper questions")
      return
    }

    setIsImportingText(true)
    setTextImportError(null)
    setTextImportResult(null)

    try {
      const form = new FormData()
      form.append("text_input", textInput.trim())
      
      const res = await fetch("/api/quiz/import-text", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Import failed")
      setTextImportResult(data as ImportResult)
      setTextInput("")
    } catch (e) {
      setTextImportError(e instanceof Error ? e.message : "Import failed")
    } finally {
      setIsImportingText(false)
    }
  }

  const filteredTopics = availableTopics.filter(t =>
    t.toLowerCase().includes(genTopic.toLowerCase())
  )

  const handleAiGenerate = async () => {
    if (!genTopic.trim()) {
      setGenerateError("Please enter a concept")
      return
    }
    setIsGenerating(true)
    setGenerateError(null)
    setGenerateResult(null)
    try {
      const form = new FormData()
      form.append("topic", genTopic.trim())
      form.append("source_exam", genSource)
      form.append("year", String(genYear))
      form.append("count", String(genCount))
      form.append("difficulty_level", String(genDifficulty))
      const res = await fetch("/api/quiz/ai-generate", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Generation failed")
      setGenerateResult(data as GenerateResult)
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExcelUpload = async () => {
    if (!excelFile) return
    setIsUploading(true)
    setExcelImportError(null)
    setExcelImportResult(null)
    try {
      const form = new FormData()
      form.append("file", excelFile)
      const res = await fetch("/api/quiz/import-csv", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Upload failed")
      setExcelImportResult(data as ImportResult)
      setExcelFile(null)
      if (excelInputRef.current) excelInputRef.current.value = ""
    } catch (e) {
      setExcelImportError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Import Past Papers
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Paste raw exam question text or let AI generate questions for a concept. Mac Mini's AI (powered by qwen-long) intelligently parses the text and auto-fills missing fields. All imported questions are saved to the knowledge base and appear in Practice Exam Questions.
        </p>
      </div>

      <Card title="AI-Powered Text Import" subtitle="LLM analyzes your text using the fastest model (qwen-long) — paste any format, MCQ or essay">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Raw Question Text (can be incomplete)
            </label>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={`Paste your question text here. Examples:
DSE 2024, Paper 1, Q1: Solve for x: 2x + 3 = 11. Options: A. x=2, B. x=4, C. x=6, D. x=8. Answer: B

Or just: Find the derivative of 3x^2 + 2x. It's 6x + 2.

Or: ALevel 2023 - What is the capital of France?`}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={8}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Missing fields like source_exam, year, topic and difficulty will be inferred from context.
            </p>
          </div>

          <Button 
            onClick={handleTextImport} 
            disabled={isImportingText || !textInput.trim()}
          >
            {isImportingText ? "Processing with Mac Mini…" : "Parse & Import Questions"}
          </Button>

          {textImportError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20 flex gap-3">
              <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">Import failed</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">{textImportError}</p>
              </div>
            </div>
          )}

          {textImportResult && (
            <div className="space-y-3">
              {/* Success banner */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20 flex gap-3">
                <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    Text import successful
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {textImportResult.inserted} question{textImportResult.inserted !== 1 ? "s" : ""} successfully parsed and added.
                    {textImportResult.errors.length > 0 && ` ${textImportResult.errors.length} question${textImportResult.errors.length !== 1 ? "s" : ""} could not be processed.`}
                  </p>
                </div>
              </div>

              {/* Processing errors */}
              {textImportResult.errors.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800">
                    <svg className="h-4 w-4 text-amber-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      {textImportResult.errors.length} question{textImportResult.errors.length !== 1 ? "s" : ""} skipped
                    </p>
                  </div>
                  <div className="divide-y divide-amber-100 dark:divide-amber-900 max-h-40 overflow-y-auto">
                    {textImportResult.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="flex gap-3 px-4 py-2.5 bg-white dark:bg-gray-900">
                        <span className="inline-flex items-center justify-center rounded bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 shrink-0 self-start mt-0.5">
                          {(err as any).index ?? idx + 1}
                        </span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{(err as any).error || err}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* AI Generate */}
      <Card title="AI Generate Questions" subtitle="Let AI create questions for a concept and save them to the knowledge base">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Topic */}
            <div className="sm:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concept *</label>
              <input
                type="text"
                value={genTopic}
                onChange={e => { setGenTopic(e.target.value); setShowTopicDropdown(true) }}
                onFocus={() => setShowTopicDropdown(true)}
                onBlur={() => setTimeout(() => setShowTopicDropdown(false), 150)}
                placeholder="e.g. Calculus, Probability, Vectors…"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              {showTopicDropdown && filteredTopics.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 max-h-40 overflow-y-auto">
                  {filteredTopics.map(t => (
                    <button
                      key={t}
                      type="button"
                      onMouseDown={() => { setGenTopic(t); setShowTopicDropdown(false) }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-indigo-900/30"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Exam</label>
              <select
                value={genSource}
                onChange={e => setGenSource(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="Mock">Mock</option>
                <option value="DSE">DSE</option>
                <option value="ALevel">ALevel</option>
                {subjects.length > 0 && (
                  <optgroup label="Subjects">
                    {subjects.map(s => (
                      <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
              <input
                type="number"
                value={genYear}
                onChange={e => setGenYear(Number(e.target.value))}
                min={2000}
                max={2099}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Questions (max 20)
              </label>
              <input
                type="number"
                value={genCount}
                onChange={e => setGenCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                min={1}
                max={20}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Difficulty (1 easy → 5 hard)
              </label>
              <input
                type="range"
                value={genDifficulty}
                onChange={e => setGenDifficulty(Number(e.target.value))}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Easy</span>
                <span className="font-medium text-indigo-600 dark:text-indigo-400">Level {genDifficulty}</span>
                <span>Hard</span>
              </div>
            </div>
          </div>

          <Button onClick={handleAiGenerate} disabled={isGenerating || !genTopic.trim()}>
            {isGenerating ? "Generating…" : "Generate & Save to Practice Exam Questions"}
          </Button>

          {generateError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{generateError}</p>
            </div>
          )}

          {generateResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    {generateResult.generated} question{generateResult.generated !== 1 ? "s" : ""} generated for concept "{generateResult.topic}" and saved to the knowledge base.
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    They will now appear in Practice Exam Questions when you search for "{generateResult.topic}".
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/application/practice-exam")}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition"
              >
                Go to Practice Exam Questions
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default PastPaperImportPage
