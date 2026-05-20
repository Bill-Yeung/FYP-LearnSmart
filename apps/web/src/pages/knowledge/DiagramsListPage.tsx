import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"


type DiagramType = "knowledge_map" | "flowchart" | "mindmap" | "timeline"
type GenerateSourceMode = "all" | "documents" | "concepts" | "learning_paths"

interface DiagramListItem {
  id: string
  url_slug: string
  title: string
  description: string | null
  diagram_type: DiagramType
  layout_type: string
  node_count: number
  link_count: number
  is_edited: boolean
  is_public: boolean
  last_viewed_at: string | null
  created_at: string
  updated_at: string
}

interface DocumentItem {
  id: string
  document_name: string
  document_type: string
  processing_status: string
  concepts_extracted: number
  relationships_extracted: number
}

interface ConceptItem {
  id: string
  title: string
  concept_type: string
  difficulty_level: string | null
}

interface LearningPathItem {
  id: string
  title: string
  description: string | null
  target_concept_title: string | null
  created_at: string | null
}


const DIAGRAM_TYPE_META: Record<DiagramType, { label: string; icon: string; color: string; description: string }> = {
  knowledge_map: {
    label: "Knowledge Map",
    icon: "🧠",
    color: "#3B82F6",
    description: "3D interactive graph showing concept relationships"
  },
  flowchart: {
    label: "Flowchart",
    icon: "📊",
    color: "#22C55E",
    description: "Procedure step flows generated from stored procedure steps"
  },
  mindmap: {
    label: "Mind Map",
    icon: "🌳",
    color: "#8B5CF6",
    description: "Radial tree branching from a central concept"
  },
  timeline: {
    label: "Timeline",
    icon: "📅",
    color: "#EAB308",
    description: "Ordered progression generated from learning path steps"
  },
}

