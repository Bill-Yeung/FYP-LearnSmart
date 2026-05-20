import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../../contexts/ToastContext"
import { useNotifications } from "../../contexts/NotificationContext"
import { Card } from "../../components/ui/Card"
import { logActivity } from "../../lib/activityLog"
import { Button } from "../../components/ui/Button"
import { DocumentUploadModal } from "../../components/knowledge/DocumentUploadModal"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import { useConfirmDialog, ConfirmDialog } from "../../components/general/ConfirmDialog"


type ProcessingStatus = "pending" | "processing" | "completed" | "failed"

type SubjectInfo = { id: string; code: string; name: string }

type SubjectOption = { id: string; code: string; name: string }

type DocumentItem = {
  id: string
  document_name: string
  document_type: string
  processing_status: ProcessingStatus
  concepts_extracted: number
  relationships_extracted: number
  uploaded_at: string
  is_public: boolean
  deleted_at?: string
  subjects?: SubjectInfo[]
}

type ViewMode = "active" | "deleted"


export function DocumentListPage() {

  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirmDialog()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>("active")

  const [statusFilter, setStatusFilter] = useState<ProcessingStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [subjectFilter, setSubjectFilter] = useState<string>("all")
  const [availableSubjects, setAvailableSubjects] = useState<SubjectOption[]>([])

  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchMode, setSearchMode] = useState<"keyword" | "hybrid">("hybrid")
  const [searchTitleOnly, setSearchTitleOnly] = useState<boolean>(false)

  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const { notifications } = useNotifications()
  const seenNotificationIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    apiClient.get<SubjectOption[]>("/api/subjects")
      .then(data => setAvailableSubjects(data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, typeFilter, subjectFilter, viewMode, searchQuery, searchMode, searchTitleOnly])

  useEffect(() => {
    loadDocuments()
  }, [page, statusFilter, typeFilter, subjectFilter, viewMode, searchQuery, searchMode, searchTitleOnly])

  // listen for notifications: if a doc's status changed, silently reload the list
  useEffect(() => {

    if (notifications.length === 0) return

    let shouldRefresh = false
    const seenIds = seenNotificationIdsRef.current

    for (const notification of notifications) {
      const notificationId = notification.id || notification.timestamp
      if (!notificationId || seenIds.has(notificationId)) continue

      if (notification.type?.startsWith("document.")) {
        shouldRefresh = true
      }

      seenIds.add(notificationId)
    }

    if (shouldRefresh) {
      loadDocuments()
    }
  }, [notifications])

  async function loadDocuments() {

    const isInitialLoad = documents.length === 0
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError(null)

    try {

      const params = new URLSearchParams()
      params.append("page", String(page))
      params.append("page_size", String(pageSize))

      if (viewMode === "deleted") {
        const data = await apiClient.get<{ documents: DocumentItem[], total: number }>(`/api/documents/deleted/list?${params.toString()}`)
        setDocuments(data?.documents || [])
        setTotal(data?.total || 0)

      } else {

        if (statusFilter !== "all") params.append("status", statusFilter)
        if (typeFilter !== "all") params.append("document_type", typeFilter)
        if (subjectFilter !== "all") params.append("subject_id", subjectFilter)
        if (searchQuery.trim()) {
          params.append("query", searchQuery.trim())
          params.append("search_mode", searchMode)
          params.append("title_only", String(searchTitleOnly))
        }

        const data = await apiClient.get<{ documents: DocumentItem[], total: number }>(`/api/documents?${params.toString()}`)
        setDocuments(data?.documents || [])
        setTotal(data?.total || 0)

      }
    } catch (err) {
      console.error("Load documents error:", err)
      setError("Unable to load documents. Please try again later.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleDelete(id: string, name: string) {

    const confirmed = await confirm({
      title: "Delete Document",
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "warning"
    })
    if (!confirmed) return

    try {
      await apiClient.delete(`/api/documents/${id}`)
      logActivity("document", "delete", id)
      showToast(`"${name}" deleted successfully`)
      loadDocuments()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete")
    }

  }

  async function handleRestore(id: string, name: string) {
    try {
      await apiClient.post(`/api/documents/${id}/restore`)
      showToast(`"${name}" restored successfully`)
      loadDocuments()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to restore")
    }
  }

  async function handleDownload(id: string, name: string) {
    try {
      const response = await apiClient.download(`/api/documents/${id}/download`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to download")
    }
  }

  // count down the 30-day window before a soft-deleted doc is purged for good
  function getDaysUntilDeletion(deletedAt: string): number {
    const deletedDate = new Date(deletedAt)
    const expiryDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const now = new Date()
    const diffTime = expiryDate.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  function getStatusColor(status: ProcessingStatus) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "pdf":
        return "📄"
      case "word":
        return "📝"
      case "excel":
        return "📊"
      case "powerpoint":
        return "📽️"
      case "image":
        return "🖼️"
      case "audio":
        return "🎵"
      case "video":
        return "🎬"
      case "text":
        return "📃"
      default:
        return "📁"
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {viewMode === "deleted" ? "Deleted Documents" : "My Documents"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {viewMode === "deleted"
              ? "Documents will be permanently deleted after 30 days"
              : "View and manage your uploaded documents"}
          </p>
        </div>
        {viewMode === "active" && (
          <Button onClick={() => setIsUploadModalOpen(true)}>
            Upload Document
          </Button>
        )}
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setViewMode("active")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            viewMode === "active"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          )}>
          Active
        </button>
        <button
          onClick={() => setViewMode("deleted")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            viewMode === "deleted"
              ? "bg-red-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          )}>
          Deleted
        </button>
      </div>

      <div className="min-w-0">

          {viewMode === "active" && (
            <div className="mb-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchTitleOnly ? "Search documents by title..." : "Search documents by title or content..."}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400"
                  />
                </div>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as "keyword" | "hybrid")}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="hybrid">Hybrid (Recommended)</option>
                  <option value="keyword">Keyword Only</option>
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={searchTitleOnly}
                    onChange={(e) => setSearchTitleOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <span>Search titles only</span>
                </label>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </div>
          )}

          {viewMode === "active" && (
            <div className="mb-6 flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProcessingStatus | "all")}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="all">All Types</option>
                  <option value="pdf">PDF</option>
                  <option value="word">Word</option>
                  <option value="excel">Excel</option>
                  <option value="powerpoint">PowerPoint</option>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="text">Text</option>
                </select>
              </div>
              {availableSubjects.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Subject
                  </label>
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                    <option value="all">All Subjects</option>
                    {availableSubjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {loading && documents.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          )}

          {error && !loading && documents.length === 0 && (
            <Card>
              <div className="py-8 text-center text-red-500">
                {error}
                <Button variant="ghost" onClick={loadDocuments} className="ml-2">
                  Retry
                </Button>
              </div>
            </Card>
          )}

          {!loading && !error && documents.length === 0 && (
            <Card>
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                {viewMode === "deleted" ? (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      No deleted documents
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Documents you delete will appear here for 30 days before being permanently removed.
                    </p>
                  </>
                ) : statusFilter === "all" && typeFilter === "all" && subjectFilter === "all" ? (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      No documents yet
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Upload your first document to start building your knowledge base.
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      You can also upload a ZIP file - each file inside will be processed as a separate document.
                    </p>
                    <Button onClick={() => setIsUploadModalOpen(true)} className="mt-4">
                      Upload Document
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      No documents found
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      No documents match the current filters.
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}

          {documents.length > 0 && (
            <>
              {refreshing && (
                <div className="mb-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span>Refreshing...</span>
                </div>
              )}
              <div className="space-y-3">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{getTypeIcon(doc.document_type)}</div>

                      <div className="flex-1 min-w-0">
                        <h3 className="truncate font-medium text-gray-900 dark:text-white">
                          {doc.document_name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="uppercase">{doc.document_type}</span>
                          <span>{formatDate(doc.uploaded_at)}</span>
                          {viewMode === "deleted" && doc.deleted_at && (
                            <span className="text-red-500 dark:text-red-400">
                              {getDaysUntilDeletion(doc.deleted_at)} days until permanent deletion
                            </span>
                          )}
                          {viewMode === "active" && doc.processing_status === "completed" && (
                            <>
                              <span>{doc.concepts_extracted} concepts</span>
                              <span>{doc.relationships_extracted} relationships</span>
                            </>
                          )}
                          {doc.is_public && (
                            <span className="text-green-600 dark:text-green-400">Public</span>
                          )}
                        </div>
                        {doc.subjects && doc.subjects.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {doc.subjects.map(subj => (
                              <span key={subj.id} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                {subj.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      {viewMode === "active" ? (
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium capitalize",
                            getStatusColor(doc.processing_status)
                          )}>
                          {doc.processing_status}
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          Deleted
                        </span>
                      )}

                      <div className="flex gap-2">
                        {viewMode === "deleted" ? (
                          <Button
                            variant="secondary"
                            onClick={() => handleRestore(doc.id, doc.document_name)}>
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => handleDownload(doc.id, doc.document_name)}
                              title="Download document">
                              <DownloadIcon className="h-4 w-4" />
                            </Button>
                            {doc.processing_status === "completed" && (
                              <Button
                                variant="secondary"
                                onClick={() => navigate(`/knowledge/documents/${doc.id}`)}
                              >
                                View Details
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              onClick={() => handleDelete(doc.id, doc.document_name)}>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {total > pageSize && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} documents
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}>
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * pageSize >= total}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

        {/* Upload Modal */}
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={loadDocuments}
        />
        <ConfirmDialog {...dialogProps} />
      </div>
    </div>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
    </svg>
  )
}
