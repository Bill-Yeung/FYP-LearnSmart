import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components"
import { LayoutGrid, Layers, Clock3, Plus, ChevronUp, ChevronDown } from "lucide-react"
import { ConfirmDialog, useConfirmDialog } from "../../components/general/ConfirmDialog"

type ScriptListItem = {
	script_id?: string | null
	document_hash: string
	document_name?: string | null
	created_at?: string | null
	updated_at?: string | null
	module_name?: string | null
	target_level?: string | null
	title?: string | null
	script: any
	subject_code?: string | null
	status?: string | null
	progressPercent?: number | null
	lastReviewedAt?: string | null
	completedSceneCount?: number | null
	totalSceneCount?: number | null
}

export function MyScriptsPage() {
	const navigate = useNavigate()
	const [scripts, setScripts] = useState<ScriptListItem[]>([])
	const [loading, setLoading] = useState(false)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
	const [isBatchDeleting, setIsBatchDeleting] = useState(false)
	const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([])
	const [sortState, setSortState] = useState<{ column: string; order: "asc" | "desc" }>({ column: "date", order: "desc" })
	const [search, setSearch] = useState("")
	const [subjectFilter, setSubjectFilter] = useState("")
	const { confirm, dialogProps } = useConfirmDialog()

	useEffect(() => {
		let alive = true
		async function load() {
			setLoading(true)
			setLoadError(null)
			try {
				const res = await fetch("/api/game/my-scripts")
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				const data = await res.json()
				const list = Array.isArray(data?.scripts) ? (data.scripts as ScriptListItem[]) : []
				if (alive) setScripts(list)
			} catch (e: any) {
				if (alive) setLoadError(e?.message || "Failed to load scripts")
			} finally {
				if (alive) setLoading(false)
			}
		}
		void load()
		return () => {
			alive = false
		}
	}, [])

	const SUBJECT_OPTIONS = useMemo(() => {
		return Array.from(new Set(scripts.map(s => toDisplaySubject(s)).filter(Boolean)))
	}, [scripts])

	function toDisplayName(s: ScriptListItem) {
		return s.title || s.script?.title || (s.document_name ? `${s.document_name} Script` : `Script ${(s.document_hash || "unknown").slice(0, 8)}`)
	}

	function toDisplaySubject(s: ScriptListItem) {
		return (s.module_name || "Uncategorized") as string
	}

	function toDisplaySource(s: ScriptListItem) {
		const docName = s.document_name || `Hash: ${(s.document_hash || "unknown").slice(0, 8)}...`
		if (s.subject_code) {
			return `${s.subject_code.trim()} - ${docName}`
		}
		return docName
	}

	function toDisplayTargetLevel(s: ScriptListItem) {
		if (!s.target_level) return "Standard"
		return s.target_level.charAt(0).toUpperCase() + s.target_level.slice(1)
	}

	function isScriptSelected(scriptId?: string | null) {
		return !!scriptId && selectedScriptIds.includes(scriptId)
	}

	function toggleScriptSelection(scriptId?: string | null) {
		if (!scriptId) return
		setSelectedScriptIds(prev =>
			prev.includes(scriptId) ? prev.filter(id => id !== scriptId) : [...prev, scriptId]
		)
	}

	function selectAllScripts() {
		setSelectedScriptIds(filteredAndSorted.map(script => script.script_id ?? "").filter(Boolean) as string[])
	}

	function clearSelection() {
		setSelectedScriptIds([])
	}

	// run the search/subject filter then sort by the chosen column
	const filteredAndSorted = useMemo(() => {
		const q = search.trim().toLowerCase()
		let list = scripts

		if (q) {
			list = list.filter(s => 
				toDisplayName(s).toLowerCase().includes(q) || 
				toDisplaySource(s).toLowerCase().includes(q) ||
				toDisplaySubject(s).toLowerCase().includes(q) ||
				toDisplayTargetLevel(s).toLowerCase().includes(q)
			)
		}
		if (subjectFilter) {
			list = list.filter(s => toDisplaySubject(s) === subjectFilter)
		}

		const copy = [...list]
		copy.sort((a, b) => {
			const getVal = (s: ScriptListItem) => {
				switch (sortState.column) {
					case "name": return toDisplayName(s)
					case "subject": return toDisplaySubject(s)
					case "source": return toDisplaySource(s)
					case "target_level": return toDisplayTargetLevel(s)
					case "progress": return String(s.progressPercent ?? 0).padStart(3, "0")
					case "last_reviewed": return s.lastReviewedAt ? String(s.lastReviewedAt) : ""
					default: return s.updated_at || s.created_at || ""
				}
			}
			const aVal = getVal(a)
			const bVal = getVal(b)
			if (aVal === bVal) return 0
			if (aVal < bVal) return sortState.order === "asc" ? -1 : 1
			return sortState.order === "asc" ? 1 : -1
		})
		return copy
	}, [scripts, search, subjectFilter, sortState])

	function toggleSort(column: "name" | "subject" | "source" | "target_level" | "progress" | "last_reviewed") {
		setSortState(prev => {
			if (prev.column === column) {
				return { column, order: prev.order === "asc" ? "desc" : "asc" }
			}
			return { column, order: "asc" }
		})
	}

	const totalScripts = scripts.length
	const uniqueModules = new Set(scripts.map(s => s.module_name).filter(Boolean)).size
	const latestScript = scripts.reduce((latest, s) => {
		const d = s.lastReviewedAt || s.updated_at || s.created_at
		if (!d) return latest
		const dateStr = String(d).slice(0, 10)
		return dateStr > latest ? dateStr : latest
	}, "") || "N/A"

	async function handleDeleteScript(s: ScriptListItem) {
		const id = s.script_id
		if (!id) {
			setLoadError("This script has no script_id, cannot delete.")
			return
		}

		const ok = await confirm({
			title: "Delete script",
			message: (
				<div>
					<div className="font-medium">{toDisplayName(s)}</div>
					<div className="mt-1 text-xs">This action can’t be undone.</div>
				</div>
			),
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			variant: "danger",
		})
		if (!ok) return

		setDeleteLoadingId(id)
		setLoadError(null)
		try {
			const res = await fetch(`/api/game/scripts/${id}`, { method: "DELETE" })
			if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
			setScripts(prev => prev.filter(x => x.script_id !== id))
		} catch (e: any) {
			setLoadError(e?.message || "Failed to delete script")
		} finally {
			setDeleteLoadingId(null)
		}
	}

	async function handleBatchDelete() {
		if (selectedScriptIds.length === 0) return
		const ok = await confirm({
			title: "Delete selected scripts",
			message: <div className="space-y-2"><div className="font-medium">Delete {selectedScriptIds.length} selected scripts?</div><div className="text-xs text-slate-500">This operation cannot be undone.</div></div>,
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			variant: "danger",
		})
		if (!ok) return

		setLoadError(null)
		setDeleteLoadingId(null)
		setIsBatchDeleting(true)
		try {
			const res = await fetch(`/api/game/scripts?ids=${selectedScriptIds.join(",")}`, { method: "DELETE" })
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			setScripts(prev => prev.filter(script => !selectedScriptIds.includes(script.script_id || "")))
			clearSelection()
		} catch (e: any) {
			setLoadError(e?.message || "Failed to delete selected scripts")
		} finally {
			setIsBatchDeleting(false)
		}
	}

	const getSortIcon = (column: string) => {
		if (sortState.column !== column) return null
		return sortState.order === "asc" ? <ChevronUp className="w-3 h-3 inline-block" /> : <ChevronDown className="w-3 h-3 inline-block" />
	}

	const renderScriptCard = (script: ScriptListItem) => (
		<div
			key={script.script_id || `${script.document_hash}-${toDisplayName(script)}`}
			className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:ring-indigo-400"
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={isScriptSelected(script.script_id)}
							onChange={() => toggleScriptSelection(script.script_id)}
							className="form-checkbox h-4 w-4 text-indigo-600"
						/>
						<h3 className="text-base font-semibold text-slate-900 dark:text-white">{toDisplayName(script)}</h3>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{toDisplaySource(script)}</p>
				</div>
				<div className="flex flex-col items-end gap-2">
					<span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
						{toDisplaySubject(script)}
					</span>
					<span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${(script.progressPercent ?? 0) === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800/60 dark:text-emerald-400' : (script.progressPercent ?? 0) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800/60 dark:text-amber-400' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/60 dark:text-slate-400'}`}>
						{script.progressPercent ?? 0}% progress
					</span>
				</div>
			</div>
			<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-300">
				<div>
					<div className="font-semibold text-slate-700 dark:text-slate-100">Scenes</div>
					<div className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
						<span>{script.completedSceneCount ?? 0}/{script.totalSceneCount ?? 0}</span>
					</div>
				</div>
				<div>
					<div className="font-semibold text-slate-700 dark:text-slate-100">Last Reviewed</div>
					<div>{script.lastReviewedAt ? String(script.lastReviewedAt).slice(0, 10) : "N/A"}</div>
				</div>
			</div>
				<div className="mt-4 flex flex-wrap items-center gap-2">
				<Button
					variant="secondary"
					className="w-[88px] justify-center"
					disabled={!script.script_id}
					onClick={() => {
						if (!script.script_id) return
						navigate(`/game/scripts/${script.script_id}/report`, { state: { documentName: script.document_name } })
					}}
				>
					Report
				</Button>
				<Button
					variant="primary"
					className="w-[88px] justify-center"
					disabled={!script.document_hash}
					onClick={() => {
						if (!script.document_hash) return
						navigate(`/game/play?scriptId=${script.script_id}`)
					}}
				>
					{(script.progressPercent ?? 0) === 0 ? "Play" : (script.progressPercent ?? 0) >= 100 ? "Replay" : "Resume"}
				</Button>
				<Button
					variant="secondary"
					className="w-[88px] justify-center text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:hover:border-red-800"
					disabled={!script.script_id || deleteLoadingId === script.script_id || isBatchDeleting}
					onClick={() => void handleDeleteScript(script)}
				>
					{deleteLoadingId === script.script_id ? "..." : "Delete"}
				</Button>
			</div>
		</div>
	)

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-16 relative dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
			<ConfirmDialog {...dialogProps} isLoading={!!deleteLoadingId} />
			<main className="mx-auto max-w-[1600px] px-4 sm:px-6 py-8 text-slate-800 dark:text-slate-100">
				
				{/* Header Section */}
				<div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
					<div>
						<h1 className="text-2xl sm:text-3xl font-bold leading-tight text-gray-900 dark:text-white">My Scripts</h1>
						<p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage and play your generated detective scenarios.</p>
					</div>
					<div className="flex items-center gap-3">
						<Button variant="primary" className="inline-flex items-center whitespace-nowrap" onClick={() => navigate("/game/generate-script")}> 
							<Plus className="w-4 h-4 mr-2" /> Generate New Script
						</Button>
					</div>
				</div>

				{/* Stats */}
				<div className="grid gap-6 md:grid-cols-3 mb-8">
				<div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all dark:bg-slate-900 dark:border-slate-800">
					<div className="flex items-center gap-4">
						<div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
							<LayoutGrid className="w-8 h-8" />
						</div>
						<div>
							<div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totalScripts}</div>
							<div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.18em]">Total Scripts</div>
						</div>
					</div>
				</div>
				<div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all dark:bg-slate-900 dark:border-slate-800">
					<div className="flex items-center gap-4">
						<div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
							<Layers className="w-8 h-8" />
						</div>
						<div>
							<div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{uniqueModules}</div>
							<div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.18em]">Active Modules</div>
						</div>
					</div>
				</div>
				<div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all dark:bg-slate-900 dark:border-slate-800">
					<div className="flex items-center gap-4">
						<div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
							<Clock3 className="w-8 h-8" />
						</div>
						<div>
							<div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{latestScript}</div>
							<div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.18em]">Latest Activity</div>
						</div>
					</div>
				</div>
			</div>

				{/* Filter + Search */}
				<div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex flex-wrap items-center gap-3">
							<input
								type="text"
								value={search}
								onChange={e => setSearch(e.target.value)}
								placeholder="Search scripts..."
								className="min-w-[220px] rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-400"
							/>
							<select
								value={subjectFilter}
								onChange={e => setSubjectFilter(e.target.value)}
								className="rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-400"
							>
								<option value="">All Modules</option>
								{SUBJECT_OPTIONS.map(subject => (
									<option key={subject} value={subject}>
										{subject}
									</option>
								))}
							</select>
							<select
								value={`${sortState.column}-${sortState.order}`}
								onChange={e => {
									const [col, order] = e.target.value.split("-")
									setSortState({ column: col, order: order as "asc" | "desc" })
								}}
								className="rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-400"
							>
								<option value="date-desc">Newest First</option>
								<option value="date-asc">Oldest First</option>
								<option value="progress-desc">Highest Progress</option>
								<option value="progress-asc">Lowest Progress</option>
								<option value="name-asc">Name (A-Z)</option>
							</select>
							{loading && <span className="text-xs text-slate-500">Loading...</span>}
							{loadError && <span className="text-xs text-red-500">{loadError}</span>}
						</div>
						<div className="flex items-center gap-2">
							<Button variant="secondary" onClick={() => window.location.reload()}>Refresh</Button>
							{selectedScriptIds.length > 0 && (
								<Button variant="danger" disabled={isBatchDeleting || !!deleteLoadingId} onClick={handleBatchDelete}>
									{isBatchDeleting ? "Deleting..." : `Delete ${selectedScriptIds.length} selected`}
								</Button>
							)}
						</div>
					</div>
				</div>

				{/* Script List */}
				{loading && scripts.length === 0 ? (
					<div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
						<p className="text-lg font-semibold">Loading scripts...</p>
					</div>
				) : filteredAndSorted.length === 0 ? (
					<div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
						<p className="text-lg font-semibold">No scripts found</p>
						<p className="mt-2 text-sm">Try adjusting your search filters or generate a new script.</p>
					</div>
				) : (
					<>
						{/* Card view for smaller screens */}
						<div className="grid gap-4 sm:grid-cols-2 lg:hidden">
							{filteredAndSorted.map(renderScriptCard)}
						</div>
						{/* Table view for larger screens */}
						<div className="hidden lg:block rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
							<div className="overflow-x-auto">
								<table className="min-w-full text-left text-sm">
									<thead className="bg-slate-50 dark:bg-slate-800/50">
										<tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400 uppercase tracking-wide">
											<th className="px-6 py-4">
												<input
													type="checkbox"
													checked={filteredAndSorted.length > 0 && filteredAndSorted.every(s => isScriptSelected(s.script_id))}
													onChange={() => {
													if (filteredAndSorted.length > 0 && filteredAndSorted.every(s => isScriptSelected(s.script_id))) {
														clearSelection()
													} else {
														selectAllScripts()
													}
												}}
												className="form-checkbox h-4 w-4 text-indigo-600"
											/>
											</th>
											<th className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort("source")}> 
												Source <span className="text-xs">{getSortIcon("source")}</span>
											</th>
											<th className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort("subject")}> 
												Module <span className="text-xs">{getSortIcon("subject")}</span>
											</th>
											<th className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort("target_level")}> 
												Script Name - Target Level <span className="text-xs">{getSortIcon("target_level")}</span>
											</th>
											<th className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => toggleSort("last_reviewed")}> 
												Last Reviewed <span className="text-xs">{getSortIcon("last_reviewed")}</span>
											</th>
											<th className="px-6 py-4">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
										{filteredAndSorted.map(script => (
											<tr
												key={script.script_id || `${script.document_hash}-${toDisplayName(script)}`}
												className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
											>
												<td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
													<input
														type="checkbox"
														checked={isScriptSelected(script.script_id)}
														onChange={() => toggleScriptSelection(script.script_id)}
														className="form-checkbox h-4 w-4 text-indigo-600"
													/>
												</td>
												<td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] sm:max-w-[200px] truncate" title={toDisplaySource(script)}>{toDisplaySource(script)}</td>
												<td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
													<div className="flex flex-col items-start gap-1">
														<span className="max-w-[140px] xl:max-w-[180px] truncate" title={toDisplaySubject(script)}>{toDisplaySubject(script)}</span>
														<span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${(script.progressPercent ?? 0) === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800/60 dark:text-emerald-400' : (script.progressPercent ?? 0) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800/60 dark:text-amber-400' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/60 dark:text-slate-400'}`}>
															{script.progressPercent ?? 0}% progress
														</span>
													</div>
												</td>
												<td className="px-6 py-4 font-semibold text-slate-900 dark:text-white max-w-[200px] xl:max-w-[300px] 2xl:max-w-[400px]">
													<div className="flex flex-col items-start gap-1.5">
														<span className="w-full truncate" title={toDisplayName(script)}>
															{toDisplayName(script)}
														</span>
														<span 
															className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-900/30 dark:text-indigo-400"
															title={`Target Level: ${toDisplayTargetLevel(script)}`}
														>
															{toDisplayTargetLevel(script)}
														</span>
													</div>
												</td>
												<td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{script.lastReviewedAt ? String(script.lastReviewedAt).slice(0, 10) : "N/A"}</td>
												<td className="px-6 py-4 whitespace-nowrap w-[300px]">
													<div className="flex items-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
														<Button variant="secondary" className="w-[84px] justify-center" disabled={!script.script_id} onClick={() => { if (!script.script_id) return; navigate(`/game/scripts/${script.script_id}/report`, { state: { documentName: script.document_name } }) }}>Report</Button>
														<Button variant="primary" className="w-[84px] justify-center" disabled={!script.document_hash} onClick={() => { if (!script.document_hash) return; navigate(`/game/play?scriptId=${script.script_id}&documentHash=${script.document_hash}`, { state: { scriptId: script.script_id, documentHash: script.document_hash } }) }}>
															{(script.progressPercent ?? 0) === 0 ? "Play" : (script.progressPercent ?? 0) >= 100 ? "Replay" : "Resume"}
														</Button>
														<Button variant="secondary" className="w-[84px] justify-center text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:hover:border-red-800" disabled={!script.script_id || deleteLoadingId === script.script_id || isBatchDeleting} onClick={() => void handleDeleteScript(script)}>{deleteLoadingId === script.script_id ? "..." : "Delete"}</Button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</>
				)}
			</main>
		</div>
	)
}

export default MyScriptsPage