const DIAGRAM_SOURCE_OPTIONS: Record<DiagramType, { key: GenerateSourceMode; label: string }[]> = {
  knowledge_map: [
    { key: "all", label: "All Documents" },
    { key: "documents", label: "Select Documents" },
    { key: "concepts", label: "Select Concepts" },
  ],
  flowchart: [
    { key: "documents", label: "Select Documents" },
    { key: "concepts", label: "Select Procedures" },
  ],
  mindmap: [
    { key: "all", label: "All Documents" },
    { key: "documents", label: "Select Documents" },
    { key: "concepts", label: "Select Concepts" },
  ],
  timeline: [
    { key: "learning_paths", label: "Select Learning Paths" },
  ],
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export function DiagramsListPage() {
  const navigate = useNavigate()

  const [diagrams, setDiagrams] = useState<DiagramListItem[]>([])
  const [recentDiagrams, setRecentDiagrams] = useState<DiagramListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [filterType, setFilterType] = useState<DiagramType | "all">("all")

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [genType, setGenType] = useState<DiagramType>("knowledge_map")
  const [genTitle, setGenTitle] = useState("")
  const [genSourceMode, setGenSourceMode] = useState<GenerateSourceMode>("all")
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [learningPaths, setLearningPaths] = useState<LearningPathItem[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [docConcepts, setDocConcepts] = useState<ConceptItem[]>([])
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([])
  const [selectedLearningPathIds, setSelectedLearningPathIds] = useState<string[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [loadingConcepts, setLoadingConcepts] = useState(false)
  const [loadingLearningPaths, setLoadingLearningPaths] = useState(false)

  const [expandEnabled, setExpandEnabled] = useState(true)
  const [expandDepth, setExpandDepth] = useState(0)
  const [includeLateral, setIncludeLateral] = useState(true)
  const [includeUpward, setIncludeUpward] = useState(false)
  const [showTaxonomy, setShowTaxonomy] = useState(false)

  const [docSearch, setDocSearch] = useState("")
  const [conceptSearch, setConceptSearch] = useState("")
  const [learningPathSearch, setLearningPathSearch] = useState("")

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sourceOptions = DIAGRAM_SOURCE_OPTIONS[genType]
  const supportsExpansion = genType === "knowledge_map" || genType === "mindmap"
  const selectableConceptLabel = genType === "flowchart" ? "procedure" : "concept"
  const selectableConcepts = docConcepts.filter(concept =>
    genType !== "flowchart" || concept.concept_type === "procedure"
  )

  const loadDiagrams = useCallback(async () => {
    setLoading(true)
    try {
      const typeParam = filterType !== "all" ? `&diagram_type=${filterType}` : ""
      const data = await apiClient.get<{ diagrams: DiagramListItem[]; total: number }>(
        `/api/diagrams?page=${page}&page_size=${pageSize}${typeParam}`
      )
      if (data) {
        setDiagrams(data.diagrams)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to load diagrams:", err)
    } finally {
      setLoading(false)
    }
  }, [page, filterType])

  const loadRecent = useCallback(async () => {
    try {
      const data = await apiClient.get<{ diagrams: DiagramListItem[] }>("/api/diagrams/recent")
      if (data) setRecentDiagrams(data.diagrams)
    } catch (err) {
      console.error("Failed to load recent diagrams:", err)
    }
  }, [])

  useEffect(() => {
    loadDiagrams()
    loadRecent()
  }, [loadDiagrams, loadRecent])

  useEffect(() => {
    if (genSourceMode === "concepts" && selectedDocIds.length > 0) {
      loadConceptsForDocs(selectedDocIds)
    }
  }, [selectedDocIds, genSourceMode])

  // open the generate-diagram modal, reset form state, and fetch docs + learning paths in parallel
  const openGenerateModal = async () => {
    setIsGenerateOpen(true)
    setGenType("knowledge_map")
    setGenTitle("")
    setGenSourceMode("all")
    setSelectedDocIds([])
    setSelectedConceptIds([])
    setSelectedLearningPathIds([])
    setDocConcepts([])
    setExpandEnabled(true)
    setExpandDepth(0)
    setIncludeLateral(true)
    setIncludeUpward(false)
    setShowTaxonomy(false)
    setDocSearch("")
    setConceptSearch("")
    setLearningPathSearch("")

    setLoadingDocs(true)
    try {
      const data = await apiClient.get<{ documents: DocumentItem[] }>(
        "/api/documents?page_size=100&status=completed"
      )
      if (data) setDocuments(data.documents)
    } catch (err) {
      console.error("Failed to load documents:", err)
    } finally {
      setLoadingDocs(false)
    }

    setLoadingLearningPaths(true)
    try {
      const data = await apiClient.get<{ learning_paths: LearningPathItem[] }>(
        "/api/learning-paths?page_size=100"
      )
      if (data) setLearningPaths(data.learning_paths)
    } catch (err) {
      console.error("Failed to load learning paths:", err)
    } finally {
      setLoadingLearningPaths(false)
    }
  }

  const handleGenTypeChange = (type: DiagramType) => {
    setGenType(type)
    setGenSourceMode(DIAGRAM_SOURCE_OPTIONS[type][0].key)
    setSelectedDocIds([])
    setSelectedConceptIds([])
    setSelectedLearningPathIds([])
    setDocSearch("")
    setConceptSearch("")
    setLearningPathSearch("")
  }

  const loadConceptsForDocs = async (docIds: string[]) => {
    if (docIds.length === 0) {
      setDocConcepts([])
      return
    }
    setLoadingConcepts(true)
    try {
      const allConcepts: ConceptItem[] = []
      for (const docId of docIds) {
        const data = await apiClient.get<{ concepts: ConceptItem[] }>(
          `/api/documents/${docId}/concepts?page_size=200`
        )
        if (data) allConcepts.push(...data.concepts)
      }
      const seen = new Set<string>()
      const unique = allConcepts.filter(c => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })
      setDocConcepts(unique)
    } catch (err) {
      console.error("Failed to load concepts:", err)
    } finally {
      setLoadingConcepts(false)
    }
  }

  // build the request body from current form, post to /generate, then jump into the new diagram
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const title = genTitle.trim() || `${DIAGRAM_TYPE_META[genType].label} - ${new Date().toLocaleDateString()}`

      const body: Record<string, unknown> = {
        title,
        diagram_type: genType,
      }

      if (genSourceMode === "documents" && selectedDocIds.length > 0) {
        body.document_ids = selectedDocIds
      } else if (genSourceMode === "concepts" && selectedConceptIds.length > 0) {
        body.concept_ids = selectedConceptIds
      } else if (genSourceMode === "learning_paths" && selectedLearningPathIds.length > 0) {
        body.learning_path_ids = selectedLearningPathIds
      }

      if (supportsExpansion) {
        body.expand = expandEnabled
        body.expand_depth = expandDepth
        body.include_lateral = includeLateral
        body.include_upward = includeUpward
        body.show_taxonomy = showTaxonomy
      }

      const result = await apiClient.post<{ id: string; url_slug: string }>("/api/diagrams/generate", body)
      if (result) {
        setIsGenerateOpen(false)
        navigate(`/knowledge/diagram/${result.url_slug}`)
      }
    } catch (err) {
      console.error("Failed to generate diagram:", err)
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/diagrams/${id}`)
      setDeletingId(null)
      loadDiagrams()
      loadRecent()
    } catch (err) {
      console.error("Failed to delete diagram:", err)
    }
  }


  const totalPages = Math.ceil(total / pageSize)


  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diagrams & Maps</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generate and manage knowledge visualizations from your documents
          </p>
        </div>
        <Button onClick={openGenerateModal}>Generate New</Button>
      </div>

      {recentDiagrams.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
            Recently Viewed
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentDiagrams.map(d => {
              const meta = DIAGRAM_TYPE_META[d.diagram_type]
              return (
                <button
                  key={d.id}
                  onClick={() => navigate(`/knowledge/diagram/${d.url_slug}`)}
                  className="flex-shrink-0 w-56 rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{meta?.icon}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: meta?.color }}
                    >
                      {meta?.label}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {d.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{d.node_count} concepts</span>
                    <span>·</span>
                    <span>{d.link_count} links</span>
                  </div>
                  {d.last_viewed_at && (
                    <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      {timeAgo(d.last_viewed_at)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        {(["all", "knowledge_map", "flowchart", "mindmap", "timeline"] as const).map(type => {
          const isActive = filterType === type
          const label = type === "all" ? "All" : DIAGRAM_TYPE_META[type].label
          return (
            <button
              key={type}
              onClick={() => { setFilterType(type); setPage(1) }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : diagrams.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-8 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <svg className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 64 64">
            <circle cx="32" cy="20" r="6" stroke="currentColor" strokeWidth="2" />
            <circle cx="16" cy="44" r="5" stroke="currentColor" strokeWidth="2" />
            <circle cx="48" cy="44" r="5" stroke="currentColor" strokeWidth="2" />
            <line x1="28" y1="24" x2="19" y2="40" stroke="currentColor" strokeWidth="2" />
            <line x1="36" y1="24" x2="45" y2="40" stroke="currentColor" strokeWidth="2" />
            <line x1="21" y1="44" x2="43" y2="44" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">No diagrams yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generate your first diagram from your uploaded documents
          </p>
          <Button onClick={openGenerateModal} className="mt-4">
            Generate New Diagram
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {diagrams.map(d => {
            const meta = DIAGRAM_TYPE_META[d.diagram_type]
            return (
              <div
                key={d.id}
                className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => navigate(`/knowledge/diagram/${d.url_slug}`)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{meta?.icon}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: meta?.color }}
                      >
                        {meta?.label}
                      </span>
                      {d.is_edited && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Edited
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {d.title}
                    </h3>
                    {d.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {d.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{d.node_count} concepts</span>
                      <span>{d.link_count} connections</span>
                      <span>·</span>
                      <span>Updated {timeAgo(d.updated_at)}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/knowledge/diagram/${d.url_slug}`)}
                      className="text-xs px-3 py-1"
                    >
                      Open
                    </Button>
                    {deletingId === d.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="danger"
                          onClick={() => handleDelete(d.id)}
                          className="text-xs px-3 py-1"
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setDeletingId(null)}
                          className="text-xs px-2 py-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => setDeletingId(d.id)}
                        className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generate New Diagram</h2>
              <button
                onClick={() => setIsGenerateOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Diagram Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(DIAGRAM_TYPE_META) as [DiagramType, typeof DIAGRAM_TYPE_META[DiagramType]][]).map(([type, meta]) => (
                  <button
                    key={type}
                    onClick={() => handleGenTypeChange(type)}
                    className={cn(
                      "rounded-lg border-2 p-3 text-left transition",
                      genType === type
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{meta.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{meta.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Source
              </label>
              <div className="flex gap-2 mb-3">
                {sourceOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setGenSourceMode(opt.key)
                    }}
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs font-medium transition",
                      genSourceMode === opt.key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {genSourceMode === "all" && (
                <p className="text-sm text-gray-500 dark:text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  {genType === "mindmap"
                    ? "All concepts from all your uploaded documents will be included to build a broad concept tree."
                    : "All concepts from all your uploaded documents will be included."}
                </p>
              )}

              {genSourceMode === "documents" && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                  ) : documents.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No completed documents found</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          placeholder="Search documents..."
                          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:text-white"
                        />
                        <span className="shrink-0 text-xs text-gray-500">{selectedDocIds.length} selected</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {documents
                          .filter(doc => docSearch === "" || doc.document_name.toLowerCase().includes(docSearch.toLowerCase()))
                          .map(doc => (
                          <label
                            key={doc.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedDocIds.includes(doc.id)}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...selectedDocIds, doc.id]
                                  : selectedDocIds.filter(id => id !== doc.id)
                                setSelectedDocIds(newIds)
                              }}
                              className="rounded border-gray-300"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {doc.document_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {doc.concepts_extracted} concepts · {doc.relationships_extracted} relationships
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {genSourceMode === "concepts" && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                  {loadingConcepts ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                  ) : selectableConcepts.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                      {genType === "flowchart" ? "No procedures found" : "No concepts found"}
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={conceptSearch}
                          onChange={(e) => setConceptSearch(e.target.value)}
                          placeholder={`Search ${selectableConceptLabel}s...`}
                          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:text-white"
                        />
                        <div className="ml-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">{selectedConceptIds.length} / {selectableConcepts.length}</span>
                          <button
                            onClick={() => {
                              if (selectedConceptIds.length === selectableConcepts.length) {
                                setSelectedConceptIds([])
                              } else {
                                setSelectedConceptIds(selectableConcepts.map(c => c.id))
                              }
                            }}
                            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {selectedConceptIds.length === selectableConcepts.length ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {selectableConcepts
                          .filter(c => conceptSearch === "" || c.title.toLowerCase().includes(conceptSearch.toLowerCase()) || c.concept_type.toLowerCase().includes(conceptSearch.toLowerCase()))
                          .map(concept => (
                          <label
                            key={concept.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedConceptIds.includes(concept.id)}
                              onChange={(e) => {
                                setSelectedConceptIds(prev =>
                                  e.target.checked
                                    ? [...prev, concept.id]
                                    : prev.filter(id => id !== concept.id)
                                )
                              }}
                              className="rounded border-gray-300"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-900 dark:text-white">{concept.title}</span>
                              <span className="ml-2 text-xs text-gray-400 capitalize">{concept.concept_type}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {genSourceMode === "learning_paths" && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                  {loadingLearningPaths ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                  ) : learningPaths.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No learning paths found</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={learningPathSearch}
                          onChange={(e) => setLearningPathSearch(e.target.value)}
                          placeholder="Search learning paths..."
                          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:text-white"
                        />
                        <span className="shrink-0 text-xs text-gray-500">{selectedLearningPathIds.length} selected</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {learningPaths
                          .filter(path =>
                            learningPathSearch === ""
                            || path.title.toLowerCase().includes(learningPathSearch.toLowerCase())
                            || (path.target_concept_title || "").toLowerCase().includes(learningPathSearch.toLowerCase())
                          )
                          .map(path => (
                            <label
                              key={path.id}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedLearningPathIds.includes(path.id)}
                                onChange={(e) => {
                                  setSelectedLearningPathIds(prev =>
                                    e.target.checked
                                      ? [...prev, path.id]
                                      : prev.filter(id => id !== path.id)
                                  )
                                }}
                                className="rounded border-gray-300"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {path.title}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {path.target_concept_title || "Learning path"}
                                </div>
                              </div>
                            </label>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {supportsExpansion && (genSourceMode === "all" || (genSourceMode === "documents" && selectedDocIds.length > 0) || (genSourceMode === "concepts" && selectedConceptIds.length > 0)) && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expandEnabled}
                    onChange={(e) => setExpandEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Expand related concepts
                  </span>
                </label>

                {expandEnabled && (
                  <div className="mt-3 ml-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-12">Depth:</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setExpandDepth(d)}
                            className={cn(
                              "rounded px-3 py-1 text-xs font-medium transition",
                              expandDepth === d
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                            )}
                          >
                            {d === 0 ? "Full" : `${d} ${d === 1 ? "level" : "levels"}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Include lateral */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeLateral}
                        onChange={(e) => setIncludeLateral(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Include related concepts (similar, connected, etc.)
                      </span>
                    </label>

                    {/* Include upward */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeUpward}
                        onChange={(e) => setIncludeUpward(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Include parent concepts (confined to same taxonomy)
                      </span>
                    </label>

                    {/* Show taxonomy */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTaxonomy}
                        onChange={(e) => setShowTaxonomy(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Show taxonomy categories as nodes
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={genTitle}
                onChange={(e) => setGenTitle(e.target.value)}
                placeholder={`${DIAGRAM_TYPE_META[genType].label} - ${new Date().toLocaleDateString()}`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsGenerateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={
                  generating
                  || (genSourceMode === "documents" && selectedDocIds.length === 0)
                  || (genSourceMode === "concepts" && selectedConceptIds.length === 0)
                  || (genSourceMode === "learning_paths" && selectedLearningPathIds.length === 0)
                }
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </span>
                ) : (
                  "Generate"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
