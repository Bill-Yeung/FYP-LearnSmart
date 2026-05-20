import { useState, useEffect, useCallback } from "react"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { useToast } from "../../contexts"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"


type ContentType = "document" | "post" | "comment" | "shared" | "submission"

type ContentItem = {
  id: string
  type: ContentType
  title: string
  author_name: string
  author_email: string
  created_at: string
  status: string
  community_name?: string
}

type ContentDetail = ContentItem & {
  content?: string
}

export function ManageContentPage() {
  const { showToast } = useToast()
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all")
  const [selectedItem, setSelectedItem] = useState<ContentDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ContentItem | null>(null)

  const loadContent = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<{ items: ContentItem[] }>("/api/admin/content")
      setContent(res?.items || [])
    } catch {
      showToast("Failed to load content")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadContent() }, [loadContent])

  const filteredContent = content.filter(item => {
    const matchesSearch = searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.author_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === "all" || item.type === typeFilter
    return matchesSearch && matchesType
  })

  async function handleView(item: ContentItem) {
    setSelectedItem({ ...item, content: undefined })
    setLoadingDetail(true)
    try {
      const res = await apiClient.get<ContentDetail>(`/api/admin/content/${item.type}/${item.id}`)
      if (res) {
        setSelectedItem(res)
      }
    } catch {
      setSelectedItem({ ...item, content: "Content preview not available" })
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleDelete(item: ContentItem) {
    try {
      await apiClient.delete(`/api/admin/content/${item.type}/${item.id}`)
      setContent(prev => prev.filter(c => c.id !== item.id))
      showToast("Content removed")
      setConfirmDelete(null)
      if (selectedItem?.id === item.id) setSelectedItem(null)
    } catch {
      showToast("Failed to remove content")
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric"
    })
  }

  function getTypeBadgeColor(type: ContentType) {
    const colors: Record<ContentType, string> = {
      document: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      post: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      comment: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      shared: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      submission: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    }
    return colors[type] || colors.document
  }

  function getTypeLabel(type: ContentType) {
    const labels: Record<ContentType, string> = {
      document: "Document", post: "Post", comment: "Comment",
      shared: "Shared", submission: "Submission",
    }
    return labels[type] || type
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Moderation</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor user-generated content and remove inappropriate items
        </p>
      </div>

      <div className="mb-6 rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <TextField
              label=""
              placeholder="Search by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ContentType | "all")}
          >
            <option value="all">All Types</option>
            <option value="document">Documents</option>
            <option value="post">Posts</option>
            <option value="comment">Comments</option>
            <option value="shared">Shared Content</option>
            <option value="submission">Submissions</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      )}

      {!loading && (
        <div className="rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Content</th>
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Author</th>
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Type</th>
                  <th className="p-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Created</th>
                  <th className="p-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredContent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No content found
                    </td>
                  </tr>
                ) : (
                  filteredContent.map((item) => (
                    <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</div>
                        {item.community_name && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{item.community_name}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-gray-900 dark:text-white">{item.author_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.author_email}</div>
                      </td>
                      <td className="p-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getTypeBadgeColor(item.type))}>
                          {getTypeLabel(item.type)}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => handleView(item)}>View</Button>
                          <Button variant="danger" onClick={() => setConfirmDelete(item)}>Remove</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedItem.title}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getTypeBadgeColor(selectedItem.type))}>
                      {getTypeLabel(selectedItem.type)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      by {selectedItem.author_name} on {formatDate(selectedItem.created_at)}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content</h3>
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Loading content...
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                    {selectedItem.content || "No content available"}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedItem(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Remove Content</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to remove <strong>"{confirmDelete.title}"</strong> by {confirmDelete.author_name}? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Remove</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
