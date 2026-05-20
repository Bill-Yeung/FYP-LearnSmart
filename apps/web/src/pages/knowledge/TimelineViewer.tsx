import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react"
import type { DiagramNode, DiagramLink, ViewerProps } from "./DiagramDetailPage"
import type { DiagramViewerHandle } from "./KnowledgeMapViewer"
import { ConfirmDialog } from "../../components/ui/ConfirmDialog"
import { Button } from "../../components/ui/Button"

type ConceptType = "definition" | "procedure" | "example" | "assessment" | "formula" | "entity"

interface TimelineViewerProps extends ViewerProps {
  onUnsavedChange: () => void
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 80
const NODE_RADIUS = 8
const H_SPACING = 250
const TIMELINE_Y = 200
const NODE_Y_ABOVE = 100
const NODE_Y_BELOW = 300
const DOT_RADIUS = 7
const STEM_WIDTH = 2

function getConceptColor(type: string): string {
  switch (type) {
    case "definition": return "#3B82F6"
    case "procedure": return "#22C55E"
    case "example": return "#EAB308"
    case "assessment": return "#8B5CF6"
    case "entity": return "#6B7280"
    case "formula": return "#EF4444"
    default: return "#9CA3AF"
  }
}

const CONCEPT_LEGEND = [
  { type: "definition", label: "Definition", color: "#3B82F6" },
  { type: "procedure", label: "Procedure", color: "#22C55E" },
  { type: "example", label: "Example", color: "#EAB308" },
  { type: "assessment", label: "Assessment", color: "#8B5CF6" },
  { type: "formula", label: "Formula", color: "#EF4444" },
  { type: "entity", label: "Entity", color: "#6B7280" },
]

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + "\u2026"
}

interface LayoutNode extends DiagramNode {
  lx: number
  ly: number
  timelineX: number
  index: number
}

// kahn-style topological sort to order nodes by their link dependencies
function topologicalSort(
  nodes: DiagramNode[],
  links: DiagramLink[]
): DiagramNode[] {
  if (nodes.length === 0) return []

  const nodeIds = new Set(nodes.map((n) => n.id))
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  const inDegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  nodes.forEach((n) => {
    inDegree.set(n.id, 0)
    outgoing.set(n.id, [])
  })

  const connectedIds = new Set<string>()

  links.forEach((l) => {
    if (nodeIds.has(l.sourceId) && nodeIds.has(l.targetId)) {
      connectedIds.add(l.sourceId)
      connectedIds.add(l.targetId)
      outgoing.get(l.sourceId)?.push(l.targetId)
      inDegree.set(l.targetId, (inDegree.get(l.targetId) ?? 0) + 1)
    }
  })

  const connectedNodes = nodes.filter((n) => connectedIds.has(n.id))
  const disconnectedNodes = nodes.filter((n) => !connectedIds.has(n.id))

  const queue: string[] = []
  connectedNodes.forEach((n) => {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      queue.push(n.id)
    }
  })

  if (queue.length === 0 && connectedNodes.length > 0) {
    queue.push(connectedNodes[0].id)
  }

  const sorted: DiagramNode[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = nodeById.get(id)
    if (node) sorted.push(node)

    const targets = outgoing.get(id) ?? []
    for (const tid of targets) {
      const newDeg = (inDegree.get(tid) ?? 1) - 1
      inDegree.set(tid, newDeg)
      if (newDeg <= 0 && !visited.has(tid)) {
        queue.push(tid)
      }
    }
  }

  connectedNodes.forEach((n) => {
    if (!visited.has(n.id)) {
      sorted.push(n)
      visited.add(n.id)
    }
  })

  disconnectedNodes.forEach((n) => sorted.push(n))

  return sorted
}

// space sorted nodes evenly along the axis, alternating above/below
function computeTimelineLayout(
  nodes: DiagramNode[],
  links: DiagramLink[]
): LayoutNode[] {
  const sorted = topologicalSort(nodes, links)

  return sorted.map((node, index) => {
    const timelineX = index * H_SPACING
    const isAbove = index % 2 === 1
    const nodeY = isAbove ? NODE_Y_ABOVE : NODE_Y_BELOW

    return {
      ...node,
      lx: timelineX - NODE_WIDTH / 2,
      ly: nodeY - (isAbove ? NODE_HEIGHT : 0),
      timelineX,
      index,
    }
  })
}

