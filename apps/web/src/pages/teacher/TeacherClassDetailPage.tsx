import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"
import { DateInput } from "../../components/ui/DateInput"
import {
  ArrowLeft, Users, ClipboardList, Plus, Clock,
  GraduationCap, Pencil, Trash2, X, Download,
  Mail, Calendar, Eye, Send, Award, MessageSquare,
  PenLine, Gamepad2, FileQuestion, Layers
} from "lucide-react"


type ClassDetail = {
  id: string
  name: string
  description: string | null
  class_code: string
  course_name: string | null
  student_count: number
  status: string
  created_at: string | null
}

type Student = {
  id: string
  username: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  joined_at: string | null
}

type StudentDetail = {
  student: {
    id: string
    username: string
    email: string | null
    display_name: string | null
    avatar_url: string | null
  }
  classes: {
    class_id: string
    class_name: string
    course_code: string | null
    joined_at: string | null
    submissions_count: number
    total_assignments: number
  }[]
}

type Assignment = {
  id: string
  title: string
  description: string | null
  assignment_type: string
  class_id: string
  class_name?: string
  course_code?: string
  due_at: string | null
  created_at: string | null
  submission_count?: number
  student_count?: number
}

type Submission = {
  id: string
  student_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  answer_text: string | null
  status: string
  grade: number | null
  teacher_feedback: string | null
  submitted_at: string | null
  graded_at: string | null
}

type Tab = "students" | "assignments"


