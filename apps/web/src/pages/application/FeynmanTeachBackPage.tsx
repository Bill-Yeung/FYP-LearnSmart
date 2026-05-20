import { useState, useEffect, useRef } from "react"
import { Button } from "../../components"
import FollowupChat from "../../components/chat/FollowupChat"
import { ConceptSelector } from "../../components/form/ConceptSelector"
import { API_ENDPOINTS } from "@shared/constants"
import type { FeynmanAnalysis, FeynmanSession } from "@shared/types"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import { useLocation } from "react-router-dom"

function ScoreRing({ score }: { score: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  const offset = circ * (1 - pct / 100)
  const color =
    pct >= 80 ? "#10b981"
    : pct >= 60 ? "#f59e0b"
    : "#ef4444"

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-gray-700" />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="700" fill={color}>
          {Math.round(pct)}%
        </text>
      </svg>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Understanding</span>
    </div>
  )
}

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={[
      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
      done ? "bg-emerald-500 text-white"
      : active ? "bg-indigo-600 text-white"
      : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
    ].join(" ")}>
      {done ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
      ) : n}
    </div>
  )
}

const STEPS = ["1. Choose concept", "2. Write explanation", "3. Get feedback"]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <StepDot n={i + 1} active={current === i} done={current > i} />
            <span className={[
              "text-[10px] font-medium",
              current === i ? "text-indigo-600 dark:text-indigo-400"
              : current > i ? "text-emerald-600 dark:text-emerald-400"
              : "text-gray-400 dark:text-gray-500"
            ].join(" ")}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={[
              "mx-2 mb-4 h-0.5 w-12 sm:w-20 rounded transition-colors",
              current > i ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"
            ].join(" ")} />
          )}
        </div>
      ))}
    </div>
  )
}

function Chip({ label, color = "gray" }: { label: string; color?: "gray" | "red" | "amber" | "indigo" }) {
  const cls = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  }[color]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function FeedbackSection({
  icon, title, color, children,
}: {
  icon: React.ReactNode
  title: string
  color: "emerald" | "red" | "amber" | "indigo" | "violet"
  children: React.ReactNode
}) {
  const border = {
    emerald: "border-emerald-200 dark:border-emerald-800",
    red: "border-red-200 dark:border-red-800",
    amber: "border-amber-200 dark:border-amber-800",
    indigo: "border-indigo-200 dark:border-indigo-800",
    violet: "border-violet-200 dark:border-violet-800",
  }[color]
  const iconBg = {
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  }[color]

  return (
    <div className={`rounded-xl border bg-white dark:bg-gray-900 p-4 ${border}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${iconBg}`}>{icon}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</span>
      </div>
      {children}
    </div>
  )
}

type AnalysisTab = "gaps" | "misconceptions" | "rewrite"

const ANALYSIS_TABS: { id: AnalysisTab; label: string; desc: string }[] = [
  { id: "gaps",           label: "What's Missing",      desc: "Terms or ideas you forgot to mention" },
  { id: "misconceptions", label: "Unclear Phrases",     desc: "Parts of your explanation that need fixing" },
  { id: "rewrite",        label: "Better Version",      desc: "How AI would rewrite your explanation" },
]

