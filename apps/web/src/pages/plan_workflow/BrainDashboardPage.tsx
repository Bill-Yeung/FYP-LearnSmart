import React, { useEffect, useState } from "react"
import * as planWorkflowApi from "../../api/planWorkflow"
import type { PlanSummaryDTO } from "../../types/planWorkflow.dto"

// custom hook that hand-draws the radar chart and study heatmap into divs
function useBrainDashboardVisuals(stats?: PlanSummaryDTO | null) {
	useEffect(() => {
		// build the six-axis ability radar svg from current ability scores
		function drawRadarChart() {
			const container = document.getElementById("radarChart")
			if (!container) return
			
			container.innerHTML = ""

			const width = container.clientWidth || 400
			const height = container.clientHeight || 260
			const svgNS = "http://www.w3.org/2000/svg"

			const svg = document.createElementNS(svgNS, "svg")
			svg.setAttribute("width", "100%")
			svg.setAttribute("height", "100%")
			svg.setAttribute("viewBox", `0 0 ${width} ${height}`)

			const abilityScores = stats?.abilityScores || {};
			const memoryScore = abilityScores.memory ?? 0;
			const understandingScore = abilityScores.understanding ?? 0;
			const logicScore = abilityScores.logic ?? 0;
			const associationScore = abilityScores.association ?? 0;
			const applicationScore = abilityScores.application ?? 0;
			const creativityScore = abilityScores.creativity ?? 0;

			const dimensions = [
				{ name: "Memory", score: memoryScore, color: "#38bdf8" },
				{ name: "Understanding", score: understandingScore, color: "#22c55e" },
				{ name: "Logic", score: logicScore, color: "#fb923c" },
				{ name: "Association", score: associationScore, color: "#a855f7" },
				{ name: "Application", score: applicationScore, color: "#f97373" },
				{ name: "Creativity", score: creativityScore, color: "#ec4899" },
			]

			const centerX = width / 2
			const centerY = height / 2
			const radius = Math.min(width, height) * 0.35
			const numCircles = 5
			const angleStep = (Math.PI * 2) / dimensions.length

			for (let i = 1; i <= numCircles; i++) {
				const circleRadius = radius * (i / numCircles)
				const circle = document.createElementNS(svgNS, "circle")
				circle.setAttribute("cx", String(centerX))
				circle.setAttribute("cy", String(centerY))
				circle.setAttribute("r", String(circleRadius))
				circle.setAttribute("fill", "rgba(56,189,248,0.06)")
				circle.setAttribute("stroke", "rgba(56,189,248,0.2)")
				circle.setAttribute("stroke-width", "1")
				svg.appendChild(circle)
			}

			dimensions.forEach((dim, i) => {
				const angle = i * angleStep - Math.PI / 2
				const x = centerX + Math.cos(angle) * radius
				const y = centerY + Math.sin(angle) * radius

				const line = document.createElementNS(svgNS, "line")
				line.setAttribute("x1", String(centerX))
				line.setAttribute("y1", String(centerY))
				line.setAttribute("x2", String(x))
				line.setAttribute("y2", String(y))
				line.setAttribute("stroke", "rgba(56,189,248,0.4)")
				line.setAttribute("stroke-width", "1")
				svg.appendChild(line)

				const labelX = centerX + Math.cos(angle) * (radius + 26)
				const labelY = centerY + Math.sin(angle) * (radius + 26)
				const text = document.createElementNS(svgNS, "text")
				text.setAttribute("x", String(labelX))
				text.setAttribute("y", String(labelY))
				text.setAttribute("fill", "#ffffff")
				text.setAttribute("font-size", "11")
				text.setAttribute("text-anchor", "middle")
				text.setAttribute("dominant-baseline", "middle")
				text.textContent = dim.name
				svg.appendChild(text)
			})

			const points = dimensions
				.map((dim, i) => {
					const angle = i * angleStep - Math.PI / 2
					const scoreRadius = radius * (dim.score / 100)
					const x = centerX + Math.cos(angle) * scoreRadius
					const y = centerY + Math.sin(angle) * scoreRadius
					return `${x},${y}`
				})
				.join(" ")

			const polygon = document.createElementNS(svgNS, "polygon")
			polygon.setAttribute("points", points)
			polygon.setAttribute("fill", "rgba(56,189,248,0.35)")
			polygon.setAttribute("stroke", "#0ea5e9")
			polygon.setAttribute("stroke-width", "2")
			svg.appendChild(polygon)

			dimensions.forEach((dim, i) => {
				const angle = i * angleStep - Math.PI / 2
				const scoreRadius = radius * (dim.score / 100)
				const x = centerX + Math.cos(angle) * scoreRadius
				const y = centerY + Math.sin(angle) * scoreRadius

				const circle = document.createElementNS(svgNS, "circle")
				circle.setAttribute("cx", String(x))
				circle.setAttribute("cy", String(y))
				circle.setAttribute("r", "4")
				circle.setAttribute("fill", dim.color)
				circle.setAttribute("stroke", "white")
				circle.setAttribute("stroke-width", "2")
				svg.appendChild(circle)
			})

			container.innerHTML = ""
			container.appendChild(svg)
		}

		// fill the 90-day heatmap grid with color-coded cells based on study minutes
			function generateHeatmap(dailyData: NonNullable<PlanSummaryDTO["dailyStudyHeatmap"]> = []) {
			const heatmap = document.getElementById("heatmap")
			if (!heatmap) return
			heatmap.innerHTML = ""

			const days = 90
			for (let i = 0; i < days; i++) {
				const dayData = dailyData[i] || { minutes: 0, date: `Day ${i + 1}` }
				const studyTime = typeof dayData.minutes === 'number' ? dayData.minutes : 0
				const dStr = dayData.date || `Day ${i + 1}`

				const cell = document.createElement("div")
				cell.className =
					"h-3.5 w-3.5 rounded-md transition hover:scale-110 hover:shadow-sm" // Tailwind-ish sizing

				let color
				if (studyTime === 0) color = "#f1f5f9"
				else if (studyTime < 15) color = "#bae6fd"
				else if (studyTime < 30) color = "#7dd3fc"
				else if (studyTime < 60) color = "#38bdf8"
				else color = "#0284c7"

				cell.style.backgroundColor = color
				cell.title = `${dStr}: ${studyTime} min`
				heatmap.appendChild(cell)
			}
		}

		const handleResize = () => drawRadarChart()
		drawRadarChart()
		generateHeatmap(stats?.dailyStudyHeatmap || [])
		window.addEventListener("resize", handleResize)

		return () => {
			window.removeEventListener("resize", handleResize)
		}
	}, [stats])
}

