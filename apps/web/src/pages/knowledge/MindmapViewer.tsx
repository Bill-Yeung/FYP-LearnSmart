import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react"
import type { DiagramNode, DiagramLink, ViewerProps } from "./DiagramDetailPage"
import type { DiagramViewerHandle } from "./KnowledgeMapViewer"
import { ConfirmDialog } from "../../components/ui/ConfirmDialog"
import { Button } from "../../components/ui/Button"

type ConceptType = "definition" | "procedure" | "example" | "assessment" | "formula" | "entity"

interface MindmapViewerProps extends ViewerProps {
  onUnsavedChange: () => void
}

const LEVEL_RADIUS_STEP = 150
const CENTER_NODE_RADIUS = 35
const LEVEL1_NODE_RADIUS = 25
const DEFAULT_NODE_RADIUS = 20
const DISCONNECTED_CLUSTER_GAP = 100

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

interface LayoutNode extends DiagramNode {
  lx: number
  ly: number
  level: number
}

// place nodes in concentric rings around the most-connected hub via bfs levels
function computeRadialLayout(
  nodes: DiagramNode[],
  links: DiagramLink[]
): LayoutNode[] {
  if (nodes.length === 0) return []

  const nodeIds = new Set(nodes.map((n) => n.id))

  const adjacency = new Map<string, Set<string>>()
  nodes.forEach((n) => adjacency.set(n.id, new Set()))
  links.forEach((l) => {
    if (nodeIds.has(l.sourceId) && nodeIds.has(l.targetId)) {
      adjacency.get(l.sourceId)?.add(l.targetId)
      adjacency.get(l.targetId)?.add(l.sourceId)
    }
  })

  const connectedIds = new Set<string>()
  links.forEach((l) => {
    if (nodeIds.has(l.sourceId) && nodeIds.has(l.targetId)) {
      connectedIds.add(l.sourceId)
      connectedIds.add(l.targetId)
    }
  })

  const connectedNodes = nodes.filter((n) => connectedIds.has(n.id))
  const disconnectedNodes = nodes.filter((n) => !connectedIds.has(n.id))

  if (connectedNodes.length === 0) {
    return nodes.map((node, idx) => {
      const cols = Math.ceil(Math.sqrt(nodes.length))
      const row = Math.floor(idx / cols)
      const col = idx % cols
      return {
        ...node,
        lx: col * 80,
        ly: row * 80,
        level: -1,
      }
    })
  }

  let centerNode = connectedNodes[0]
  let maxConnections = adjacency.get(centerNode.id)?.size ?? 0
  connectedNodes.forEach((n) => {
    const count = adjacency.get(n.id)?.size ?? 0
    if (count > maxConnections) {
      maxConnections = count
      centerNode = n
    }
  })

  const levelMap = new Map<string, number>()
  const levels: string[][] = []
  const visited = new Set<string>()

  const queue: string[] = [centerNode.id]
  visited.add(centerNode.id)
  levelMap.set(centerNode.id, 0)
  levels.push([centerNode.id])

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLevel = levelMap.get(current)!
    const neighbors = adjacency.get(current)

    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          const nextLevel = currentLevel + 1
          levelMap.set(neighbor, nextLevel)

          while (levels.length <= nextLevel) {
            levels.push([])
          }
          levels[nextLevel].push(neighbor)
          queue.push(neighbor)
        }
      }
    }
  }

  connectedNodes.forEach((n) => {
    if (!visited.has(n.id)) {
      visited.add(n.id)

      const miniQueue: string[] = [n.id]
      const miniVisited = new Set<string>([n.id])
      const miniLevels: string[][] = [[n.id]]
      levelMap.set(n.id, 0)

      while (miniQueue.length > 0) {
        const cur = miniQueue.shift()!
        const curLevel = levelMap.get(cur)!
        const neigh = adjacency.get(cur)
        if (neigh) {
          for (const nb of neigh) {
            if (!visited.has(nb) && !miniVisited.has(nb)) {
              miniVisited.add(nb)
              visited.add(nb)
              const nl = curLevel + 1
              levelMap.set(nb, nl)
              while (miniLevels.length <= nl) miniLevels.push([])
              miniLevels[nl].push(nb)
              miniQueue.push(nb)
            }
          }
        }
      }

      miniLevels.forEach((ml, li) => {
        while (levels.length <= li) levels.push([])
        levels[li].push(...ml)
      })
    }
  })

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const result: LayoutNode[] = []

  levels.forEach((levelNodes, levelIndex) => {
    if (levelIndex === 0) {
      levelNodes.forEach((id) => {
        const node = nodeById.get(id)
        if (node) {
          result.push({
            ...node,
            lx: 0,
            ly: 0,
            level: 0,
          })
        }
      })
    } else {
      const radius = levelIndex * LEVEL_RADIUS_STEP
      const count = levelNodes.length
      const angleStep = (2 * Math.PI) / count
      const startAngle = -Math.PI / 2

      levelNodes.forEach((id, idx) => {
        const node = nodeById.get(id)
        if (node) {
          const angle = startAngle + idx * angleStep
          result.push({
            ...node,
            lx: Math.cos(angle) * radius,
            ly: Math.sin(angle) * radius,
            level: levelIndex,
          })
        }
      })
    }
  })

  if (disconnectedNodes.length > 0) {
    let maxY = 0
    result.forEach((n) => {
      const bottom = n.ly + CENTER_NODE_RADIUS
      if (bottom > maxY) maxY = bottom
    })

    const startY = maxY + DISCONNECTED_CLUSTER_GAP
    const cols = Math.ceil(Math.sqrt(disconnectedNodes.length))

    disconnectedNodes.forEach((node, idx) => {
      const row = Math.floor(idx / cols)
      const col = idx % cols
      const totalCols = Math.min(cols, disconnectedNodes.length - row * cols)
      const offsetX = -((totalCols - 1) * 80) / 2

      result.push({
        ...node,
        lx: offsetX + col * 80,
        ly: startY + row * 80,
        level: -1,
      })
    })
  }

  return result
}

