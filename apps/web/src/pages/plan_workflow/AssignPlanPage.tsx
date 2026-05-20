import type React from "react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
	ArrowLeft,
	BookOpenCheck,
	CalendarClock,
	CheckCircle2,
	Loader2,
	Save,
	Users,
	ClipboardList,
	Sparkles,
	ListChecks,
	Type,
	NotebookPen,
	Lock,
	Layers3,
} from "lucide-react"

type LockMode = "flexible" | "locked" | "personalized"

interface AssignmentFormData {
	name: string
	scopeId: string
	contentRefs: string[]
	dueAt: string
	lockMode: LockMode
	notes: string
}

interface RecentAssignmentItem {
	id: string
	name: string
	scopeLabel: string
	studentCount: number
	dueAt: string
	status: "publishing" | "draft" | "live"
}

const initialForm: AssignmentFormData = {
	name: "Monday Script Review",
	scopeId: "",
	contentRefs: [],
	dueAt: "2026-01-30T18:00",
	lockMode: "flexible",
	notes: "",
}

const AssignPlanPage: React.FC = () => {
	const navigate = useNavigate()
	const [form, setForm] = useState<AssignmentFormData>(initialForm)
	const [draftId, setDraftId] = useState<string | null>(null)
	const [isSaving, setIsSaving] = useState(false)
	const [isPublishing, setIsPublishing] = useState(false)
	const [chipStatus, setChipStatus] = useState("Draft")
	const [recentAssignments, setRecentAssignments] = useState<RecentAssignmentItem[]>([
		{
			id: "1",
			name: "Monday Script Review",
			scopeLabel: "Year 1 · Class A",
			studentCount: 28,
			dueAt: "2026-01-30 18:00",
			status: "publishing",
		},
	])

	// derive a quick affected-students preview from the chosen scope id
	const rosterPreview = useMemo(() => {
		if (!form.scopeId) return null
		const isClass = form.scopeId.includes("class")
		const studentCount = isClass ? (form.scopeId === "class-1" ? 28 : 25) : 8
		const listText = isClass
			? "Student 1, Student 2, ... (preview)"
			: "Group members 1–8 (preview)"
		return { studentCount, listText }
	}, [form.scopeId])

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { id, value } = e.target
		setForm((prev) => ({ ...prev, [id.replace("assignment-", "")]: value }))
	}

	const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const { id, value, multiple, options } = e.target
		if (multiple) {
			const selectedValues = Array.from(options)
				.filter((o) => o.selected)
				.map((o) => o.value)
			setForm((prev) => ({ ...prev, [id]: selectedValues }))
		} else {
			setForm((prev) => ({ ...prev, [id === "scope-select" ? "scopeId" : id]: value }))
		}
	}

	const createDraft = async (showToast = true) => {
		setIsSaving(true)
		try {
			const res = await fetch("/api/assignments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: form.name,
					scopeId: form.scopeId,
					contentRefs: form.contentRefs,
					lockMode: form.lockMode,
					DueAt: form.dueAt,
					notes: form.notes,
				}),
			})
			if (!res.ok) throw new Error("Failed to save draft")
			const data = (await res.json()) as { assignmentId: string }
			setDraftId(data.assignmentId)
			setChipStatus("Draft saved")
			if (showToast) {
				alert(`Draft saved (ID: ${data.assignmentId})`)
			}
			return data.assignmentId
		} catch (err) {
			console.error(err)
			alert("Unable to save draft. Please try again.")
			return null
		} finally {
			setIsSaving(false)
		}
	}

	const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
		e.preventDefault()
		if (!form.name || !form.scopeId || !form.contentRefs.length || !form.dueAt) {
			alert("Please fill in all required fields before publishing.")
			return
		}
		setIsPublishing(true)
		try {
			let id = draftId
			if (!id) {
				id = await createDraft(false)
				if (!id) return
			}
			const res = await fetch(`/api/assignments/${id}/publish`, {
				method: "POST",
			})
			if (!res.ok) throw new Error("Failed to publish assignment")
			setChipStatus("Publishing")
			setRecentAssignments((prev) => [
				{
					id: id!,
					name: form.name,
					scopeLabel:
						form.scopeId === "class-1"
							? "Year 1 · Class A"
							: form.scopeId === "class-2"
								? "Year 1 · Class B"
								: "Group 5",
					studentCount: rosterPreview?.studentCount ?? 0,
					dueAt: form.dueAt.replace("T", " "),
					status: "publishing",
				},
				...prev,
			])
			alert("Published! Worker is fanning out to students asynchronously.")
		} catch (err) {
			console.error(err)
			alert("Unable to publish assignment. Please try again.")
		} finally {
			setIsPublishing(false)
		}
	}

	const handleRetryPublish = async (id: string) => {
		try {
			const res = await fetch(`/api/assignments/${id}/publish`, {
				method: "POST",
			})
			if (!res.ok) throw new Error("Failed to re-publish")
			alert("Publish retriggered for all students.")
		} catch (err) {
			console.error(err)
			alert("Unable to retry publish at the moment.")
		}
	}

	const canSubmit =
		!!form.name && !!form.scopeId && form.contentRefs.length > 0 && !!form.dueAt

	return (
		<div className="min-h-screen text-[13px] text-[#2c1f17]">
			<header className="sticky top-0 z-10 border-b border-[#f0ddcc] bg-[rgba(253,244,234,0.96)]/90 backdrop-blur">
				<div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3 px-4 py-3">
					<div>
						<h1 className="flex items-center gap-2 text-[16px] font-semibold">
							<BookOpenCheck className="h-4 w-4 text-[#e07a5f]" />
							<span>Assign Learning Plans</span>
							<Sparkles className="h-4 w-4 text-[#f4a261]" />
						</h1>
						<p className="mt-1 max-w-xl text-[12px] leading-snug text-[#8b7164]">
							Batch assign script-based learning tasks to a class or group, with
							optional personalization based on mastery.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded-xl border border-[#f0ddcc] bg-[#fbe7d4] px-3 py-1.5 text-[13px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
							onClick={() => navigate(-1)}
						>
							<ArrowLeft className="h-3.5 w-3.5" />
							<span>Back</span>
						</button>
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded-xl border border-[#c5a05a]/70 bg-gradient-to-b from-[#c5a05a]/70 to-[#c5a05a]/50 px-3 py-1.5 text-[13px] text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
							onClick={() => createDraft()}
							disabled={isSaving}
						>
							{isSaving ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Save className="h-3.5 w-3.5" />
							)}
							<span>{isSaving ? "Saving..." : "Save draft"}</span>
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 pb-12 pt-4">
				<div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr]">
					<section className="overflow-hidden rounded-[14px] border border-[#f0ddcc] bg-white shadow-[0_10px_25px_rgba(0,0,0,0.10)]">
						<div className="flex items-start justify-between gap-3 border-b border-[#f0ddcc] bg-[#fbe7d4] px-3 py-3">
							<div>
								<h2 className="flex items-center gap-1 text-[13px] font-semibold">
									<ClipboardList className="h-3.5 w-3.5 text-[#e07a5f]" />
									<span>Create Assignment</span>
								</h2>
								<p className="mt-1 text-[12px] leading-snug text-[#8b7164]">
									Define the assignment name, target scope, content bundle and due
									time.
								</p>
							</div>
							<span className="inline-flex items-center gap-1 rounded-full border border-[#c5a05a]/40 bg-[#f4a261]/10 px-3 py-1 text-[12px] text-[#f4a261]">
								{chipStatus === "Publishing" ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<CheckCircle2 className="h-3 w-3" />
								)}
								<span>{chipStatus}</span>
							</span>
						</div>
						<div className="space-y-3 px-3 py-3">
							<form onSubmit={handleSubmit} className="space-y-3" id="assignment-form">
								<div className="space-y-1">
									<label
										htmlFor="assignment-name"
										className="flex items-center gap-1 text-[12px] font-medium"
									>
										<Type className="h-3.5 w-3.5 text-[#8b7164]" />
										<span>Assignment name *</span>
									</label>
									<input
										id="assignment-name"
										value={form.name}
										onChange={handleInputChange}
										className="w-full rounded-[10px] border border-[#f0ddcc] bg-white/60 px-2.5 py-2 text-[13px] outline-none transition focus:border-[#f4a261] focus:bg-[#fffdf8] focus:ring-1 focus:ring-[#c49a6c]/50"
									/>
									<p className="text-[11px] text-[#8b7164]">
										Example: "Week 3 · Factory Method Review".
									</p>
								</div>

								<div className="grid gap-3 md:grid-cols-2">
									<div className="space-y-1">
										<label
											htmlFor="scope-select"
											className="flex items-center gap-1 text-[12px] font-medium"
										>
											<Users className="h-3.5 w-3.5 text-[#8b7164]" />
											<span>Scope (class / group) *</span>
										</label>
										<div className="relative">
											<Users className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8b7164]/80" />
											<select
												id="scope-select"
												value={form.scopeId}
												onChange={handleSelectChange}
												className="w-full appearance-none rounded-[10px] border border-[#f0ddcc] bg-white/60 px-7 py-2 text-[13px] outline-none transition focus:border-[#f4a261] focus:bg-[#fffdf8] focus:ring-1 focus:ring-[#c49a6c]/50"
											>
												<option value="">Select a class...</option>
												<option value="class-1">Year 1 · Class A (28 students)</option>
												<option value="class-2">Year 1 · Class B (25 students)</option>
												<option value="group-5">Group 5 (8 students)</option>
											</select>
										</div>
										{rosterPreview && (
											<div className="mt-1 rounded-[10px] border border-[#f0ddcc] bg-white/70 p-2.5 text-[12px]">
												<strong>
													Affected students: {rosterPreview.studentCount}
												</strong>
												<div className="mt-1 text-[11px] text-[#8b7164]">
													{rosterPreview.listText}
												</div>
											</div>
										)}
									</div>

									<div className="space-y-1">
										<label
											htmlFor="lock-mode"
											className="flex items-center gap-1 text-[12px] font-medium"
										>
											<Lock className="h-3.5 w-3.5 text-[#8b7164]" />
											<span>Lock mode</span>
										</label>
										<select
											id="lock-mode"
											value={form.lockMode}
											onChange={handleSelectChange}
											className="w-full rounded-[10px] border border-[#f0ddcc] bg-white/60 px-2.5 py-2 text-[13px] outline-none transition focus:border-[#f4a261] focus:bg-[#fffdf8] focus:ring-1 focus:ring-[#c49a6c]/50"
										>
											<option value="flexible">
												Flexible (students can adjust schedule)
											</option>
											<option value="locked">
												Locked (teacher-defined only)
											</option>
											<option value="personalized">
												Personalized (auto adjust by mastery)
											</option>
										</select>
										<p className="text-[11px] text-[#8b7164]">
											Controls how much students can change their own plan.
										</p>
									</div>
								</div>

								<div className="space-y-1">
									<label
										htmlFor="content-refs"
										className="flex items-center gap-1 text-[12px] font-medium"
									>
										<Layers3 className="h-3.5 w-3.5 text-[#8b7164]" />
										<span>Content bundle (multi-select) *</span>
									</label>
									<select
										id="content-refs"
										multiple
										value={form.contentRefs}
										onChange={handleSelectChange}
										className="min-h-[100px] w-full rounded-[10px] border border-[#f0ddcc] bg-white/60 px-2.5 py-2 text-[13px] outline-none transition focus:border-[#f4a261] focus:bg-[#fffdf8] focus:ring-1 focus:ring-[#c49a6c]/50"
									>
										<option value="script-mystery1">
											Script · Murder Mystery (Scene 1)
										</option>
										<option value="quiz-math-basics">
											Quiz · Math Basics (10 questions)
										</option>
										<option value="keypoints-history">
											Key points · History Events (5 items)
										</option>
										<option value="review-wrongset">
											Review · Personal wrong-set
										</option>
									</select>
									<p className="text-[11px] text-[#8b7164]">
										Combine scripts, quizzes and key points into one assignment.
									</p>
								</div>

								<div className="space-y-1">
									<label
										htmlFor="due-at"
										className="flex items-center gap-1 text-[12px] font-medium"
									>
										<CalendarClock className="h-3.5 w-3.5 text-[#8b7164]" />
										<span>Due time *</span>
									</label>
									<div className="relative">
										<CalendarClock className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8b7164]" />
										<input
											id="due-at"
											type="datetime-local"
											value={form.dueAt}
											onChange={handleInputChange}
											className="w-full rounded-[10px] border border-[#f0ddcc] bg-white/60 px-7 py-2 text-[13px] outline-none transition focus:border-[#f4a261] focus:bg-[#fffdf8] focus:ring-1 focus:ring-[#c49a6c]/50"
										/>
									</div>
									<p className="text-[11px] text-[#8b7164]">
										Used for notifications and progress tracking.
									</p>
								</div>

								<hr className="my-2 border-[#f0ddcc]" />

								<div className="space-y-1">
									<label
										htmlFor="notes"
										className="flex items-center gap-1 text-[12px] font-medium"
									>
										<NotebookPen className="h-3.5 w-3.5 text-[#8b7164]" />
										<span>Teacher notes (optional)</span>
									</label>
									<textarea
										id="notes"
										value={form.notes}
										onChange={handleInputChange}
										placeholder="E.g. focus on scenes 2–3 first, quiz is for consolidation."
										className="min-h-[70px] w-full resize-y rounded-[10px] border border-[#f0ddcc] bg-white/60 px-2.5 py-2 text-[13px] outline-none transition focus:border-[#f4a261] focus:bg-[#fffdf8] focus:ring-1 focus:ring-[#c49a6c]/50"
									/>
								</div>

								<div className="mt-2 flex flex-wrap justify-end gap-2">
									<button
										type="button"
										className="inline-flex items-center gap-1 rounded-xl border border-[#f0ddcc] bg-[#fbe7d4] px-3 py-1.5 text-[13px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
										onClick={() => createDraft()}
										disabled={isSaving}
									>
										{isSaving ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<Save className="h-3.5 w-3.5" />
										)}
										<span>{isSaving ? "Saving..." : "Save draft"}</span>
									</button>
									<button
										type="submit"
										className="inline-flex items-center gap-1 rounded-xl border border-[#c5a05a]/70 bg-gradient-to-b from-[#c5a05a]/70 to-[#c5a05a]/50 px-3 py-1.5 text-[13px] text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
										disabled={!canSubmit || isPublishing}
									>
										{isPublishing ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<CheckCircle2 className="h-3.5 w-3.5" />
										)}
										<span>
											{isPublishing ? "Publishing..." : "Preview & publish"}
										</span>
									</button>
								</div>
							</form>
						</div>
					</section>

					<aside className="overflow-hidden rounded-[14px] border border-[#f0ddcc] bg-white shadow-[0_10px_25px_rgba(0,0,0,0.10)]">
						<div className="flex items-start justify-between gap-3 border-b border-[#f0ddcc] bg-[#fbe7d4] px-3 py-3">
							<div>
								<h2 className="flex items-center gap-1 text-[13px] font-semibold">
									<ListChecks className="h-3.5 w-3.5 text-[#e07a5f]" />
									<span>Recent Assignments</span>
								</h2>
								<p className="mt-1 text-[12px] leading-snug text-[#8b7164]">
									Monitor publishing status and quickly retry if needed.
								</p>
							</div>
							<span className="inline-flex items-center gap-1 rounded-full border border-[#c5a05a]/60 bg-[#f4a261]/18 px-2.5 py-1 text-[11px] text-[#e07a5f]">
								<Loader2 className="h-3 w-3 animate-spin" />
								<span>live fanout</span>
							</span>
						</div>
						<div className="space-y-2 px-3 py-3">
							{recentAssignments.length === 0 ? (
								<p className="text-[12px] text-[#8b7164]">
									No recent assignments yet. Published plans will appear here.
								</p>
							) : (
								<ul className="space-y-2">
									{recentAssignments.map((a) => (
										<li
											key={a.id}
											className="flex items-start justify-between gap-3 rounded-[10px] border border-[#f0ddcc] bg-white/70 px-3 py-2.5"
										>
											<div>
												<p className="flex items-center gap-2 text-[13px] font-medium">
													{a.name}
												</p>
												<p className="mt-0.5 text-[12px] text-[#8b7164]">
													{a.scopeLabel} · {a.studentCount} students · due {a.dueAt}
												</p>
											</div>
											<div className="flex flex-col items-end gap-1.5">
												<span
													className={`rounded-full px-3 py-1 text-[11px] text-white ${
														a.status === "publishing"
															? "bg-[#e07a5f] animate-pulse"
														: a.status === "live"
															? "bg-[#16a34a]"
														: "bg-[#e9a23b]"
													}`}
												>
													{a.status === "publishing"
														? "Publishing..."
														: a.status === "live"
															? "Live"
															: "Draft"}
												</span>
												<div className="flex flex-wrap justify-end gap-1.5">
													<button
														type="button"
														className="rounded-xl border border-[#f0ddcc] bg-[#fbe7d4] px-2.5 py-1 text-[12px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
														onClick={() => handleRetryPublish(a.id)}
													>
														Notify All
													</button>
													<button
														type="button"
														className="rounded-xl border border-[#f0ddcc] bg-white px-2.5 py-1 text-[12px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
														onClick={() => alert("Detail view (example).")}
													>
														View details
													</button>
												</div>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</aside>
				</div>
			</main>
		</div>
	)
}

export default AssignPlanPage

