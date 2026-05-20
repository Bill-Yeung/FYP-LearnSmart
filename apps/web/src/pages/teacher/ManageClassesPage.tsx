import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import {
  GraduationCap, Users, Plus, Search, Archive,
  RotateCcw, X
} from "lucide-react"


type ClassItem = {
  id: string
  name: string
  description: string
  class_code: string
  student_count: number
  pending_count?: number
  created_at: string
  status: "active" | "archived"
}

export function ManageClassesPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClasses()
  }, [])

  async function loadClasses() {
    setLoading(true)
    try {
      const response = await apiClient.get<{ classes: ClassItem[] }>("/api/classroom/teacher/classes") ?? { classes: [] }
      setClasses((response.classes || []).map(c => ({ ...c, status: (c.status || "active") as "active" | "archived" })))
    } catch (error) {
      showToast("Failed to load classes")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [newClassName, setNewClassName] = useState("")
  const [newClassDesc, setNewClassDesc] = useState("")
  const [newClassCode, setNewClassCode] = useState("")
  const [creating, setCreating] = useState(false)

  const activeClasses = classes.filter(c => c.status === "active")
  const archivedClasses = classes.filter(c => c.status === "archived")
  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cls.class_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalStudents = classes.reduce((sum, c) => sum + c.student_count, 0)
  const totalPending = classes.reduce((sum, c) => sum + (c.pending_count || 0), 0)

  // toggle a class between active and archived and patch the server
  async function handleArchiveClass(classId: string) {
    const cls = classes.find(c => c.id === classId)
    if (!cls) return
    const newStatus = cls.status === "active" ? "archived" : "active"
    try {
      await apiClient.patch(`/api/classroom/teacher/classes/${classId}/status?status=${newStatus}`)
      setClasses(prev => prev.map(c =>
        c.id === classId ? { ...c, status: newStatus } : c
      ))
      showToast(`Class "${cls.name}" ${newStatus === "archived" ? "archived" : "activated"}`)
    } catch {
      showToast("Failed to update class status")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading classes...</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Classes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {activeClasses.length} active class{activeClasses.length !== 1 ? "es" : ""} · {totalStudents} student{totalStudents !== 1 ? "s" : ""}
            {totalPending > 0 && <span className="text-amber-500"> · {totalPending} pending</span>}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Class
        </Button>
      </div>

      {classes.length > 0 && (
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>
      )}

      {filteredClasses.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {searchQuery ? "No classes found" : "No classes yet"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? "Try a different search" : "Create your first class to get started"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                Create Your First Class
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClasses.filter(c => c.status === "active").map((cls) => (
            <Card
              key={cls.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/classroom/classes/${cls.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cls.name}</h3>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono">
                      {cls.class_code}
                    </span>
                    {(cls.pending_count || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {cls.pending_count} pending
                      </span>
                    )}
                  </div>
                  {cls.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{cls.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{cls.student_count}</span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(cls.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleArchiveClass(cls.id) }}
                    className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    title="Archive"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {archivedClasses.length > 0 && !searchQuery && (
            <>
              <div className="pt-4">
                <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                  Archived ({archivedClasses.length})
                </h3>
              </div>
              {archivedClasses.map((cls) => (
                <Card key={cls.id} className="opacity-60 hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-600 dark:text-gray-400">{cls.name}</h3>
                        <span className="px-2 py-0.5 rounded text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-800">
                          {cls.class_code}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm text-gray-400">{cls.student_count} students</span>
                      <button
                        onClick={() => handleArchiveClass(cls.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        title="Activate"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create New Class</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              setCreating(true)
              try {
                const res = await apiClient.post<{ class: ClassItem }>("/api/classroom/teacher/classes", {
                  name: newClassName,
                  description: newClassDesc,
                  class_code: newClassCode,
                })
                if (res?.class) {
                  setClasses(prev => [{ ...res.class, status: "active" as const }, ...prev])
                }
                showToast("Class created successfully")
                setShowCreateModal(false)
                setNewClassName("")
                setNewClassDesc("")
                setNewClassCode("")
              } catch (err: any) {
                showToast(err?.message || "Failed to create class")
              } finally {
                setCreating(false)
              }
            }}>
              <div className="space-y-4">
                <TextField
                  label="Class Name"
                  placeholder="e.g., Computer Science 101"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    rows={3}
                    placeholder="Brief description of the class"
                    value={newClassDesc}
                    onChange={(e) => setNewClassDesc(e.target.value)}
                    required
                  />
                </div>
                <TextField
                  label="Class Code (optional)"
                  placeholder="Leave blank to auto-generate"
                  hint="A unique join code will be created automatically if left empty"
                  value={newClassCode}
                  onChange={(e) => setNewClassCode(e.target.value)}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Class"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
