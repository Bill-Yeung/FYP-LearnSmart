import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Button } from "../../components/ui/Button"
import { ConfirmDialog } from "../../components/ui/ConfirmDialog"
import { cn } from "../../../../../shared/utils"
import type { ViewerProps, TaxonomyGroup } from "./DiagramDetailPage"

interface KnowledgeMapProps extends ViewerProps {
  onUnsavedChange: () => void
}

export type DiagramViewerHandle = {
  save: () => void
}

type ConceptType = "definition" | "procedure" | "example" | "assessment" | "entity" | "formula"

interface ConceptNode {
  id: string
  title: string
  description: string | null
  concept_type: ConceptType
  difficulty_level: string | null
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  fx: number | null
  fy: number | null
  fz: number | null
  mesh?: THREE.Mesh
  label?: THREE.Sprite
}

interface ConceptLink {
  id: string
  sourceId: string
  targetId: string
  relationship_type: string
  line?: THREE.Line
  arrow?: THREE.Mesh
  label?: THREE.Sprite
}

function getConceptColor(type: ConceptType): number {
  switch (type) {
    case "definition": return 0x3B82F6 // blue
    case "procedure": return 0x22C55E // green
    case "example": return 0xEAB308 // yellow
    case "assessment": return 0x8B5CF6 // purple
    case "entity": return 0x6B7280 // gray
    case "formula": return 0xEF4444 // red
    default: return 0x9CA3AF
  }
}

function getConceptColorHex(type: ConceptType): string {
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

function getLinkColor(type: string): number {
  switch (type) {
    case "has_part": return 0x3B82F6
    case "requires": return 0xEF4444
    case "exemplifies": return 0xEAB308
    case "related_to": return 0x6B7280
    case "leads_to": return 0x22C55E
    default: return 0x9CA3AF
  }
}

function getLinkColorHex(type: string): string {
  switch (type) {
    case "has_part": return "#3B82F6"
    case "requires": return "#EF4444"
    case "exemplifies": return "#EAB308"
    case "related_to": return "#6B7280"
    case "leads_to": return "#22C55E"
    default: return "#9CA3AF"
  }
}

// draw the concept title onto a canvas and turn it into a Three.js sprite
function createNodeLabel(text: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")!

  context.font = "bold 28px Arial, sans-serif"
  const textWidth = context.measureText(text).width

  canvas.width = Math.min(800, Math.max(300, textWidth + 80))
  canvas.height = 80

  context.clearRect(0, 0, canvas.width, canvas.height)

  const padding = 16
  const height = 56
  const y = (canvas.height - height) / 2
  const radius = 10

  context.fillStyle = "#FFFFFF"
  context.beginPath()
  context.roundRect(padding, y, canvas.width - padding * 2, height, radius)
  context.fill()

  context.strokeStyle = colorHex
  context.lineWidth = 3
  context.beginPath()
  context.roundRect(padding, y, canvas.width - padding * 2, height, radius)
  context.stroke()

  context.fillStyle = colorHex
  context.fillRect(padding, y, 8, height)

  context.font = "bold 28px Arial, sans-serif"
  context.fillStyle = "#111827"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(text, canvas.width / 2 + 4, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)

  const scaleX = canvas.width / 12
  const scaleY = canvas.height / 12
  sprite.scale.set(scaleX, scaleY, 1)

  return sprite
}

function createLinkLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")!
  canvas.width = 256
  canvas.height = 64

  context.clearRect(0, 0, canvas.width, canvas.height)

  const padding = 12
  const height = 44
  const y = (canvas.height - height) / 2
  context.fillStyle = "#FFFFFF"
  context.beginPath()
  context.roundRect(padding, y, canvas.width - padding * 2, height, 8)
  context.fill()

  context.strokeStyle = color
  context.lineWidth = 3
  context.beginPath()
  context.roundRect(padding, y, canvas.width - padding * 2, height, 8)
  context.stroke()

  context.font = "bold 22px Arial, sans-serif"
  context.fillStyle = "#374151"
  context.textAlign = "center"
  context.textBaseline = "middle"

  const displayText = text.replace(/_/g, " ")
  context.fillText(displayText, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(22, 5.5, 1)

  return sprite
}

const GROUP_COLORS = [0x3B82F6, 0x22C55E, 0x8B5CF6, 0xEAB308, 0xEF4444, 0x06B6D4, 0xEC4899]

function createGroupLabel(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  canvas.width = 512
  canvas.height = 80
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const hex = "#" + color.toString(16).padStart(6, "0")
  ctx.fillStyle = hex
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.roundRect(16, 8, canvas.width - 32, 64, 16)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.font = "bold 32px Arial, sans-serif"
  ctx.fillStyle = "#FFFFFF"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(42, 6.5, 1)
  return sprite
}

function createArrowHead(color: number): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(3, 8, 8)
  const material = new THREE.MeshLambertMaterial({ color })
  return new THREE.Mesh(geometry, material)
}