export const BrainDashboardPage: React.FC = () => {
	const [summary, setSummary] = useState<PlanSummaryDTO | null>(null)
	const [summaryLoading, setSummaryLoading] = useState(true)
	const [summaryError, setSummaryError] = useState<string | null>(null)

	useBrainDashboardVisuals(summary)

	useEffect(() => {
		const fetchSummary = async () => {
			setSummaryLoading(true)
			setSummaryError(null)
			try {
				const data = await planWorkflowApi.getPlanSummary()
				setSummary(data)
			} catch (err) {
				console.error(err)
				setSummaryError("Unable to load plan summary")
			} finally {
				setSummaryLoading(false)
			}
		}
		fetchSummary()
	}, [])

	const focusToday = summary ? Math.max(0, summary.totalStudyMinutes) : 0
	const taskCompletion = summary ? (summary.totalTasks > 0 ? Math.round((summary.completedTasks / summary.totalTasks) * 100) : 0) : 0
	const abilityScores = summary?.abilityScores ?? {}
	const formatAbilityScore = (key: string) => {
		if (summaryLoading) return "--"
		const value = abilityScores[key]
		return typeof value === "number" ? `${value}%` : "—"
	}

	const formatFocusTime = (mins: number) => {
		if (mins < 60) return `${mins} min`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	return (
		<div className="px-4 py-5 text-slate-900">
			<div className="mx-auto w-full max-w-6xl">
				{/* Header */}
				<header className="flex flex-col gap-4 border-b border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl shadow-sm">
					<div>
						<h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
							🧠 Welcome back!
						</h1>
						<p className="mt-1 text-xs text-slate-500 sm:text-sm">Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} · Personalized cognitive insights</p>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<div className="flex gap-4 text-right text-xs sm:text-sm">
							<div>
								<div className="text-base font-semibold text-sky-500 sm:text-lg">{summaryLoading ? "--" : formatFocusTime(focusToday)}</div>
								<div className="text-[11px] text-slate-500">Focus today</div>
							</div>
							<div>
								<div className="text-base font-semibold text-emerald-500 sm:text-lg">{summaryLoading ? "--" : `${summary?.total_scripts ?? 0} scripts`}</div>
								<div className="text-[11px] text-slate-500">Total scripts</div>
							</div>
							<div>
								<div className="text-base font-semibold text-amber-500 sm:text-lg">{summaryLoading ? "--" : `${summary?.masteryDistribution?.mastered ?? 0} mastered`}</div>
								<div className="text-[11px] text-slate-500">Mastered concepts</div>
							</div>
						</div>
						<button
							type="button"
							className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-sky-500/40 transition hover:translate-y-0.5 hover:shadow-lg sm:text-sm"
						>
							<span>🚀</span>
							<span>Smart reinforce</span>
						</button>
					</div>
				</header>
				{summaryError && (
					<div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{summaryError}
					</div>
				)}

				{/* Main content */}
				<div className="mt-4 grid gap-5 lg:grid-cols-3">
					{/* Left: Ability radar */}
					<section className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50/80 shadow-sm">
						<div className="flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 rounded-t-2xl">
							<h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
								<span>📊</span>
								<span>Ability radar</span>
							</h3>
						</div>
						<div className="flex-1 space-y-4 px-4 py-4">
							<div
								id="radarChart"
								className="h-64 w-full rounded-2xl bg-slate-900/95 p-4 shadow-inner shadow-slate-900/40"
							/>
							<div className="space-y-1.5 text-xs">
								<div className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2">
									<div className="flex items-center gap-2">
										<span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
										<span className="font-medium text-slate-700">Memory</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-semibold text-slate-900">{formatAbilityScore("memory")}</span>
									</div>
								</div>
								<div className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2">
									<div className="flex items-center gap-2">
										<span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
										<span className="font-medium text-slate-700">Understanding</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-semibold text-slate-900">{formatAbilityScore("understanding")}</span>
									</div>
								</div>
								<div className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2">
									<div className="flex items-center gap-2">
										<span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
										<span className="font-medium text-slate-700">Logical reasoning</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-semibold text-slate-900">{formatAbilityScore("logic")}</span>
									</div>
								</div>
								<div className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2">
									<div className="flex items-center gap-2">
										<span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
										<span className="font-medium text-slate-700">Association</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-semibold text-slate-900">{formatAbilityScore("association")}</span>
									</div>
								</div>
								<div className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2">
									<div className="flex items-center gap-2">
										<span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
										<span className="font-medium text-slate-700">Application</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-semibold text-slate-900">{formatAbilityScore("application")}</span>
									</div>
								</div>
								<div className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2">
									<div className="flex items-center gap-2">
										<span className="h-2.5 w-2.5 rounded-full bg-pink-400" />
										<span className="font-medium text-slate-700">Creativity</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-semibold text-slate-900">{formatAbilityScore("creativity")}</span>
									</div>
								</div>
							</div>
						</div>
					</section>

					{/* Middle: Progress overview */}
					<section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm">
						<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 rounded-t-2xl">
							<h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
								<span>📈</span>
								<span>Study progress</span>
							</h3>
						</div>
						<div className="flex-1 space-y-5 px-4 py-4">
							<div>
								<div className="text-xs font-medium text-slate-600">
									Study heatmap (last 90 days)
								</div>
								<div className="mt-2 rounded-2xl bg-slate-950/90 p-3 shadow-inner shadow-slate-900/60">
									<div
										id="heatmap"
										className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1.5 justify-items-center"
									/>
									<div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-300">
										<span className="text-[10px] text-slate-400">Less</span>
										<div className="flex items-center gap-1">
											<span className="h-3 w-3 rounded-[4px] bg-slate-700" />
											<span className="h-3 w-3 rounded-[4px] bg-emerald-500/70" />
											<span className="h-3 w-3 rounded-[4px] bg-emerald-400" />
											<span className="h-3 w-3 rounded-[4px] bg-emerald-300" />
											<span className="h-3 w-3 rounded-[4px] bg-emerald-200" />
										</div>
										<span className="text-[10px] text-slate-400">More</span>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3 text-center text-xs sm:text-sm">
								<div className="rounded-2xl bg-slate-50 px-3 py-3 shadow-sm">
									<div className="text-xl font-semibold text-sky-500 sm:text-2xl">{summaryLoading ? "--" : `${summary?.total_scripts ?? 0}`}</div>
									<div className="text-[11px] text-slate-500">Total scripts</div>
									<div className="mt-1 text-[11px] text-emerald-500">All modules</div>
								</div>
								<div className="rounded-2xl bg-slate-50 px-3 py-3 shadow-sm">
									<div className="text-xl font-semibold text-emerald-500 sm:text-2xl">{summaryLoading ? "--" : `${summary?.completed_scenes ?? 0}`}</div>
									<div className="text-[11px] text-slate-500">Completed scenes</div>
									<div className="mt-1 text-[11px] text-emerald-500">Milestones</div>
								</div>
								<div className="rounded-2xl bg-slate-50 px-3 py-3 shadow-sm">
									<div className="text-xl font-semibold text-violet-500 sm:text-2xl">{summaryLoading ? "--" : taskCompletion}%</div>
									<div className="text-[11px] text-slate-500">Task completion</div>
									<div className="mt-1 text-[11px] text-emerald-500">Progress rate</div>
								</div>
								<div className="rounded-2xl bg-slate-50 px-3 py-3 shadow-sm">
									<div className="text-xl font-semibold text-amber-500 sm:text-2xl">{summaryLoading ? "--" : `${summary?.answered_questions ?? 0}`}</div>
									<div className="text-[11px] text-slate-500">Answered questions</div>
									<div className="mt-1 text-[11px] text-emerald-500">Exercises</div>
								</div>
							</div>
						</div>
					</section>
					{/* Right: AI insights */}
					<section className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50/80 shadow-sm">
						<div className="flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 rounded-t-2xl">
							<h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
								<span>🤖</span>
								<span>Data-Driven insights & plan</span>
							</h3>
						</div>
						<div className="flex-1 space-y-4 px-4 py-4">
							<div className="rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4 shadow-sm">
								<div className="space-y-2 text-xs sm:text-sm">
									<div>
										<p className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
											<span>✅</span>
											<span>Strengths</span>
										</p>
										<ul className="space-y-1.5 text-[12px] text-emerald-700">
												{summary?.aiPlan?.strengths?.length ? summary.aiPlan.strengths.map((str, i) => (
													<li key={i} className="flex items-center gap-2">
														<span>✨</span>
														<span>{str}</span>
													</li>
												)) : (
													<li className="flex items-center gap-2">
														<span>—</span>
														<span>{summaryLoading ? "Loading strengths..." : "No strengths available yet."}</span>
													</li>
												)}
										</ul>
									</div>

									<div className="mt-3">
										<p className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
											<span>⚠️</span>
											<span>To improve</span>
										</p>
										<ul className="space-y-1.5 text-[12px] text-rose-700">
												{summary?.aiPlan?.improvements?.length ? summary.aiPlan.improvements.map((imp, i) => (
													<li key={i} className="flex items-center gap-2">
														<span>🔍</span>
														<span>{imp}</span>
													</li>
												)) : (
													<li className="flex items-center gap-2">
														<span>—</span>
														<span>{summaryLoading ? "Loading improvement areas..." : "No improvement areas available yet."}</span>
													</li>
												)}
										</ul>
									</div>
								</div>
							</div>

							<div className="space-y-3 text-xs sm:text-sm">
								<div>
									<p className="mb-2 text-[13px] font-semibold text-slate-800">
										🎯 Recommended training plan
									</p>
									<ul className="space-y-1.5">
											{summary?.aiPlan?.actions?.length ? summary.aiPlan.actions.map((act, i) => (
												<li key={i} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
													<span>🎯</span>
													<span>{act}</span>
												</li>
											)) : (
												<li className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
													<span>—</span>
													<span>{summaryLoading ? "Loading recommendations..." : "No recommended actions available yet."}</span>
												</li>
											)}
									</ul>
								</div>

									{summary?.aiPlan?.predictive_insight && (
										<div className="rounded-2xl bg-slate-900 px-3 py-3 text-[12px] text-slate-100 shadow-sm">
											<p className="mb-1 text-[13px] font-semibold">📈 Predictive insight</p>
											<p>{summary.aiPlan.predictive_insight}</p>
										</div>
									)}
							</div>
						</div>
					</section>
				</div>

				{/* Timeline */}
				<section className="mx-0 mb-2 mt-3 rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
					<div className="mb-3 flex items-center gap-2">
						<h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
							<span>📝</span>
							<span>Recent activity timeline</span>
						</h3>
					</div>
					<ol className="space-y-3 text-xs sm:text-sm">
						{summary?.recentActivities?.length ? (
							summary.recentActivities.map((act, i) => (
								<li key={i} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
									<div className="w-24 flex-shrink-0 text-[11px] font-medium text-slate-500">{act.time}</div>
									<div className="flex-1">
										<p className="text-[13px] font-medium text-slate-800">
											{act.title}
										</p>
										{act.delta && (
											<span className="mt-1 inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700">
												{act.type} {act.delta}
											</span>
										)}
									</div>
								</li>
							))
						) : (
							<div className="text-center py-4 text-slate-400">No recent activities available.</div>
						)}
					</ol>
				</section>
			</div>
		</div>
	)
}

export default BrainDashboardPage