export function TeacherClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, setActiveTab] = useState<Tab>("students")
  const [loading, setLoading] = useState(true)

  const [pendingEnrollments, setPendingEnrollments] = useState<{ id: string; student_id: string; username: string; display_name: string | null; avatar_url: string | null; requested_at: string | null }[]>([])

  const [studentSearch, setStudentSearch] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null)
  const [studentDetailLoading, setStudentDetailLoading] = useState(false)
  const [studentModalTab, setStudentModalTab] = useState<"info" | "activity">("info")
  const [studentActivity, setStudentActivity] = useState<{ activities: any[]; daily_summary: Record<string, number>; streak: number } | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)

  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [assignmentForm, setAssignmentForm] = useState({ title: "", description: "", assignment_type: "script", due_date: "", due_time: "23:59" })
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [submissionsModal, setSubmissionsModal] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [gradeForm, setGradeForm] = useState<{ grade: string; feedback: string }>({ grade: "", feedback: "" })

  // pull the class info, assignments, and pending enrollments in parallel
  const fetchClassData = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    try {
      const [classData, assignmentsData, pendingData] = await Promise.all([
        apiClient.get<{ class: any; classmates: any[]; assignments: Assignment[] }>(`/api/classroom/${classId}`),
        apiClient.get<{ assignments: Assignment[] }>("/api/classroom/teacher/assignments").catch(() => null),
        apiClient.get<{ pending: any[] }>(`/api/classroom/teacher/classes/${classId}/pending`).catch(() => null),
      ])

      if (classData?.class) {
        setClassDetail({
          id: classData.class.id,
          name: classData.class.name,
          description: classData.class.description,
          class_code: classData.class.course_code || "",
          course_name: classData.class.course_name,
          student_count: classData.class.student_count || 0,
          status: "active",
          created_at: classData.class.created_at,
        })
      }
      setStudents((classData?.classmates ?? []).map((m: any) => ({
        id: m.id,
        username: m.username,
        email: m.email,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
        joined_at: m.joined_at,
      })))
      setPendingEnrollments(pendingData?.pending ?? [])
      const classAssignments = classData?.assignments ?? []
      if (classAssignments.length > 0) {
        setAssignments(classAssignments)
      } else if (assignmentsData?.assignments) {
        setAssignments(assignmentsData.assignments.filter((a: any) => a.class_id === classId))
      }
    } catch (e: any) {
      console.error("Failed to load class details:", e)
    } finally {
      setLoading(false)
    }
  }, [classId])

  // refetch class data when the loader changes (effectively on classId change)
  useEffect(() => {
    fetchClassData()
  }, [fetchClassData])

  // approve or reject a pending enrolment request and refresh the page
  async function handleEnrollment(enrollmentId: string, action: "approve" | "reject") {
    try {
      await apiClient.post(`/api/classroom/teacher/enrollments/${enrollmentId}/${action}`)
      showToast(action === "approve" ? "Student approved" : "Student rejected")
      fetchClassData()
    } catch (e: any) {
      showToast(e?.message || `Failed to ${action}`)
    }
  }

  // open the student profile modal and load their cross-class info
  async function openStudentDetail(studentId: string) {
    setSelectedStudentId(studentId)
    setStudentModalTab("info")
    setStudentActivity(null)
    setStudentDetailLoading(true)
    try {
      const data = await apiClient.get<StudentDetail>(`/api/classroom/teacher/students/${studentId}`)
      setStudentDetail(data)
    } catch {
      showToast("Failed to load student details")
    } finally {
      setStudentDetailLoading(false)
    }
  }

  // lazy-load activity data when the user opens the activity tab
  async function loadStudentActivity(studentId: string) {
    setActivityLoading(true)
    try {
      const data = await apiClient.get<any>(`/api/classroom/teacher/students/${studentId}/activity`)
      setStudentActivity(data)
    } catch {
      showToast("Failed to load activity")
    } finally {
      setActivityLoading(false)
    }
  }

  // build a csv from the visible student rows and trigger a browser download
  function exportStudentsCSV() {
    if (students.length === 0) {
      showToast("No students to export")
      return
    }
    const headers = ["Username", "Display Name", "Email", "Joined At"]
    const rows = filteredStudents.map(s => [
      s.username,
      s.display_name || "",
      s.email || "",
      s.joined_at ? new Date(s.joined_at).toLocaleDateString() : "",
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${classDetail?.name || "class"}-students.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Exported ${filteredStudents.length} students`)
  }

  // reset the assignment form and open the modal in create mode
  function openCreateAssignment() {
    setEditingAssignment(null)
    setAssignmentForm({ title: "", description: "", assignment_type: "script", due_date: "", due_time: "23:59" })
    setShowAssignmentModal(true)
  }

  // pre-fill the assignment form from the existing record and open in edit mode
  function openEditAssignment(a: Assignment) {
    setEditingAssignment(a)
    let due_date = ""
    let due_time = "23:59"
    if (a.due_at) {
      const d = new Date(a.due_at)
      due_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      due_time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    }
    setAssignmentForm({
      title: a.title,
      description: a.description || "",
      assignment_type: a.assignment_type,
      due_date,
      due_time,
    })
    setShowAssignmentModal(true)
  }

  // post or put the assignment depending on edit-vs-create state
  async function handleSaveAssignment() {
    if (!assignmentForm.title.trim()) return
    setAssignmentSaving(true)
    try {
      let due_at: string | null = null
      if (assignmentForm.due_date) {
        const d = new Date(`${assignmentForm.due_date}T${assignmentForm.due_time}:00`)
        due_at = d.toISOString()
      }
      const body: any = {
        title: assignmentForm.title.trim(),
        description: assignmentForm.description.trim(),
        assignment_type: assignmentForm.assignment_type,
        due_at,
      }

      if (editingAssignment) {
        await apiClient.put(`/api/classroom/teacher/assignments/${editingAssignment.id}`, body)
        showToast("Assignment updated")
      } else {
        body.class_id = classId
        await apiClient.post("/api/classroom/teacher/assignments", body)
        showToast("Assignment created")
      }
      setShowAssignmentModal(false)
      fetchClassData()
    } catch {
      showToast("Failed to save assignment")
    } finally {
      setAssignmentSaving(false)
    }
  }

  // remove an assignment and optimistically drop it from local state
  async function handleDeleteAssignment(id: string) {
    setDeletingId(id)
    try {
      await apiClient.delete(`/api/classroom/teacher/assignments/${id}`)
      showToast("Assignment deleted")
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch {
      showToast("Failed to delete assignment")
    } finally {
      setDeletingId(null)
    }
  }

  // open the submissions modal for an assignment and load its records
  async function openSubmissions(assignment: Assignment) {
    setSubmissionsModal(assignment)
    setSubmissionsLoading(true)
    setGradingId(null)
    try {
      const data = await apiClient.get<{ submissions: Submission[] }>(`/api/classroom/teacher/assignments/${assignment.id}/submissions`)
      setSubmissions(data?.submissions ?? [])
    } catch {
      showToast("Failed to load submissions")
    } finally {
      setSubmissionsLoading(false)
    }
  }

  // validate the grade input and post the grade plus feedback for a submission
  async function handleGrade(submissionId: string) {
    const grade = parseFloat(gradeForm.grade)
    if (isNaN(grade) || grade < 0 || grade > 100) {
      showToast("Grade must be between 0 and 100")
      return
    }
    try {
      await apiClient.post(`/api/classroom/teacher/submissions/${submissionId}/grade`, {
        grade,
        feedback: gradeForm.feedback.trim(),
      })
      showToast("Submission graded")
      setGradingId(null)
      setGradeForm({ grade: "", feedback: "" })
      if (submissionsModal) openSubmissions(submissionsModal)
    } catch {
      showToast("Failed to grade submission")
    }
  }

  const filteredStudents = students.filter(s =>
    (s.display_name || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.username.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(studentSearch.toLowerCase())
  )

  const upcomingAssignments = assignments.filter(a => !a.due_at || new Date(a.due_at) >= new Date())
  const pastDueAssignments = assignments.filter(a => a.due_at && new Date(a.due_at) < new Date())

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading class...</span>
        </div>
      </div>
    )
  }

  if (!classDetail) {
    return (
      <div className="mx-auto max-w-6xl py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Class not found</p>
        <Button onClick={() => navigate("/classroom/classes")} className="mt-4">Back to Classes</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <button
        onClick={() => navigate("/classroom/classes")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Manage Classes
      </button>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{classDetail.name}</h1>
              {classDetail.class_code && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono">
                  {classDetail.class_code}
                </span>
              )}
            </div>
            {classDetail.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{classDetail.description}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0 space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 justify-end">
              <Users className="w-4 h-4" />
              <span>{students.length} student{students.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 justify-end">
              <ClipboardList className="w-4 h-4" />
              <span>{assignments.length} assignment{assignments.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-6 flex gap-2">
        {([
          { id: "students" as Tab, label: "Students", icon: Users, count: students.length },
          { id: "assignments" as Tab, label: "Assignments", icon: ClipboardList, count: assignments.length },
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

      {activeTab === "students" && (
        <>
          {pendingEnrollments.length > 0 && (
            <Card className="mb-4 border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Requests ({pendingEnrollments.length})
              </h3>
              <div className="space-y-2">
                {pendingEnrollments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/10 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-medium">
                        {(p.display_name || p.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{p.display_name || p.username}</span>
                        {p.display_name && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1.5">@{p.username}</span>}
                        {p.requested_at && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">Requested {new Date(p.requested_at).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="primary" onClick={() => handleEnrollment(p.id, "approve")} className="!py-1 !px-3 !text-xs">
                        Approve
                      </Button>
                      <Button variant="ghost" onClick={() => handleEnrollment(p.id, "reject")} className="!py-1 !px-3 !text-xs text-red-500">
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="mb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex-1 w-full sm:max-w-md">
                <TextField
                  label=""
                  placeholder="Search by name, username, or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={exportStudentsCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">Student</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">Joined</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                            {(student.display_name || student.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {student.display_name || student.username}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              @{student.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                        {student.email || "-"}
                      </td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                        {student.joined_at ? new Date(student.joined_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" onClick={() => openStudentDetail(student.id)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredStudents.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {studentSearch ? "No students found matching your search" : "No students enrolled yet"}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {activeTab === "assignments" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div />
            <Button onClick={openCreateAssignment}>
              <Plus className="w-4 h-4 mr-2" />
              Create Assignment
            </Button>
          </div>

          {assignments.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No assignments yet</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Create your first assignment for this class
                </p>
                <Button className="mt-4" onClick={openCreateAssignment}>
                  Create Assignment
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Upcoming */}
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                  Upcoming / Active ({upcomingAssignments.length})
                </h2>
                {upcomingAssignments.length === 0 ? (
                  <Card>
                    <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">No upcoming assignments</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {upcomingAssignments.map((a) => (
                      <AssignmentCard
                        key={a.id}
                        assignment={a}
                        onEdit={() => openEditAssignment(a)}
                        onDelete={() => handleDeleteAssignment(a.id)}
                        onViewSubmissions={() => openSubmissions(a)}
                        deleting={deletingId === a.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Past Due */}
              {pastDueAssignments.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                    Past Due ({pastDueAssignments.length})
                  </h2>
                  <div className="space-y-3">
                    {pastDueAssignments.map((a) => (
                      <AssignmentCard
                        key={a.id}
                        assignment={a}
                        onEdit={() => openEditAssignment(a)}
                        onDelete={() => handleDeleteAssignment(a.id)}
                        onViewSubmissions={() => openSubmissions(a)}
                        deleting={deletingId === a.id}
                        pastDue
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {selectedStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedStudentId(null)}>
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Student Details</h2>
              <button
                onClick={() => setSelectedStudentId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {studentDetailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                <span className="ml-2 text-sm text-gray-500">Loading...</span>
              </div>
            ) : studentDetail ? (
              <div className="space-y-4">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                    {(studentDetail.student.display_name || studentDetail.student.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {studentDetail.student.display_name || studentDetail.student.username}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{studentDetail.student.username}</p>
                    {studentDetail.student.email && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Mail className="w-3.5 h-3.5" />
                        {studentDetail.student.email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs: Info / Activity */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setStudentModalTab("info")}
                    className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      studentModalTab === "info"
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    )}
                  >Classes</button>
                  <button
                    onClick={() => {
                      setStudentModalTab("activity")
                      if (!studentActivity && selectedStudentId) loadStudentActivity(selectedStudentId)
                    }}
                    className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      studentModalTab === "activity"
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    )}
                  >Activity</button>
                </div>

                {studentModalTab === "info" ? (
                  /* Classes enrolled under this teacher */
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Enrolled Classes ({studentDetail.classes.length})
                    </h4>
                    {studentDetail.classes.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No classes found</p>
                    ) : (
                      <div className="space-y-2">
                        {studentDetail.classes.map((c) => (
                          <div key={c.class_id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-gray-900 dark:text-white text-sm">{c.class_name}</span>
                                {c.course_code && (
                                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-mono">{c.course_code}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Joined {c.joined_at ? new Date(c.joined_at).toLocaleDateString() : "-"}
                              </span>
                              <span className="flex items-center gap-1">
                                <ClipboardList className="w-3 h-3" />
                                {c.submissions_count}/{c.total_assignments} submitted
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Activity tab */
                  <div>
                    {activityLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                        <span className="ml-2 text-sm text-gray-500">Loading activity...</span>
                      </div>
                    ) : studentActivity ? (
                      <div className="space-y-4">
                        {/* Streak + summary stats */}
                        <div className="flex gap-3">
                          <div className="flex-1 rounded-lg bg-orange-50 p-3 text-center dark:bg-orange-900/20">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{studentActivity.streak}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Day Streak</div>
                          </div>
                          <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Object.keys(studentActivity.daily_summary).length}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Active Days</div>
                          </div>
                          <div className="flex-1 rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/20">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{studentActivity.activities.length}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Activities</div>
                          </div>
                        </div>

                        {/* Activity heatmap */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">Last 30 Days</h4>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: 30 }, (_, i) => {
                              const d = new Date()
                              d.setDate(d.getDate() - (29 - i))
                              const key = d.toISOString().slice(0, 10)
                              const count = studentActivity.daily_summary[key] || 0
                              return (
                                <div
                                  key={key}
                                  title={`${key}: ${count} activities`}
                                  className={cn("w-3.5 h-3.5 rounded-sm", count === 0
                                    ? "bg-gray-100 dark:bg-gray-700"
                                    : count <= 2 ? "bg-green-200 dark:bg-green-800"
                                    : count <= 5 ? "bg-green-400 dark:bg-green-600"
                                    : "bg-green-600 dark:bg-green-400"
                                  )}
                                />
                              )
                            })}
                          </div>
                        </div>

                        {/* Recent activity list */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">Recent Activity</h4>
                          {studentActivity.activities.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No activity recorded</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {studentActivity.activities.slice(0, 30).map((a: any, i: number) => (
                                <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
                                  <div className="flex items-center gap-2">
                                    <span className={cn("w-2 h-2 rounded-full",
                                      a.activity_type === "flashcard" ? "bg-blue-500"
                                      : a.activity_type === "quiz" ? "bg-purple-500"
                                      : a.activity_type === "assignment" ? "bg-yellow-500"
                                      : a.activity_type === "challenge" ? "bg-orange-500"
                                      : a.activity_type === "document" ? "bg-cyan-500"
                                      : a.activity_type === "error_review" ? "bg-red-500"
                                      : "bg-gray-400"
                                    )} />
                                    <span className="text-sm text-gray-900 dark:text-white capitalize">
                                      {a.activity_type.replace(/_/g, " ")}
                                    </span>
                                    {a.sub_type && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {a.sub_type}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                    {a.created_at ? new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-center py-4 text-sm text-gray-500">No activity data</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-4 text-gray-500">Failed to load student details</p>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT ASSIGNMENT MODAL */}
      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAssignmentModal(false)}>
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingAssignment ? "Edit Assignment" : "Create Assignment"}
              </h2>
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <TextField
                label="Title"
                placeholder="e.g., Chapter 3 Quiz"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm(f => ({ ...f, title: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Brief description of the assignment"
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assignment Type
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "text", label: "Written", Icon: PenLine },
                    { value: "script", label: "Script Kill", Icon: Gamepad2 },
                    { value: "quiz", label: "Quiz", Icon: FileQuestion },
                    { value: "mixed", label: "Mixed", Icon: Layers },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setAssignmentForm(f => ({ ...f, assignment_type: type.value }))}
                      className={cn(
                        "flex-1 rounded-lg border p-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                        assignmentForm.assignment_type === type.value
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500"
                      )}
                    >
                      <type.Icon className="w-4 h-4" /> {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date (optional)
                  </label>
                  <DateInput
                    value={assignmentForm.due_date}
                    onChange={(v) => setAssignmentForm(f => ({ ...f, due_date: v }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Select date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    value={assignmentForm.due_time}
                    onChange={(e) => setAssignmentForm(f => ({ ...f, due_time: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAssignmentModal(false)}>Cancel</Button>
              <Button onClick={handleSaveAssignment} disabled={assignmentSaving || !assignmentForm.title.trim()}>
                {assignmentSaving ? "Saving..." : editingAssignment ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {submissionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSubmissionsModal(null)}>
          <div
            className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Submissions</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{submissionsModal.title}</p>
              </div>
              <button
                onClick={() => setSubmissionsModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                <span className="ml-2 text-sm text-gray-500">Loading submissions...</span>
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No submissions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    {/* Student info + status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {(s.display_name || s.username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{s.display_name || s.username}</span>
                          {s.display_name && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1.5">@{s.username}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          s.status === "graded" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                          s.status === "submitted" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        )}>
                          {s.status === "graded" ? "Graded" : s.status === "submitted" ? "Submitted" : "In Progress"}
                        </span>
                        {s.submitted_at && (
                          <span className="text-xs text-gray-400">{new Date(s.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                      </div>
                    </div>

                    {/* Answer text */}
                    {s.answer_text && (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">
                        {s.answer_text}
                      </div>
                    )}

                    {/* Existing grade */}
                    {s.status === "graded" && s.grade != null && (
                      <div className="flex items-center gap-3 text-sm mb-2">
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                          <Award className="w-3.5 h-3.5" /> Grade: {s.grade}
                        </span>
                        {s.teacher_feedback && (
                          <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <MessageSquare className="w-3 h-3" /> {s.teacher_feedback}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Grade form */}
                    {gradingId === s.id ? (
                      <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Grade (0-100)"
                            value={gradeForm.grade}
                            onChange={(e) => setGradeForm(f => ({ ...f, grade: e.target.value }))}
                            className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Feedback (optional)"
                            value={gradeForm.feedback}
                            onChange={(e) => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleGrade(s.id)} className="flex items-center gap-1.5 text-sm">
                            <Send className="w-3.5 h-3.5" /> Save Grade
                          </Button>
                          <Button variant="ghost" onClick={() => { setGradingId(null); setGradeForm({ grade: "", feedback: "" }) }} className="text-sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (s.status === "submitted" || s.status === "graded") && (
                      <button
                        onClick={() => {
                          setGradingId(s.id)
                          setGradeForm({ grade: s.grade != null ? String(s.grade) : "", feedback: s.teacher_feedback || "" })
                        }}
                        className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        {s.status === "graded" ? "Update Grade" : "Grade"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


function getAssignmentTypeStyle(type: string) {
  const styles: Record<string, { bg: string; text: string; Icon: typeof PenLine; label: string }> = {
    text:   { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", Icon: PenLine,      label: "Written" },
    script: { bg: "bg-purple-100 dark:bg-purple-900/30",   text: "text-purple-700 dark:text-purple-300",   Icon: Gamepad2,     label: "Script Kill" },
    quiz:   { bg: "bg-blue-100 dark:bg-blue-900/30",       text: "text-blue-700 dark:text-blue-300",       Icon: FileQuestion, label: "Quiz" },
    mixed:  { bg: "bg-orange-100 dark:bg-orange-900/30",   text: "text-orange-700 dark:text-orange-300",   Icon: Layers,       label: "Mixed" },
  }
  return styles[type] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", Icon: ClipboardList, label: type }
}

function AssignmentCard({
  assignment,
  onEdit,
  onDelete,
  onViewSubmissions,
  deleting,
  pastDue,
}: {
  assignment: Assignment
  onEdit: () => void
  onDelete: () => void
  onViewSubmissions: () => void
  deleting: boolean
  pastDue?: boolean
}) {
  const style = getAssignmentTypeStyle(assignment.assignment_type)

  return (
    <Card className={pastDue ? "opacity-75" : ""}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">{assignment.title}</h3>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1", style.bg, style.text)}>
              <style.Icon className="w-3 h-3" /> {style.label}
            </span>
            {(assignment.submission_count ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                {assignment.submission_count}/{assignment.student_count} submitted
              </span>
            )}
          </div>
          {assignment.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{assignment.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            {assignment.due_at && (
              <span className={cn("flex items-center gap-1", pastDue && "text-red-500")}>
                <Clock className="w-3 h-3" />
                {pastDue ? "Past due: " : "Due: "}
                {new Date(assignment.due_at).toLocaleString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
            {assignment.created_at && (
              <span>Created {new Date(assignment.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          <button
            onClick={onViewSubmissions}
            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            title="View Submissions"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  )
}