export function FeynmanTeachBackPage() {
  const location = useLocation()
  const preloaded = (location.state as any) ?? {}

  const [concept, setConcept] = useState<string>(preloaded.concept ?? "")
  const [explanation, setExplanation] = useState<string>(preloaded.wrongAnswer ?? "")
  const [analysis, setAnalysis] = useState<FeynmanAnalysis | null>(null)
  const [sessionTimestamp, setSessionTimestamp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoRun, setAutoRun] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(80)
  const [maxFollowupRounds, setMaxFollowupRounds] = useState<number>(5)
  const [followupRoundCount, setFollowupRoundCount] = useState<number>(0)
  const [targetLevel, setTargetLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner")
  const [language, setLanguage] = useState<"en" | "zh">("en")
  const [activeTab, setActiveTab] = useState<AnalysisTab>("gaps")
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [selectedWhisperModel, setSelectedWhisperModel] = useState<string>("small")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [serverCaps, setServerCaps] = useState<any | null>(null)
  const [suggestingConcept, setSuggestingConcept] = useState(false)

  const step = analysis ? 2 : (concept.trim() ? 1 : 0)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const resp = await fetch("/api/speech/capabilities")
        if (!resp.ok) return
        const data = await resp.json()
        if (mounted) setServerCaps(data)
      } catch { }
    })()
    return () => { mounted = false }
  }, [])

  async function suggestConcept() {
    setSuggestingConcept(true)
    setError(null)
    try {
      const res = await fetch("/api/documents/knowledge-map/data", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load concepts")
      const data = await res.json()
      const concepts: string[] = (data.concepts || [])
        .map((c: any) => c.title || c.name)
        .filter(Boolean)
      if (concepts.length === 0) throw new Error("No concepts found in your knowledge map")
      const picked = concepts[Math.floor(Math.random() * concepts.length)]
      setConcept(picked)
      setExplanation("")
      setAnalysis(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest a concept")
    } finally {
      setSuggestingConcept(false)
    }
  }

  async function runTeachBack() {
    if (!explanation.trim()) { setError("Please write your explanation first."); return }
    setError(null); setAnalysis(null); setLoading(true)
    try {
      const response = await apiClient.post<FeynmanSession>(API_ENDPOINTS.feynman.analyze, {
        concept_title: concept.trim() || undefined,
        explanation: explanation.trim(),
        target_level: targetLevel,
        language,
      })
      if (!response) throw new Error("No analysis returned.")
      setAnalysis(response.analysis)
      setSessionTimestamp(response.created_at)
      setActiveTab("gaps")
      logActivity("feynman", "practice", undefined, { concept: concept.trim(), score: response.analysis.score })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run teach-back.")
    } finally { setLoading(false) }
  }

  // in auto-run mode, keep looping until confidence hits the threshold
  async function submitFollowup(question: string, answer: string) {
    if (!question || !answer) return
    setError(null); setLoading(true)
    try {
      const response = await apiClient.post<FeynmanSession>(API_ENDPOINTS.feynman.analyze, {
        concept_title: concept.trim() || undefined,
        explanation: explanation.trim(),
        target_level: targetLevel,
        language,
        follow_up: { question, answer },
      })
      if (!response) throw new Error("No analysis returned.")
      setAnalysis(response.analysis)
      setSessionTimestamp(response.created_at)
      setFollowupRoundCount(c => c + 1)
      if (autoRun) {
        const score = typeof response.analysis.score === "number" ? response.analysis.score : 0
        if (score >= confidenceThreshold) { setAutoRun(false) }
        else if (followupRoundCount + 1 >= maxFollowupRounds) { setAutoRun(false) }
        else if (!response.analysis.follow_up_questions?.length) {
          try {
            const extra = await apiClient.post<FeynmanSession>(API_ENDPOINTS.feynman.analyze, {
              concept_title: concept.trim() || undefined,
              explanation: explanation.trim(),
              target_level: targetLevel,
              language,
            })
            if (extra) { setAnalysis(extra.analysis); setSessionTimestamp(extra.created_at) }
          } catch { }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit follow-up.")
    } finally { setLoading(false) }
  }

  function startAutoRun() {
    setFollowupRoundCount(0); setAutoRun(true); setError(null)
    if (analysis && !analysis.follow_up_questions?.length) {
      ;(async () => {
        setLoading(true)
        try {
          const res = await apiClient.post<FeynmanSession>(API_ENDPOINTS.feynman.analyze, {
            concept_title: concept.trim() || undefined,
            explanation: explanation.trim(),
            target_level: targetLevel,
            language,
          })
          if (res) { setAnalysis(res.analysis); setSessionTimestamp(res.created_at) }
        } catch (e) { setError(e instanceof Error ? e.message : "Failed to start auto-run") }
        finally { setLoading(false) }
      })()
    }
  }

  async function generateAndAnalyze() {
    if (!concept.trim()) { setError("Please enter a concept first."); return }
    setError(null); setAnalysis(null); setLoading(true)
    try {
      const gen = await apiClient.post<{ explanation: string }>(API_ENDPOINTS.feynman.generateExplanation, {
        concept_title: concept.trim(), target_level: targetLevel, language,
      })
      const explanationText = gen?.explanation?.trim() || ""
      setExplanation(explanationText)
      const response = await apiClient.post<FeynmanSession>(API_ENDPOINTS.feynman.analyze, {
        concept_title: concept.trim() || undefined,
        explanation: explanationText,
        target_level: targetLevel,
        language,
      })
      if (!response) throw new Error("No analysis returned.")
      setAnalysis(response.analysis)
      setSessionTimestamp(response.created_at)
      logActivity("feynman", "create", undefined, { concept: concept.trim(), score: response.analysis.score })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate and analyze.")
    } finally { setLoading(false) }
  }

  function clearAll() {
    setConcept(""); setExplanation(""); setAnalysis(null)
    setSessionTimestamp(null); setError(null); setAutoRun(false)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks: Blob[] = []
      mediaRecorderRef.current = mr
      audioChunksRef.current = chunks
      mr.addEventListener("dataavailable", (e: any) => { if (e.data?.size > 0) chunks.push(e.data) })
      mr.addEventListener("stop", async () => {
        const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" })
        await uploadAndTranscribe(blob)
        stream.getTracks().forEach(t => t.stop())
        mediaRecorderRef.current = null
        audioChunksRef.current = []
      })
      mr.start(); setRecording(true)
    } catch { setError("Could not access microphone") }
  }

  const stopRecording = () => {
    try {
      const mr: MediaRecorder | null = mediaRecorderRef.current
      if (mr && mr.state !== "inactive") mr.stop()
    } catch { } finally { setRecording(false) }
  }

  const uploadAndTranscribe = async (blob: Blob) => {
    setTranscribing(true)
    try {
      const form = new FormData()
      form.append("file", blob, "recording.webm")
      form.append("language", language === "zh" ? "zh" : "en")
      form.append("model", selectedWhisperModel)
      const resp = await fetch("/api/speech/transcribe", { method: "POST", body: form })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || "Transcription failed")
      }
      const data = await resp.json()
      const text = (data.text || "").trim()
      if (text) setExplanation(prev => prev ? `${prev}\n\n${text}` : text)
      else setError("No speech detected")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed")
    } finally { setTranscribing(false) }
  }

  const score = typeof analysis?.score === "number" ? analysis.score : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feynman Teach-back</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            The best way to test if you truly understand something. Try to explain it simply and AI will score your explanation and show you exactly what's missing.
          </p>
        </div>

        {/* Step bar */}
        <div className="flex justify-center">
          <StepBar current={step} />
        </div>

        {/* How it works */}
        {!analysis && (
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/20 px-5 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">How it works</p>
            <ol className="space-y-2 text-sm text-indigo-800 dark:text-indigo-300 list-decimal list-inside">
              <li><strong>Choose a concept</strong>: e.g. "Newton's First Law" or "Photosynthesis"</li>
              <li><strong>Write your explanation</strong>: in simple words, as if teaching a friend who has never heard of it</li>
              <li><strong>Get a score</strong>: AI gives you a % score and shows 3 things: what's missing, unclear phrases, and a better version</li>
              <li><strong>Answer follow-up questions</strong>: to prove you really understand (your score will go up)</li>
            </ol>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 italic">The Feynman Technique: if you can't explain it simply, you don't understand it yet.</p>
          </div>
        )}

        {/* Step 1: Setup */}
        <div className="rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Step 1: Set up</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ConceptSelector
                value={concept}
                onChange={setConcept}
                label="Concept or topic"
                hint="Select from your knowledge map or type your own"
              />
              <button
                type="button"
                onClick={suggestConcept}
                disabled={suggestingConcept}
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
              >
                {suggestingConcept ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Suggesting…
                  </>
                ) : (
                  <>Suggest a concept for me</>
                )}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Target audience level
              </label>
              <select
                value={targetLevel}
                onChange={e => setTargetLevel(e.target.value as any)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-indigo-600 dark:focus:ring-indigo-900/50"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Language
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value as any)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-indigo-600 dark:focus:ring-indigo-900/50"
              >
                <option value="zh">Chinese</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Explanation */}
        <div className="rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Step 2: Your explanation</p>

          {/* Voice controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Voice input:</span>
            <select
              value={selectedWhisperModel}
              onChange={e => setSelectedWhisperModel(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
            >
              {["tiny", "base", "small", "medium", "large"].map(m => {
                const supported = serverCaps?.models?.[m]?.supported ?? true
                return (
                  <option key={m} value={m} disabled={!supported} style={!supported ? { opacity: 0.45 } : {}}>
                    {m}{!supported ? " (unavailable)" : ""}
                  </option>
                )
              })}
            </select>

            <button
              onClick={() => recording ? stopRecording() : startRecording()}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                recording
                  ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              ].join(" ")}
            >
              {recording ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Stop recording
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                    <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
                  </svg>
                  Record
                </>
              )}
            </button>

            {transcribing && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Transcribing…
              </span>
            )}

            <button
              onClick={() => setExplanation("")}
              className="ml-auto rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Clear text
            </button>
          </div>

          <textarea
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            rows={8}
            placeholder="Explain the concept in simple language. Include: what it is, why it matters, how it works step by step, and a real-world example."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:placeholder-gray-500 dark:focus:border-indigo-600 dark:focus:ring-indigo-900/50"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {explanation.trim().split(/\s+/).filter(Boolean).length} words
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={clearAll} disabled={loading}>Reset all</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (!explanation.trim() && concept.trim()) await generateAndAnalyze()
                  else await runTeachBack()
                }}
                disabled={loading || (!explanation.trim() && !concept.trim())}
              >
                {loading
                  ? <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Analysing…
                    </span>
                  : !explanation.trim() && concept.trim()
                    ? "Generate & analyse"
                    : "Run teach-back"
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Analysis results */}
        {analysis && (
          <div className="space-y-4">

            {/* Score + summary header */}
            <div className="rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {score !== null && <ScoreRing score={score} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">AI Feedback</span>
                    {sessionTimestamp && (
                      <span className="text-xs text-gray-400">
                        · saved {new Date(sessionTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  {analysis.summary && (
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{analysis.summary}</p>
                  )}
                  {score !== null && (
                    <div className="mt-2">
                      <Chip
                        label={score >= 80 ? "Strong understanding" : score >= 60 ? "Partial understanding" : "Needs more work"}
                        color={score >= 80 ? "indigo" : score >= 60 ? "amber" : "red"}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {ANALYSIS_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "flex-1 px-3 py-3 text-left transition-colors",
                      activeTab === tab.id
                        ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    ].join(" ")}
                  >
                    <div className="text-xs font-semibold">{tab.label}</div>
                    <div className="text-[10px] opacity-60 hidden sm:block">{tab.desc}</div>
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-4">

                {activeTab === "gaps" && (
                  <>
                    {analysis.missing_terms.length === 0 && analysis.logical_gaps.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No missing terms or logical gaps detected.</p>
                    )}

                    {analysis.missing_terms.length > 0 && (
                      <FeedbackSection
                        color="red"
                        title="Missing terminology"
                        icon={
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        }
                      >
                        <div className="flex flex-wrap gap-2">
                          {analysis.missing_terms.map(term => (
                            <Chip key={term} label={term} color="red" />
                          ))}
                        </div>
                      </FeedbackSection>
                    )}

                    {analysis.logical_gaps.length > 0 && (
                      <FeedbackSection
                        color="amber"
                        title="Logical gaps"
                        icon={
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm-.75 4.75a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5zm.75 8.5a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        }
                      >
                        <ul className="space-y-1.5">
                          {analysis.logical_gaps.map(item => (
                            <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </FeedbackSection>
                    )}
                  </>
                )}

                {activeTab === "misconceptions" && (
                  <>
                    {analysis.unclear_reasoning.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No flagged phrases or misconceptions detected.</p>
                    )}

                    {analysis.unclear_reasoning.length > 0 && (
                      <FeedbackSection
                        color="indigo"
                        title="Flagged phrases & unclear reasoning"
                        icon={
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                          </svg>
                        }
                      >
                        <ul className="space-y-1.5">
                          {analysis.unclear_reasoning.map(item => (
                            <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </FeedbackSection>
                    )}
                  </>
                )}

                {activeTab === "rewrite" && (
                  <>
                    {!analysis.revised_explanation && analysis.analogies.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No simplified rewrite available.</p>
                    )}

                    {analysis.analogies.length > 0 && (
                      <FeedbackSection
                        color="emerald"
                        title="Suggested analogies"
                        icon={
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
                          </svg>
                        }
                      >
                        <ul className="space-y-1.5">
                          {analysis.analogies.map(item => (
                            <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </FeedbackSection>
                    )}

                    {analysis.revised_explanation && (
                      <FeedbackSection
                        color="violet"
                        title="Suggested improved explanation"
                        icon={
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                          </svg>
                        }
                      >
                        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{analysis.revised_explanation}</p>
                        <button
                          className="mt-3 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
                          onClick={() => { setExplanation(analysis.revised_explanation!); setAnalysis(null) }}
                        >
                          Use this as my new explanation
                        </button>
                      </FeedbackSection>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Reflection — Follow-up questions */}
            {analysis.follow_up_questions.length > 0 && (
              <div className="rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Reflection — Follow-up questions
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                      Answer these to deepen your understanding.
                    </p>
                  </div>

                  {/* Auto-run controls */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      Max rounds
                      <input
                        type="number" min={1} value={maxFollowupRounds}
                        onChange={e => setMaxFollowupRounds(Number(e.target.value || 1))}
                        className="ml-1 w-14 rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      Stop at
                      <input
                        type="number" min={1} max={100} value={confidenceThreshold}
                        onChange={e => setConfidenceThreshold(Number(e.target.value || 80))}
                        className="ml-1 w-14 rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                      />
                      %
                    </label>
                    <button
                      onClick={() => autoRun ? setAutoRun(false) : startAutoRun()}
                      className={[
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        autoRun
                          ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300"
                      ].join(" ")}
                    >
                      {autoRun ? "Stop auto-run" : "Auto-run until confident"}
                    </button>
                  </div>
                </div>

                <FollowupChat
                  questions={analysis.follow_up_questions}
                  onSubmit={submitFollowup}
                  onClose={() => {}}
                />
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  )
}

export default FeynmanTeachBackPage