// build a quadratic-bezier svg path that bows outward from the straight line
function buildCurvedPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number
): string {
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2

  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy)

  const curvature = Math.min(dist * 0.2, 40)

  if (dist === 0) return `M ${sx} ${sy} L ${tx} ${ty}`
  const nx = -dy / dist
  const ny = dx / dist

  const cx = mx + nx * curvature
  const cy = my + ny * curvature

  return `M ${sx} ${sy} Q ${cx} ${cy}, ${tx} ${ty}`
}

function getNodeRadius(level: number): number {
  if (level === 0) return CENTER_NODE_RADIUS
  if (level === 1) return LEVEL1_NODE_RADIUS
  return DEFAULT_NODE_RADIUS
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + "\u2026"
}

export const MindmapViewer = forwardRef(function MindmapViewer({ nodes: propNodes, links: propLinks, viewState, onSave, title: _title, onUnsavedChange }: MindmapViewerProps, ref: React.ForwardedRef<DiagramViewerHandle>) {

  const [nodes, setNodes] = useState<DiagramNode[]>(propNodes)
  const [links, setLinks] = useState<DiagramLink[]>(propLinks)

  const layoutNodes = useMemo(
    () => computeRadialLayout(nodes, links),
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
      if (target.tagName === "svg" || target.classList.contains("mindmap-bg")) {
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
      const r = getNodeRadius(n.level)
      if (n.lx - r < minX) minX = n.lx - r
      if (n.ly - r < minY) minY = n.ly - r
      if (n.lx + r > maxX) maxX = n.lx + r
      if (n.ly + r > maxY) maxY = n.ly + r
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
            <filter id="mindmap-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect
            className="mindmap-bg"
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="transparent"
          />

          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {links.map((link) => {
              const source = nodeMap.get(link.sourceId)
              const target = nodeMap.get(link.targetId)
              if (!source || !target) return null

              const sourcePos = getNodePosition(link.sourceId)
              const targetPos = getNodePosition(link.targetId)

              const isSelectedLink =
                selectedNodeId === link.sourceId ||
                selectedNodeId === link.targetId

              const pathD = buildCurvedPath(
                sourcePos.x,
                sourcePos.y,
                targetPos.x,
                targetPos.y
              )

              return (
                <g key={link.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelectedLink ? "#3B82F6" : "#CBD5E1"}
                    strokeWidth={isSelectedLink ? 2.5 : 1.5}
                    strokeOpacity={isSelectedLink ? 0.9 : 0.5}
                  />
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelectedLink ? "#3B82F6" : "#94A3B8"}
                    fontSize={9}
                    fontWeight={isSelectedLink ? 600 : 400}
                  >
                    {link.relationship_type.replace(/_/g, " ")}
                  </text>
                </g>
              )
            })}

            {layoutNodes.map((node) => {
              const color = getConceptColor(node.concept_type)
              const isSelected = node.id === selectedNodeId
              const isLinkSource = isCreatingLink && linkSourceNodeId === node.id
              const isCenter = node.level === 0
              const r = getNodeRadius(node.level)
              const fontSize = isCenter ? 14 : node.level === 1 ? 11 : 10
              const maxChars = isCenter ? 20 : node.level === 1 ? 16 : 14
              const pos = getNodePosition(node.id)

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
                  {isCenter && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 8}
                      fill="none"
                      stroke={color}
                      strokeWidth={3}
                      strokeOpacity={0.3}
                      filter="url(#mindmap-glow)"
                    />
                  )}

                  {(isSelected || isLinkSource) && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 5}
                      fill="none"
                      stroke={isLinkSource ? "#3B82F6" : color}
                      strokeWidth={3}
                      strokeDasharray={isLinkSource ? "none" : "6 3"}
                      opacity={0.7}
                    />
                  )}

                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={color}
                    stroke={isSelected ? "#FFFFFF" : "none"}
                    strokeWidth={isSelected ? 2 : 0}
                  />

                  <text
                    x={pos.x}
                    y={pos.y + r + 14}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fill={isCenter ? "#1E293B" : "#475569"}
                    fontSize={fontSize}
                    fontWeight={isCenter ? 700 : 600}
                  >
                    {truncateText(node.title, maxChars)}
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
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                />
              </svg>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Mind Map
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
