import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../../contexts/ToastContext"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"
import {
  BookOpen, FileText, Library, Layers, BarChart3,
  Route, Gamepad2, ClipboardList, Lightbulb, Calculator,
  Presentation, FileType
} from "lucide-react"


type Tag = {
  id: string
  name: string
  url_id: string
  description: string | null
  color: string | null
  icon: string | null
  is_system: boolean
  usage_count: number
  created_at: string
  updated_at: string
  concept_count: number
  source_count: number
  subject_count: number
  diagram_count: number
  flashcard_count: number
  learning_path_count: number
  shared_content_count: number
  vr_scenario_count: number
  generated_script_count: number
}

type TagListResponse = {
  tags: Tag[]
  total: number
  page: number
  page_size: number
}

type Concept = {
  id: string
  title: string
  concept_type: string
  difficulty_level?: string
  description?: string
  keywords?: string[]
  language?: string
  source_location?: string
  page_numbers?: string
  section_title?: string
  document_name?: string
}

type Subject = {
  id: string
  code: string
  name: string
  description?: string
}

type Document = {
  id: string
  document_name: string
  document_type: string
}

type Flashcard = {
  id: string
  front: string
  back: string
  card_type: string
}

type FlashcardReviewResponse = {
  cards: Flashcard[]
  total: number
  page: number
  page_size: number
}

type LearningPath = {
  id: string
  title?: string
  description?: string
  status: string
}

type GeneratedScript = {
  script_id: string
  script_title?: string
  title?: string
  script_summary?: string
  generation_method?: string
  module_name?: string
  target_level?: string
}

type Diagram = {
  id: string
  url_slug: string
  title: string
  diagram_type: string
  node_count: number
  link_count: number
}

type TaggedEntity = {
  entity_type: string
  entity_id: string
  applied_at: string
}

type SortOption = "name_asc" | "name_desc" | "usage_desc" | "usage_asc" | "newest" | "oldest"

const ENTITY_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; pluralLabel: string; countKey: keyof Tag }> = {
  concept:          { label: "Concept",          icon: <BookOpen className="h-4 w-4" />,   pluralLabel: "Concepts",          countKey: "concept_count" },
  source:           { label: "Document",         icon: <FileText className="h-4 w-4" />,   pluralLabel: "Documents",         countKey: "source_count" },
  subject:          { label: "Subject",          icon: <Library className="h-4 w-4" />,    pluralLabel: "Subjects",          countKey: "subject_count" },
  flashcard:        { label: "Flashcard",        icon: <Layers className="h-4 w-4" />,     pluralLabel: "Flashcards",        countKey: "flashcard_count" },
  diagram:          { label: "Diagram",          icon: <BarChart3 className="h-4 w-4" />,  pluralLabel: "Diagrams",          countKey: "diagram_count" },
  learning_path:    { label: "Learning Path",    icon: <Route className="h-4 w-4" />,      pluralLabel: "Learning Paths",    countKey: "learning_path_count" },
  generated_script: { label: "Script",           icon: <Gamepad2 className="h-4 w-4" />,   pluralLabel: "Generated Scripts", countKey: "generated_script_count" },
}

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "usage_desc", label: "Most Used" },
  { value: "usage_asc", label: "Least Used" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
]

function isValidHex(hex: string): boolean {
  return /^#([0-9A-Fa-f]{6})$/.test(hex)
}

function CollapsibleSection({ title, icon, count, defaultOpen = true, children }: {
  title: string; icon: React.ReactNode; count: number; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 flex w-full items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>{icon}</span>
        <span>{title} ({count})</span>
      </button>
      {isOpen && children}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [customHex, setCustomHex] = useState("")
  const [showCustom, setShowCustom] = useState(false)
  const isCustom = !PRESET_COLORS.includes(value)

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => { onChange(color); setShowCustom(false) }}
            className={cn(
              "h-8 w-8 rounded-full transition-transform",
              value === color && "ring-2 ring-offset-2 ring-gray-400 scale-110"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
        <button
          onClick={() => {
            setShowCustom(!showCustom)
            setCustomHex(isCustom ? value : "#")
          }}
          className={cn(
            "h-8 w-8 rounded-full border-2 border-dashed transition-transform flex items-center justify-center text-xs font-bold",
            isCustom
              ? "ring-2 ring-offset-2 ring-gray-400 scale-110 border-gray-400"
              : "border-gray-300 text-gray-400 hover:border-gray-500 dark:border-gray-600"
          )}
          style={isCustom ? { backgroundColor: value } : {}}
          title="Custom color"
        >
          {!isCustom && "#"}
        </button>
      </div>
      {showCustom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={isValidHex(customHex) ? customHex : value}
            onChange={(e) => {
              setCustomHex(e.target.value)
              onChange(e.target.value)
            }}
            className="h-8 w-8 cursor-pointer rounded border-0 p-0"
          />
          <input
            type="text"
            value={customHex}
            onChange={(e) => {
              let v = e.target.value
              if (!v.startsWith("#")) v = "#" + v
              setCustomHex(v)
              if (isValidHex(v)) onChange(v)
            }}
            placeholder="#FF5733"
            maxLength={7}
            className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          {customHex && !isValidHex(customHex) && customHex !== "#" && (
            <span className="text-xs text-red-500">Invalid hex</span>
          )}
        </div>
      )}
    </div>
  )
}


