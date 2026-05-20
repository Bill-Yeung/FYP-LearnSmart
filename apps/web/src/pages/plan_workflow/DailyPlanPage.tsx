import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Card, Button } from "../../components"
import { Target, X } from "lucide-react"
import * as planWorkflowApi from "../../api/planWorkflow"
import type { DailyPlanTaskDTO } from "../../types/planWorkflow.dto"
import { useTimer } from "../../contexts/TimerContext"


const MOCK_BLOCKS = [
	{
		time: "09:00 – 09:30",
		label: "Script Play: The Lost Packet Mystery",
		mode: "script" as const,
		status: "done" as const,
	},
	{
		time: "09:40 – 10:10",
		label: "Redo mistakes: Transport layer quiz",
		mode: "study" as const,
		status: "in-progress" as const,
	},
	{
		time: "10:20 – 10:40",
		label: "Continue the story: tracing segments",
		mode: "script" as const,
		status: "pending" as const,
	},
	{
		time: "10:50 – 11:20",
		label: "Focused reading: congestion control",
		mode: "study" as const,
		status: "pending" as const,
	},
]

export function DailyPlanPage() {
        const navigate = useNavigate()
        const [searchParams] = useSearchParams()
        const { selectTask, loadTasks: loadTimerTasks } = useTimer()

        const selectedDay = searchParams.get("day") ?? "Today"
	const [dailyTasks, setDailyTasks] = useState<DailyPlanTaskDTO[]>([])
	const [tasksLoading, setTasksLoading] = useState(false)
	const [tasksError, setTasksError] = useState<string | null>(null)
	const [showAddModal, setShowAddModal] = useState(false)
	const [editingTask, setEditingTask] = useState<DailyPlanTaskDTO | null>(null)
	const [newTaskTitle, setNewTaskTitle] = useState("")
	const [newTaskDuration, setNewTaskDuration] = useState(25)
	const [newTaskType, setNewTaskType] = useState<"memory" | "logic" | "script" | "understanding">("memory")
	const [isSaving, setIsSaving] = useState(false)

	const loadTasks = async () => {
		setTasksLoading(true)
		setTasksError(null)
		try {
			const tasks = await planWorkflowApi.getDailyPlanTasks(selectedDay)
			const baseTasks = tasks.slice(0, 5)
			const extraUserTasks = tasks.slice(5).filter(t => !t.scriptId && !t.knowledgeId && (!t.tags || t.tags.length === 0))
			setDailyTasks([...baseTasks, ...extraUserTasks])
		} catch (err) {
			console.error(err)
			setTasksError("Failed to load daily plan tasks")
		} finally {
			setTasksLoading(false)
		}
	}

	useEffect(() => {
		loadTasks()
	}, [selectedDay])

	// validate then create a new daily task via the api and append it locally
	const handleAddTask = async () => {
		if (!newTaskTitle.trim()) {
			setTasksError("Task title cannot be empty")
			return
		}
		if (newTaskDuration < 5 || newTaskDuration > 120) {
			setTasksError("Task duration must be between 5 and 120 minutes")
			return
		}

		setIsSaving(true)
		setTasksError(null)
		try {
			const newTask = await planWorkflowApi.createDailyTask({
				title: newTaskTitle,
				type: newTaskType,
				durationMinutes: newTaskDuration,
			}, selectedDay)
			setDailyTasks([...dailyTasks, newTask])
			setNewTaskTitle("")
			setNewTaskDuration(25)
			setNewTaskType("memory")
			setShowAddModal(false)
		} catch (err) {
			console.error(err)
			setTasksError("Failed to create task")
		} finally {
			setIsSaving(false)
		}
	}

	const isPersistentTask = (task: DailyPlanTaskDTO) => !task.id.startsWith("learnlater-")
	const isSuggestionTask = (task: DailyPlanTaskDTO) => task.id.startsWith("learnlater-")

	const handleEditTask = useCallback((task: DailyPlanTaskDTO) => {
		setEditingTask(task)
		setNewTaskTitle(task.title)
		setNewTaskDuration(task.durationMinutes)
		setNewTaskType(task.type as any)
		setShowAddModal(true)
	}, [])

	const handleDeleteTask = useCallback(async (taskId: string) => {
		try {
			await planWorkflowApi.deleteDailyTask(taskId)
			setDailyTasks(prev => prev.filter(t => t.id !== taskId))
			await loadTimerTasks(true)
		} catch (error) {
			console.error("Failed to delete task:", error)
			alert("Failed to delete task. Please try again.")
		}
	}, [loadTimerTasks])

	const handleSaveEdit = async () => {
		if (!editingTask || !newTaskTitle.trim()) {
			setTasksError("Task title cannot be empty")
			return
		}
		if (newTaskDuration < 5 || newTaskDuration > 120) {
			setTasksError("Task duration must be between 5 and 120 minutes")
			return
		}

		setIsSaving(true)
		setTasksError(null)
		try {
			let updatedTask: DailyPlanTaskDTO
			if (isSuggestionTask(editingTask)) {
				updatedTask = await planWorkflowApi.updateDailyTask(editingTask.id, {
					title: newTaskTitle,
					type: newTaskType,
					durationMinutes: newTaskDuration,
					tags: editingTask.tags,
				})
			} else {
				updatedTask = await planWorkflowApi.updateDailyTask(editingTask.id, {
					title: newTaskTitle,
					type: newTaskType,
					durationMinutes: newTaskDuration,
				})
			}
			setDailyTasks(dailyTasks.map(t => (t.id === editingTask.id ? updatedTask : t)))
			setEditingTask(null)
			setNewTaskTitle("")
			setNewTaskDuration(25)
			setNewTaskType("memory")
			setShowAddModal(false)
			await loadTasks()
			await loadTimerTasks(true)
		} catch (err) {
			console.error(err)
			setTasksError("Failed to update task")
		} finally {
			setIsSaving(false)
		}
	}

	// toggle the task between completed and pending; suggestion tasks are not allowed
	const handleCompleteTask = async (taskId: string) => {
		const task = dailyTasks.find(t => t.id === taskId)
		if (!task) return
		if (!isPersistentTask(task)) {
			setTasksError("Suggested tasks from Learn Later cannot be completed from here.")
			return
		}

		setTasksError(null)
		try {
			const updatedTask = await planWorkflowApi.updateDailyTask(taskId, {
				status: task.status === "completed" ? "pending" : "completed",
			})
			setDailyTasks(dailyTasks.map(t => (t.id === taskId ? updatedTask : t)))
			await loadTasks()
		} catch (err) {
			console.error(err)
			setTasksError("Failed to update task status")
		}
	}

	const handleCloseModal = () => {
		setShowAddModal(false)
		setEditingTask(null)
		setNewTaskTitle("")
		setNewTaskDuration(25)
		setNewTaskType("memory")
	}

        const handleStartTask = async (task: DailyPlanTaskDTO) => {
		await loadTasks()
		selectTask(task.id, task.durationMinutes, {
			title: task.title,
			type: task.type as any,
			duration: task.durationMinutes,
			completed: task.status === "completed",
			tags: task.tags ?? [],
		})

		if (task.scriptId) {
			const query = new URLSearchParams({
				scriptId: task.scriptId,
				...(task.knowledgeId ? { knowledgeId: task.knowledgeId } : {}),
			}).toString()
			navigate(`/game/script-learning?${query}`, {
				state: { scriptId: task.scriptId, knowledgeId: task.knowledgeId },
			})
 		} else if (task.knowledgeId) {
 			navigate("/knowledge/concepts/compare")
 		} else {
 			navigate("/plan-workflow/work-timer")
 		}
	}

	const getTaskTypeLabel = (task: DailyPlanTaskDTO) => {
		if (task.scriptId) return "Module"
		if (task.knowledgeId) return "Concept"
		return "Task"
	}

	const getTaskDisplayTitle = (task: DailyPlanTaskDTO) => {
		if (task.title && task.title.trim()) return task.title
		if (task.scriptId && task.knowledgeId) return "Script concept review"
		if (task.scriptId) return "Script review"
		if (task.knowledgeId) return "Concept review"
		return "General study"
	}

	const getTaskContextLabel = (task: DailyPlanTaskDTO) => {
		if (task.scriptId && task.knowledgeId) return "Script + concept"
		if (task.scriptId) return "Script review"
		if (task.knowledgeId) return "Concept review"
		return "General study"
	}

	// render each timeline card with status pill, edit/start buttons and delete-x
	const renderBlocks = (taskList: DailyPlanTaskDTO[]) =>
		taskList.map((task, idx) => {
			const isScript = task.type === "script"
			const isDone = task.status === "completed"
			const isInProgress = task.status === "in-progress"

			const typeLabel = getTaskTypeLabel(task)
			const showTitle = getTaskDisplayTitle(task)

			const isPersistent = isPersistentTask(task)

			return (
				<Card
					key={task.id}
					className={
						"relative border-[#e0d5c4] bg-[#fdfaf4] p-5 sm:p-6 transition hover:border-[#c49a6c] hover:shadow-sm rounded-xl " +
						(isInProgress ? "ring-1 ring-[#c49a6c]/30" : "")
					}
				>
							{isPersistent && (
								<button
									className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
									title="Delete this task"
									onClick={() => {
										if (window.confirm("Are you sure you want to delete this task?")) {
											handleDeleteTask(task.id)
										}
									}}
								>
									<X size={16} />
								</button>
							)}
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<div className="rounded-md bg-[#ebe3d7] px-2 py-0.5 text-[11px] text-slate-600">
											{task.durationMinutes} min
										</div>
										<div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
											{typeLabel}
										</div>
									</div>
									<h3 className="mt-2 text-[15px] font-semibold text-slate-900">{showTitle}</h3>
									<p className="mt-1 text-[12px] text-slate-600">
										{isScript
											? "Advance the story and weave in new knowledge points."
											: "Follow this focused block, you can still adjust details later."}
									</p>
								</div>
								<div className="flex flex-col items-end gap-2">
									<span
							onClick={() => isPersistent && handleCompleteTask(task.id)}
						className={
							"task-status cursor-pointer rounded-full px-2.5 py-0.5 text-[10px] font-medium transition " +
							(isDone
								? "bg-emerald-200 text-emerald-900"
								: isInProgress
									? "bg-amber-200 text-amber-900"
									: "bg-[#c49a6c] text-white")
						}
						style={{ cursor: isPersistent ? "pointer" : "not-allowed" }}
					>
										{isDone ? "Done" : isInProgress ? "In progress" : "Ready"}
									</span>
									<div className="mt-3 flex gap-2 text-[11px] mr-2">
										<Button variant="secondary" className="h-9 min-w-[94px] rounded-lg border-[#c49a6c] px-4 text-[11px] text-[#c49a6c] hover:bg-[#c49a6c] hover:text-white" onClick={() => handleStartTask(task)}>
											{idx === 0 ? "Start learning" : isDone ? "Review" : "Start"}
										</Button>
										<Button
							variant="secondary"
							className="h-9 min-w-[94px] rounded-lg border-[#c49a6c] px-4 text-[11px] text-[#c49a6c] hover:bg-[#c49a6c] hover:text-white"
							onClick={() => handleEditTask(task)}
						>
							Edit
						</Button>
					</div>
								</div>
							</div>
						</Card>
					)
		})

	const fallbackTasks: DailyPlanTaskDTO[] = MOCK_BLOCKS.map((block, idx) => {
		const normalizedType = block.mode === "script" ? "script" : block.mode === "study" ? "memory" : "logic"
		return {
			id: String(idx),
			title: block.label,
			type: normalizedType as any,
			status: block.status === "done" ? "completed" : block.status === "in-progress" ? "in-progress" : "pending",
			durationMinutes: 25,
			userId: "",
		}
	})

	const displayTasks = dailyTasks.length > 0 ? dailyTasks : fallbackTasks.slice(0, 5)

	const completedBlocks = displayTasks.filter(t => t.status === "completed").length
	const totalBlocks = displayTasks.length
	const totalMinutes = displayTasks.reduce((acc, t) => acc + t.durationMinutes, 0)

	return (
		<div className="min-h-screen text-slate-900">
			<main className="mx-auto w-full max-w-7xl h-[calc(100vh-4rem)] overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
				<div className="border-b border-[#e0d5c4] pb-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h1 className="text-3xl font-bold tracking-tight text-slate-900">Daily plan</h1>
							<p className="mt-2 text-base text-slate-700">
								Fine-grained plan for <span className="font-semibold">{selectedDay}</span>. This is what you
								actually do today, block by block.
							</p>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<Button variant="secondary" className="h-9 rounded-full border-[#d3c4ae] px-4">
								Export
							</Button>
							<Button variant="primary" className="h-9 rounded-full bg-[#b0703c] px-4 text-sm text-white">
								Save snapshot
							</Button>
						</div>
					</div>

					<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
						<Button variant="secondary" className="h-9 rounded-full border-none bg-[#e7dfd1] px-4 hover:bg-[#ddd2c0]">
							Plan history
						</Button>
						<Button variant="secondary" className="h-9 rounded-full border-none bg-[#f2ece1] px-4 hover:bg-[#e6ddcd]">
							Mastery dashboard
						</Button>
						<Button variant="secondary" className="h-9 rounded-full border-none bg-[#f2ece1] px-4 hover:bg-[#e6ddcd]">
							Mistake collection
						</Button>
						<Button variant="secondary" className="h-9 rounded-full border-none bg-[#f2ece1] px-4 hover:bg-[#e6ddcd]">
							Settings
						</Button>
					</div>
				</div>

				{/* Cozy banner & global progress */}
				<section className="mt-6 space-y-5">
					<Card className="border-[#e0d5c4] bg-[#fdf5e7] p-6">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-start gap-3">
								<div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#c49a6c] text-white shadow-sm">
									<span className="text-lg">★</span>
								</div>
								<div>
									<div className="text-xs font-semibold uppercase tracking-wide text-[#8a5d34]">New plan is ready</div>
									<div className="mt-1 text-sm text-slate-800">Blocks are arranged to balance focus and recovery. You can still tweak below.</div>
								</div>
							</div>
							<div className="flex flex-col items-start gap-2 text-xs sm:items-end">
								<div className="text-slate-700">{completedBlocks} / {totalBlocks} blocks locked in</div>
								<Button variant="secondary" className="h-8 rounded-full border-[#c49a6c] px-3 text-[11px] text-[#8a5d34] hover:bg-[#c49a6c] hover:text-white">Refresh from AI</Button>
							</div>
						</div>
					</Card>

					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm text-slate-700">
							<span>Overall focus load today</span>
							<span>≈ {totalMinutes} min planned</span>
						</div>
						{totalMinutes > 600 && (
							<div className="text-xs font-medium text-red-600 bg-red-50 p-2 rounded-md">
								⚠️ Warning: Planned time exceeds 10 hours. Consider reducing tasks to avoid burnout or fatigue.
							</div>
						)}
						<div className="h-2 overflow-hidden rounded-full bg-[#e0d5c4]">
							<div
								className="h-full bg-[#b0703c]"
								style={{ width: `${Math.min(100, (completedBlocks / Math.max(1, totalBlocks)) * 100)}%` }}
							/>
						</div>
					</div>
				</section>				
				{/* Main two-column layout */}
				<div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
					{/* Left column: timeline blocks */}
					<section className="space-y-4">
						<Card className="border-[#e0d5c4] bg-[#fdfaf4] p-6">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 className="text-sm font-semibold text-slate-900">Today&apos;s timeline</h2>
									<p className="mt-1 text-xs text-slate-700">
										From first block to last. Script-based learning and classic study blocks share one view.
									</p>
								</div>
								<div className="flex flex-wrap gap-2 text-[11px]">
									<div className="flex items-center gap-1">
										<span className="inline-block h-2 w-2 rounded-full bg-[#b0703c]" />
										<span>Script-learning</span>
									</div>
									<div className="flex items-center gap-1">
										<span className="inline-block h-2 w-2 rounded-full bg-[#6b7b8c]" />
										<span>Study</span>
									</div>
								</div>
							</div>
						</Card>

						<div className="space-y-3">
							{tasksError && <p className="text-sm text-red-600">{tasksError}</p>}

							{tasksLoading ? (
								<p className="px-5 py-3 text-center text-sm text-slate-500">Loading tasks...</p>
							) : (
								renderBlocks(displayTasks)
							)}
						</div>
					</section>

					{/* Right column: micro-goals & quick adjustments */}
					<section className="space-y-4">
						<Card className="border-[#e0d5c4] bg-[#fdfaf4] p-6">
							<div className="mb-2 flex items-center justify-between">
								<h2 className="text-sm font-semibold text-slate-900">Today&apos;s micro-goals</h2>
								<Button 
									variant="secondary" 
									className="text-[11px]"
									onClick={() => setShowAddModal(true)}
								>
									Add goal
								</Button>
							</div>
							<p className="mb-3 text-[11px] text-slate-600">
								Small, clear steps that match your current capacity. You can drag or edit them later (planned).
							</p>
							<div className="rounded-lg border border-[#e0d5c4] bg-white">
								<div className="flex items-center justify-between gap-3 border-b border-[#e0d5c4] px-3 py-2.5 text-xs font-medium text-slate-700">
									<h3 className="flex flex-1 items-center gap-2 font-medium text-[#463d32]">
										<Target className="h-4 w-4 text-[#8b7355]" />
										Micro-Goals
									</h3>
									<div className="rounded-full border border-[#d5c3aa] bg-[#fbf9f6] px-2 py-0.5 text-[10px] text-[#8b7355]">
										{completedBlocks}/{totalBlocks} Done
									</div>
								</div>
								<div className="flex-1 overflow-y-auto pr-3 pb-6">
									<div className="space-y-4">
										<ul className="divide-y divide-[#e0d5c4] rounded-lg border border-[#e0d5c4] bg-white text-xs">
											{displayTasks.map(goal => (
												<li key={goal.id} className="group flex items-center justify-between gap-3 px-3 py-2.5">
													<div className="flex items-center gap-3">
														<span
															className={
																goal.status === "in-progress"
																	? "mt-0.5 h-3 w-3 rounded-full bg-amber-400"
																	: "mt-0.5 h-3 w-3 rounded-full bg-slate-300"
															}
														/>
														<div className="flex-1">
															<div className="text-[13px] font-semibold text-slate-900">{getTaskDisplayTitle(goal)}</div>
															<div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
																<span>{getTaskContextLabel(goal)}</span>
																<span>· {goal.durationMinutes} min</span>
																<span
																	className={
																		"rounded-full px-2 py-0.5 text-[10px] font-medium " +
																		(goal.type === "memory" || (goal.type as string) === "study"
																			? "bg-violet-50 text-violet-700"
																			: (goal.type as string) === "review"
																			? "bg-emerald-50 text-emerald-700"
																			: "bg-amber-50 text-amber-700")
																	}
																>
																	{goal.type}
																</span>
															</div>
														</div>
													</div>
													<div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100 items-center">
														<Button
															variant="secondary"
															className="h-7 px-2 text-[11px]"
															onClick={() => handleEditTask(goal)}
															title="Edit"
														>
															Edit
														</Button>
														{goal.scriptId && (
															<Button
																variant="secondary"
																className="h-7 px-2 text-[11px] border border-slate-400 text-slate-700 hover:bg-slate-100"
																onClick={() => handleStartTask(goal)}
																title="Play script"
															>
																🎮 Play
															</Button>
														)}
													</div>
												</li>
											))}
										</ul>
									</div>
								</div>
							</div>
						</Card>

						<Card className="border-[#e0d5c4] bg-[#fdfaf4] p-6">
							<h2 className="mb-2 text-sm font-semibold text-slate-900">Quick adjustments</h2>
							<p className="mb-3 text-[11px] text-slate-600">
								If today feels too heavy or too light, adjust with one tap. Detailed tuning lives in Study planner.
							</p>
							<div className="grid gap-2 text-xs sm:grid-cols-2">
								<Button
									variant="secondary"
									className="border-[#c49a6c] text-[#c49a6c] hover:bg-[#c49a6c] hover:text-white"
								>
									Lighten today (keep essentials)
								</Button>
								<Button
									variant="secondary"
									className="border-[#c49a6c] text-[#c49a6c] hover:bg-[#c49a6c] hover:text-white"
								>
									Intensify today (add stretch goal)
								</Button>
								<Button
									variant="secondary"
									className="border-[#c49a6c] text-[#c49a6c] hover:bg-[#c49a6c] hover:text-white"
								>
									Swap in a script-learning block
								</Button>
								<Button
									variant="secondary"
									className="border-[#c49a6c] text-[#c49a6c] hover:bg-[#c49a6c] hover:text-white"
								>
									Jump to Study planner
								</Button>
							</div>
						</Card>
					</section>
				</div>
			</main>

			{showAddModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
					<Card className="w-full max-w-md border-[#e0d5c4] p-5">
						<div className="space-y-5">
							<h2 className="text-lg font-semibold text-slate-900">
								{editingTask ? "Edit task" : "Add new task"}
							</h2>

							{tasksError && <p className="text-sm text-red-600">{tasksError}</p>}

							<div className="space-y-4">
								<div className="space-y-2">
									<label className="block text-sm font-medium text-slate-700">Task title</label>
									<input
										type="text"
										value={newTaskTitle}
										onChange={(e) => setNewTaskTitle(e.target.value)}
										className="mt-1 w-full rounded border border-[#e0d5c4] px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#b0703c]"
										placeholder="e.g., Understanding TCP protocol"
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<label className="block text-sm font-medium text-slate-700">Duration (minutes)</label>
										<input
											type="number"
											min="5"
											max="120"
											value={newTaskDuration}
											onChange={(e) => setNewTaskDuration(Math.max(5, parseInt(e.target.value) || 25))}
											className="mt-1 w-full rounded border border-[#e0d5c4] px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#b0703c]"
										/>
									</div>
									<div className="space-y-2">
										<label className="block text-sm font-medium text-slate-700">Type</label>
										<select
											value={newTaskType}
											onChange={(e) => setNewTaskType(e.target.value as any)}
											className="mt-1 w-full rounded border border-[#e0d5c4] px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#b0703c]"
										>
											<option value="memory">Memory</option>
											<option value="logic">Logic</option>
											<option value="script">Script</option>
											<option value="understanding">Understanding</option>
										</select>
									</div>
								</div>
							</div>

							<div className="flex gap-3 pt-3">
								<Button
									variant="secondary"
									className="flex-1"
									onClick={handleCloseModal}
									disabled={isSaving}
								>
									Cancel
								</Button>
								<Button
									variant="primary"
									className="flex-1"
									onClick={editingTask ? handleSaveEdit : handleAddTask}
									disabled={isSaving}
								>
									{isSaving ? "Saving..." : editingTask ? "Save changes" : "Add task"}
								</Button>
							</div>
						</div>
					</Card>
				</div>
			)}
		</div>
	)
}

export default DailyPlanPage
