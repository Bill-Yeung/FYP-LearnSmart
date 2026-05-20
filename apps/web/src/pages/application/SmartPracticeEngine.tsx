import React, { useMemo, useState } from "react";
import { Card, Button } from "../../components";
import { QUESTIONS } from "../../configs/sampleData";

type Question = {
  id: string
  topic: string
  stem: string
  choices: string[]
  answerIndex: number
  solution?: string
}

const MOCK_QUESTIONS = QUESTIONS

const STORAGE_KEY = "practice_attempts_v1"

export const SmartPracticeEngine: React.FC = () => {
  const [topic, setTopic] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const availableTopics = useMemo(() => {
    return Array.from(new Set(MOCK_QUESTIONS.map(q => q.topic)))
  }, [])

  function findQuestions() {
    const t = topic.trim().toLowerCase()
    if (!t) {
      setQuestions([])
      setResultMessage("Please enter or select a topic.")
      return
    }
    const found = MOCK_QUESTIONS.filter(q => q.topic.toLowerCase() === t)
    if (found.length === 0) {
      setQuestions([])
      setResultMessage(`No past questions found for "${topic}".`)
      return
    }
    setQuestions(found)
    setCurrentIdx(0)
    setSelected(null)
    setResultMessage(null)
  }

  function submitAnswer() {
    const q = questions[currentIdx]
    if (!q) return
    if (selected === null) {
      setResultMessage("Please select an answer.")
      return
    }
    const correct = selected === q.answerIndex
    const attempt = {
      questionId: q.id,
      topic: q.topic,
      selected,
      correct,
      timestamp: Date.now()
    }
    const next = [attempt, ...attempts]
    setAttempts(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setResultMessage(correct ? "Correct — well done!" : `Incorrect. ${q.solution ?? ""}`)
  }

  function nextQuestion() {
    setSelected(null)
    setResultMessage(null)
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1)
    } else {
      setResultMessage("No more questions. Change topic or re-run search.")
    }
  }

  function clearAttempts() {
    localStorage.removeItem(STORAGE_KEY)
    setAttempts([])
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <Card title="Smart Practice Engine" subtitle="The system automatically matches past exam questions related to the current learning topic from the database.">
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <label className="text-sm font-medium shrink-0">Topic</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Enter topic or select"
                className="rounded border px-2 py-1 w-full sm:w-auto"
              />
              <select className="rounded border px-2 py-1 w-full sm:w-auto" onChange={e => setTopic(e.target.value)} value={topic}>
                <option value="">-- select --</option>
                {availableTopics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <Button onClick={findQuestions}>Find questions</Button>
            </div>

            {resultMessage && <div className="text-sm text-red-600">{resultMessage}</div>}

            {questions.length > 0 && (
              <div className="rounded border p-4 bg-white dark:bg-gray-900">
                <div className="font-semibold">Question {currentIdx + 1} of {questions.length}</div>
                <div className="mt-2">{questions[currentIdx].stem}</div>
                <div className="mt-3 space-y-2">
                  {questions[currentIdx].choices.map((c, i) => (
                    <label key={i} className="flex items-center gap-2">
                      <input type="radio" name="choice" checked={selected === i} onChange={() => setSelected(i)} />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={submitAnswer}>Submit answer</Button>
                  <Button variant="secondary" onClick={nextQuestion}>Next question</Button>
                </div>
                {resultMessage && <div className="mt-2 text-sm">{resultMessage}</div>}
              </div>
            )}

            <div className="mt-4">
              <div className="font-semibold">Past attempts</div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {attempts.length === 0 ? (
                  <div>No attempts yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {attempts.map((a, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{new Date(a.timestamp).toLocaleString()} — {a.topic} — {a.correct ? "Correct" : "Incorrect"}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2">
                  <Button variant="ghost" onClick={clearAttempts}>Clear attempts</Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}

export default SmartPracticeEngine;