export function TagManagementPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  const [sortOption, setSortOption] = useState<SortOption>("usage_desc")
  const [filterColor, setFilterColor] = useState<string | null>(null)
  const [filterSubject, setFilterSubject] = useState<string | null>(null)
  const [subjectTagIds, setSubjectTagIds] = useState<Set<string> | null>(null)
  const [showSortFilter, setShowSortFilter] = useState(false)

  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const [renamingTagId, setRenamingTagId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const renameInputRef = useRef<HTMLInputElement>(null)

  const [availableConcepts, setAvailableConcepts] = useState<Concept[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([])
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([])
  const [availableFlashcards, setAvailableFlashcards] = useState<Flashcard[]>([])
  const [availableLearningPaths, setAvailableLearningPaths] = useState<LearningPath[]>([])
  const [availableScripts, setAvailableScripts] = useState<GeneratedScript[]>([])
  const [availableDiagrams, setAvailableDiagrams] = useState<Diagram[]>([])
  const [loadingEntities, setLoadingEntities] = useState(false)

  const [taggedEntityIds, setTaggedEntityIds] = useState<Record<string, Set<string>>>({})

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null)
  const [conceptModalTab, setConceptModalTab] = useState<"overview" | "source">("overview")

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [mergeSourceTag, setMergeSourceTag] = useState<Tag | null>(null)
  const [mergeTargetTagId, setMergeTargetTagId] = useState<string>("")
  const [isMerging, setIsMerging] = useState(false)

  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)

  const [suggestions, setSuggestions] = useState<Array<{ name: string; reason: string; entities: Array<{ type: string; id: string; title: string }> }>>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [formName, setFormName] = useState("")
  const [formColor, setFormColor] = useState(PRESET_COLORS[0])
  const [formDescription, setFormDescription] = useState("")
  const [formSelectedEntities, setFormSelectedEntities] = useState<Record<string, string[]>>({})
  const [formEntityTab, setFormEntityTab] = useState<string>("concept")
  const [formEntitySearch, setFormEntitySearch] = useState("")
  const [saving, setSaving] = useState(false)

  const [draggedTagId, setDraggedTagId] = useState<string | null>(null)
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)

  const loadTags = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<TagListResponse>("/api/tags?page_size=100")
      if (data) {
        setTags(data.tags)
        setSelectedTag(prev => {
          if (!prev && data.tags.length > 0) return data.tags[0]
          if (prev) {
            const updated = data.tags.find(t => t.id === prev.id)
            return updated || prev
          }
          return prev
        })
      }
    } catch (err) {
      console.error("Failed to load tags:", err)
      showToast("Failed to load tags")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // load all taggable entities (concepts, docs, flashcards, paths, scripts, diagrams) in parallel
  const loadAvailableEntities = useCallback(async () => {
    try {
      setLoadingEntities(true)

      try {
        const subjectsData = await apiClient.get<Subject[]>("/api/subjects")
        if (Array.isArray(subjectsData)) setAvailableSubjects(subjectsData)
      } catch { }

      const docsData = await apiClient.get<{ documents: Document[], total: number }>("/api/documents?page_size=100")
      if (docsData) setAvailableDocuments(docsData.documents)

      const allConcepts: Concept[] = []
      if (docsData?.documents) {
        for (const doc of docsData.documents.slice(0, 5)) {
          try {
            const conceptsData = await apiClient.get<{ concepts: Concept[], total: number }>(
              `/api/documents/${doc.id}/concepts?page_size=50`
            )
            if (conceptsData?.concepts) allConcepts.push(...conceptsData.concepts)
          } catch { }
        }
      }
      setAvailableConcepts(allConcepts)

      try {
        const flashcardsData = await apiClient.get<FlashcardReviewResponse | Flashcard[]>("/api/flashcards/review?page_size=200")
        if (Array.isArray(flashcardsData)) {
          setAvailableFlashcards(flashcardsData)
        } else if (flashcardsData?.cards && Array.isArray(flashcardsData.cards)) {
          setAvailableFlashcards(flashcardsData.cards)
        }
      } catch { }

      try {
        const pathsData = await apiClient.get<{ learning_paths: LearningPath[], total: number }>("/api/learning-paths?page_size=100")
        if (pathsData?.learning_paths) setAvailableLearningPaths(pathsData.learning_paths)
      } catch { }

      try {
        const scriptsData = await apiClient.get<{ scripts: GeneratedScript[], total?: number }>("/api/game/my-scripts")
        if (scriptsData?.scripts) setAvailableScripts(scriptsData.scripts)
      } catch { }

      try {
        const diagramsData = await apiClient.get<{ diagrams: Diagram[], total: number }>("/api/diagrams?page_size=100")
        if (diagramsData?.diagrams) setAvailableDiagrams(diagramsData.diagrams)
      } catch { }
    } catch (err) {
      console.error("Failed to load entities:", err)
    } finally {
      setLoadingEntities(false)
    }
  }, [])

  const loadTaggedEntities = useCallback(async (tagId: string) => {
    try {
      const data = await apiClient.get<{ entities: TaggedEntity[], total: number }>(
        `/api/tags/${tagId}/entities?page_size=500`
      )
      if (data) {
        const grouped: Record<string, Set<string>> = {}
        for (const e of data.entities) {
          if (!grouped[e.entity_type]) grouped[e.entity_type] = new Set()
          grouped[e.entity_type].add(e.entity_id)
        }
        setTaggedEntityIds(grouped)
      }
    } catch (err) {
      console.error("Failed to load tagged entities:", err)
    }
  }, [])

  useEffect(() => {
    loadTags()
    loadAvailableEntities()
  }, [])

  useEffect(() => {
    if (selectedTag) {
      loadTaggedEntities(selectedTag.id)
    } else {
      setTaggedEntityIds({})
    }
  }, [selectedTag, loadTaggedEntities])

  // when a subject filter is chosen, fetch the set of tag ids attached to that subject
  useEffect(() => {
    if (!filterSubject) {
      setSubjectTagIds(null)
      return
    }
    ;(async () => {
      try {
        const data = await apiClient.get<{ tags: Array<{ id: string }> }>(
          `/api/tags/entity/subject/${filterSubject}`
        )
        if (data?.tags) {
          setSubjectTagIds(new Set(data.tags.map(t => t.id)))
        }
      } catch {
        setSubjectTagIds(new Set())
      }
    })()
  }, [filterSubject])

  useEffect(() => {
    if (renamingTagId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingTagId])

  const filteredAndSortedTags = tags
    .filter(tag => {
      if (searchQuery && !tag.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filterColor && tag.color !== filterColor) return false
      if (subjectTagIds && !subjectTagIds.has(tag.id)) return false
      return true
    })
    .sort((a, b) => {
      switch (sortOption) {
        case "name_asc": return a.name.localeCompare(b.name)
        case "name_desc": return b.name.localeCompare(a.name)
        case "usage_desc": return b.usage_count - a.usage_count
        case "usage_asc": return a.usage_count - b.usage_count
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        default: return 0
      }
    })

  const ENTITY_TABS = Object.keys(ENTITY_TYPE_CONFIG)

  function openCreateModal() {
    setFormName("")
    setFormColor(PRESET_COLORS[0])
    setFormDescription("")
    setFormSelectedEntities({})
    setFormEntityTab("concept")
    setFormEntitySearch("")
    setIsCreateModalOpen(true)
  }

  function openEditModal() {
    if (!selectedTag) return
    setFormName(selectedTag.name)
    setFormColor(selectedTag.color || PRESET_COLORS[0])
    setFormDescription(selectedTag.description || "")
    const selected: Record<string, string[]> = {}
    for (const [type, ids] of Object.entries(taggedEntityIds)) {
      selected[type] = Array.from(ids)
    }
    setFormSelectedEntities(selected)
    setFormEntityTab("concept")
    setFormEntitySearch("")
    setIsEditModalOpen(true)
  }

  async function handleCreateTag() {
    if (!formName.trim()) { showToast("Please enter a tag name"); return }
    try {
      setSaving(true)
      const newTag = await apiClient.post<Tag>("/api/tags", {
        name: formName.trim(),
        color: formColor,
        description: formDescription || null
      })
      if (newTag) {
        const applyList: Array<{ entity_type: string; entity_id: string }> = []
        for (const [entityType, ids] of Object.entries(formSelectedEntities)) {
          for (const id of ids) applyList.push({ entity_type: entityType, entity_id: id })
        }
        for (const item of applyList) {
          await apiClient.post(`/api/tags/${newTag.id}/apply`, item)
        }
        await loadTags()
        await loadTaggedEntities(newTag.id)
        setIsCreateModalOpen(false)
        showToast(`Tag "${newTag.name}" created`)
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create tag")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateTag() {
    if (!selectedTag || !formName.trim()) { showToast("Please enter a tag name"); return }
    try {
      setSaving(true)
      await apiClient.put(`/api/tags/${selectedTag.id}`, {
        name: formName.trim(),
        color: formColor,
        description: formDescription || null
      })
      const allTypes = new Set([...Object.keys(formSelectedEntities), ...Object.keys(taggedEntityIds)])
      for (const type of allTypes) {
        const current = new Set(formSelectedEntities[type] || [])
        const prev = taggedEntityIds[type] || new Set()
        for (const id of prev) {
          if (!current.has(id)) await apiClient.delete(`/api/tags/${selectedTag.id}/remove?entity_type=${type}&entity_id=${id}`)
        }
        for (const id of current) {
          if (!prev.has(id)) await apiClient.post(`/api/tags/${selectedTag.id}/apply`, { entity_type: type, entity_id: id })
        }
      }
      await loadTags()
      await loadTaggedEntities(selectedTag.id)
      setIsEditModalOpen(false)
      showToast(`Tag "${formName}" updated`)
    } catch (err: any) {
      showToast(err.message || "Failed to update tag")
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickUntag(entityType: string, entityId: string) {
    if (!selectedTag) return
    try {
      await apiClient.delete(`/api/tags/${selectedTag.id}/remove?entity_type=${entityType}&entity_id=${entityId}`)
      setTaggedEntityIds(prev => {
        const next = { ...prev }
        if (next[entityType]) {
          const updated = new Set(next[entityType])
          updated.delete(entityId)
          next[entityType] = updated
        }
        return next
      })
      loadTags()
      showToast("Tag removed")
    } catch (err: any) {
      showToast(err.message || "Failed to remove tag")
    }
  }

  function confirmDelete(tag: Tag) {
    setTagToDelete(tag)
    setIsDeleteConfirmOpen(true)
  }

  async function handleDeleteTag() {
    if (!tagToDelete) return
    try {
      await apiClient.delete(`/api/tags/${tagToDelete.id}`)
      setTags(tags.filter(t => t.id !== tagToDelete.id))
      if (selectedTag?.id === tagToDelete.id) {
        setSelectedTag(tags.find(t => t.id !== tagToDelete.id) || null)
      }
      setIsDeleteConfirmOpen(false)
      showToast(`Tag "${tagToDelete.name}" deleted`)
      setTagToDelete(null)
    } catch (err: any) {
      showToast(err.message || "Failed to delete tag")
    }
  }

  async function handleBulkDelete() {
    if (bulkSelected.size === 0) return
    setIsBulkDeleting(true)
    try {
      let deleted = 0
      for (const tagId of bulkSelected) {
        try {
          await apiClient.delete(`/api/tags/${tagId}`)
          deleted++
        } catch { }
      }
      setBulkSelected(new Set())
      setBulkMode(false)
      await loadTags()
      showToast(`Deleted ${deleted} tag${deleted !== 1 ? "s" : ""}`)
    } catch (err: any) {
      showToast(err.message || "Failed to delete tags")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  function startRename(tag: Tag) {
    setRenamingTagId(tag.id)
    setRenameValue(tag.name)
  }

  async function commitRename() {
    if (!renamingTagId || !renameValue.trim()) {
      setRenamingTagId(null)
      return
    }
    const tag = tags.find(t => t.id === renamingTagId)
    if (!tag || tag.name === renameValue.trim()) {
      setRenamingTagId(null)
      return
    }
    try {
      await apiClient.put(`/api/tags/${renamingTagId}`, { name: renameValue.trim() })
      await loadTags()
      showToast(`Renamed to "${renameValue.trim()}"`)
    } catch (err: any) {
      showToast(err.message || "Failed to rename tag")
    }
    setRenamingTagId(null)
  }

  // copy every entity from the source tag to the target then delete the source
  async function handleMerge() {
    if (!mergeSourceTag || !mergeTargetTagId) return
    setIsMerging(true)
    try {
      const data = await apiClient.get<{ entities: TaggedEntity[], total: number }>(
        `/api/tags/${mergeSourceTag.id}/entities?page_size=500`
      )
      if (data?.entities) {
        for (const entity of data.entities) {
          try {
            await apiClient.post(`/api/tags/${mergeTargetTagId}/apply`, {
              entity_type: entity.entity_type,
              entity_id: entity.entity_id
            })
          } catch { }
        }
      }
      await apiClient.delete(`/api/tags/${mergeSourceTag.id}`)
      setIsMergeModalOpen(false)
      setMergeSourceTag(null)
      setMergeTargetTagId("")
      await loadTags()
      showToast(`Merged "${mergeSourceTag.name}" into target tag`)
    } catch (err: any) {
      showToast(err.message || "Failed to merge tags")
    } finally {
      setIsMerging(false)
    }
  }

  // ask the backend for ai-suggested missing tags and show the panel
  async function fetchSuggestions() {
    setLoadingSuggestions(true)
    setSuggestions([])
    setShowSuggestions(true)
    try {
      const data = await apiClient.post<{ suggestions: Array<{ name: string; reason: string; entities: Array<{ type: string; id: string; title: string }> }> }>(
        "/api/tags/suggest-missing"
      )
      if (data?.suggestions) setSuggestions(data.suggestions)
    } catch (err: any) {
      showToast(err.message || "Failed to get suggestions")
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // accept a suggestion: create the tag with a random color and apply to all suggested entities
  async function createTagFromSuggestion(name: string, entities: Array<{ type: string; id: string; title: string }>) {
    try {
      const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
      const newTag = await apiClient.post<Tag>("/api/tags", {
        name: name.trim(),
        color: randomColor,
      })
      if (newTag) {
        let applied = 0
        for (const entity of entities) {
          try {
            await apiClient.post(`/api/tags/${newTag.id}/apply`, {
              entity_type: entity.type,
              entity_id: entity.id,
            })
            applied++
          } catch {
          }
        }
        await loadTags()
        showToast(`Tag "${name}" created and applied to ${applied} item${applied !== 1 ? 's' : ''}`)
        setSuggestions(prev => prev.filter(s => s.name !== name))
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create tag")
    }
  }

  function handleDragStart(tagId: string) {
    setDraggedTagId(tagId)
  }
  function handleDragOver(e: React.DragEvent, tagId: string) {
    e.preventDefault()
    setDragOverTagId(tagId)
  }

  function handleDragEnd() {
    if (draggedTagId && dragOverTagId && draggedTagId !== dragOverTagId) {
      setTags(prev => {
        const items = [...prev]
        const fromIdx = items.findIndex(t => t.id === draggedTagId)
        const toIdx = items.findIndex(t => t.id === dragOverTagId)
        if (fromIdx === -1 || toIdx === -1) return prev
        const [moved] = items.splice(fromIdx, 1)
        items.splice(toIdx, 0, moved)
        return items
      })
    }
    setDraggedTagId(null)
    setDragOverTagId(null)
  }

  function toggleEntity(entityType: string, entityId: string) {
    setFormSelectedEntities(prev => {
      const current = prev[entityType] || []
      const updated = current.includes(entityId)
        ? current.filter(id => id !== entityId)
        : [...current, entityId]
      return { ...prev, [entityType]: updated }
    })
  }

  function getSelectedCount(entityType: string): number {
    return (formSelectedEntities[entityType] || []).length
  }

  function isEntitySelected(entityType: string, entityId: string): boolean {
    return (formSelectedEntities[entityType] || []).includes(entityId)
  }

  function getEntityTabItems(): Array<{ id: string; title: string; subtitle: string; icon: React.ReactNode }> {
    const search = formEntitySearch.toLowerCase()
    switch (formEntityTab) {
      case "concept":
        return availableConcepts
          .filter(c => c.title.toLowerCase().includes(search))
          .map(c => ({ id: c.id, title: c.title, subtitle: `${c.concept_type}${c.difficulty_level ? ` · ${c.difficulty_level}` : ""}`, icon: getConceptTypeIcon(c.concept_type) }))
      case "subject":
        return availableSubjects
          .filter(s => s.name.toLowerCase().includes(search) || s.code.toLowerCase().includes(search))
          .map(s => ({ id: s.id, title: s.name, subtitle: s.code, icon: ENTITY_TYPE_CONFIG.subject.icon }))
      case "source":
        return availableDocuments
          .filter(d => d.document_name.toLowerCase().includes(search))
          .map(d => ({ id: d.id, title: d.document_name, subtitle: d.document_type.toUpperCase(), icon: getDocumentTypeIcon(d.document_type) }))
      case "flashcard":
        return availableFlashcards
          .filter(f => f.front.toLowerCase().includes(search))
          .map(f => ({ id: f.id, title: f.front, subtitle: f.card_type, icon: ENTITY_TYPE_CONFIG.flashcard.icon }))
      case "learning_path":
        return availableLearningPaths
          .filter(p => (p.title || "").toLowerCase().includes(search))
          .map(p => ({ id: p.id, title: p.title || "Untitled Path", subtitle: p.status, icon: ENTITY_TYPE_CONFIG.learning_path.icon }))
      case "generated_script":
        return availableScripts
          .filter(s => (s.script_title || s.title || "").toLowerCase().includes(search))
          .map(s => ({
            id: s.script_id,
            title: s.script_title || s.title || "Untitled Script",
            subtitle: s.generation_method || s.module_name || s.target_level || "Script Kill",
            icon: ENTITY_TYPE_CONFIG.generated_script.icon
          }))
      case "diagram":
        return availableDiagrams
          .filter(d => d.title.toLowerCase().includes(search))
          .map(d => ({ id: d.id, title: d.title, subtitle: `${d.node_count} concepts · ${d.link_count} links`, icon: ENTITY_TYPE_CONFIG.diagram.icon }))
      default:
        return []
    }
  }

  const taggedConcepts = availableConcepts.filter(c => taggedEntityIds["concept"]?.has(c.id))
  const taggedSubjects = availableSubjects.filter(s => taggedEntityIds["subject"]?.has(s.id))
  const taggedDocuments = availableDocuments.filter(d => taggedEntityIds["source"]?.has(d.id))
  const taggedFlashcards = availableFlashcards.filter(f => taggedEntityIds["flashcard"]?.has(f.id))
  const taggedLearningPaths = availableLearningPaths.filter(p => taggedEntityIds["learning_path"]?.has(p.id))
  const taggedScripts = availableScripts.filter(s => taggedEntityIds["generated_script"]?.has(s.script_id))
  const taggedDiagrams = availableDiagrams.filter(d => taggedEntityIds["diagram"]?.has(d.id))

  const totalApplied = Object.values(taggedEntityIds).reduce((sum, set) => sum + set.size, 0)

  const usedColors = [...new Set(tags.map(t => t.color).filter(Boolean))] as string[]

  function getConceptTypeIcon(type: string) {
    const cls = "h-5 w-5"
    switch (type) {
      case "definition": return <BookOpen className={cls} />
      case "procedure": return <ClipboardList className={cls} />
      case "example": return <Lightbulb className={cls} />
      case "formula": return <Calculator className={cls} />
      case "entity": return <FileType className={cls} />
      default: return <FileText className={cls} />
    }
  }

  function getDocumentTypeIcon(type: string) {
    const cls = "h-5 w-5"
    switch (type) {
      case "pdf": return <FileText className={cn(cls, "text-red-500")} />
      case "word": return <FileText className={cn(cls, "text-blue-500")} />
      case "powerpoint": return <Presentation className={cn(cls, "text-orange-500")} />
      case "text": return <FileText className={cls} />
      default: return <FileText className={cls} />
    }
  }

  // route to the right page for a given entity type when its row is clicked
  function navigateToEntity(entityType: string, entityId: string) {
    switch (entityType) {
      case "source":
        navigate(`/knowledge/documents/${entityId}`)
        break
      case "concept":
        navigate("/knowledge/diagram")
        break
      case "flashcard":
        navigate("/flashcards/manage")
        break
      case "learning_path":
        navigate("/progress/pathway")
        break
      case "generated_script":
        navigate("/game/my-scripts")
        break
      case "diagram": {
        const diagram = availableDiagrams.find(d => d.id === entityId)
        navigate(diagram ? `/knowledge/diagram/${diagram.url_slug}` : "/knowledge/diagram")
        break
      }
      default:
        break
    }
  }

  const analyticsData = tags.map(t => ({
    name: t.name,
    color: t.color || "#6B7280",
    total: t.usage_count,
    concept_count: t.concept_count,
    source_count: t.source_count,
    subject_count: t.subject_count,
    flashcard_count: t.flashcard_count,
    diagram_count: t.diagram_count,
    learning_path_count: t.learning_path_count,
    generated_script_count: t.generated_script_count,
  })).sort((a, b) => b.total - a.total).slice(0, 15)
  const maxUsage = Math.max(...analyticsData.map(d => d.total), 1)


  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Organize your knowledge with custom tags
          </p>
        </div>
        <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Organize your knowledge with custom tags
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tags.length > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={() => setIsAnalyticsOpen(true)}
                className="text-xs"
              >
                <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </Button>
              <Button
                variant="secondary"
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
                className="text-xs"
              >
                <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {loadingSuggestions ? "Analyzing..." : "AI Suggest"}
              </Button>
            </>
          )}
          <Button onClick={openCreateModal}>
            Create Tag
          </Button>
        </div>
      </div>

      {/* AI Suggestions Panel */}
      {showSuggestions && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Suggested Tags
            </h4>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {loadingSuggestions ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-sm text-gray-500">Analyzing your content...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Click to create tag and apply to suggested content:</p>
              {suggestions.map((s, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => createTagFromSuggestion(s.name, s.entities)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      + Create "{s.name}"
                    </button>
                    <span className="text-xs text-gray-500">{s.entities.length} item{s.entities.length !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1.5">{s.reason}</p>
                  {s.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.entities.slice(0, 5).map((e, eidx) => (
                        <span key={eidx} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {e.type === 'concept' && <BookOpen className="h-3 w-3" />}
                          {e.type === 'source' && <FileText className="h-3 w-3" />}
                          {e.type === 'flashcard' && <Layers className="h-3 w-3" />}
                          {e.title.length > 30 ? e.title.slice(0, 30) + '...' : e.title}
                        </span>
                      ))}
                      {s.entities.length > 5 && (
                        <span className="text-xs text-gray-400">+{s.entities.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No suggestions available. Add more content to get better suggestions.</p>
          )}
        </div>
      )}

      <div className="flex h-[calc(100vh-14rem)] gap-4">
        <div className="w-80 flex-shrink-0 flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">

          <div className="border-b border-gray-200 p-3 dark:border-gray-700 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                onClick={() => setShowSortFilter(!showSortFilter)}
                className={cn(
                  "rounded-lg border p-2 transition-colors",
                  showSortFilter
                    ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                )}
                title="Sort & Filter"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            </div>

            {showSortFilter && (
              <div className="space-y-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Sort by</label>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    {SORT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {usedColors.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Filter by color</label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setFilterColor(null)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors",
                          filterColor === null
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                        )}
                      >
                        All
                      </button>
                      {usedColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setFilterColor(filterColor === color ? null : color)}
                          className={cn(
                            "h-5 w-5 rounded-full border-2 transition-transform",
                            filterColor === color ? "scale-125 border-gray-800 dark:border-white" : "border-transparent hover:scale-110"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {availableSubjects.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Filter by subject</label>
                    <select
                      value={filterSubject ?? ""}
                      onChange={(e) => setFilterSubject(e.target.value || null)}
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All subjects</option>
                      {availableSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()) }}
                className={cn(
                  "text-xs font-medium transition-colors",
                  bulkMode ? "text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                {bulkMode ? "Cancel Selection" : "Select Multiple"}
              </button>
              {bulkMode && bulkSelected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{bulkSelected.size} selected</span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isBulkDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
          {filteredAndSortedTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {searchQuery || filterColor || filterSubject ? "No matching tags" : "No tags yet"}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {searchQuery || filterColor || filterSubject ? "Try adjusting your search or filters" : "Create your first tag to organize content"}
              </p>
              {!searchQuery && !filterColor && !filterSubject && (
                <Button onClick={openCreateModal} className="mt-4 text-xs">
                  Create First Tag
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredAndSortedTags.map((tag) => (
                <div
                  key={tag.id}
                  draggable={!bulkMode && !renamingTagId}
                  onDragStart={() => handleDragStart(tag.id)}
                  onDragOver={(e) => handleDragOver(e, tag.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-all",
                    selectedTag?.id === tag.id && !bulkMode
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800",
                    dragOverTagId === tag.id && "border-t-2 border-blue-500",
                    draggedTagId === tag.id && "opacity-50"
                  )}
                  onClick={() => {
                    if (bulkMode) {
                      if (tag.is_system) return
                      setBulkSelected(prev => {
                        const next = new Set(prev)
                        if (next.has(tag.id)) next.delete(tag.id)
                        else next.add(tag.id)
                        return next
                      })
                    } else {
                      setSelectedTag(tag)
                    }
                  }}
                >
                  {bulkMode && (
                    <input
                      type="checkbox"
                      checked={bulkSelected.has(tag.id)}
                      onChange={() => {}}
                      disabled={tag.is_system}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  )}

                  {!bulkMode && (
                    <svg className="h-4 w-4 flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab dark:text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                    </svg>
                  )}

                  <div
                    className="h-4 w-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || "#6B7280" }}
                  />
                  <div className="flex-1 min-w-0">
                    {renamingTagId === tag.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename()
                          if (e.key === "Escape") setRenamingTagId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-sm font-medium outline-none dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <>
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {tag.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {tag.usage_count} {tag.usage_count === 1 ? "item" : "items"} tagged
                        </div>
                      </>
                    )}
                  </div>
                  {!tag.is_system && !bulkMode && renamingTagId !== tag.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Rename button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); startRename(tag) }}
                        className="p-1 text-gray-400 hover:text-blue-500"
                        title="Rename"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Merge button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMergeSourceTag(tag)
                          setMergeTargetTagId("")
                          setIsMergeModalOpen(true)
                        }}
                        className="p-1 text-gray-400 hover:text-purple-500"
                        title="Merge into..."
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmDelete(tag) }}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="Delete tag"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

      <div className="flex-1 flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {selectedTag ? (
          <>
            {/* Tag Header */}
            <div className="border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: selectedTag.color || "#6B7280" }}
                  />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedTag.name}
                    </h2>
                    {selectedTag.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedTag.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedTag.is_system && (
                    <Button variant="secondary" onClick={openEditModal}>
                      Edit Tag
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Applied Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Summary badges */}
              {totalApplied > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ENTITY_TYPE_CONFIG).map(([type, config]) => {
                    const count = Number(selectedTag[config.countKey] ?? 0)
                    if (count === 0) return null
                    return (
                      <span key={type} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        <span>{config.icon}</span>
                        {count} {count === 1 ? config.label : config.pluralLabel}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Applied Concepts */}
              {taggedConcepts.length > 0 && (
                <CollapsibleSection title="Concepts" icon={ENTITY_TYPE_CONFIG.concept.icon} count={taggedConcepts.length}>
                  <div className="grid gap-2">
                    {taggedConcepts.map((concept) => (
                      <div
                        key={concept.id}
                        className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => setSelectedConcept(concept)}
                      >
                        <span className="flex-shrink-0">{getConceptTypeIcon(concept.concept_type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {concept.title}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">
                            {concept.concept_type}
                            {concept.difficulty_level && ` · ${concept.difficulty_level}`}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUntag("concept", concept.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Applied Documents */}
              {taggedDocuments.length > 0 && (
                <CollapsibleSection title="Documents" icon={ENTITY_TYPE_CONFIG.source.icon} count={taggedDocuments.length}>
                  <div className="grid gap-2">
                    {taggedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => navigateToEntity("source", doc.id)}
                      >
                        <span className="text-lg">{getDocumentTypeIcon(doc.document_type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {doc.document_name}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">{doc.document_type}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUntag("source", doc.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Applied Subjects */}
              {taggedSubjects.length > 0 && (
                <CollapsibleSection title="Subjects" icon={ENTITY_TYPE_CONFIG.subject.icon} count={taggedSubjects.length}>
                  <div className="grid gap-2">
                    {taggedSubjects.map((subj) => (
                      <div
                        key={subj.id}
                        className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                      >
                        <span className="flex-shrink-0">{ENTITY_TYPE_CONFIG.subject.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {subj.name}
                          </div>
                          <div className="text-xs text-gray-500">{subj.code}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUntag("subject", subj.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Applied Flashcards */}
              {taggedFlashcards.length > 0 && (
                <CollapsibleSection title="Flashcards" icon={ENTITY_TYPE_CONFIG.flashcard.icon} count={taggedFlashcards.length}>
                  <div className="grid gap-2">
                    {taggedFlashcards.map((fc) => (
                      <div
                        key={fc.id}
                        className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => navigateToEntity("flashcard", fc.id)}
                      >
                        <span className="flex-shrink-0">{ENTITY_TYPE_CONFIG.flashcard.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{fc.front}</div>
                          <div className="text-xs text-gray-500 capitalize">{fc.card_type}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUntag("flashcard", fc.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Applied Learning Paths */}
              {taggedLearningPaths.length > 0 && (
                <CollapsibleSection title="Learning Paths" icon={ENTITY_TYPE_CONFIG.learning_path.icon} count={taggedLearningPaths.length}>
                  <div className="grid gap-2">
                    {taggedLearningPaths.map((lp) => (
                      <div
                        key={lp.id}
                        className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                      >
                        <span className="flex-shrink-0">{ENTITY_TYPE_CONFIG.learning_path.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{lp.title || "Untitled Path"}</div>
                          <div className="text-xs text-gray-500 capitalize">{lp.status}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUntag("learning_path", lp.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Applied Scripts */}
              {taggedScripts.length > 0 && (
                <CollapsibleSection title="Generated Scripts" icon={ENTITY_TYPE_CONFIG.generated_script.icon} count={taggedScripts.length}>
                  <div className="grid gap-2">
                    {taggedScripts.map((s) => (
                      <div
                        key={s.script_id}
                        className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => navigateToEntity("generated_script", s.script_id)}
                      >
                        <span className="flex-shrink-0">{ENTITY_TYPE_CONFIG.generated_script.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{s.script_title || s.title || "Untitled Script"}</div>
                          <div className="text-xs text-gray-500 capitalize">{s.generation_method || s.module_name || s.target_level || "Script Kill"}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUntag("generated_script", s.script_id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Applied Diagrams */}
              {taggedDiagrams.length > 0 && (
                <CollapsibleSection title="Diagrams" icon={ENTITY_TYPE_CONFIG.diagram.icon} count={taggedDiagrams.length}>
                  <div className="grid gap-2">
                    {taggedDiagrams.map((d) => (
                      <div
                        key={d.id}
                        className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => navigateToEntity("diagram", d.id)}
                      >
                        <span className="flex-shrink-0">{ENTITY_TYPE_CONFIG.diagram.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{d.title}</div>
                          <div className="text-xs text-gray-500">{d.node_count} concepts · {d.link_count} links</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUntag("diagram", d.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Empty state with illustration */}
              {totalApplied === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="mb-4 h-20 w-20 text-gray-200 dark:text-gray-700" fill="none" viewBox="0 0 100 100">
                    <rect x="15" y="25" width="70" height="50" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M15 35h70" stroke="currentColor" strokeWidth="2" />
                    <circle cx="25" cy="30" r="2" fill="currentColor" />
                    <circle cx="32" cy="30" r="2" fill="currentColor" />
                    <circle cx="39" cy="30" r="2" fill="currentColor" />
                    <rect x="25" y="45" width="22" height="4" rx="2" fill="currentColor" opacity="0.3" />
                    <rect x="25" y="55" width="35" height="4" rx="2" fill="currentColor" opacity="0.2" />
                    <rect x="25" y="63" width="15" height="4" rx="2" fill="currentColor" opacity="0.15" />
                    <path d="M68 50l-8 8m0-8l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                  </svg>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No items tagged yet</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Click "Edit Tag" to apply this tag to concepts, documents, and more
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <svg className="mb-4 h-24 w-24 text-gray-200 dark:text-gray-700" fill="none" viewBox="0 0 120 120">
              <path d="M40 30h30c2.5 0 4.8 1 6.5 2.7l20 20c3.6 3.6 3.6 9.4 0 13l-30 30c-3.6 3.6-9.4 3.6-13 0l-20-20A9.2 9.2 0 0130 69.2V40a10 10 0 0110-10z" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="50" cy="48" r="5" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <path d="M75 75l15 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
            </svg>
            <p className="text-sm font-medium">Select a tag to view applied content</p>
            <p className="text-xs mt-1">or create a new tag to get started</p>
          </div>
        )}
      </div>
      </div>

      {/* Create Tag Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900 flex flex-col">
            <div className="flex-shrink-0 border-b border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Tag</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-6 space-y-4">
                <TextField
                  label="Tag Name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter tag name"
                />
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of this tag"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <ColorPicker value={formColor} onChange={setFormColor} />
              </div>

              {/* Entity selection with global search */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Apply to Content
                </label>
                <div className="flex flex-wrap gap-1 mb-3">
                  {ENTITY_TABS.map((type) => {
                    const config = ENTITY_TYPE_CONFIG[type]
                    const count = getSelectedCount(type)
                    return (
                      <button
                        key={type}
                        onClick={() => { setFormEntityTab(type); setFormEntitySearch("") }}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5",
                          formEntityTab === type
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        )}
                      >
                        <span>{config.icon}</span>
                        <span>{config.pluralLabel}</span>
                        {count > 0 && (
                          <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">{count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <input
                  type="text"
                  placeholder={`Search ${ENTITY_TYPE_CONFIG[formEntityTab]?.pluralLabel.toLowerCase()}...`}
                  value={formEntitySearch}
                  onChange={(e) => setFormEntitySearch(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />

                <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  {loadingEntities ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                  ) : (() => {
                    const items = getEntityTabItems()
                    if (items.length === 0) {
                      return (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No {ENTITY_TYPE_CONFIG[formEntityTab]?.pluralLabel.toLowerCase()} available
                        </div>
                      )
                    }
                    return (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {items.map((item) => (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors",
                              isEntitySelected(formEntityTab, item.id) && "bg-blue-50 dark:bg-blue-900/20"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isEntitySelected(formEntityTab, item.id)}
                              onChange={() => toggleEntity(formEntityTab, item.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">{item.title}</div>
                              <div className="text-xs text-gray-500 capitalize mt-0.5">{item.subtitle}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCreateTag} disabled={!formName.trim() || saving}>
                {saving ? "Creating..." : "Create Tag"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {isEditModalOpen && selectedTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900 flex flex-col">
            <div className="flex-shrink-0 border-b border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Tag</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-6 space-y-4">
                <TextField
                  label="Tag Name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter tag name"
                />
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of this tag"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <ColorPicker value={formColor} onChange={setFormColor} />
              </div>

              {/* Entity selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Apply to Content
                </label>
                <div className="flex flex-wrap gap-1 mb-3">
                  {ENTITY_TABS.map((type) => {
                    const config = ENTITY_TYPE_CONFIG[type]
                    const count = getSelectedCount(type)
                    return (
                      <button
                        key={type}
                        onClick={() => { setFormEntityTab(type); setFormEntitySearch("") }}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5",
                          formEntityTab === type
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        )}
                      >
                        <span>{config.icon}</span>
                        <span>{config.pluralLabel}</span>
                        {count > 0 && (
                          <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">{count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <input
                  type="text"
                  placeholder={`Search ${ENTITY_TYPE_CONFIG[formEntityTab]?.pluralLabel.toLowerCase()}...`}
                  value={formEntitySearch}
                  onChange={(e) => setFormEntitySearch(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />

                <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  {loadingEntities ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                  ) : (() => {
                    const items = getEntityTabItems()
                    if (items.length === 0) {
                      return (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No {ENTITY_TYPE_CONFIG[formEntityTab]?.pluralLabel.toLowerCase()} available
                        </div>
                      )
                    }
                    return (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {items.map((item) => (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors",
                              isEntitySelected(formEntityTab, item.id) && "bg-blue-50 dark:bg-blue-900/20"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isEntitySelected(formEntityTab, item.id)}
                              onChange={() => toggleEntity(formEntityTab, item.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">{item.title}</div>
                              <div className="text-xs text-gray-500 capitalize mt-0.5">{item.subtitle}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTag} disabled={!formName.trim() || saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && tagToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Tag</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete "{tagToDelete.name}"? This will remove the tag from all {tagToDelete.usage_count} tagged items.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteTag}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Tag Modal */}
      {isMergeModalOpen && mergeSourceTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Merge Tag</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Merge "<strong>{mergeSourceTag.name}</strong>" into another tag. All tagged items will be moved to the target tag, and "{mergeSourceTag.name}" will be deleted.
            </p>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Target Tag
              </label>
              <select
                value={mergeTargetTagId}
                onChange={(e) => setMergeTargetTagId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select a tag...</option>
                {tags
                  .filter(t => t.id !== mergeSourceTag.id && !t.is_system)
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsMergeModalOpen(false)} disabled={isMerging}>
                Cancel
              </Button>
              <Button onClick={handleMerge} disabled={!mergeTargetTagId || isMerging}>
                {isMerging ? "Merging..." : "Merge"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {isAnalyticsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900 flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tag Usage Analytics</h3>
              <button
                onClick={() => setIsAnalyticsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{tags.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Tags</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tags.reduce((sum, t) => sum + t.usage_count, 0)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Applications</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tags.filter(t => t.usage_count === 0).length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Unused Tags</div>
                </div>
              </div>

              {/* Bar chart */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Usage Distribution</h4>
                {analyticsData.length === 0 ? (
                  <p className="text-sm text-gray-500">No usage data available</p>
                ) : (
                  <div className="space-y-2">
                    {analyticsData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="w-28 text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                          {item.name}
                        </div>
                        <div className="flex-1">
                          <div className="h-5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(item.total / maxUsage) * 100}%`,
                                backgroundColor: item.color,
                                minWidth: item.total > 0 ? "8px" : "0"
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-8 text-right text-xs font-medium text-gray-600 dark:text-gray-400">
                          {item.total}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Breakdown by type */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Breakdown by Content Type</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 text-left font-medium text-gray-500">Tag</th>
                        {Object.entries(ENTITY_TYPE_CONFIG).map(([key, config]) => (
                          <th key={key} className="py-2 text-center font-medium text-gray-500" title={config.pluralLabel}>
                            <span className="inline-flex justify-center">{config.icon}</span>
                          </th>
                        ))}
                        <th className="py-2 text-center font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 font-medium text-gray-700 dark:text-gray-300">
                            <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.concept_count}</td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.source_count}</td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.subject_count}</td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.flashcard_count}</td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.diagram_count}</td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.learning_path_count}</td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{item.generated_script_count}</td>
                          <td className="py-2 text-center font-semibold text-gray-900 dark:text-white">{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-end border-t border-gray-200 p-4 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setIsAnalyticsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Concept Detail Modal */}
      {selectedConcept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setSelectedConcept(null); setConceptModalTab("overview"); }}>
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex-shrink-0 border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex-shrink-0 mt-1 [&>svg]:h-8 [&>svg]:w-8">{getConceptTypeIcon(selectedConcept.concept_type)}</span>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white break-words">
                      {selectedConcept.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                      <span className="capitalize">{selectedConcept.concept_type}</span>
                      {selectedConcept.difficulty_level && (
                        <>
                          <span>·</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            selectedConcept.difficulty_level === "beginner" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                            selectedConcept.difficulty_level === "intermediate" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                            selectedConcept.difficulty_level === "advanced" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            {selectedConcept.difficulty_level}
                          </span>
                        </>
                      )}
                      {selectedConcept.language && (
                        <>
                          <span>·</span>
                          <span>{selectedConcept.language}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedConcept(null); setConceptModalTab("overview"); }}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex gap-1 mt-4">
                <button
                  onClick={() => setConceptModalTab("overview")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    conceptModalTab === "overview"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  Overview
                </button>
                <button
                  onClick={() => setConceptModalTab("source")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    conceptModalTab === "source"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  Source
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {conceptModalTab === "overview" ? (
                <div className="space-y-5">
                  {selectedConcept.description && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        Description
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedConcept.description}
                      </p>
                    </div>
                  )}
                  {selectedConcept.keywords && selectedConcept.keywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedConcept.keywords.map((keyword, idx) => (
                          <span key={idx} className="px-3 py-1.5 text-sm rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!selectedConcept.description && (!selectedConcept.keywords || selectedConcept.keywords.length === 0) && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <svg className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">No additional details available for this concept.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {(selectedConcept.document_name || selectedConcept.page_numbers) ? (
                    <>
                      {selectedConcept.document_name && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Document
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {selectedConcept.document_name}
                          </p>
                        </div>
                      )}
                      {selectedConcept.page_numbers && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Page
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {selectedConcept.page_numbers}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <svg className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <p className="text-sm">No source information available for this concept.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 flex justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
              <Button variant="secondary" onClick={() => { setSelectedConcept(null); setConceptModalTab("overview"); }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
