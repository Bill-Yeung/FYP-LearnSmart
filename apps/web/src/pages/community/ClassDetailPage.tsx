import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import {
  ArrowLeft, Users, ClipboardList,
  Clock, GraduationCap, User, Play, Send, CheckCircle2,
  PenLine, Gamepad2, FileQuestion, Layers, X, Eye, Star, MessageSquare
} from "lucide-react"

type ClassTeacher = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type ClassDetail = {
  id: string
  name: string
  description: string | null
  course_code: string | null
  course_name: string | null
  student_count: number
  created_at: string | null
  teacher: ClassTeacher
}

type Classmate = {
  id: string
  username: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  joined_at: string | null
}

type AssignmentSubmission = {
  id: string
  status: string
  submitted_at: string | null
  answer_text?: string | null
  grade?: number | null
  teacher_feedback?: string | null
}

type Assignment = {
  id: string
  title: string
  description: string | null
  assignment_type: string
  due_at: string | null
  created_at: string | null
  template_id?: string | null
  script_id?: string | null
  submission?: AssignmentSubmission | null
}

type Tab = "assignments" | "classmates"

function getAssignmentTypeStyle(type: string) {
  const styles: Record<string, { bg: string; text: string; Icon: typeof PenLine; label: string }> = {
    text:   { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", Icon: PenLine,      label: "Written" },
    script: { bg: "bg-purple-100 dark:bg-purple-900/30",   text: "text-purple-700 dark:text-purple-300",   Icon: Gamepad2,     label: "Script Kill" },
    quiz:   { bg: "bg-blue-100 dark:bg-blue-900/30",       text: "text-blue-700 dark:text-blue-300",       Icon: FileQuestion, label: "Quiz" },
    mixed:  { bg: "bg-orange-100 dark:bg-orange-900/30",   text: "text-orange-700 dark:text-orange-300",   Icon: Layers,       label: "Mixed" },
  }
  return styles[type] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", Icon: ClipboardList, label: type }
}

function getSubmissionStatusStyle(status: string) {
  switch (status) {
    case "in_progress":
      return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", label: "In Progress" }
    case "submitted":
      return { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "Submitted" }
    case "graded":
      return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Graded" }
    default:
      return null
  }
}

export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null)
  const [classmates, setClassmates] = useState<Classmate[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, setActiveTab] = useState<Tab>("assignments")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [answerModal, setAnswerModal] = useState<Assignment | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [answerSubmitting, setAnswerSubmitting] = useState(false)
  const [viewModal, setViewModal] = useState<Assignment | null>(null)

  const fetchClassDetail = useCallback(async () => {
    if (!classId) return
    try {
      const data = await apiClient.get<{ class: ClassDetail; classmates: Classmate[]; assignments: Assignment[] }>(`/api/classroom/${classId}`)
      if (data?.class) setClassDetail(data.class)
      setClassmates(data?.classmates ?? [])
      setAssignments(data?.assignments ?? [])
      logActivity("assignment", "view", classId, { assignment_count: data?.assignments?.length ?? 0 })
    } catch (e: any) {
      console.error("Failed to load class:", e)
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    fetchClassDetail()
  }, [fetchClassDetail])

  // mark the assignment as started, refresh, and jump into the script game if applicable
  async function handleStart(assignment: Assignment) {
    setActionLoading(assignment.id)
    try {
      const data = await apiClient.post<{ template_id?: string | null }>(`/api/classroom/assignments/${assignment.id}/start`, {})
      await fetchClassDetail()
      if (data?.template_id) {
        navigate(`/game/script/${data.template_id}/play`)
      }
    } catch (e: any) {
      console.error("Failed to start assignment:", e)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSubmit(assignment: Assignment) {
    setActionLoading(assignment.id)
    try {
      await apiClient.post(`/api/classroom/assignments/${assignment.id}/submit`, {})
      await fetchClassDetail()
    } catch (e: any) {
      console.error("Failed to submit assignment:", e)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSubmitAnswer() {
    if (!answerModal || !answerText.trim()) return
    setAnswerSubmitting(true)
    try {
      await apiClient.post(`/api/classroom/assignments/${answerModal.id}/submit-text`, { answer_text: answerText.trim() })
      setAnswerModal(null)
      setAnswerText("")
      await fetchClassDetail()
    } catch (e: any) {
      console.error("Failed to submit answer:", e)
    } finally {
      setAnswerSubmitting(false)
    }
  }

  const teacherName = classDetail?.teacher?.display_name || classDetail?.teacher?.username || "Unknown"
  const upcomingAssignments = assignments.filter(a => !a.due_at || new Date(a.due_at) >= new Date())
  const pastDueAssignments = assignments.filter(a => a.due_at && new Date(a.due_at) < new Date())

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    )
  }

  if (!classDetail) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Class not found</p>
        <Button onClick={() => navigate("/community/studygroups")} className="mt-4">Back to Study Groups</Button>
      </div>
    )
  }

  function renderAssignmentCard(a: Assignment, isPastDue: boolean) {
    const style = getAssignmentTypeStyle(a.assignment_type)
    const submissionStatus = a.submission ? getSubmissionStatusStyle(a.submission.status) : null
    const isLoading = actionLoading === a.id
    const hasNotStarted = !a.submission || a.submission.status === "not_started"
    const isInProgress = a.submission?.status === "in_progress"
    const isSubmitted = a.submission?.status === "submitted"
    const isGraded = a.submission?.status === "graded"

    return (
      <Card key={a.id} className={isPastDue ? "opacity-75" : ""}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white">{a.title}</h3>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1", style.bg, style.text)}>
                <style.Icon className="w-3 h-3" /> {style.label}
              </span>
              {submissionStatus && (
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", submissionStatus.bg, submissionStatus.text)}>
                  {submissionStatus.label}
                </span>
              )}
            </div>
            {a.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{a.description}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {a.due_at && (
                <div className={cn("flex items-center gap-1.5 text-xs", isPastDue ? "text-red-500" : "text-gray-500 dark:text-gray-400")}>
                  <Clock className="w-3 h-3" />
                  {isPastDue ? "Past due: " : "Due: "}
                  {new Date(a.due_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              {a.submission?.submitted_at && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Submitted {new Date(a.submission.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              {isGraded && a.submission?.grade != null && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <Star className="w-3 h-3" />
                  Grade: {a.submission.grade}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 ml-3 flex-shrink-0">
            {/* Text: Write Answer directly */}
            {a.assignment_type === "text" && !isSubmitted && !isGraded && !isPastDue && (
              <Button
                onClick={() => { setAnswerModal(a); setAnswerText(a.submission?.answer_text || "") }}
                className="flex items-center gap-1.5 text-sm"
              >
                <PenLine className="w-3.5 h-3.5" />
                Write Answer
              </Button>
            )}

            {/* Script Kill: Navigate to game directly */}
            {a.assignment_type === "script" && !isSubmitted && !isGraded && !isPastDue && (
              <Button
                onClick={() => {
                  if (hasNotStarted) handleStart(a)
                  else if (a.script_id) navigate(`/game/script/${a.script_id}/play`)
                  else navigate("/game/play")
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-sm"
              >
                {isLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Gamepad2 className="w-3.5 h-3.5" />
                )}
                {hasNotStarted ? "Play" : "Continue"}
              </Button>
            )}

            {/* Quiz: Navigate to practice exam */}
            {a.assignment_type === "quiz" && !isSubmitted && !isGraded && !isPastDue && (
              <Button
                onClick={async () => {
                  if (hasNotStarted) await handleStart(a)
                  navigate("/application/practice-exam")
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-sm"
              >
                {isLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <FileQuestion className="w-3.5 h-3.5" />
                )}
                {hasNotStarted ? "Start Quiz" : "Continue Quiz"}
              </Button>
            )}

            {(a.assignment_type === "script" || a.assignment_type === "quiz") && isInProgress && (
              <Button
                variant="secondary"
                onClick={() => handleSubmit(a)}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Mark Done
              </Button>
            )}

            {a.assignment_type !== "text" && a.assignment_type !== "script" && a.assignment_type !== "quiz" && !isSubmitted && !isGraded && !isPastDue && (
              <Button
                onClick={() => hasNotStarted ? handleStart(a) : handleSubmit(a)}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-sm"
              >
                {isLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : hasNotStarted ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {hasNotStarted ? "Start" : "Submit"}
              </Button>
            )}

            {/* View submitted work */}
            {(isSubmitted || isGraded) && (
              <Button
                variant="secondary"
                onClick={() => setViewModal(a)}
                className="flex items-center gap-1.5 text-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/community/studygroups")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Study Groups
        </button>

        {/* Header Card */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{classDetail.name}</h1>
                {classDetail.course_code && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono">
                    {classDetail.course_code}
                  </span>
                )}
              </div>
              {classDetail.course_name && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{classDetail.course_name}</p>
              )}
              {classDetail.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{classDetail.description}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0 space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 justify-end">
                <User className="w-4 h-4" />
                <span>{teacherName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 justify-end">
                <Users className="w-4 h-4" />
                <span>{classDetail.student_count} student{classDetail.student_count !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {([
          { id: "assignments" as Tab, label: "Assignments", icon: ClipboardList, count: assignments.length },
          { id: "classmates" as Tab, label: "Classmates", icon: Users, count: classmates.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Assignments Tab */}
      {activeTab === "assignments" && (
        <div className="space-y-6">
          {/* Upcoming */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Upcoming ({upcomingAssignments.length})
            </h2>
            {upcomingAssignments.length === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No upcoming assignments</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.map((a) => renderAssignmentCard(a, false))}
              </div>
            )}
          </div>

          {/* Past Due */}
          {pastDueAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Past Due ({pastDueAssignments.length})
              </h2>
              <div className="space-y-3">
                {pastDueAssignments.map((a) => renderAssignmentCard(a, true))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classmates Tab */}
      {activeTab === "classmates" && (
        <div>
          {classmates.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No classmates yet</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {classmates.map((mate) => (
                <Card key={mate.id}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {(mate.display_name || mate.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {mate.display_name || mate.username}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">@{mate.username}</div>
                    </div>
                    {mate.joined_at && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        Joined {new Date(mate.joined_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Answer Modal */}
      {answerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAnswerModal(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{answerModal.title}</h3>
              <button onClick={() => setAnswerModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            {answerModal.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{answerModal.description}</p>
            )}
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Write your answer here..."
              className="w-full h-40 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setAnswerModal(null)}>Cancel</Button>
              <Button
                onClick={handleSubmitAnswer}
                disabled={answerSubmitting || !answerText.trim()}
                className="flex items-center gap-1.5"
              >
                {answerSubmitting ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Submit Answer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Submission Modal */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewModal(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewModal.title}</h3>
              <button onClick={() => setViewModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submission status */}
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {viewModal.submission?.status === "graded" ? "Graded" : "Submitted"}
              </span>
              {viewModal.submission?.submitted_at && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  on {new Date(viewModal.submission.submitted_at).toLocaleString()}
                </span>
              )}
            </div>

            {/* Answer text */}
            {viewModal.submission?.answer_text && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Answer</label>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {viewModal.submission.answer_text}
                </div>
              </div>
            )}

            {/* Grade */}
            {viewModal.submission?.grade != null && (
              <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Grade: {viewModal.submission.grade}</span>
                </div>
                {viewModal.submission.teacher_feedback && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      <MessageSquare className="w-3 h-3" />
                      Teacher Feedback
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{viewModal.submission.teacher_feedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* No content to show */}
            {!viewModal.submission?.answer_text && viewModal.submission?.grade == null && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                {viewModal.assignment_type === "script" ? "Script Kill game completed." : "Assignment submitted."}
              </p>
            )}

            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setViewModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
