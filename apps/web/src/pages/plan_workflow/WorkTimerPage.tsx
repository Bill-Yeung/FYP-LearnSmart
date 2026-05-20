import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "../../components";
import type { TaskType } from "../../types/planWorkflow.dto";
import { useTimer } from "../../contexts";
const typeLabel: Record<TaskType, string> = {
	memory: "Memory Task",
	logic: "Logic Task",
	script: "Script Task",
	understanding: "Understanding Task",
};

const typeClass: Record<TaskType, string> = {
	memory: "bg-sky-100 text-sky-800",
	logic: "bg-cyan-100 text-cyan-800",
	script: "bg-amber-100 text-amber-800",
	understanding: "bg-emerald-100 text-emerald-800",
};

const formatHoursMinutes = (totalSeconds: number): string => {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	return `${hours}h ${minutes}m`;
};

const formatTimeRemaining = (seconds: number): string => {
	if (seconds <= 0) return "0 min";
	const minutes = Math.ceil(seconds / 60);
	return `${minutes} min`;
};

const WorkTimerPage = () => {
        const navigate = useNavigate();
        const {
                tasks, loading, error, activeTask,
                isRunning, isWorkSession, sessionCount, timeLeft, totalFocusSeconds,
                startTimer, pauseTimer, skipSession, selectTask, loadTasks, ambientSound, setAmbientSound
        } = useTimer();

        useEffect(() => {
                loadTasks(true);
             
        }, []);

        const [focusModeOn, setFocusModeOn] = useState(false);
        const [syncTime, setSyncTime] = useState<Date>(new Date());

        const wakeLockRef = useRef<any>(null);

        // ask for browser notification permission
        useEffect(() => {
                if ("Notification" in window) {
                        Notification.requestPermission();
                }
        }, []);

        // request a screen wake-lock while focus mode is on so the screen stays awake
        useEffect(() => {
                const toggleWakeLock = async () => {
                        if (focusModeOn && "wakeLock" in navigator) {
                                try {
                                        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
                                } catch (err) {
                                        console.warn("Wake Lock error:", err);
                                }
                        } else if (!focusModeOn && wakeLockRef.current) {
                                wakeLockRef.current.release();
                                wakeLockRef.current = null;
                        }
                };
                toggleWakeLock();
        }, [focusModeOn]);

        const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

        useEffect(() => {
                const id = window.setInterval(() => setSyncTime(new Date()), 60000);
                return () => window.clearInterval(id);
        }, []);

        const handleSelectTask = (taskId: string) => selectTask(taskId);
        const handleStart = startTimer;
        const handlePause = pauseTimer;
        const handleSkip = () => {
                if (window.confirm("Are you sure you want to skip the current session?")) {
                        skipSession();
                }
        };

        const timeDisplay = useMemo(() => {
		const minutes = Math.floor(timeLeft / 60);
		const seconds = timeLeft % 60;
		return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}, [timeLeft]);

	const totalFocusDisplay = useMemo(() => formatHoursMinutes(totalFocusSeconds), [totalFocusSeconds]);

	const syncTimeDisplay = useMemo(() => {
		const hours = syncTime.getHours().toString().padStart(2, "0");
		const minutes = syncTime.getMinutes().toString().padStart(2, "0");
		return `${hours}:${minutes}`;
	}, [syncTime]);

	const completedCount = safeTasks.filter(t => t.completed).length;
	const totalTasks = safeTasks.length;
	const taskCompletionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

	const nextBreakTimeDisplay = useMemo(() => {
		if (!isWorkSession) {
			return "In progress";
		}
		return formatTimeRemaining(timeLeft);
	}, [isWorkSession, timeLeft]);

	return (
		<div className="px-6 py-4 text-slate-900">
			{/* Main three-column layout */}
			<div className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col gap-4 lg:flex-row">
				{/* Left: task control */}
				<section className="flex min-h-[240px] flex-1 flex-col rounded-2xl border border-slate-100 bg-slate-50/80 lg:min-h-0 lg:flex-[0_0_28%]">
					<div className="border-b border-slate-100 bg-white/80 px-5 py-3 rounded-t-2xl">
						<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							<span className="mr-2">📋</span> Today&apos;s tasks ({completedCount}/{totalTasks} done)
						</h3>
					</div>
					<div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-3">
						{loading ? (
							<p className="px-5 py-3 text-center text-sm text-slate-500">Loading tasks...</p>
						) : error ? (
							<p className="px-5 py-3 text-center text-sm text-rose-600">{error}</p>
						) : safeTasks.length > 0 ? (
							safeTasks.map(task => (
								<button
									key={task.id}
									type="button"
									onClick={() => handleSelectTask(task.id)}
									className={
										"w-full rounded-xl border bg-white p-3.5 text-left text-xs shadow-sm transition-all " +
										(task.active
											? "border-sky-300 bg-gradient-to-br from-sky-50 to-slate-50 shadow-md"
											: "border-slate-100 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow")
									}
								>
									<div>
										<span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${typeClass[task.type]}`}>
											{typeLabel[task.type]}
										</span>
										<span className="ml-2 text-[13px] font-semibold text-slate-800">{task.title}</span>
										<div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-600">
											{(task.tags || []).map(tag => (
												<span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5">
													{tag}
												</span>
											))}
										</div>
									</div>
									<div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
										<span>⏱️ {task.duration} min</span>
										<span>{task.completed ? "✅ Completed" : task.active ? "🔄 In progress" : "⏳ Pending"}</span>
									</div>
								</button>
							))
						) : (
							<p className="px-5 py-3 text-center text-sm text-slate-500">No tasks available</p>
						)}
					</div>
				</section>

				{/* Middle: timer core */}
				<section className="flex min-h-[320px] flex-[0_0_44%] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white px-8 py-6">
					<div className="text-center">
						<div className="mb-5">
							<p className="text-xs font-medium uppercase tracking-wide text-slate-400">Focus timer</p>
							<div className="mt-2 text-[72px] font-light leading-none text-slate-900 tabular-nums sm:text-[96px]">
									{timeDisplay}
								</div>
									<div className="mt-3 text-sm text-slate-600 sm:text-base">
									<span
										className={`inline-flex items-center rounded-full px-4 py-1 text-sm font-semibold text-white ${
											isWorkSession ? "bg-sky-500" : "bg-emerald-500"
										}`}
									>
										{isWorkSession ? "Focus session" : "Break"}
									</span>
									<span className="mx-2">•</span>
									<span>
										Pomodoro <span className="font-semibold">{sessionCount}</span>
									</span>
								</div>
							</div>
								<div className="text-sm text-slate-700 text-center">
								<div>
									<strong>Current task: </strong>
									<span>{activeTask ? activeTask.title : "Select a task to start timing"}</span>
								</div>
								{activeTask && (activeTask.scriptId || activeTask.knowledgeId) && (
									<button
										className="mt-3 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 active:scale-95"
										onClick={() => {
											if (activeTask.scriptId) {
												const params = new URLSearchParams({
													scriptId: activeTask.scriptId,
													...(activeTask.knowledgeId ? { knowledgeId: activeTask.knowledgeId } : {}),
												}).toString()
												navigate(`/game/script-learning?${params}`, {
 													state: { scriptId: activeTask.scriptId, knowledgeId: activeTask.knowledgeId }
 												});
											} else {
 												navigate(`/knowledge/concepts/compare`);
 											}
 										}}
 									>
 										📖 Jump to Study Material
 									</button>
 								)}
 							</div>
								<div className="mt-6 flex w-full max-w-md gap-3">
								<Button
									variant="primary"
									className="flex-1 rounded-2xl bg-sky-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-sky-600 disabled:bg-sky-300"
									onClick={handleStart}
								>
									<span>{isRunning ? "Focusing..." : isWorkSession ? "Start focus" : "Start break"}</span>
								</Button>
								<Button
									variant="secondary"
									className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
									onClick={handlePause}
									disabled={!isRunning}
								>
									⏸ Pause
								</Button>
								<Button
									variant="secondary"
									className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-600 disabled:bg-rose-300 disabled:opacity-60"
									onClick={handleSkip}
									disabled={!isRunning}
								>
									⏭ Skip
								</Button>
							</div>
							<div className="mt-10 text-center">
								<div className="text-xs text-slate-500">Total focus time today</div>
								<div className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
									{totalFocusDisplay}
								</div>
							</div>
						</div>
				</section>

				{/* Right: tools */}
				<section className="flex min-h-[240px] flex-1 flex-col rounded-2xl border border-slate-100 bg-slate-50/80 lg:min-h-0 lg:flex-[0_0_28%]">
					<div className="border-b border-slate-100 bg-white/80 px-5 py-3 rounded-t-2xl">
						<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								<span className="mr-2">⚙️</span> Focus tools
						</h3>
					</div>
					<div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
							<Card className="w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all border-slate-100 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow">
								<h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
									🔕 Deep focus mode
								</h4>
								<div className="flex items-center justify-between text-sm">
									<span className="text-slate-600">Mute non-essential notifications</span>
									<label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
										<input
											type="checkbox"
											className="peer sr-only"
											checked={focusModeOn}
											onChange={e => setFocusModeOn(e.target.checked)}
										/>
										<span className="h-full w-full rounded-full bg-slate-300 transition peer-checked:bg-sky-500" />
										<span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
									</label>
								</div>
								<p className="mt-2 text-xs text-slate-500">
									When on, social feeds, news and non-urgent messages are silenced.
								</p>
							</Card>

							<Card className="w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all border-slate-100 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow">
								<h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
									🎵 Ambient sound
								</h4>
								<div className="flex gap-2 text-sm">
									{[
										{ id: "rain", label: "🌧️ Rain" },
										{ id: "cafe", label: "☕ Cafe" },
										{ id: "white", label: "📻 White noise" },
									].map(sound => (
										<Button
											key={sound.id}
											variant="secondary"
											className={
												"flex-1 rounded-full border px-3 py-1.5 text-xs " +
												(ambientSound === sound.id
													? "border-slate-700 bg-slate-800 text-white"
													: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")
											}
											onClick={() => setAmbientSound(ambientSound === sound.id ? null : (sound.id as "rain" | "cafe" | "white"))}
										>
											{sound.label}
										</Button>
									))}
								</div>
							</Card>

							<Card className="w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all border-slate-100 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow">
								<h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
									🎯 Goal for this Pomodoro
								</h4>
								<div className="min-h-[64px] rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
									{activeTask
										? `Complete "${activeTask.title}" focusing on: ${activeTask.tags.join(", ")}`
										: "Pick a task from the list to set a concrete goal for this Pomodoro."}
								</div>
							</Card>

							<Card className="w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all border-slate-100 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow">
								<h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
									📊 Efficiency stats
								</h4>
								<div className="grid grid-cols-2 gap-4 text-center">
									<div>
										<div className="text-2xl font-semibold text-sky-500 sm:text-3xl">87%</div>
										<div className="text-xs text-slate-500">Avg. focus level</div>
									</div>
									<div>
										<div className="text-2xl font-semibold text-emerald-500 sm:text-3xl">{taskCompletionRate}%</div>
										<div className="text-xs text-slate-500">Task completion</div>
									</div>
								</div>
							</Card>
						</div>
				</section>
			</div>

		{/* Bottom status bar */}
		<footer className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between rounded-xl bg-slate-900 px-6 py-3 text-xs text-slate-100">
			<div className="flex items-center gap-5">
				<div className="flex items-center gap-2">
					<span className={`h-2.5 w-2.5 rounded-full ${isRunning ? "animate-pulse bg-rose-400" : "bg-slate-500"}`} />
					<span>{isRunning ? "Focusing" : "Paused"}</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
					<span>Connection OK</span>
				</div>
			</div>
			<div className="flex items-center gap-6">
				<div>
					Sync time: <span className="font-mono">{syncTimeDisplay}</span>
				</div>
				<div>
					Next break in: <span className="font-mono">{nextBreakTimeDisplay}</span>
				</div>
			</div>
		</footer>
		</div>
	)
}

export default WorkTimerPage
