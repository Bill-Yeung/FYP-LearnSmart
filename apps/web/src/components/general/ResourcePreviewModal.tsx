import { useState, useEffect } from "react"
import { Modal } from "../ui/Modal"
import { apiClient } from "../../lib/api"
import {
  FileText, MapPin, Route, Layers, Lightbulb, Link2,
  ExternalLink, Download, FolderOpen
} from "lucide-react"

type ResourcePreviewProps = {
  isOpen: boolean
  onClose: () => void
  entityType: string
  entityId: string | null
  title: string
  note?: string | null
  url?: string | null
  fileUrl?: string | null
  fileSize?: number | null
}

const TYPE_META: Record<string, { label: string; icon: typeof FileText; color: string; bg: string; text: string }> = {
  source:        { label: "Document",      icon: FileText,  color: "blue",    bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-600 dark:text-blue-400" },
  diagram:       { label: "Diagram",       icon: MapPin,    color: "indigo",  bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400" },
  learning_path: { label: "Learning Path", icon: Route,     color: "emerald", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
  flashcard:     { label: "Flashcard",     icon: Layers,    color: "amber",   bg: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-600 dark:text-amber-400" },
  concept:       { label: "Concept",       icon: Lightbulb, color: "yellow",  bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-600 dark:text-yellow-400" },
  link:          { label: "External Link", icon: Link2,     color: "green",   bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-600 dark:text-green-400" },
  file:          { label: "File",          icon: FileText,  color: "blue",    bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-600 dark:text-blue-400" },
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ResourcePreviewModal({
  isOpen, onClose, entityType, entityId, title, note, url, fileUrl, fileSize,
}: ResourcePreviewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, any> | null>(null)

  // fetch full detail for the entity when modal opens
  useEffect(() => {
    if (!isOpen || !entityId) return
    setLoading(true)
    setError(null)
    setDetail(null)

    let cancelled = false
    const fetchDetail = async () => {
      try {
        let data: any = null
        switch (entityType) {
          case "source":
            data = await apiClient.get<any>(`/api/documents/${entityId}`)
            break
          case "diagram":
            data = await apiClient.get<any>(`/api/diagrams/${entityId}`)
            break
          case "concept":
            data = await apiClient.get<any>(`/api/documents/concepts/${entityId}`)
            break
          case "flashcard":
            data = await apiClient.get<any>(`/api/flashcards/${entityId}/detail`)
            break
        }
        if (!cancelled) {
          setDetail(data)
          setLoading(false)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load details")
          setLoading(false)
        }
      }
    }

    if (["source", "diagram", "concept", "flashcard"].includes(entityType)) {
      fetchDetail()
    } else {
      setLoading(false)
    }
    return () => { cancelled = true }
  }, [isOpen, entityType, entityId])

  const meta = TYPE_META[entityType] || { label: entityType, icon: FolderOpen, color: "purple", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" }
  const Icon = meta.icon

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || "Resource Preview"} size="md">
      <div className="space-y-4">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg}`}>
            <Icon className={`h-4 w-4 ${meta.text}`} />
          </div>
          <span className="text-sm font-medium capitalize text-gray-600 dark:text-gray-400">
            {meta.label}
          </span>
        </div>

        {/* Note */}
        {note && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300">
            {note}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="ml-2 text-sm text-gray-500">Loading details...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Document */}
        {entityType === "source" && detail && (
          <div className="space-y-3">
            <DetailRow label="Document Name" value={detail.document_name} />
            <DetailRow label="Type" value={detail.document_type} />
            {detail.author && <DetailRow label="Author" value={detail.author} />}
            {detail.language && <DetailRow label="Language" value={detail.language} />}
            {detail.ai_summary && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">AI Summary</p>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {detail.ai_summary}
                </div>
              </div>
            )}
            {detail.subjects?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detail.subjects.map((s: any) => {
                  const label = typeof s === "string" ? s : s.name || s.code || String(s)
                  const key = typeof s === "string" ? s : s.id || s.code || label
                  return (
                    <span key={key} className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">{label}</span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Diagram */}
        {entityType === "diagram" && detail && (
          <div className="space-y-3">
            {detail.description && (
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{detail.description}</div>
            )}
            <DetailRow label="Diagram Type" value={detail.diagram_type} />
            {detail.node_count != null && (
              <DetailRow label="Size" value={`${detail.node_count} nodes, ${detail.link_count} links`} />
            )}
          </div>
        )}

        {/* Concept */}
        {entityType === "concept" && detail && (
          <div className="space-y-3">
            {detail.concept_type && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-300 capitalize">
                  {detail.concept_type}
                </span>
                {detail.difficulty_level && (
                  <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">
                    {detail.difficulty_level}
                  </span>
                )}
              </div>
            )}
            {detail.description && (
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {detail.description}
              </div>
            )}
            {detail.keywords?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.keywords.map((k: string) => (
                    <span key={k} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-300">{k}</span>
                  ))}
                </div>
              </div>
            )}
            {detail.estimated_study_time_minutes && (
              <DetailRow label="Estimated Study Time" value={`${detail.estimated_study_time_minutes} minutes`} />
            )}
          </div>
        )}

        {/* Flashcard */}
        {entityType === "flashcard" && detail && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Front</p>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {detail.front}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Back</p>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {detail.back}
              </div>
            </div>
            {detail.card_type && detail.card_type !== "standard" && (
              <DetailRow label="Card Type" value={detail.card_type} />
            )}
          </div>
        )}

        {/* Learning Path */}
        {entityType === "learning_path" && !loading && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            This learning path has been shared as a resource.
          </div>
        )}

        {/* Link */}
        {entityType === "link" && (url || fileUrl) && (
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">URL</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 break-all">{url || fileUrl}</p>
            </div>
            <a
              href={(url || fileUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Open Link
            </a>
          </div>
        )}

        {/* File */}
        {entityType === "file" && fileUrl && (
          <div className="space-y-3">
            {fileSize && <DetailRow label="File Size" value={formatFileSize(fileSize)} />}
            <a
              href={fileUrl}
              download={title || "download"}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" /> Download File
            </a>
          </div>
        )}
      </div>
    </Modal>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}
