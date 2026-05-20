import React, { useState, useEffect } from "react"

type Props = {
  questions?: string[]
  onSubmit: (question: string, answer: string) => Promise<void>
  onClose?: () => void
}

export function FollowupChat({ questions = [], onSubmit, onClose }: Props) {
  const [answer, setAnswer] = useState("")
  const [history, setHistory] = useState<Array<{ sender: "ai" | "user"; text: string }>>([])
  const [askedKeys, setAskedKeys] = useState<Set<string>>(new Set())
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  // Append any new AI questions to the running history without wiping past turns.
  useEffect(() => {
    if (questions.length === 0) return
    setAskedKeys(prev => {
      const next = new Set(prev)
      const additions: Array<{ sender: "ai"; text: string }> = []
      for (const q of questions) {
        if (!q) continue
        if (!next.has(q)) {
          next.add(q)
          additions.push({ sender: "ai", text: q })
        }
      }
      if (additions.length > 0) {
        setHistory(h => [...h, ...additions])
        if (pendingQuestion === null) setPendingQuestion(additions[0].text)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.join("||")])

  const handleSubmit = async () => {
    const q = pendingQuestion ?? questions.find(qq => !!qq)
    if (!q || !answer.trim()) return
    const userAnswer = answer.trim()
    setHistory(prev => [...prev, { sender: "user", text: userAnswer }])
    setAnswer("")
    setPendingQuestion(null)
    try {
      await onSubmit(q, userAnswer)
    } catch (err) {
      setHistory(prev => [...prev, { sender: "ai", text: "(Failed to submit answer)" }])
    }
  }

  const currentQuestion = pendingQuestion ?? questions.find(q => !askedKeys.has(q)) ?? null

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Follow-up questions</h4>
        {onClose && (
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-300">Close</button>
        )}
      </div>

      <div className="max-h-60 overflow-y-auto space-y-3 pb-2">
        {history.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-300">No follow-up questions.</p>}
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.sender === "ai" ? "justify-start" : "justify-end"}`}>
            <div className={`rounded-lg px-3 py-2 text-sm ${m.sender === "ai" ? "bg-gray-100 text-gray-900 dark:bg-gray-700/30 dark:text-gray-100" : "bg-purple-50 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200"}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {currentQuestion ? (
        <div className="mt-3">
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">Question: <span className="font-medium text-gray-800 dark:text-gray-100">{currentQuestion}</span></p>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Type your answer to the AI's question"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={handleSubmit} className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700">Send</button>
            {onClose && <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Close</button>}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">No more follow-up questions.</div>
      )}
    </div>
  )
}

export default FollowupChat
