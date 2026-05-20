import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"
import { KnowledgeMapViewer } from "./KnowledgeMapViewer"
import type { DiagramViewerHandle } from "./KnowledgeMapViewer"
import { FlowchartViewer } from "./FlowchartViewer"
import { MindmapViewer } from "./MindmapViewer"
import { TimelineViewer } from "./TimelineViewer"

interface DiagramData {
  id: string
  title: string
  description: string | null
  diagram_type: "knowledge_map" | "flowchart" | "mindmap" | "timeline"
  layout_type: string
  diagram_data: {
    nodes: DiagramNode[]
    links: DiagramLink[]
    groups?: TaxonomyGroup[]
  }
  view_state: Record<string, number> | null
  node_count: number
  link_count: number
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface DiagramNode {
  id: string
  title: string
  description: string | null
  concept_type: string
  difficulty_level: string | null
  keywords?: string[]
  x?: number
  y?: number
  z?: number
}

export interface DiagramLink {
  id: string
  sourceId: string
  targetId: string
  relationship_type: string
  strength?: number | null
}

export interface TaxonomyGroup {
  id: string
  label: string
  lcc_code: string
  concept_ids: string[]
}

export interface ViewerProps {
  nodes: DiagramNode[]
  links: DiagramLink[]
  groups?: TaxonomyGroup[]
  viewState: Record<string, number> | null
  onSave: (data: { nodes: DiagramNode[]; links: DiagramLink[] }, viewState: Record<string, number> | null) => Promise<void>
  title: string
}

export function DiagramDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const viewerRef = useRef<DiagramViewerHandle>(null)

  const [diagram, setDiagram] = useState<DiagramData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      navigate("/knowledge/diagram")
      return
    }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await apiClient.get<DiagramData>(`/api/diagrams/s/${slug}`)
        if (data) {
          setDiagram(data)
        } else {
          setError("Diagram not found")
        }
      } catch (err) {
        console.error("Failed to load diagram:", err)
        setError("Failed to load diagram")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug, navigate])

  // persist the edited nodes/links + camera view-state, and mark as user-edited
  const handleSave = useCallback(async (
    data: { nodes: DiagramNode[]; links: DiagramLink[] },
    viewState: Record<string, number> | null
  ) => {
    if (!diagram) return
    setSaving(true)
    try {
      await apiClient.put(`/api/diagrams/${diagram.id}`, {
        diagram_data: data,
        view_state: viewState,
        is_edited: true,
      })
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error("Failed to save diagram:", err)
    } finally {
      setSaving(false)
    }
  }, [diagram])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading diagram...</p>
        </div>
      </div>
    )
  }

  if (error || !diagram) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{error || "Diagram not found"}</p>
          <Button variant="secondary" onClick={() => navigate("/knowledge/diagram")} className="mt-4">
            Back to Diagrams
          </Button>
        </div>
      </div>
    )
  }

  const headerBar = (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate("/knowledge/diagram")} className="text-sm">
          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{diagram.title}</h1>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {diagram.node_count} concepts · {diagram.link_count} connections
        </span>
      </div>
      <div className="flex items-center gap-2">
        {hasUnsavedChanges && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
        )}
        <Button
          variant={hasUnsavedChanges ? "primary" : "secondary"}
          onClick={() => {
            viewerRef.current?.save()
          }}
          disabled={saving || !hasUnsavedChanges}
          className="text-sm"
        >
          {saving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}
        </Button>
      </div>
    </div>
  )

  const viewerProps: ViewerProps = {
    nodes: diagram.diagram_data.nodes,
    links: diagram.diagram_data.links,
    groups: diagram.diagram_data.groups,
    viewState: diagram.view_state,
    onSave: handleSave,
    title: diagram.title,
  }

  return (
    <div>
      {headerBar}
      {diagram.diagram_type === "knowledge_map" && (
        <KnowledgeMapViewer ref={viewerRef} {...viewerProps} onUnsavedChange={() => setHasUnsavedChanges(true)} />
      )}
      {diagram.diagram_type === "flowchart" && (
        <FlowchartViewer ref={viewerRef} {...viewerProps} onUnsavedChange={() => setHasUnsavedChanges(true)} />
      )}
      {diagram.diagram_type === "mindmap" && (
        <MindmapViewer ref={viewerRef} {...viewerProps} onUnsavedChange={() => setHasUnsavedChanges(true)} />
      )}
      {diagram.diagram_type === "timeline" && (
        <TimelineViewer ref={viewerRef} {...viewerProps} onUnsavedChange={() => setHasUnsavedChanges(true)} />
      )}
    </div>
  )
}
