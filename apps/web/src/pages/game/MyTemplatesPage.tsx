import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Button } from "../../components"
import { listTemplates } from "../../api/gameTemplates"
import { handleDelete, handleDuplicate} from "../../hooks/useTemplateActions"
import { Layers, BadgeCheck, FileText, Plus, Copy, Trash2, RefreshCcw, Edit3 } from "lucide-react"

interface TemplateItem {
  id: string
  name: string
  subject: string
  status: "published" | "draft" | "ready" | "archived"
  lastModified: string
}

type SortColumn = "name" | "subject" | "status" | "lastModified"

type SortState = {
  column: SortColumn
  order: "asc" | "desc"
}

export function MyTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TemplateItem[]>([])

  const [search, setSearch] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("")
  const [sortState, setSortState] = useState<SortState>({ column: "lastModified", order: "desc" })

  // apply search + subject filter then sort by the chosen column/order
  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = templates

    if (q) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      )
    }

    if (subjectFilter) {
      list = list.filter(t => t.subject === subjectFilter)
    }

    const copy = [...list]
    copy.sort((a, b) => {
      const { column, order } = sortState
      const aVal = a[column]
      const bVal = b[column]

      if (aVal === bVal) return 0

      if (aVal < (bVal as any)) return order === "asc" ? -1 : 1
      return order === "asc" ? 1 : -1
    })

    return copy
  }, [templates, search, subjectFilter, sortState])

  useEffect(() => {
    ;(async () => {
      try {
        const data = await listTemplates()
        const mapped: TemplateItem[] = data.map(t => ({
          id: t.id,
          name: t.name,
            subject:
              t.subject_code && t.subject_name
                ? `${t.subject_code} – ${t.subject_name}`
                : t.subject_code || t.subject_name || "(no subject)",
          status: (t.status ?? "draft") as TemplateItem["status"],
          lastModified: (t.updated_at || t.created_at).slice(0, 10),
        }))
        setTemplates(mapped)
      } catch (e) {
        console.error("Failed to load templates", e)
      }
    })()
  }, [])

  const subjectOptions = useMemo(
    () => Array.from(new Set(templates.map(t => t.subject))).sort(),
    [templates]
  )

  function toggleSort(column: SortColumn) {
    setSortState(prev => {
      if (prev.column === column) {
        return { column, order: prev.order === "asc" ? "desc" : "asc" }
      }
      return { column, order: "asc" }
    })
  }

  function renderStatusChip(status: TemplateItem["status"]) {
    const base =
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
  if (status === "published" || status === "ready") {
      return (
        <span className={`${base} border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200`}>
          Published
        </span>
      )
    }
    return (
      <span className={`${base} border-amber-300/60 bg-amber-50/70 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100`}>
        Draft
      </span>
    )
  }

  const totalTemplates = templates.length
  const publishedCount = templates.filter(t => t.status === "published" || t.status === "ready").length
  const draftCount = templates.filter(t => t.status === "draft").length

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">My templates</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Review, search and manage your game templates.</p>
          </div>
          <Button variant="primary" className="inline-flex items-center whitespace-nowrap" onClick={() => navigate("/game/create-template")}> <Plus className="w-4 h-4 mr-2 inline-block" /> Create template</Button>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-xl border bg-white p-4 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{totalTemplates}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Templates total</div>
              </div>
            </div>
          </Card>
          <Card className="rounded-xl border bg-white p-4 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{publishedCount}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Published templates</div>
              </div>
            </div>
          </Card>
          <Card className="rounded-xl border bg-white p-4 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-500 text-white">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{draftCount}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Drafts in progress</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main card */}
        <Card className="mt-5 rounded-xl border bg-white p-0 text-left shadow-sm transition-shadow duration-150 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 text-sm dark:border-gray-800">
            <div className="flex flex-nowrap items-center gap-3 w-full max-w-[calc(100%-12rem)]">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by template name..."
                className="flex-1 min-w-[200px] rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <select
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value)}
                className="min-w-[150px] rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">All subjects</option>
                {subjectOptions.map(subject => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              className="inline-flex items-center whitespace-nowrap h-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => { setSearch(""); setSubjectFilter(""); setSortState({ column: "lastModified", order: "desc" }) }}
            >
              <RefreshCcw className="w-4 h-4 inline-block mr-2" /> Reset filters
            </Button>
          </div>

          <div className="max-h-[56vh] overflow-y-auto px-4 pb-3 pt-2">
            <table className="min-w-full table-auto border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-slate-950/90">
                <tr className="border-b border-gray-200 bg-amber-50/70 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:border-gray-800 dark:bg-amber-900/20 dark:text-amber-100">
                  <th className="px-3 py-2 cursor-pointer" onClick={()=>toggleSort("name")}>Template name</th>
                  <th className="px-3 py-2 cursor-pointer" onClick={()=>toggleSort("subject")}>Subject</th>
                  <th className="px-3 py-2 cursor-pointer" onClick={()=>toggleSort("status")}>Status</th>
                  <th className="px-3 py-2 cursor-pointer" onClick={()=>toggleSort("lastModified")}>Last modified</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-xs text-gray-500 dark:text-gray-400">
                      No templates found. Adjust filters or create a new template.
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map(tpl => (
                    <tr key={tpl.id} className="border-b border-gray-100 text-sm hover:bg-amber-50/60 dark:border-gray-800 dark:hover:bg-amber-900/20">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{tpl.name}</td>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{tpl.subject}</td>
                      <td className="px-3 py-2">{renderStatusChip(tpl.status)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{tpl.lastModified}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/game/create-template?id=${tpl.id}`)}
                            className="inline-flex items-center whitespace-nowrap rounded px-2 py-1 text-amber-700 hover:text-amber-500 dark:text-amber-200 dark:hover:text-amber-100"
                          >
                            <Edit3 className="w-4 h-4 inline-block mr-1" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(tpl.id, setTemplates)}
                            className="inline-flex items-center whitespace-nowrap rounded px-2 py-1 text-amber-700 hover:text-amber-500 dark:text-amber-200 dark:hover:text-amber-100"
                          >
                            <Copy className="w-4 h-4 inline-block mr-1" /> Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tpl.id, setTemplates)}
                            className="inline-flex items-center whitespace-nowrap rounded px-2 py-1 text-red-600 hover:text-red-500 dark:text-red-300 dark:hover:text-red-200"
                          >
                            <Trash2 className="w-4 h-4 inline-block mr-1" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  )
}

export default MyTemplatesPage