function initializeNode(node: Omit<ConceptNode, "x" | "y" | "z" | "vx" | "vy" | "vz" | "fx" | "fy" | "fz"> & { x?: number; y?: number; z?: number }): ConceptNode {

  if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
    return {
      ...node,
      x: node.x,
      y: node.y,
      z: node.z,
      vx: 0,
      vy: 0,
      vz: 0,
      fx: null,
      fy: null,
      fz: null,
    }
  }

  const radius = 80 + Math.random() * 60
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)

  return {
    ...node,
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.sin(phi) * Math.sin(theta),
    z: radius * Math.cos(phi),
    vx: 0,
    vy: 0,
    vz: 0,
    fx: null,
    fy: null,
    fz: null,
  }
}

function applyForces(
  nodes: ConceptNode[],
  links: ConceptLink[],
  alpha: number
) {

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x
      let dy = nodes[j].y - nodes[i].y
      let dz = nodes[j].z - nodes[i].z
      let distSq = dx * dx + dy * dy + dz * dz
      let dist = Math.sqrt(distSq)

      if (dist < 1) {
        dx = (Math.random() - 0.5) * 10
        dy = (Math.random() - 0.5) * 10
        dz = (Math.random() - 0.5) * 10
        dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        distSq = dist * dist
      }

      const repulsionStrength = 300
      const force = Math.min(repulsionStrength * alpha / distSq, 5 * alpha)

      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force

      if (nodes[i].fx === null) nodes[i].vx -= fx
      if (nodes[i].fy === null) nodes[i].vy -= fy
      if (nodes[i].fz === null) nodes[i].vz -= fz
      if (nodes[j].fx === null) nodes[j].vx += fx
      if (nodes[j].fy === null) nodes[j].vy += fy
      if (nodes[j].fz === null) nodes[j].vz += fz
    }
  }

  links.forEach(link => {
    const source = nodes.find(n => n.id === link.sourceId)
    const target = nodes.find(n => n.id === link.targetId)
    if (!source || !target) return

    const dx = target.x - source.x
    const dy = target.y - source.y
    const dz = target.z - source.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
    const targetDist = 55
    const force = (dist - targetDist) * 0.03 * alpha

    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    const fz = (dz / dist) * force

    if (source.fx === null) source.vx += fx
    if (source.fy === null) source.vy += fy
    if (source.fz === null) source.vz += fz
    if (target.fx === null) target.vx -= fx
    if (target.fy === null) target.vy -= fy
    if (target.fz === null) target.vz -= fz
  })

  const velocityDecay = 0.6
  const maxVelocity = 8

  nodes.forEach(node => {

    node.vx = Math.max(-maxVelocity, Math.min(maxVelocity, node.vx))
    node.vy = Math.max(-maxVelocity, Math.min(maxVelocity, node.vy))
    node.vz = Math.max(-maxVelocity, Math.min(maxVelocity, node.vz))

    if (node.fx !== null) {
      node.x = node.fx
      node.vx = 0
    } else {
      node.vx *= velocityDecay
      node.x += node.vx
    }

    if (node.fy !== null) {
      node.y = node.fy
      node.vy = 0
    } else {
      node.vy *= velocityDecay
      node.y += node.vy
    }

    if (node.fz !== null) {
      node.z = node.fz
      node.vz = 0
    } else {
      node.vz *= velocityDecay
      node.z += node.vz
    }
  })
}


