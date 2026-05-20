import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import { cn } from "../../../../../shared/utils"


function AuthenticatedImage({
  src,
  alt,
  className
}: {
  src: string
  alt: string
  className?: string
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchImage() {
      try {
        const token = await apiClient.getAccessToken()
        const response = await fetch(src, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) throw new Error('Failed to load image')

        const blob = await response.blob()
        if (!cancelled) {
          const url = URL.createObjectURL(blob)
          setObjectUrl(url)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    fetchImage()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-100 dark:bg-gray-800", className)}>
        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  if (!objectUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-100 dark:bg-gray-800", className)}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return <img src={objectUrl} alt={alt} className={className} />
}


type SubjectInfo = { id: string; code: string; name: string }

type DocumentDetails = {
  id: string
  document_name: string
  document_type: string
  document_path: string
  processing_status: string
  concepts_extracted: number
  relationships_extracted: number
  uploaded_at: string
  processing_started_at?: string
  processing_completed_at?: string
  processing_error?: string
  is_public: boolean
  ai_summary?: string
  subjects?: SubjectInfo[]
}

type ExtractedMedia = {
  id: string
  media_type: string
  file_url: string
  extraction_location?: string
  content?: string
  metadata?: Record<string, unknown>
}

type Concept = {
  id: string
  concept_type: string
  difficulty_level?: string
  title: string
  description?: string
  keywords?: string[]
  language: string
  pages?: number[]
  source_location?: string
  created_at: string
}

type Relationship = {
  id: string
  relationship_type: string
  strength?: number
  bidirectional?: boolean
  description?: string
  language: string
  source_concept_title: string
  target_concept_title: string
  source_concept_id: string
  target_concept_id: string
  pages?: number[]
  source_location?: string
  created_at: string
}

export function DocumentDetailsPage() {

  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()

  const [document, setDocument] = useState<DocumentDetails | null>(null)
  const [media, setMedia] = useState<ExtractedMedia[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [conceptsTotal, setConceptsTotal] = useState(0)
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [relationshipsTotal, setRelationshipsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "concepts" | "relationships" | "media">("overview")
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [selectedConcepts, setSelectedConcepts] = useState<Set<string>>(new Set())
  const [exportingPdf, setExportingPdf] = useState(false)
  const [expandedConcept, setExpandedConcept] = useState<Concept | null>(null)
  const [tokenQuota, setTokenQuota] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)

  useEffect(() => {
    async function loadTokenQuota() {
      try {
        const data = await apiClient.get<{ items: { item_type: string; quantity: number }[] }>("/api/gamification/inventory")
        const aiToken = data?.items?.find(i => i.item_type === "ai_summary")
        setTokenQuota(aiToken?.quantity ?? 0)
      } catch {
        setTokenQuota(0)
      }
    }
    loadTokenQuota()
  }, [])

  useEffect(() => {
    if (documentId) {
      loadDocument()
      loadMedia()
      loadConcepts()
      loadRelationships()
    }
  }, [documentId])

  async function loadDocument() {
    try {
      const data = await apiClient.get<DocumentDetails>(`/api/documents/${documentId}`)
      setDocument(data)
      if (data) logActivity("document", "view", documentId)
    } catch (err) {
      console.error("Failed to load document:", err)
      setError("Failed to load document details")
    } finally {
      setLoading(false)
    }
  }

  async function loadMedia() {
    try {
      const data = await apiClient.get<{ media: ExtractedMedia[] }>(`/api/documents/${documentId}/media`)
      setMedia(data?.media || [])
    } catch (err) {
      console.error("Failed to load media:", err)
    }
  }

  async function loadConcepts() {
    try {
      const data = await apiClient.get<{ concepts: Concept[], total: number }>(`/api/documents/${documentId}/concepts?page_size=200`)
      setConcepts(data?.concepts || [])
      setConceptsTotal(data?.total || 0)
    } catch (err) {
      console.error("Failed to load concepts:", err)
    }
  }

  async function loadRelationships() {
    try {
      const data = await apiClient.get<{ relationships: Relationship[], total: number }>(`/api/documents/${documentId}/relationships?page_size=200`)
      setRelationships(data?.relationships || [])
      setRelationshipsTotal(data?.total || 0)
    } catch (err) {
      console.error("Failed to load relationships:", err)
    }
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

  function getTypeIcon(type: string) {
    switch (type) {
      case "pdf": return "PDF"
      case "word": return "DOC"
      case "excel": return "XLS"
      case "powerpoint": return "PPT"
      case "image": return "IMG"
      case "audio": return "AUD"
      case "video": return "VID"
      case "text": return "TXT"
      default: return "FILE"
    }
  }

  const [showTokenModal, setShowTokenModal] = useState(false)

  // spend an ai_summary token to generate a fresh summary, or open the buy-token modal
  async function handleGenerateSummary() {
    setGeneratingSummary(true)
    try {
      const data = await apiClient.post<{ ai_summary: string }>(`/api/documents/${documentId}/generate-summary`)
      if (data && document) {
        setDocument({ ...document, ai_summary: data.ai_summary })
        setTokenQuota(prev => (prev !== null && prev > 0 ? prev - 1 : prev))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      if (message.includes("AI Summary Token") || message.includes("402")) {
        setShowTokenModal(true)
      } else {
        console.error("Failed to generate summary:", err)
      }
    } finally {
      setGeneratingSummary(false)
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true)
    try {
      const response = await apiClient.download(`/api/documents/${documentId}/export/pdf`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement("a")
      a.href = url
      a.download = `${document?.document_name || "document"}_report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to export PDF:", err)
    } finally {
      setExportingPdf(false)
    }
  }

  function toggleConceptSelection(conceptId: string) {
    setSelectedConcepts(prev => {
      const next = new Set(prev)
      if (next.has(conceptId)) next.delete(conceptId)
      else next.add(conceptId)
      return next
    })
  }

  function handleCompareSelected() {
    const ids = Array.from(selectedConcepts).join(",")
    navigate(`/knowledge/concepts/compare?ids=${ids}`)
  }

  function getStatusColor(status: string) {
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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <div className="py-8 text-center">
            <p className="text-red-500">{error || "Document not found"}</p>
            <Button variant="secondary" onClick={() => navigate("/knowledge/documents")} className="mt-4">
              Back to Documents
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => navigate("/knowledge/documents")}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Documents
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {getTypeIcon(document.document_type)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {document.document_name}
              </h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="uppercase">{document.document_type}</span>
                <span>Uploaded {formatDate(document.uploaded_at)}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    getStatusColor(document.processing_status)
                  )}
                >
                  {document.processing_status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={() => navigate(`/knowledge/documents/${documentId}/analytics`)}
              className="text-sm"
            >
              Analytics
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="text-sm"
            >
              {exportingPdf ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "overview"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("concepts")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "concepts"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          )}
        >
          Concepts ({conceptsTotal})
        </button>
        <button
          onClick={() => setActiveTab("relationships")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "relationships"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          )}
        >
          Relationships ({relationshipsTotal})
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "media"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          )}
        >
          Media ({media.length})
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Processing Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</p>
                <p className="mt-1 capitalize text-gray-900 dark:text-white">{document.processing_status}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Uploaded</p>
                <p className="mt-1 text-gray-900 dark:text-white">{formatDate(document.uploaded_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Subjects</p>
                {document.subjects && document.subjects.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {document.subjects.map(subj => (
                      <span key={subj.id} className="inline-block rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {subj.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-gray-400 dark:text-gray-500">Not assigned</p>
                )}
              </div>
              {document.processing_started_at && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Processing Started</p>
                  <p className="mt-1 text-gray-900 dark:text-white">{formatDate(document.processing_started_at)}</p>
                </div>
              )}
              {document.processing_completed_at && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Processing Completed</p>
                  <p className="mt-1 text-gray-900 dark:text-white">{formatDate(document.processing_completed_at)}</p>
                </div>
              )}
              {document.processing_error && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-red-500">Error</p>
                  <p className="mt-1 text-red-600 dark:text-red-400">{document.processing_error}</p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Extraction Results
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{media.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Media Extracted</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{document.concepts_extracted}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Concepts</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{document.relationships_extracted}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Relationships</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Summary
              </h3>
              {document.processing_status === "completed" && (
                <Button
                  variant="secondary"
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary || tokenQuota === 0}
                  className="text-sm"
                >
                  {generatingSummary
                    ? "Generating..."
                    : `${document.ai_summary ? "Re-generate" : "Generate"}${tokenQuota !== null ? ` (${tokenQuota} quota left)` : ""}`}
                </Button>
              )}
            </div>
            {generatingSummary ? (
              <div className="flex items-center gap-2 py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-sm text-gray-500">Generating summary...</span>
              </div>
            ) : document.ai_summary ? (
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {document.ai_summary}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No summary generated yet. Click "Generate Summary" to create one.
              </p>
            )}
          </Card>
        </div>
      )}

      {activeTab === "concepts" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant={compareMode ? "primary" : "secondary"}
              onClick={() => {
                if (compareMode) {
                  setCompareMode(false)
                  setSelectedConcepts(new Set())
                } else {
                  setCompareMode(true)
                }
              }}
              className="text-sm"
            >
              {compareMode ? "Exit Compare Mode" : "Compare Concepts"}
            </Button>
            {compareMode && selectedConcepts.size >= 2 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedConcepts.size} selected
                </span>
                <Button onClick={handleCompareSelected} className="text-sm">
                  View Comparison
                </Button>
              </div>
            )}
          </div>
          {compareMode && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Select 2 or more concepts to compare them side by side.
              </p>
            </div>
          )}
          {concepts.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No concepts extracted from this document
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {concepts.map((concept) => (
                <Card
                  key={concept.id}
                  className={cn(
                    "cursor-pointer hover:ring-2 transition-shadow",
                    compareMode && selectedConcepts.has(concept.id)
                      ? "ring-2 ring-blue-500 dark:ring-blue-400"
                      : "hover:ring-blue-200 dark:hover:ring-blue-800"
                  )}
                  onClick={() => {
                    if (compareMode) {
                      toggleConceptSelection(concept.id)
                    } else {
                      setExpandedConcept(concept)
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    {compareMode && (
                      <input
                        type="checkbox"
                        checked={selectedConcepts.has(concept.id)}
                        onChange={() => toggleConceptSelection(concept.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {concept.title}
                      </h4>
                      {concept.description && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                          {concept.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                          {concept.concept_type}
                        </span>
                        {concept.difficulty_level && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize">
                            {concept.difficulty_level}
                          </span>
                        )}
                        {concept.pages && concept.pages.length > 0 && (
                          <span>Page {concept.pages.join(", ")}</span>
                        )}
                      </div>
                      {concept.keywords && concept.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {concept.keywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "relationships" && (
        <div>
          {relationships.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No relationships extracted from this document
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {relationships.map((rel) => (
                <Card key={rel.id}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {rel.source_concept_title}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 capitalize">
                          {rel.relationship_type}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {rel.target_concept_title}
                        </span>
                      </div>
                      {rel.description && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          {rel.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        {rel.strength !== undefined && rel.strength > 0 && (
                          <span>Strength: {(rel.strength * 100).toFixed(0)}%</span>
                        )}
                        {rel.bidirectional && (
                          <span className="text-green-600 dark:text-green-400">Bidirectional</span>
                        )}
                        {rel.pages && rel.pages.length > 0 && (
                          <span>Pages: {rel.pages.join(", ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "media" && (
        <div>
          {media.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No media extracted from this document
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {media.map((item) => (
                <Card key={item.id} className="flex h-full flex-col overflow-hidden">
                  {item.media_type === "image" && item.file_url && (
                    <div className="flex h-48 items-center justify-center bg-gray-50 dark:bg-gray-950 sm:h-52">
                      <AuthenticatedImage
                        src={`/api/documents/${documentId}/media/${item.id}/file`}
                        alt={item.extraction_location || "Extracted image"}
                        className="max-h-full w-full object-contain"
                      />
                    </div>
                  )}
                  {item.media_type === "text" && (
                    <div className="h-48 overflow-auto bg-gray-50 p-3 text-xs dark:bg-gray-950 sm:h-52">
                      <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                        {item.content || "No content"}
                      </pre>
                    </div>
                  )}
                  {item.media_type !== "image" && item.media_type !== "text" && (
                    <div className="flex h-48 items-center justify-center bg-gray-100 dark:bg-gray-950 sm:h-52">
                      <span className="text-2xl font-bold text-gray-400">{item.media_type.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="mt-auto border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {item.media_type}
                    </p>
                    {item.extraction_location && (
                      <p className="mt-1 break-words text-xs leading-5 text-gray-600 dark:text-gray-300">
                        {item.extraction_location}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      <Modal isOpen={showTokenModal} onClose={() => setShowTokenModal(false)} title="AI Summary Token Required" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You need an AI Summary Token to generate document summaries. You can purchase tokens from the Rewards Shop using your earned points.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowTokenModal(false)}>Cancel</Button>
            <Button onClick={() => { setShowTokenModal(false); navigate("/community/rewards") }}>Go to Rewards Shop</Button>
          </div>
        </div>
      </Modal>

      {expandedConcept && (
        <Modal isOpen={!!expandedConcept} onClose={() => setExpandedConcept(null)} title={expandedConcept.title} size="lg">
          <div className="max-h-[70vh] overflow-y-auto space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                {expandedConcept.concept_type}
              </span>
              {expandedConcept.difficulty_level && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize">
                  {expandedConcept.difficulty_level}
                </span>
              )}
              {expandedConcept.pages && expandedConcept.pages.length > 0 && (
                <span className="text-sm text-gray-500">Page {expandedConcept.pages.join(", ")}</span>
              )}
            </div>

            {expandedConcept.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Description</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed space-y-1.5">
                  {expandedConcept.description
                    .replace(/\s*[•·]\s*/g, '\n')
                    .replace(/\s*–\s+/g, '\n')
                    .replace(/\s*-\s+(?=[A-Z])/g, '\n')
                    .split('\n')
                    .filter((line: string) => line.trim().length > 0)
                    .map((line: string, idx: number) => (
                      <p key={idx}>{line.trim()}</p>
                    ))}
                </div>
              </div>
            )}

            {expandedConcept.keywords && expandedConcept.keywords.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Keywords</h4>
                <div className="flex flex-wrap gap-1.5">
                  {expandedConcept.keywords.map((keyword: string, idx: number) => (
                    <span key={idx} className="rounded bg-gray-100 px-2.5 py-1 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
