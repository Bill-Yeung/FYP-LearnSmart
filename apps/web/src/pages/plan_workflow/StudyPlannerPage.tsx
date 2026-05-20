import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Button } from "../../components"
import * as planWorkflowApi from "../../api/planWorkflow"
import type { PlanSummaryDTO } from "../../types/planWorkflow.dto"

export function StudyPlannerPage() {
	const navigate = useNavigate()
	const [planSummary, setPlanSummary] = useState<PlanSummaryDTO | null>(null)
	const [summaryLoading, setSummaryLoading] = useState(false)
	const [summaryError, setSummaryError] = useState<string | null>(null)
	const [generateLoading, setGenerateLoading] = useState(false)
	const [generateError, setGenerateError] = useState<string | null>(null)

	const loadSummary = async () => {
		setSummaryLoading(true)
		setSummaryError(null)
		try {
			const data = await planWorkflowApi.getPlanSummary()
			setPlanSummary(data)
		} catch (err) {
			console.error(err)
			setSummaryError("Unable to load plan summary")
		} finally {
			setSummaryLoading(false)
		}
	}

	const handleGenerateWeeklyPlan = async () => {
		setGenerateLoading(true)
		setGenerateError(null)
		try {
			await planWorkflowApi.generateWeeklyPlan()
			await loadSummary()
		} catch (err) {
			console.error(err)
			setGenerateError("Unable to generate weekly plan")
		} finally {
			setGenerateLoading(false)
		}
	}

	useEffect(() => {
		loadSummary()
	}, [])

const goalsToRender = planSummary?.longTermGoals && planSummary.longTermGoals.length > 0
  ? planSummary.longTermGoals
  : [];

const weekTemplateToRender = planSummary?.weekTemplate && planSummary.weekTemplate.length > 0
  ? planSummary.weekTemplate
  : [];

const aiPlanToRender = planSummary?.aiPlan
  ? planSummary.aiPlan
  : { basedOn: "", strengths: [], improvements: [], actions: [] };
	const handleDayClick = (dayIdentifier: string) => {
		navigate(`/plan-workflow/daily-plan?day=${encodeURIComponent(dayIdentifier)}`)
	}

	const formatDayLabel = (item: { day: string; date?: string }) => {
		if (!item.date) return item.day
		const parsed = new Date(item.date)
		if (isNaN(parsed.getTime())) return item.day
		return `${parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${item.day}`
	}

	const handleBrainDashboardClick = () => navigate("/plan-workflow")
	const handleDailyPlanClick = () => navigate("/plan-workflow/daily-plan")
	const handleFocusTimerClick = () => navigate("/plan-workflow/work-timer")
	const handleScriptLearningClick = () => navigate("/game/script-learning")
	const handleSendNext7Days = () => navigate("/plan-workflow/daily-plan")

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
			<main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
								Study planner
							</h1>
							<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
								Visual overview of your medium-term goals and weekly rhythm.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-[11px]">
							<Button
								variant="secondary"
								className="h-7 rounded-full border-slate-200 px-2.5 py-0 text-[11px] font-medium dark:border-slate-700"
							>
								Reset plan
							</Button>
							<Button
								variant="primary"
								onClick={handleGenerateWeeklyPlan}
								disabled={generateLoading}
								className="h-7 rounded-full px-3 py-0 text-[11px] font-semibold shadow-sm"
							>
								{generateLoading ? "Generating…" : planSummary?.weekTemplate?.length ? "Refresh weekly plan" : "Generate weekly plan"}
							</Button>
						</div>
					</div>
					{generateError ? (
					<div className="text-xs text-red-600 dark:text-red-400">{generateError}</div>
				) : null}
 				{/* Cross-view navigation */}
					<div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
						<Button
							variant="secondary"
							className="h-7 rounded-full border-none bg-slate-100/70 px-2.5 py-0 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
							onClick={handleBrainDashboardClick}
						>
							Brain dashboard
						</Button>
						<Button
							variant="secondary"
							className="h-7 rounded-full border-none bg-slate-100/70 px-2.5 py-0 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
							onClick={handleDailyPlanClick}
						>
							Daily plan
						</Button>
						<Button
							variant="secondary"
							className="h-7 rounded-full border-none bg-slate-100/70 px-2.5 py-0 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
							onClick={handleFocusTimerClick}
						>
							Focus timer
						</Button>
						<Button
							variant="secondary"
							className="h-7 rounded-full border-none bg-slate-100/70 px-2.5 py-0 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
							onClick={handleScriptLearningClick}
						>
							Script-learning
						</Button>
					</div>
				</div>

				{/* Main content */}
				<div className="mt-6 space-y-5">
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
						<Card className="shadow-sm rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
							<div className="flex items-center justify-between gap-3">
								<div>
									<h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Weekly calendar</h2>
									<p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
										One-week grid. Each day shows its main theme and how many focus blocks you plan.
									</p>
								</div>
								<Button variant="secondary" className="text-xs">Edit template</Button>
							</div>
							<div className="mt-4 grid gap-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
								{weekTemplateToRender.map(day => (
									<div
										key={day.date ?? day.day}
										className="flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-sky-500/60 dark:hover:bg-slate-900"
										onClick={() => handleDayClick(day.date ?? day.day)}
									>
										<div className="flex items-center justify-between gap-2">
											<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
												{formatDayLabel(day)}
											</span>
											<span
												className={
													day.blocks >= 3
														? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
														: day.blocks === 0
															? "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-300"
															: "rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-200"
													}
											>
												{day.blocks === 0 ? "Rest" : `${day.blocks} blocks`}
											</span>
										</div>
										<div className="mt-2 flex-1">
											<div className="line-clamp-4 text-sm text-slate-700 dark:text-slate-200">
												{day.focus}
											</div>
										</div>
										<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
											<div
												className="h-full rounded-full bg-sky-400 dark:bg-sky-500"
												style={{ width: `${Math.min(100, day.blocks * 30)}%` }}
											/>
										</div>
									</div>
								))}
							</div>
						</Card>

						<Card className="shadow-sm rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
							<div className="mb-2 flex items-center justify-between gap-3">
								<h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">AI planning helper</h2>
								<Button variant="secondary" className="text-xs" onClick={handleGenerateWeeklyPlan} disabled={generateLoading}>
									{generateLoading ? "Generating…" : "Regenerate plan"}
								</Button>
							</div>
							<p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
								Quick sketch of how AI will turn your goals and weekly grid into daily plans.
							</p>
							<div className="space-y-3 text-xs text-slate-700 dark:text-slate-200">
								<div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-100">
									<span className="font-semibold">Based on:</span> {aiPlanToRender.basedOn}
								</div>
								{aiPlanToRender.strengths && aiPlanToRender.strengths.length > 0 && (
									<div>
										<div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
											Strengths
										</div>
										<ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-600 dark:text-slate-300">
											{aiPlanToRender.strengths.map((str, idx) => (
												<li key={idx}>{str}</li>
											))}
										</ul>
									</div>
								)}
								{aiPlanToRender.improvements && aiPlanToRender.improvements.length > 0 && (
									<div>
										<div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
											Improvements
										</div>
										<ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-600 dark:text-slate-300">
											{aiPlanToRender.improvements.map((imp, idx) => (
												<li key={idx}>{imp}</li>
											))}
										</ul>
									</div>
								)}
								<div>
									<div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
										Planned actions
									</div>
									<ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-600 dark:text-slate-300">
										{aiPlanToRender.actions.map((action, idx) => (
											<li key={idx}>{action}</li>
										))}
									</ul>
								</div>
								<div className="pt-1">
									<Button variant="primary" className="text-xs" onClick={handleSendNext7Days}>
										Send next 7 days to Daily plan
									</Button>
								</div>
							</div>
						</Card>
					</div>
					<Card className="shadow-sm">
						<div className="mb-3 flex items-center justify-between gap-3">
							<h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Goals at a glance</h2>
							<Button variant="secondary" className="text-xs">Add / edit goals</Button>
						</div>
						<div className="grid gap-3 text-xs sm:grid-cols-3">
							{summaryLoading && <div>Loading...</div>}
							{summaryError && <div className="text-red-600 text-sm">{summaryError}</div>}
							{goalsToRender.map(goal => (
								<div
									key={goal.id}
									className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60"
								>
									<div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
										{goal.horizon === "2-weeks" && "~2 weeks"}
										{goal.horizon === "1-month" && "~1 month"}
										{goal.horizon === "3-months" && "~3 months"}
									</div>
									<div className="mt-1 line-clamp-2 text-[12px] font-semibold text-slate-900 dark:text-slate-50">
										{goal.label}
									</div>
									<div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
										<span>Progress</span>
										<span>{Math.round(goal.progress * 100)}%</span>
									</div>
									<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
										<div
											className="h-full rounded-full bg-sky-500 transition-all dark:bg-sky-400"
											style={{ width: `${Math.min(100, Math.round(goal.progress * 100))}%` }}
										/>
									</div>
								</div>
							))}
						</div>
					</Card>
				</div>
			</main>
		</div>
	)
}

export default StudyPlannerPage

