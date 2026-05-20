import { useEffect, useState, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { Database, Plus, Edit2, Trash2, Search, RefreshCw, Filter } from "lucide-react"

type Question = {
  id: string
  question_text: string
  question_type: string
  difficulty: number
  skill_dim: string
  score_max: number
  subject_name: string
  times_used: number
  avg_score: number
  created_at: string
}

type Subject = { id: string; code: string; name: string }

const DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" }
const DIFFICULTY_COLOR: Record<number, string> = {
  1: "bg-green-100 text-green-700",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-red-100 text-red-700",
}

export function TeacherQuestionBankPage() {
  const { showToast } = useToast()
  const [questions, setQuestions] = useState<Question[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterSubject, setFilterSubject] = useState("")
  const [filterDifficulty, setFilterDifficulty] = useState("")
  const [filterType, setFilterType] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [newQ, setNewQ] = useState({ question_text: "", question_type: "mcq", difficulty: 1, skill_dim: "concept", score_max: 1, subject_id: "", correct_answer: "" })

  // pull questions and subjects together, applying the active filters
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterSubject) params.set("subject_id", filterSubject)
      if (filterDifficulty) params.set("difficulty", filterDifficulty)
      if (filterType) params.set("question_type", filterType)
      if (search) params.set("search", search)
      const [qRes, sRes] = await Promise.all([
        apiClient.get<{ questions: Question[] }>(`/api/teacher/question-bank?${params}`),
        apiClient.get<{ subjects: Subject[] }>("/api/teacher/subjects"),
      ])
      setQuestions(qRes.questions)
      setSubjects(sRes.subjects)
    } catch {
      showToast("Failed to load questions", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast, filterSubject, filterDifficulty, filterType, search])

  useEffect(() => { load() }, [load])

  const deleteQuestion = async (id: string) => {
    try {
      await apiClient.delete(`/api/teacher/question-bank/${id}`)
      showToast("Question deleted", "success")
      load()
    } catch {
      showToast("Failed to delete", "error")
    }
  }

  const createQuestion = async () => {
    if (!newQ.question_text.trim() || !newQ.correct_answer.trim()) {
      showToast("Question text and correct answer are required", "error")
      return
    }
    try {
      await apiClient.post("/api/teacher/question-bank", {
        ...newQ,
        correct_answer: newQ.correct_answer,
        subject_id: newQ.subject_id || null,
      })
      showToast("Question created", "success")
      setShowForm(false)
      setNewQ({ question_text: "", question_type: "mcq", difficulty: 1, skill_dim: "concept", score_max: 1, subject_id: "", correct_answer: "" })
      load()
    } catch {
      showToast("Failed to create question", "error")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Question Bank</h1>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4 mr-1" /> New Question
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm"
            placeholder="Search questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
          />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
          <option value="">All Difficulties</option>
          <option value="1">Easy</option>
          <option value="2">Medium</option>
          <option value="3">Hard</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="mcq">MCQ</option>
          <option value="tf">True/False</option>
          <option value="short">Short Answer</option>
          <option value="fill">Fill in the Blank</option>
        </select>
      </Card>

      {/* Create form */}
      {showForm && (
        <Card className="p-4 space-y-3 border-blue-200 bg-blue-50/30">
          <p className="font-medium text-sm">New Question</p>
          <textarea rows={2} className="w-full border rounded-lg p-2 text-sm" placeholder="Question text..." value={newQ.question_text} onChange={e => setNewQ(v => ({ ...v, question_text: e.target.value }))} />
          <input className="w-full border rounded-lg p-2 text-sm" placeholder="Correct answer..." value={newQ.correct_answer} onChange={e => setNewQ(v => ({ ...v, correct_answer: e.target.value }))} />
          <div className="flex gap-2 flex-wrap">
            <select className="border rounded-lg px-2 py-1.5 text-sm" value={newQ.question_type} onChange={e => setNewQ(v => ({ ...v, question_type: e.target.value }))}>
              <option value="mcq">MCQ</option><option value="tf">True/False</option><option value="short">Short</option><option value="fill">Fill</option>
            </select>
            <select className="border rounded-lg px-2 py-1.5 text-sm" value={newQ.difficulty} onChange={e => setNewQ(v => ({ ...v, difficulty: Number(e.target.value) }))}>
              <option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Hard</option>
            </select>
            <select className="border rounded-lg px-2 py-1.5 text-sm" value={newQ.subject_id} onChange={e => setNewQ(v => ({ ...v, subject_id: e.target.value }))}>
              <option value="">No Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={createQuestion}>Save</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : questions.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">No questions found.</Card>
      ) : (
        <div className="space-y-2">
          {questions.map(q => (
            <Card key={q.id} className="p-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2">{q.question_text}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${DIFFICULTY_COLOR[q.difficulty]}`}>{DIFFICULTY_LABEL[q.difficulty]}</span>
                  <span className="text-xs text-gray-400">{q.question_type.toUpperCase()}</span>
                  {q.subject_name && <span className="text-xs text-gray-400">{q.subject_name}</span>}
                  <span className="text-xs text-gray-400">Used {q.times_used}×</span>
                  {q.avg_score != null && <span className="text-xs text-gray-400">Avg {q.avg_score}</span>}
                </div>
              </div>
              <button onClick={() => deleteQuestion(q.id)} className="p-1.5 hover:bg-red-50 rounded shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