export const TimelineViewer = forwardRef(function TimelineViewer({ nodes: propNodes, links: propLinks, viewState, onSave, title: _title, onUnsavedChange }: TimelineViewerProps, ref: React.ForwardedRef<DiagramViewerHandle>) {

  const [nodes, setNodes] = useState<DiagramNode[]>(propNodes)
  const [links, setLinks] = useState<DiagramLink[]>(propLinks)

  const layoutNodes = useMemo(
    () => computeTimelineLayout(nodes, links),
    [nodes, links]
  )

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editConceptType, setEditConceptType] = useState<ConceptType>("definition")
  const [editDifficulty, setEditDifficulty] = useState("")

  const [isEditLinkModalOpen, setIsEditLinkModalOpen] = useState(false)
  const [selectedLink, setSelectedLink] = useState<DiagramLink | null>(null)
  const [editLinkType, setEditLinkType] = useState("")

  const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false)
  const [isDeleteLinkDialogOpen, setIsDeleteLinkDialogOpen] = useState(false)

  const [isCreatingLink, setIsCreatingLink] = useState(false)
  const [linkSourceNodeId, setLinkSourceNodeId] = useState<string | null>(null)
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false)
  const [pendingLinkTargetId, setPendingLinkTargetId] = useState<string | null>(null)
  const [newLinkType, setNewLinkType] = useState("related_to")

  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(() => {

    const map = new Map<string, { x: number; y: number }>()
    propNodes.forEach(n => {
      if (n.x !== undefined && n.y !== undefined) {
        map.set(n.id, { x: n.x, y: n.y })
      }
    })
    return map
  })
  const [transform, setTransform] = useState(() => {
    if (viewState && viewState.panX !== undefined) {
      return {
        x: viewState.panX,
        y: viewState.panY,
        scale: viewState.scale ?? 1,
      }
    }
    return { x: 0, y: 0, scale: 1 }
  })

  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const transformAtPanStart = useRef({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const isDragging = useRef(false)
  const dragNodeId = useRef<string | null>(null)
  const dragStart = useRef({ x: 0, y: 0 })
  const nodeStartPos = useRef({ x: 0, y: 0 })

  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>()
    layoutNodes.forEach((n) => map.set(n.id, n))
    return map
  }, [layoutNodes])

  const getNodePosition = useCallback((nodeId: string) => {
    const customPos = nodePositions.get(nodeId)
    if (customPos) return customPos
    const ln = layoutNodes.find((n) => n.id === nodeId)
    return ln ? { x: ln.lx, y: ln.ly } : { x: 0, y: 0 }
  }, [nodePositions, layoutNodes])

  const triggerSave = useCallback(() => {
    const saveNodes = nodes.map((n) => {
      const pos = getNodePosition(n.id)
      return {
        ...n,
        x: pos.x,
        y: pos.y,
      }
    })
    const currentViewState = {
      panX: transform.x,
      panY: transform.y,
      scale: transform.scale,
    }
    onSave({ nodes: saveNodes, links }, currentViewState)
  }, [nodes, links, getNodePosition, transform, onSave])

  useImperativeHandle(ref, () => ({
    save: triggerSave
  }), [triggerSave])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        triggerSave()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [triggerSave])

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (!isEditMode) return
      e.stopPropagation()
      isDragging.current = true
      dragNodeId.current = nodeId
      dragStart.current = { x: e.clientX, y: e.clientY }
      const pos = getNodePosition(nodeId)
      nodeStartPos.current = { x: pos.x, y: pos.y }
    },
    [isEditMode, getNodePosition]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement
      if (target.tagName === "svg" || target.classList.contains("timeline-bg")) {
        isPanning.current = true
        panStart.current = { x: e.clientX, y: e.clientY }
        transformAtPanStart.current = { x: transform.x, y: transform.y }
      }
    },
    [transform.x, transform.y]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isDragging.current && dragNodeId.current) {
        const dx = (e.clientX - dragStart.current.x) / transform.scale
        const dy = (e.clientY - dragStart.current.y) / transform.scale
        setNodePositions((prev) => {
          const newMap = new Map(prev)
          newMap.set(dragNodeId.current!, {
            x: nodeStartPos.current.x + dx,
            y: nodeStartPos.current.y + dy,
          })
          return newMap
        })
        return
      }
      if (!isPanning.current) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setTransform((prev) => ({
        ...prev,
        x: transformAtPanStart.current.x + dx,
        y: transformAtPanStart.current.y + dy,
      }))
    },
    [transform.scale]
  )

  const handleMouseUp = useCallback(() => {
    if (isDragging.current && dragNodeId.current) {
      isDragging.current = false
      dragNodeId.current = null
      onUnsavedChange()
    }
    if (isPanning.current) {
      isPanning.current = false
      onUnsavedChange()
    }
  }, [onUnsavedChange])

  // zoom around the cursor position so the point under the cursor stays put
  const handleWheelZoom = useCallback((clientX: number, clientY: number, deltaY: number) => {
    const scaleChange = deltaY > 0 ? 0.9 : 1.1
    onUnsavedChange()
    setTransform((prev) => {
      const newScale = Math.max(0.1, Math.min(5, prev.scale * scaleChange))

      const svgEl = svgRef.current
      if (!svgEl) return { ...prev, scale: newScale }

      const rect = svgEl.getBoundingClientRect()
      const cursorX = clientX - rect.left
      const cursorY = clientY - rect.top

      const ratio = newScale / prev.scale
      const newX = cursorX - (cursorX - prev.x) * ratio
      const newY = cursorY - (cursorY - prev.y) * ratio

      return { x: newX, y: newY, scale: newScale }
    })
  }, [])

  // attach a non-passive wheel listener so we can preventDefault scroll
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      handleWheelZoom(e.clientX, e.clientY, e.deltaY)
    }

    svgEl.addEventListener("wheel", onWheel, { passive: false })
    return () => svgEl.removeEventListener("wheel", onWheel)
  }, [handleWheelZoom])

  // auto-fit the diagram to the viewport on first load when no saved view exists
  useEffect(() => {
    if (viewState && viewState.panX !== undefined) return
    if (layoutNodes.length === 0) return

    const svgEl = svgRef.current
    if (!svgEl) return

    const rect = svgEl.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    layoutNodes.forEach((n) => {
      if (n.lx < minX) minX = n.lx
      if (n.ly < minY) minY = n.ly
      if (n.lx + NODE_WIDTH > maxX) maxX = n.lx + NODE_WIDTH
      if (n.ly + NODE_HEIGHT > maxY) maxY = n.ly + NODE_HEIGHT
    })

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    const padding = 80

    const scaleX = (rect.width - padding * 2) / contentWidth
    const scaleY = (rect.height - padding * 2) / contentHeight
    const scale = Math.min(scaleX, scaleY, 1.5)

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setTransform({
      x: rect.width / 2 - centerX * scale,
      y: rect.height / 2 - centerY * scale,
      scale,
    })
  }, [layoutNodes, viewState])

  // compute the start and end x of the timeline axis with some padding
  const timelineExtents = useMemo(() => {
    if (layoutNodes.length === 0) return { startX: 0, endX: 0 }
    const first = layoutNodes[0].timelineX
    const last = layoutNodes[layoutNodes.length - 1].timelineX
    return {
      startX: first - H_SPACING / 2,
      endX: last + H_SPACING / 2,
    }
  }, [layoutNodes])

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  )

  const openEditModal = useCallback(() => {
    if (!selectedNode) return
    setEditTitle(selectedNode.title)
    setEditDescription(selectedNode.description || "")
    setEditConceptType((selectedNode.concept_type as ConceptType) || "definition")
    setEditDifficulty(selectedNode.difficulty_level || "")
    setIsEditModalOpen(true)
  }, [selectedNode])

  const saveNodeEdit = useCallback(() => {
    if (!selectedNode) return
    const updatedNodes = nodes.map((n) => {
      if (n.id === selectedNode.id) {
        return {
          ...n,
          title: editTitle,
          description: editDescription,
          concept_type: editConceptType,
          difficulty_level: editDifficulty || null,
        }
      }
      return n
    })
    setNodes(updatedNodes)
    setIsEditModalOpen(false)
    onUnsavedChange()
  }, [selectedNode, editTitle, editDescription, editConceptType, editDifficulty, nodes, onUnsavedChange])

  const confirmDeleteNode = useCallback(() => {
    if (!selectedNode) return
    setIsDeleteNodeDialogOpen(true)
  }, [selectedNode])

  const performDeleteNode = useCallback(() => {
    if (!selectedNode) return
    setNodes(nodes.filter((n) => n.id !== selectedNode.id))
    setLinks(links.filter((l) => l.sourceId !== selectedNode.id && l.targetId !== selectedNode.id))
    setSelectedNodeId(null)
    setIsDeleteNodeDialogOpen(false)
    onUnsavedChange()
  }, [selectedNode, nodes, links, onUnsavedChange])

  const startLinkCreation = useCallback(() => {
    if (!selectedNode) return
    setIsCreatingLink(true)
    setLinkSourceNodeId(selectedNode.id)
  }, [selectedNode])

  const handleNodeClickForLink = useCallback((nodeId: string) => {
    if (!isCreatingLink || !linkSourceNodeId) return false
    if (nodeId === linkSourceNodeId) return false

    const exists = links.some(
      (l) =>
        (l.sourceId === linkSourceNodeId && l.targetId === nodeId) ||
        (l.sourceId === nodeId && l.targetId === linkSourceNodeId)
    )
    if (exists) {
      setIsCreatingLink(false)
      setLinkSourceNodeId(null)
      return false
    }

    setPendingLinkTargetId(nodeId)
    setIsAddLinkModalOpen(true)
    return true
  }, [isCreatingLink, linkSourceNodeId, links])

  const createLink = useCallback(() => {
    if (!linkSourceNodeId || !pendingLinkTargetId) return
    const newLink: DiagramLink = {
      id: `l${Date.now()}`,
      sourceId: linkSourceNodeId,
      targetId: pendingLinkTargetId,
      relationship_type: newLinkType,
    }
    setLinks([...links, newLink])
    setIsAddLinkModalOpen(false)
    setIsCreatingLink(false)
    setLinkSourceNodeId(null)
    setPendingLinkTargetId(null)
    setNewLinkType("related_to")
    onUnsavedChange()
  }, [linkSourceNodeId, pendingLinkTargetId, newLinkType, links, onUnsavedChange])

  const cancelLinkCreation = useCallback(() => {
    setIsCreatingLink(false)
    setLinkSourceNodeId(null)
    setIsAddLinkModalOpen(false)
    setPendingLinkTargetId(null)
    setNewLinkType("related_to")
  }, [])

  const openEditLinkModal = useCallback((link: DiagramLink) => {
    setSelectedLink(link)
    setEditLinkType(link.relationship_type)
    setIsEditLinkModalOpen(true)
  }, [])

  const saveLinkEdit = useCallback(() => {
    if (!selectedLink) return
    const updatedLinks = links.map((l) => {
      if (l.id === selectedLink.id) {
        return { ...l, relationship_type: editLinkType }
      }
      return l
    })
    setLinks(updatedLinks)
    setIsEditLinkModalOpen(false)
    setSelectedLink(null)
    onUnsavedChange()
  }, [selectedLink, editLinkType, links, onUnsavedChange])

  const confirmDeleteLink = useCallback(() => {
    if (!selectedLink) return
    setIsDeleteLinkDialogOpen(true)
  }, [selectedLink])

  const performDeleteLink = useCallback(() => {
    if (!selectedLink) return
    setLinks(links.filter((l) => l.id !== selectedLink.id))
    setSelectedLink(null)
    setIsEditLinkModalOpen(false)
    setIsDeleteLinkDialogOpen(false)
    onUnsavedChange()
  }, [selectedLink, links, onUnsavedChange])

  // precompute arrow geometry for each link for the bottom of the axis
  const linkArrows = useMemo(() => {
    return links
      .map((link) => {
        const source = nodeMap.get(link.sourceId)
        const target = nodeMap.get(link.targetId)
        if (!source || !target) return null

        const fromX = source.timelineX
        const toX = target.timelineX
        const midX = (fromX + toX) / 2
        const direction = toX > fromX ? 1 : -1

        return {
          id: link.id,
          fromX,
          toX,
          midX,
          direction,
          relationship_type: link.relationship_type,
        }
      })
      .filter(Boolean) as {
      id: string
      fromX: number
      toX: number
      midX: number
      direction: number
      relationship_type: string
    }[]
  }, [links, nodeMap])

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]" style={{ minHeight: "500px" }}>
      <div className="flex-1 relative rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
        {/* Edit Mode Button */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg transition-colors ${
              isEditMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            }`}
          >
            {isEditMode ? "Exit Edit Mode" : "Edit Mode"}
          </button>
        </div>

        <svg
          ref={svgRef}
          className="h-full w-full"
          style={{ cursor: isDragging.current ? "grabbing" : isEditMode ? "default" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <linearGradient id="timeline-axis-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.2} />
              <stop offset="15%" stopColor="#94A3B8" stopOpacity={1} />
              <stop offset="85%" stopColor="#94A3B8" stopOpacity={1} />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity={0.2} />
            </linearGradient>

            <marker
              id="timeline-arrow-right"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
            </marker>
            <marker
              id="timeline-arrow-left"
              markerWidth="8"
              markerHeight="6"
              refX="0"
              refY="3"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon points="8 0, 0 3, 8 6" fill="#6B7280" />
            </marker>

            <filter id="timeline-card-shadow" x="-5%" y="-5%" width="115%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.08" />
            </filter>
          </defs>

          <rect
            className="timeline-bg"
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="transparent"
          />

          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Timeline axis */}
            <line
              x1={timelineExtents.startX}
              y1={TIMELINE_Y}
              x2={timelineExtents.endX}
              y2={TIMELINE_Y}
              stroke="url(#timeline-axis-gradient)"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <line
              x1={timelineExtents.startX}
              y1={TIMELINE_Y - 1}
              x2={timelineExtents.endX}
              y2={TIMELINE_Y - 1}
              stroke="#CBD5E1"
              strokeWidth={1}
              strokeLinecap="round"
              opacity={0.5}
            />

            {linkArrows.map((arrow) => {
              const arrowY = TIMELINE_Y + 12
              const startX = arrow.fromX + DOT_RADIUS * 2 * arrow.direction
              const endX = arrow.toX - DOT_RADIUS * 2 * arrow.direction

              return (
                <g key={arrow.id}>
                  <line
                    x1={startX}
                    y1={arrowY}
                    x2={endX}
                    y2={arrowY}
                    stroke="#9CA3AF"
                    strokeWidth={1.5}
                    markerEnd={
                      arrow.direction > 0
                        ? "url(#timeline-arrow-right)"
                        : "url(#timeline-arrow-left)"
                    }
                    opacity={0.6}
                  />
                  <text
                    x={arrow.midX}
                    y={arrowY + 12}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fill="#94A3B8"
                    fontSize={9}
                    fontWeight={500}
                  >
                    {arrow.relationship_type.replace(/_/g, " ")}
                  </text>
                </g>
              )
            })}

            {layoutNodes.map((node) => {
              const color = getConceptColor(node.concept_type)
              const isSelected = node.id === selectedNodeId
              const isLinkSource = isCreatingLink && linkSourceNodeId === node.id
              const isAbove = node.index % 2 === 1
              const pos = getNodePosition(node.id)
              const stemX = node.timelineX
              const stemTopY = isAbove ? pos.y + NODE_HEIGHT : TIMELINE_Y
              const stemBottomY = isAbove ? TIMELINE_Y : pos.y

              return (
                <g
                  key={node.id}
                  style={{ cursor: isCreatingLink ? "crosshair" : isEditMode ? "grab" : "pointer" }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={(e) => {
                    if (isDragging.current) return
                    e.stopPropagation()
                    if (isCreatingLink) {
                      handleNodeClickForLink(node.id)
                    } else {
                      setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
                    }
                  }}
                >
                  <line
                    x1={stemX}
                    y1={stemTopY}
                    x2={stemX}
                    y2={stemBottomY}
                    stroke={color}
                    strokeWidth={STEM_WIDTH}
                    strokeDasharray="4 3"
                    opacity={0.5}
                  />

                  <circle
                    cx={node.timelineX}
                    cy={TIMELINE_Y}
                    r={DOT_RADIUS}
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />

                  {(isSelected || isLinkSource) && (
                    <rect
                      x={pos.x - 4}
                      y={pos.y - 4}
                      width={NODE_WIDTH + 8}
                      height={NODE_HEIGHT + 8}
                      rx={NODE_RADIUS + 2}
                      ry={NODE_RADIUS + 2}
                      fill="none"
                      stroke={isLinkSource ? "#3B82F6" : color}
                      strokeWidth={3}
                      strokeDasharray={isLinkSource ? "none" : "6 3"}
                      opacity={0.7}
                    />
                  )}

                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={NODE_RADIUS}
                    ry={NODE_RADIUS}
                    fill="#FFFFFF"
                    stroke={isSelected ? color : "#E2E8F0"}
                    strokeWidth={isSelected ? 2 : 1}
                    filter="url(#timeline-card-shadow)"
                  />

                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={4}
                    height={NODE_HEIGHT}
                    rx={NODE_RADIUS}
                    ry={0}
                    fill={color}
                  />
                  <rect
                    x={pos.x + 2}
                    y={pos.y + 1}
                    width={4}
                    height={NODE_HEIGHT - 2}
                    fill={color}
                  />

                  <text
                    x={pos.x + 14}
                    y={pos.y + NODE_HEIGHT / 2 - 8}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fill="#1E293B"
                    fontSize={13}
                    fontWeight={600}
                  >
                    {truncateText(node.title, 20)}
                  </text>

                  <text
                    x={pos.x + 14}
                    y={pos.y + NODE_HEIGHT / 2 + 12}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fill="#94A3B8"
                    fontSize={10}
                    fontWeight={500}
                  >
                    {node.concept_type}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        <div className="absolute bottom-4 left-4 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800/95 z-10">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Concept Types
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
            {CONCEPT_LEGEND.map((item) => (
              <div key={item.type} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 rounded-lg border border-gray-200 bg-white/95 px-3 py-1.5 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800/95 z-10">
          <span className="font-semibold text-gray-900 dark:text-white">{nodes.length}</span>
          <span className="text-gray-500 dark:text-gray-400"> nodes &middot; </span>
          <span className="font-semibold text-gray-900 dark:text-white">{links.length}</span>
          <span className="text-gray-500 dark:text-gray-400"> links</span>
        </div>

        {/* Link creation mode indicator */}
        {isCreatingLink && (
          <div className="absolute top-4 right-4 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 shadow-lg dark:border-blue-700 dark:bg-blue-900/50 z-10">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Creating Connection
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Click another node to connect
            </div>
            <button
              onClick={cancelLinkCreation}
              className="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="w-80 flex-shrink-0 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden flex flex-col">
        {selectedNode ? (
          <>
            <div className="border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: getConceptColor(selectedNode.concept_type) }}
                >
                  {selectedNode.concept_type}
                </span>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedNode.title}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode.description && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Description
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedNode.description}
                  </p>
                </div>
              )}

              {selectedNode.difficulty_level && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Difficulty Level
                  </h4>
                  <span
                    className={
                      "inline-block rounded-full px-3 py-1 text-xs font-medium capitalize " +
                      (selectedNode.difficulty_level === "beginner"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : selectedNode.difficulty_level === "intermediate"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : selectedNode.difficulty_level === "advanced"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400")
                    }
                  >
                    {selectedNode.difficulty_level}
                  </span>
                </div>
              )}

              {selectedNode.keywords && selectedNode.keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Keywords
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                  Connections
                </h4>
                {(() => {
                  const connections = links
                    .filter(
                      (l) =>
                        l.sourceId === selectedNode.id ||
                        l.targetId === selectedNode.id
                    )
                    .map((l) => {
                      const isOutgoing = l.sourceId === selectedNode.id
                      const relatedId = isOutgoing ? l.targetId : l.sourceId
                      const relatedNode = layoutNodes.find(
                        (n) => n.id === relatedId
                      )
                      return relatedNode
                        ? { node: relatedNode, link: l, direction: isOutgoing ? "outgoing" : "incoming" }
                        : null
                    })
                    .filter(Boolean) as {
                    node: LayoutNode
                    link: DiagramLink
                    direction: string
                  }[]

                  if (connections.length === 0) {
                    return (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No connections
                      </p>
                    )
                  }

                  return (
                    <div className="space-y-1.5">
                      {connections.map(({ node: relNode, link, direction }) => (
                        <div
                          key={relNode.id + link.id}
                          className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                        >
                          <button
                            onClick={() => setSelectedNodeId(relNode.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
                          >
                            <span
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: getConceptColor(relNode.concept_type),
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {relNode.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {direction === "outgoing" ? "\u2192" : "\u2190"}{" "}
                                {link.relationship_type.replace(/_/g, " ")}
                              </div>
                            </div>
                          </button>
                          {isEditMode && (
                            <div className="flex border-t border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() => openEditLinkModal(link)}
                                className="flex-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedLink(link)
                                  setIsDeleteLinkDialogOpen(true)
                                }}
                                className="flex-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border-l border-gray-200 dark:border-gray-700"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {isEditMode && (
              <div className="border-t border-gray-200 p-4 dark:border-gray-700 space-y-2">
                <Button variant="secondary" fullWidth onClick={openEditModal}>
                  Edit Concept
                </Button>
                <Button variant="secondary" fullWidth onClick={startLinkCreation}>
                  Create Connection
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={confirmDeleteNode}
                  className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete Concept
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg
                className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Timeline
              </p>
              <p className="text-sm mt-1">
                Click a node to view details
              </p>
              <div className="mt-4 text-xs space-y-1 text-gray-400 dark:text-gray-500">
                <p>Drag on empty space to pan</p>
                <p>Scroll to zoom</p>
                <p>Ctrl+S to save</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Node Modal */}
      {isEditModalOpen && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Concept</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Concept Type
                </label>
                <select
                  value={editConceptType}
                  onChange={(e) => setEditConceptType(e.target.value as ConceptType)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="definition">Definition</option>
                  <option value="procedure">Procedure</option>
                  <option value="example">Example</option>
                  <option value="assessment">Assessment</option>
                  <option value="formula">Formula</option>
                  <option value="entity">Entity</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">None</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveNodeEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {isAddLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create Connection</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relationship Type
              </label>
              <select
                value={newLinkType}
                onChange={(e) => setNewLinkType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="has_part">Has Part</option>
                <option value="requires">Requires</option>
                <option value="exemplifies">Exemplifies</option>
                <option value="related_to">Related To</option>
                <option value="leads_to">Leads To</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={cancelLinkCreation}>
                Cancel
              </Button>
              <Button onClick={createLink}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {isEditLinkModalOpen && selectedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Connection</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relationship Type
              </label>
              <select
                value={editLinkType}
                onChange={(e) => setEditLinkType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="has_part">Has Part</option>
                <option value="requires">Requires</option>
                <option value="exemplifies">Exemplifies</option>
                <option value="related_to">Related To</option>
                <option value="leads_to">Leads To</option>
              </select>
            </div>

            <div className="mt-6 flex justify-between">
              <Button
                variant="ghost"
                onClick={confirmDeleteLink}
                className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Delete Connection
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => {
                  setIsEditLinkModalOpen(false)
                  setSelectedLink(null)
                }}>
                  Cancel
                </Button>
                <Button onClick={saveLinkEdit}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={isDeleteNodeDialogOpen}
        onClose={() => setIsDeleteNodeDialogOpen(false)}
        onConfirm={performDeleteNode}
        title="Delete Concept"
        message={`Are you sure you want to delete "${selectedNode?.title || 'this concept'}"? This will also remove all connections to this concept.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={isDeleteLinkDialogOpen}
        onClose={() => setIsDeleteLinkDialogOpen(false)}
        onConfirm={performDeleteLink}
        title="Delete Connection"
        message="Are you sure you want to delete this connection?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
})