export const KnowledgeMapViewer = forwardRef<DiagramViewerHandle, KnowledgeMapProps>(function KnowledgeMapViewer({ nodes: propNodes, links: propLinks, groups: propGroups, viewState, onSave, title: _title, onUnsavedChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animationRef = useRef<number | null>(null)

  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const dragPlaneRef = useRef(new THREE.Plane())
  const dragOffsetRef = useRef(new THREE.Vector3())

  const [nodes, setNodes] = useState<ConceptNode[]>(() =>
    propNodes.map(n => initializeNode({
      id: n.id,
      title: n.title,
      description: n.description,
      concept_type: (n.concept_type || "definition") as ConceptType,
      difficulty_level: n.difficulty_level,
      x: n.x,
      y: n.y,
      z: n.z,
    }))
  )
  const [links, setLinks] = useState<ConceptLink[]>(() =>
    propLinks.map(l => ({
      id: l.id,
      sourceId: l.sourceId,
      targetId: l.targetId,
      relationship_type: l.relationship_type,
    }))
  )
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null)
  const [selectedLink, setSelectedLink] = useState<ConceptLink | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedNode, setDraggedNode] = useState<ConceptNode | null>(null)

  const [isCreatingLink, setIsCreatingLink] = useState(false)
  const [linkSourceNode, setLinkSourceNode] = useState<ConceptNode | null>(null)
  const tempLinkRef = useRef<THREE.Line | null>(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editConceptType, setEditConceptType] = useState<ConceptType>("definition")
  const [editDifficulty, setEditDifficulty] = useState("")

  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false)
  const [newLinkType, setNewLinkType] = useState("related_to")
  const [pendingLinkTarget, setPendingLinkTarget] = useState<ConceptNode | null>(null)

  const [isEditLinkModalOpen, setIsEditLinkModalOpen] = useState(false)
  const [editLinkType, setEditLinkType] = useState("")

  const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false)
  const [isDeleteLinkDialogOpen, setIsDeleteLinkDialogOpen] = useState(false)

  const [sceneReady, setSceneReady] = useState(false)

  const groupMeshesRef = useRef<Map<string, { sphere: THREE.Mesh; label: THREE.Sprite }>>(new Map())

  const alphaRef = useRef(1)

  const nodesRef = useRef(nodes)
  const linksRef = useRef(links)
  const isEditModeRef = useRef(isEditMode)
  const onUnsavedChangeRef = useRef(onUnsavedChange)
  nodesRef.current = nodes
  isEditModeRef.current = isEditMode
  linksRef.current = links
  onUnsavedChangeRef.current = onUnsavedChange

  // snapshot current 3d positions + camera/orbit target into the save payload
  const triggerSave = useCallback(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const currentViewState = camera && controls ? {
      cameraX: camera.position.x,
      cameraY: camera.position.y,
      cameraZ: camera.position.z,
      targetX: controls.target.x,
      targetY: controls.target.y,
      targetZ: controls.target.z,
    } : null

    const saveNodes = nodesRef.current.map(n => ({
      id: n.id,
      title: n.title,
      description: n.description,
      concept_type: n.concept_type,
      difficulty_level: n.difficulty_level,
      x: n.x,
      y: n.y,
      z: n.z,
    }))
    const saveLinks = linksRef.current.map(l => ({
      id: l.id,
      sourceId: l.sourceId,
      targetId: l.targetId,
      relationship_type: l.relationship_type,
    }))

    onSave({ nodes: saveNodes, links: saveLinks }, currentViewState)
  }, [onSave])

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

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let cleanupFn: (() => void) | null = null

    const checkAndInit = () => {
      const width = container.clientWidth
      const height = container.clientHeight

      if (width < 100 || height < 100) {
        requestAnimationFrame(checkAndInit)
        return
      }

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf8fafc)
      sceneRef.current = scene

      const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000)
      if (viewState && viewState.cameraX !== undefined) {
        camera.position.set(viewState.cameraX, viewState.cameraY, viewState.cameraZ)
      } else {
        camera.position.set(0, 0, 350)
      }
      cameraRef.current = camera

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)
      rendererRef.current = renderer

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 100
      controls.maxDistance = 800
      controls.enablePan = true
      if (viewState && viewState.targetX !== undefined) {
        controls.target.set(viewState.targetX, viewState.targetY, viewState.targetZ)
      }
      controlsRef.current = controls

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(100, 100, 100)
      scene.add(directionalLight)

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
      directionalLight2.position.set(-100, -100, -100)
      scene.add(directionalLight2)

      const tempLinkMaterial = new THREE.LineBasicMaterial({
        color: 0x3B82F6,
        transparent: true,
        opacity: 0.6,
      })
      const tempLinkGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ])
      const tempLink = new THREE.Line(tempLinkGeometry, tempLinkMaterial)
      tempLink.visible = false
      scene.add(tempLink)
      tempLinkRef.current = tempLink

      function handleResize() {
        const newWidth = container.clientWidth
        const newHeight = container.clientHeight
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight
          camera.updateProjectionMatrix()
          renderer.setSize(newWidth, newHeight)
        }
      }
      window.addEventListener("resize", handleResize)

      let running = true

      function animate() {
        if (!running) return
        animationRef.current = requestAnimationFrame(animate)

        if (alphaRef.current > 0.001 && !isEditModeRef.current) {
          applyForces(nodesRef.current, linksRef.current, alphaRef.current)
          alphaRef.current *= 0.99
        }

        nodesRef.current.forEach(node => {
          if (node.mesh) {
            node.mesh.position.set(node.x, node.y, node.z)
            const nodeRadius = node.mesh.userData.radius || 6
            if (node.label) {
              node.label.position.set(node.x, node.y + nodeRadius + 6, node.z)
            }
          }
        })

        linksRef.current.forEach(link => {
          const source = nodesRef.current.find(n => n.id === link.sourceId)
          const target = nodesRef.current.find(n => n.id === link.targetId)
          if (!source || !target) return

          if (link.line) {
            const positions = link.line.geometry.attributes.position as THREE.BufferAttribute
            positions.setXYZ(0, source.x, source.y, source.z)
            positions.setXYZ(1, target.x, target.y, target.z)
            positions.needsUpdate = true
          }

          if (link.arrow) {
            const dir = new THREE.Vector3(
              target.x - source.x,
              target.y - source.y,
              target.z - source.z
            ).normalize()

            const targetRadius = target.mesh?.userData.radius || 6
            const arrowOffset = targetRadius + 4
            const arrowPos = new THREE.Vector3(
              target.x - dir.x * arrowOffset,
              target.y - dir.y * arrowOffset,
              target.z - dir.z * arrowOffset
            )
            link.arrow.position.copy(arrowPos)

            const quaternion = new THREE.Quaternion()
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
            link.arrow.setRotationFromQuaternion(quaternion)
          }

          if (link.label) {
            link.label.position.set(
              (source.x + target.x) / 2,
              (source.y + target.y) / 2 + 8,
              (source.z + target.z) / 2
            )
          }
        })

        groupMeshesRef.current.forEach(({ sphere, label }, _groupId) => {
          const memberIds: string[] = sphere.userData.conceptIds
          const positions = nodesRef.current.filter(n => memberIds.includes(n.id))
          if (positions.length === 0) return

          let cx = 0, cy = 0, cz = 0
          for (const p of positions) { cx += p.x; cy += p.y; cz += p.z }
          cx /= positions.length; cy /= positions.length; cz /= positions.length

          let maxDist = 0
          for (const p of positions) {
            const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2)
            if (d > maxDist) maxDist = d
          }
          const radius = Math.max(maxDist + 25, 30)

          sphere.position.set(cx, cy, cz)
          sphere.scale.setScalar(radius / 50)
          label.position.set(cx, cy + radius + 10, cz)
        })

        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      cleanupFn = () => {
        running = false
        if (animationRef.current) cancelAnimationFrame(animationRef.current)
        window.removeEventListener("resize", handleResize)
        renderer.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }

      setSceneReady(true)
    }

    checkAndInit()

    return () => {
      if (cleanupFn) cleanupFn()
    }
  }, [])

  // build (or update) sphere meshes + labels for each concept node, sized by connection count
  useEffect(() => {
    if (!sceneReady || !sceneRef.current) return

    const scene = sceneRef.current
    const connectionCounts = new Map<string, number>()
    nodes.forEach(node => connectionCounts.set(node.id, 0))
    links.forEach(link => {
      connectionCounts.set(link.sourceId, (connectionCounts.get(link.sourceId) || 0) + 1)
      connectionCounts.set(link.targetId, (connectionCounts.get(link.targetId) || 0) + 1)
    })

    const getNodeRadius = (nodeId: string) => {
      const count = connectionCounts.get(nodeId) || 0
      return Math.min(10, Math.max(4, 4 + count * 1.5))
    }

    nodes.forEach(node => {
      const nodeRadius = getNodeRadius(node.id)

      if (!node.mesh) {
        const geometry = new THREE.SphereGeometry(nodeRadius, 32, 32)
        const material = new THREE.MeshPhongMaterial({
          color: getConceptColor(node.concept_type),
          shininess: 80,
          specular: 0x444444,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(node.x, node.y, node.z)
        mesh.userData = { nodeId: node.id, type: "node", radius: nodeRadius }
        scene.add(mesh)
        node.mesh = mesh
      }

      if (!node.label) {
        const label = createNodeLabel(node.title, getConceptColorHex(node.concept_type))
        label.position.set(node.x, node.y + nodeRadius + 6, node.z)
        scene.add(label)
        node.label = label
      }
    })
  }, [nodes, links, sceneReady])

  // build line + arrow + label meshes for each link, colored by relationship type
  useEffect(() => {
    if (!sceneReady || !sceneRef.current) return

    const scene = sceneRef.current

    links.forEach(link => {
      const source = nodes.find(n => n.id === link.sourceId)
      const target = nodes.find(n => n.id === link.targetId)
      if (!source || !target) return

      if (!link.line) {
        const material = new THREE.LineBasicMaterial({
          color: getLinkColor(link.relationship_type),
          linewidth: 2,
        })
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(source.x, source.y, source.z),
          new THREE.Vector3(target.x, target.y, target.z),
        ])
        const line = new THREE.Line(geometry, material)
        line.userData = { linkId: link.id, type: "link" }
        scene.add(line)
        link.line = line
      }

      if (!link.arrow) {
        const arrow = createArrowHead(getLinkColor(link.relationship_type))
        arrow.userData = { linkId: link.id, type: "arrow" }
        scene.add(arrow)
        link.arrow = arrow
      }

      if (!link.label) {
        const label = createLinkLabel(link.relationship_type, getLinkColorHex(link.relationship_type))
        scene.add(label)
        link.label = label
      }
    })
  }, [links, nodes, sceneReady])

  useEffect(() => {
    if (!sceneReady || !sceneRef.current || !propGroups || propGroups.length === 0) return

    const scene = sceneRef.current
    const newGroupIds = new Set(propGroups.map(g => g.id))
    groupMeshesRef.current.forEach((meshes, gid) => {
      if (!newGroupIds.has(gid)) {
        scene.remove(meshes.sphere)
        scene.remove(meshes.label)
        groupMeshesRef.current.delete(gid)
      }
    })

    propGroups.forEach((group, idx) => {
      if (groupMeshesRef.current.has(group.id)) return

      const color = GROUP_COLORS[idx % GROUP_COLORS.length]

      const geometry = new THREE.SphereGeometry(50, 32, 24)
      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const sphere = new THREE.Mesh(geometry, material)
      sphere.userData = { groupId: group.id, conceptIds: group.concept_ids }
      sphere.renderOrder = -1
      scene.add(sphere)

      const label = createGroupLabel(group.label, color)
      scene.add(label)

      groupMeshesRef.current.set(group.id, { sphere, label })
    })
  }, [propGroups, sceneReady])

  // wire up mouse interaction: pick nodes via raycaster, drag, click-to-select, dblclick-to-link
  useEffect(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return

    const container = containerRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current

    function getIntersectedNode(event: MouseEvent): ConceptNode | null {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycasterRef.current.setFromCamera(mouseRef.current, camera)

      const nodeMeshes = nodesRef.current.filter(n => n.mesh).map(n => n.mesh!)
      const intersects = raycasterRef.current.intersectObjects(nodeMeshes)

      if (intersects.length > 0) {
        const nodeId = intersects[0].object.userData.nodeId
        return nodesRef.current.find(n => n.id === nodeId) || null
      }
      return null
    }

    function handleMouseDown(event: MouseEvent) {
      const node = getIntersectedNode(event)

      if (node && isEditMode) {

        setIsDragging(true)
        setDraggedNode(node)
        node.fx = node.x
        node.fy = node.y
        node.fz = node.z

        if (controls) controls.enabled = false

        const cameraDirection = new THREE.Vector3()
        camera.getWorldDirection(cameraDirection)
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(
          cameraDirection,
          new THREE.Vector3(node.x, node.y, node.z)
        )
        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        const intersectPoint = new THREE.Vector3()
        raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint)
        dragOffsetRef.current.copy(new THREE.Vector3(node.x, node.y, node.z)).sub(intersectPoint)
      }
    }

    function handleMouseMove(event: MouseEvent) {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      if (isDragging && draggedNode) {

        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        const intersectPoint = new THREE.Vector3()
        raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint)
        intersectPoint.add(dragOffsetRef.current)

        draggedNode.fx = intersectPoint.x
        draggedNode.fy = intersectPoint.y
        draggedNode.fz = intersectPoint.z
        draggedNode.x = intersectPoint.x
        draggedNode.y = intersectPoint.y
        draggedNode.z = intersectPoint.z

        alphaRef.current = Math.max(alphaRef.current, 0.1)
      }

      if (isCreatingLink && linkSourceNode && tempLinkRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera)

        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -linkSourceNode.z)
        const intersectPoint = new THREE.Vector3()
        raycasterRef.current.ray.intersectPlane(plane, intersectPoint)

        const positions = tempLinkRef.current.geometry.attributes.position as THREE.BufferAttribute
        positions.setXYZ(0, linkSourceNode.x, linkSourceNode.y, linkSourceNode.z)
        positions.setXYZ(1, intersectPoint.x, intersectPoint.y, intersectPoint.z)
        positions.needsUpdate = true
      }
    }

    function handleMouseUp() {
      if (isDragging && draggedNode) {

        setTimeout(() => {
          if (draggedNode) {
            draggedNode.fx = null
            draggedNode.fy = null
            draggedNode.fz = null
          }
        }, 100)

        setIsDragging(false)
        setDraggedNode(null)

        if (controls) controls.enabled = true

        alphaRef.current = 0.3

        onUnsavedChangeRef.current()
      }
    }

    function handleClick(event: MouseEvent) {
      if (isDragging) return

      const node = getIntersectedNode(event)

      if (node) {
        if (isCreatingLink && linkSourceNode) {
          if (node.id !== linkSourceNode.id) {
            setPendingLinkTarget(node)
            setIsAddLinkModalOpen(true)
            setIsCreatingLink(false)
            if (tempLinkRef.current) tempLinkRef.current.visible = false
          }
        } else {
          setSelectedNode(node)
          setSelectedLink(null)

          nodesRef.current.forEach(n => {
            if (n.mesh) {
              const material = n.mesh.material as THREE.MeshPhongMaterial
              material.emissive.setHex(n.id === node.id ? 0x333333 : 0x000000)
            }
          })
        }
      } else {

        setSelectedNode(null)
        setSelectedLink(null)

        if (isCreatingLink) {
          setIsCreatingLink(false)
          setLinkSourceNode(null)
          if (tempLinkRef.current) tempLinkRef.current.visible = false
        }

        nodesRef.current.forEach(n => {
          if (n.mesh) {
            const material = n.mesh.material as THREE.MeshPhongMaterial
            material.emissive.setHex(0x000000)
          }
        })
      }
    }

    function handleDoubleClick(event: MouseEvent) {
      if (!isEditMode) return

      const node = getIntersectedNode(event)

      if (node) {
        setIsCreatingLink(true)
        setLinkSourceNode(node)
        if (tempLinkRef.current) {
          tempLinkRef.current.visible = true
          const positions = tempLinkRef.current.geometry.attributes.position as THREE.BufferAttribute
          positions.setXYZ(0, node.x, node.y, node.z)
          positions.setXYZ(1, node.x, node.y, node.z)
          positions.needsUpdate = true
        }
      }
    }

    container.addEventListener("mousedown", handleMouseDown)
    container.addEventListener("mousemove", handleMouseMove)
    container.addEventListener("mouseup", handleMouseUp)
    container.addEventListener("click", handleClick)
    container.addEventListener("dblclick", handleDoubleClick)

    return () => {
      container.removeEventListener("mousedown", handleMouseDown)
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mouseup", handleMouseUp)
      container.removeEventListener("click", handleClick)
      container.removeEventListener("dblclick", handleDoubleClick)
    }
  }, [isEditMode, isCreatingLink, linkSourceNode, isDragging, draggedNode])

  const openEditModal = useCallback(() => {
    if (!selectedNode) return
    setEditTitle(selectedNode.title)
    setEditDescription(selectedNode.description || "")
    setEditConceptType(selectedNode.concept_type)
    setEditDifficulty(selectedNode.difficulty_level || "")
    setIsEditModalOpen(true)
  }, [selectedNode])

  const saveConceptEdit = useCallback(() => {
    if (!selectedNode) return

    const updatedNodes = nodes.map(n => {
      if (n.id === selectedNode.id) {

        n.title = editTitle
        n.description = editDescription || null
        n.concept_type = editConceptType
        n.difficulty_level = editDifficulty || null

        if (n.mesh) {
          const material = n.mesh.material as THREE.MeshPhongMaterial
          material.color.setHex(getConceptColor(editConceptType))
        }

        if (n.label && sceneRef.current) {
          sceneRef.current.remove(n.label)
          const newLabel = createNodeLabel(editTitle, getConceptColorHex(editConceptType))
          newLabel.position.set(n.x, n.y + 16, n.z)
          sceneRef.current.add(newLabel)
          n.label = newLabel
        }
      }
      return n
    })

    setNodes(updatedNodes)
    setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id) || null)
    setIsEditModalOpen(false)
    onUnsavedChange()
  }, [selectedNode, editTitle, editDescription, editConceptType, editDifficulty, nodes, onUnsavedChange])

  const confirmDeleteNode = useCallback(() => {
    if (!selectedNode || !sceneRef.current) return
    setIsDeleteNodeDialogOpen(true)
  }, [selectedNode])

  const performDeleteNode = useCallback(() => {
    if (!selectedNode || !sceneRef.current) return

    const scene = sceneRef.current

    if (selectedNode.mesh) scene.remove(selectedNode.mesh)
    if (selectedNode.label) scene.remove(selectedNode.label)

    const connectedLinks = links.filter(
      l => l.sourceId === selectedNode.id || l.targetId === selectedNode.id
    )

    connectedLinks.forEach(link => {
      if (link.line) scene.remove(link.line)
      if (link.arrow) scene.remove(link.arrow)
      if (link.label) scene.remove(link.label)
    })

    setNodes(nodes.filter(n => n.id !== selectedNode.id))
    setLinks(links.filter(l => l.sourceId !== selectedNode.id && l.targetId !== selectedNode.id))
    setSelectedNode(null)
    setIsDeleteNodeDialogOpen(false)
    onUnsavedChange()

    alphaRef.current = 0.5
  }, [selectedNode, nodes, links, onUnsavedChange])

  const createLink = useCallback(() => {
    if (!linkSourceNode || !pendingLinkTarget || !sceneRef.current) return

    const scene = sceneRef.current

    const newLink: ConceptLink = {
      id: `l${Date.now()}`,
      sourceId: linkSourceNode.id,
      targetId: pendingLinkTarget.id,
      relationship_type: newLinkType,
    }

    const lineMaterial = new THREE.LineBasicMaterial({
      color: getLinkColor(newLinkType),
      linewidth: 2,
    })
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(linkSourceNode.x, linkSourceNode.y, linkSourceNode.z),
      new THREE.Vector3(pendingLinkTarget.x, pendingLinkTarget.y, pendingLinkTarget.z),
    ])
    const line = new THREE.Line(lineGeometry, lineMaterial)
    line.userData = { linkId: newLink.id, type: "link" }
    scene.add(line)
    newLink.line = line

    const arrow = createArrowHead(getLinkColor(newLinkType))
    arrow.userData = { linkId: newLink.id, type: "arrow" }
    scene.add(arrow)
    newLink.arrow = arrow

    const label = createLinkLabel(newLinkType, getLinkColorHex(newLinkType))
    scene.add(label)
    newLink.label = label

    setLinks([...links, newLink])
    setIsAddLinkModalOpen(false)
    setLinkSourceNode(null)
    setPendingLinkTarget(null)
    setNewLinkType("related_to")
    onUnsavedChange()

    alphaRef.current = 0.3
  }, [linkSourceNode, pendingLinkTarget, newLinkType, links, onUnsavedChange])

  const openEditLinkModal = useCallback((link: ConceptLink) => {
    setSelectedLink(link)
    setEditLinkType(link.relationship_type)
    setIsEditLinkModalOpen(true)
  }, [])

  const saveLinkEdit = useCallback(() => {
    if (!selectedLink || !sceneRef.current) return

    const scene = sceneRef.current

    const updatedLinks = links.map(l => {
      if (l.id === selectedLink.id) {
        l.relationship_type = editLinkType

        if (l.line) {
          const material = l.line.material as THREE.LineBasicMaterial
          material.color.setHex(getLinkColor(editLinkType))
        }

        if (l.arrow) {
          const material = l.arrow.material as THREE.MeshLambertMaterial
          material.color.setHex(getLinkColor(editLinkType))
        }

        if (l.label) {
          scene.remove(l.label)
          const newLabel = createLinkLabel(editLinkType, getLinkColorHex(editLinkType))
          scene.add(newLabel)
          l.label = newLabel
        }
      }
      return l
    })

    setLinks(updatedLinks)
    setIsEditLinkModalOpen(false)
    setSelectedLink(null)
    onUnsavedChange()
  }, [selectedLink, editLinkType, links, onUnsavedChange])

  const confirmDeleteLink = useCallback(() => {
    if (!selectedLink || !sceneRef.current) return
    setIsDeleteLinkDialogOpen(true)
  }, [selectedLink])

  const performDeleteLink = useCallback(() => {
    if (!selectedLink || !sceneRef.current) return

    const scene = sceneRef.current

    if (selectedLink.line) scene.remove(selectedLink.line)
    if (selectedLink.arrow) scene.remove(selectedLink.arrow)
    if (selectedLink.label) scene.remove(selectedLink.label)

    setLinks(links.filter(l => l.id !== selectedLink.id))
    setSelectedLink(null)
    setIsEditLinkModalOpen(false)
    setIsDeleteLinkDialogOpen(false)
    onUnsavedChange()
  }, [selectedLink, links, onUnsavedChange])

  const relatedConcepts = selectedNode
    ? links
        .filter(l => l.sourceId === selectedNode.id || l.targetId === selectedNode.id)
        .map(l => {
          const relatedId = l.sourceId === selectedNode.id ? l.targetId : l.sourceId
          const relatedNode = nodes.find(n => n.id === relatedId)
          const direction = l.sourceId === selectedNode.id ? "outgoing" : "incoming"
          return relatedNode ? { node: relatedNode, link: l, direction } : null
        })
        .filter(Boolean) as { node: ConceptNode; link: ConceptLink; direction: "incoming" | "outgoing" }[]
    : []

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 10rem)", minHeight: "500px" }}>
      <div
        ref={containerRef}
        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 overflow-hidden relative"
        style={{ cursor: isDragging ? "grabbing" : isEditMode ? "grab" : "default", minWidth: "400px", minHeight: "400px" }}
      >
        <div className="absolute top-4 left-4 flex gap-2 z-10">
          <Button
            variant={isEditMode ? "primary" : "secondary"}
            onClick={() => setIsEditMode(!isEditMode)}
            className="shadow-lg"
          >
            {isEditMode ? "Exit Edit Mode" : "Edit Mode"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              nodesRef.current.forEach((node, i) => {
                const phi = Math.acos(-1 + (2 * i) / nodesRef.current.length)
                const theta = Math.sqrt(nodesRef.current.length * Math.PI) * phi
                const r = 50 + Math.random() * 50
                node.x = r * Math.sin(phi) * Math.cos(theta)
                node.y = r * Math.sin(phi) * Math.sin(theta)
                node.z = r * Math.cos(phi)
                node.fx = null
                node.fy = null
                node.fz = null
              })
              alphaRef.current = 1
              onUnsavedChange()
            }}
            className="shadow-lg"
          >
            Reset Layout
          </Button>
        </div>

        <div className="absolute top-4 right-4 rounded-lg border border-gray-200 bg-white/95 px-4 py-3 text-xs text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-300 z-10 max-w-xs">
          <div className="font-semibold mb-2 text-gray-900 dark:text-white">Controls</div>
          <ul className="space-y-1">
            <li>• <strong>Rotate:</strong> Left-click + drag</li>
            <li>• <strong>Zoom:</strong> Scroll wheel</li>
            <li>• <strong>Pan:</strong> Right-click + drag</li>
            <li>• <strong>Select:</strong> Click on node</li>
            {isEditMode && (
              <>
                <li className="text-blue-600 dark:text-blue-400">• <strong>Drag node:</strong> Click + drag</li>
                <li className="text-blue-600 dark:text-blue-400">• <strong>Create link:</strong> Double-click node</li>
              </>
            )}
          </ul>
        </div>

        {/* Creating link indicator */}
        {isCreatingLink && linkSourceNode && (
          <div className="absolute top-20 left-4 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700 shadow-lg z-10 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            <div className="font-medium">Creating connection from:</div>
            <div className="mt-1">"{linkSourceNode.title}"</div>
            <div className="mt-2 text-xs opacity-75">Click another node to connect, or click empty space to cancel</div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 rounded-lg border border-gray-200 bg-white/95 p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800/95 z-10">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Concept Types</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              { type: "definition", label: "Definition", color: "#3B82F6" },
              { type: "procedure", label: "Procedure", color: "#22C55E" },
              { type: "example", label: "Example", color: "#EAB308" },
              { type: "assessment", label: "Assessment", color: "#8B5CF6" },
              { type: "formula", label: "Formula", color: "#EF4444" },
              { type: "entity", label: "Entity", color: "#6B7280" },
            ].map(item => (
              <div key={item.type} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 rounded-lg border border-gray-200 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800/95 z-10">
          <span className="font-semibold text-gray-900 dark:text-white">{nodes.length}</span>
          <span className="text-gray-500 dark:text-gray-400"> concepts · </span>
          <span className="font-semibold text-gray-900 dark:text-white">{links.length}</span>
          <span className="text-gray-500 dark:text-gray-400"> connections</span>
        </div>
      </div>

      <div className="w-80 flex-shrink-0 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden flex flex-col">
        {selectedNode ? (
          <>
            <div className="border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: getConceptColorHex(selectedNode.concept_type) }}
                  />
                  <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    {selectedNode.concept_type}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedNode(null)
                    nodesRef.current.forEach(n => {
                      if (n.mesh) {
                        const material = n.mesh.material as THREE.MeshPhongMaterial
                        material.emissive.setHex(0x000000)
                      }
                    })
                  }}
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

            <div className="flex-1 overflow-y-auto p-4">
              {selectedNode.description && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Description
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedNode.description}
                  </p>
                </div>
              )}

              {selectedNode.difficulty_level && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Difficulty Level
                  </h4>
                  <span className={cn(
                    "inline-block rounded-full px-3 py-1 text-xs font-medium capitalize",
                    selectedNode.difficulty_level === "beginner" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                    selectedNode.difficulty_level === "intermediate" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                    selectedNode.difficulty_level === "advanced" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}>
                    {selectedNode.difficulty_level}
                  </span>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                  Connections ({relatedConcepts.length})
                </h4>
                {relatedConcepts.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No connections</p>
                ) : (
                  <div className="space-y-2">
                    {relatedConcepts.map(({ node: concept, link, direction }) => (
                      <div
                        key={concept.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 overflow-hidden"
                      >
                        <button
                          onClick={() => setSelectedNode(concept)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getConceptColorHex(concept.concept_type) }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {concept.title}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              {direction === "outgoing" ? (
                                <span>→ {link.relationship_type.replace(/_/g, " ")}</span>
                              ) : (
                                <span>← {link.relationship_type.replace(/_/g, " ")}</span>
                              )}
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
                )}
              </div>
            </div>

            {isEditMode && (
              <div className="border-t border-gray-200 p-4 dark:border-gray-700 space-y-2">
                <Button variant="secondary" fullWidth onClick={openEditModal}>
                  Edit Concept
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
              <div className="text-5xl mb-4">🧠</div>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">3D Knowledge Map</p>
              <p className="text-sm mt-2">Click a concept to view details</p>
              {isEditMode && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs">
                  <p className="font-medium mb-1">Edit Mode Active</p>
                  <p>• Drag nodes to reposition</p>
                  <p>• Double-click to create connections</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
              <Button onClick={saveConceptEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAddLinkModalOpen && linkSourceNode && pendingLinkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create Connection</h3>

            <div className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: getConceptColorHex(linkSourceNode.concept_type) }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">{linkSourceNode.title}</span>
                </div>
                <span className="text-gray-400 text-lg">→</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: getConceptColorHex(pendingLinkTarget.concept_type) }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">{pendingLinkTarget.title}</span>
                </div>
              </div>
            </div>

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
              <Button variant="secondary" onClick={() => {
                setIsAddLinkModalOpen(false)
                setLinkSourceNode(null)
                setPendingLinkTarget(null)
              }}>
                Cancel
              </Button>
              <Button onClick={createLink}>
                Create Connection
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

            <div className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">
                  {nodes.find(n => n.id === selectedLink.sourceId)?.title}
                </span>
                <span className="text-gray-400 text-lg">→</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {nodes.find(n => n.id === selectedLink.targetId)?.title}
                </span>
              </div>
            </div>

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
