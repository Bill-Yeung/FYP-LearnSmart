import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { ConceptSelector } from "../../components/form/ConceptSelector"
import { usePracticeExamQuestions } from "../../hooks/usePracticeExamQuestions"
import type { ExamQuestion, KbSubject } from "../../hooks/usePracticeExamQuestions"
import { useMemo, useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

type Props = {
  onToast: (message: string) => void
}

const SOURCE_LABELS: Record<string, string> = {
  DSE: "DSE Past Papers",
  ALevel: "A-Level Past Papers",
  Mock: "Mock Exam Papers",
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200",
}

function PracticeExamQuestionsInner({ onToast }: Props) {
  const navigate = useNavigate()
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [topicInput, setTopicInput] = useState("")
  const [browseSubject, setBrowseSubject] = useState<string>("")
  const [browseSearch, setBrowseSearch] = useState<string>("")
  const [choicesTimedOut, setChoicesTimedOut] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const {
    isSubmitting,
    allQuestions,
    isLoadingAll,
    kbSubjects,
    searchResults,
    questions,
    currentQuestion,
    currentQuestionIndex,
    userAnswer,
    setUserAnswer,
    selectedChoice,
    setSelectedChoice,
    feedback,
    error,
    evaluationError,
    isSearching,
    selectedTopic,
    setSelectedTopic,
    searchQuestions,
    startQuestion,
    submitAnswer,
    selectQuestion,
    nextQuestion,
    previousQuestion,
    reset
  } = usePracticeExamQuestions()

  useEffect(() => {
    setChoicesTimedOut(false)
    if (currentQuestion?.type !== "multiple-choice") return
    if ((currentQuestion.choices ?? []).length > 0) return
    const t = setTimeout(() => { if (mountedRef.current) setChoicesTimedOut(true) }, 5000)
    return () => clearTimeout(t)
  }, [currentQuestion])

  const handleSubmit = () => submitAnswer(onToast)

  const handleStartQuestion = async (q: ExamQuestion) => {
    setStartingId(q.id)
    await startQuestion(q)
    setStartingId(null)
  }

  const handleTopicSearch = () => {
    const topic = topicInput.trim()
    if (topic) {
      setSelectedTopic(topic)
      searchQuestions(onToast, topic)
    }
  }

  const filteredForBrowse = useMemo(() => {
    let qs = allQuestions
    if (browseSubject) {
      const subjectLower = browseSubject.toLowerCase()
      qs = qs.filter(q =>
        q.topic?.toLowerCase().includes(subjectLower) ||
        q.board?.toLowerCase().includes(subjectLower)
      )
    }
    if (browseSearch.trim()) {
      const s = browseSearch.trim().toLowerCase()
      qs = qs.filter(q =>
        q.question_text?.toLowerCase().includes(s) ||
        q.topic?.toLowerCase().includes(s) ||
        q.syllabus_code?.toLowerCase().includes(s)
      )
    }
    return qs
  }, [allQuestions, browseSubject, browseSearch])

  const grouped = useMemo(() => {
    const map: Record<string, ExamQuestion[]> = {}
    filteredForBrowse.forEach(q => {
      const key = q.board || "Other"
      if (!map[key]) map[key] = []
      map[key].push(q)
    })
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => b.year - a.year || (a.syllabus_code || "").localeCompare(b.syllabus_code || ""))
    )
    return map
  }, [filteredForBrowse])

  const sourceKeys = Object.keys(grouped).sort()

  const difficultyColor = (d: string) => DIFFICULTY_COLOR[d] ?? DIFFICULTY_COLOR.easy

  return (
    <Card
      title="Practice Exam Questions"
      subtitle="Browse past exam papers and answer questions with AI-generated MCQ choices"
    >
      <div className="space-y-4">
        {!currentQuestion && (
          <div className="space-y-3">

            <div className="space-y-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <ConceptSelector
                    label="Search by Concepts"
                    value={topicInput}
                    onChange={v => { setTopicInput(v); setSelectedTopic(v) }}
                    placeholder="e.g. Calculus, Probability…"
                  />
                </div>
                <Button
                  onClick={handleTopicSearch}
                  disabled={isSearching || !topicInput.trim()}
                >
                  {isSearching ? "Searching…" : "Search"}
                </Button>
              </div>
              {searchResults.length > 0 && selectedTopic && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    Topic: {selectedTopic} · {searchResults.length} question{searchResults.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setTopicInput(""); setSelectedTopic(""); reset() }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {searchResults.length > 0 && !currentQuestion && (
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  Results for "{selectedTopic}"
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {searchResults.map(q => (
                    <div key={q.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {q.board} {q.year} · {q.syllabus_code || "—"}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${difficultyColor(q.difficulty)}`}>
                            {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {q.type === "multiple-choice" ? "MCQ" : "Long Question"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.question_text}</p>
                      </div>
                      <button
                        type="button"
                        disabled={startingId === q.id}
                        onClick={() => handleStartQuestion(q)}
                        className="flex-shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
                      >
                        {startingId === q.id ? "Loading…" : "Start"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Browse All Papers</p>

              <div className="flex items-center gap-2 mb-3">
                <label className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Subject:</label>
                <select
                  value={browseSubject}
                  onChange={e => { setBrowseSubject(e.target.value); setExpandedSource(null) }}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">All Subjects</option>
                  {kbSubjects.map((s: KbSubject) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <input
                  type="text"
                  value={browseSearch}
                  onChange={e => { setBrowseSearch(e.target.value); setExpandedSource(null) }}
                  placeholder="Search questions in papers…"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>

              {(browseSubject || browseSearch) && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {filteredForBrowse.length} question{filteredForBrowse.length !== 1 ? "s" : ""} found
                  </span>
                  <button
                    type="button"
                    onClick={() => { setBrowseSubject(""); setBrowseSearch(""); setExpandedSource(null) }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {isLoadingAll ? (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading exam papers…
              </div>
            ) : sourceKeys.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No exam questions found in the database.</p>
            ) : (
              sourceKeys.map(source => {
                const qs = grouped[source]
                const isOpen = expandedSource === source
                return (
                  <div key={source} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSource(isOpen ? null : source)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {SOURCE_LABELS[source] ?? source}
                        </span>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {qs.length} question{qs.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <svg
                        className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {qs.map(q => (
                          <div key={q.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {q.year} · {q.syllabus_code || "—"}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${difficultyColor(q.difficulty)}`}>
                                  {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                                </span>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                  {q.type === "multiple-choice" ? "MCQ" : "Long Question"}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.question_text}</p>
                            </div>
                            <button
                              type="button"
                              disabled={startingId === q.id}
                              onClick={() => handleStartQuestion(q)}
                              className="flex-shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
                            >
                              {startingId === q.id ? "Loading…" : "Start"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {error && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
              </div>
            )}
          </div>
        )}

        {currentQuestion && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
            >
              ← Back to exam papers
            </button>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-200">
                    {SOURCE_LABELS[currentQuestion.board] ?? currentQuestion.board}
                  </p>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                    {currentQuestion.year} · {currentQuestion.syllabus_code || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${difficultyColor(currentQuestion.difficulty)}`}>
                    {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {currentQuestion.type === "multiple-choice" ? "MCQ" : "Long Question"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Question</h3>
              <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {currentQuestion.question_text}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {currentQuestion.type === "multiple-choice" ? "Select your answer" : "Your answer"}
              </label>
              {currentQuestion.type === "multiple-choice" ? (
                <div className="space-y-2">
                  {(currentQuestion.choices ?? []).length === 0 ? (
                    choicesTimedOut ? (
                      <div className="space-y-2">
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          Choices could not be loaded. Type your answer below instead.
                        </p>
                        <textarea
                          rows={4}
                          value={userAnswer}
                          onChange={e => setUserAnswer(e.target.value)}
                          disabled={feedback !== null}
                          placeholder="Type your answer here…"
                          className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Loading choices…
                      </div>
                    )
                  ) : (
                    currentQuestion.choices!.map((choice, index) => {
                      const isSelected = selectedChoice === index
                      const submitted = feedback !== null
                      const isCorrect = submitted && index === currentQuestion.correct_answer
                      const isWrong = submitted && isSelected && !isCorrect

                      let cls = "w-full rounded-lg border-2 p-3 text-left text-sm font-medium transition flex items-center gap-2 "
                      if (!submitted) {
                        cls += isSelected
                          ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-100"
                          : "border-gray-300 bg-white text-gray-900 hover:border-indigo-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-indigo-400"
                      } else if (isCorrect) {
                        cls += "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-100"
                      } else if (isWrong) {
                        cls += "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-600 dark:bg-rose-900/20 dark:text-rose-100"
                      } else {
                        cls += "border-gray-200 bg-white text-gray-400 opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                      }

                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={submitted}
                          onClick={() => setSelectedChoice(index)}
                          className={cls}
                        >
                          <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">
                            {submitted && isCorrect ? "✓" : submitted && isWrong ? "✗" : String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1">{choice}</span>
                          {submitted && isCorrect && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Correct</span>}
                          {submitted && isWrong && <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Your answer</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              ) : (
                <textarea
                  rows={4}
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  disabled={feedback !== null}
                  placeholder="Type your answer here…"
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button onClick={handleSubmit} disabled={isSubmitting || (currentQuestion.type === "multiple-choice" ? selectedChoice === null : !userAnswer.trim())}>
                {isSubmitting ? "Submitting..." : "Submit Answer"}
              </Button>
              <Button variant="secondary" onClick={reset}>
                ← Back to papers
              </Button>
            </div>

            {feedback && (
              <div
                className={`rounded-lg border p-4 text-sm ${
                  feedback.verdict === "correct"
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                    : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20"
                }`}>
                <div className={`flex flex-wrap items-center gap-2 ${feedback.verdict === "correct" ? "text-emerald-900 dark:text-emerald-100" : "text-rose-900 dark:text-rose-100"}`}>
                  <span
                    className={`rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      feedback.verdict === "correct"
                        ? "text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-100"
                        : "text-rose-700 dark:bg-rose-800/60 dark:text-rose-100"
                    }`}>
                    AI Result: {feedback.verdict === "correct" ? "OK" : "NOT OK"}
                  </span>
                  {feedback.score !== undefined && (
                    <span className="text-xs font-semibold">Score: {feedback.score}%</span>
                  )}
                </div>
                {feedback.summary && (
                  <p className={`mt-2 ${feedback.verdict === "correct" ? "text-emerald-900 dark:text-emerald-100" : "text-rose-900 dark:text-rose-100"}`}>
                    {feedback.summary}
                  </p>
                )}
                {feedback.reasoning && (
                  <p className={`mt-2 text-xs ${feedback.verdict === "correct" ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"}`}>
                    {feedback.reasoning}
                  </p>
                )}
                {feedback.matched_keywords && feedback.matched_keywords.length > 0 && (
                  <p className={`mt-2 text-xs ${feedback.verdict === "correct" ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"}`}>
                    Matched: {feedback.matched_keywords.join(", ")}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {feedback.user_answer && (
                    <div className={`rounded-md border bg-white p-3 text-xs ${
                      feedback.verdict === "correct"
                        ? "border-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
                        : "border-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100"
                    }`}>
                      <p className="font-semibold">Your answer</p>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{feedback.user_answer}</p>
                    </div>
                  )}
                  {feedback.model_answer && (
                    <div className={`rounded-md border bg-white p-3 text-xs ${
                      feedback.verdict === "correct"
                        ? "border-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
                        : "border-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100"
                    }`}>
                      <p className="font-semibold">Model answer</p>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{feedback.model_answer}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {feedback && feedback.verdict === "incorrect" && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/application/error-log")}
                  className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition dark:bg-rose-700 dark:hover:bg-rose-800"
                >
                  View Error Log
                </button>
              </div>
            )}

            {evaluationError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">Error Part</p>
                <p className="mt-1 text-sm text-red-800 dark:text-red-200">{evaluationError}</p>
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> {currentQuestion.type === "multiple-choice" ? "Choices include the correct answer and 3 AI-generated distractors. Select the best answer." : "AI will evaluate your written answer against the model answer."} Your attempt will be saved for review.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function PracticeExamQuestionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <PracticeExamQuestionsInner onToast={() => {}} />
      </main>
    </div>
  )
}

export default PracticeExamQuestionsPage
