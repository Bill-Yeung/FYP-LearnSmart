import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { TimerDTO, SessionReflectionDTO } from "../types/planWorkflow.dto";
import { useAuth } from "./AuthContext";
import * as planWorkflowApi from "../api/planWorkflow";

const WORK_SESSION_SECONDS = 25 * 60;
const BREAK_SESSION_SECONDS = 5 * 60;

interface TimerContextValue {

  tasks: TimerDTO[];
  loading: boolean;
  error: string | null;
  activeTask: TimerDTO | undefined;
  
  isRunning: boolean;
  isWorkSession: boolean;
  sessionCount: number;
  timeLeft: number;
  totalFocusSeconds: number;

  reflectionOpen: boolean;
  ambientSound: "rain" | "cafe" | "white" | null;

  startTimer: () => void;
  pauseTimer: () => void;
  skipSession: () => void;
  selectTask: (taskId: string, fallbackDuration?: number, fallbackTask?: Partial<TimerDTO>) => void;
  loadTasks: (force?: boolean) => Promise<void>;
  submitReflection: (rating: number, text: string) => Promise<void>;
  cancelReflection: () => void;
  updateTasks: (tasks: TimerDTO[]) => void;
  setAmbientSound: (sound: "rain" | "cafe" | "white" | null) => void;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
};

const FALLBACK_TASKS: TimerDTO[] = [
  { id: "fallback-1", title: "Memory Training", type: "memory", duration: 30, completed: false, active: true, tags: ["memory"] },
];

// helpers for shaping task data from the server
const normalizeServerTasks = (dataRaw: unknown): TimerDTO[] => {
  if (!Array.isArray(dataRaw)) return FALLBACK_TASKS;
  console.log("TimerContext: normalizeServerTasks dataRaw ->", dataRaw);
  const seenIds = new Set<string>();

  return dataRaw.map((task: any, index) => {
    const baseId = task.id || `${task.scriptId ?? task.knowledgeId ?? task.title ?? "task"}-${index}`;
    let uniqueId = String(baseId);
    let suffix = 1;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${baseId}-${suffix++}`;
    }
    seenIds.add(uniqueId);

    return {
      id: uniqueId,
      title: task.title,
      type: task.type,
      duration: Math.min(120, Math.max(5, task.durationMinutes ?? task.duration_minutes ?? task.duration ?? 25)),
      completed: task.status === "completed",
      active: task.status === "in-progress",
      tags: Array.isArray(task.tags) ? task.tags : [],
      remainingMinutes: task.remaining_minutes,
      userId: task.userId,
      scriptId: task.scriptId,
      knowledgeId: task.knowledgeId,
    };
  });
};

const getInitialActiveTask = (tasks: TimerDTO[]): TimerDTO[] => {
  const activeTaskIndexes = tasks.map((t, idx) => t.active ? idx : -1).filter(idx => idx !== -1);
  if (activeTaskIndexes.length > 1) {
    const firstActive = activeTaskIndexes[0];
    return tasks.map((t, idx) => ({ ...t, active: idx === firstActive }));
  }

  if (tasks.some(t => t.active)) return tasks;
  const firstIncompleteIdx = tasks.findIndex(t => !t.completed);
  if (firstIncompleteIdx >= 0) {
    return tasks.map((t, idx) => ({ ...t, active: idx === firstIncompleteIdx }));
  }
  return tasks.length > 0 ? [{ ...tasks[0], active: true }, ...tasks.slice(1)] : tasks;
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState<TimerDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isRunning, setIsRunning] = useState(false);
  const [isWorkSession, setIsWorkSession] = useState(true);
  const [sessionCount, setSessionCount] = useState(1);
  const [timeLeft, setTimeLeft] = useState(WORK_SESSION_SECONDS);
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [ambientSound, setAmbientSound] = useState<"rain" | "cafe" | "white" | null>(null);

  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeTask = useMemo(() => tasks.find(t => t.active), [tasks]);

  const prevTaskRef = useRef<{ id: string; duration: number } | null>(null);

  // Keep ambient audio global to timer session state instead of page lifecycle.
  useEffect(() => {
    // Keep ambient sound user-controlled: play whenever selected, stop only when user turns it off.
    const shouldPlayAmbient = Boolean(ambientSound);
    const soundPaths: Record<"rain" | "cafe" | "white", string> = {
      rain: "/sounds/rain.mp3",
      cafe: "/sounds/cafe.mp3",
      white: "/sounds/white-noise.mp3",
    };

    if (shouldPlayAmbient && ambientSound) {
      if (!ambientAudioRef.current) {
        ambientAudioRef.current = new Audio();
        ambientAudioRef.current.loop = true;
      }
      const audio = ambientAudioRef.current;
      const nextSrc = soundPaths[ambientSound];
      if (!audio.src.endsWith(nextSrc)) {
        audio.src = nextSrc;
      }
      audio.play().catch((e) => console.warn("Ambient audio play blocked:", e));
      return;
    }

    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.currentTime = 0;
    }
  }, [ambientSound]);

  useEffect(() => {
    return () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
      }
    };
  }, []);

  // reset time left when the active task changes
  useEffect(() => {
    if (activeTask) {
      const isTaskChanged =
        !prevTaskRef.current || 
        prevTaskRef.current.id !== activeTask.id || 
        prevTaskRef.current.duration !== activeTask.duration;

      if (isTaskChanged) {
        prevTaskRef.current = { id: activeTask.id, duration: activeTask.duration };
        if (!isRunning && isWorkSession) {
          setTimeLeft(activeTask.duration * 60);
        }
      }
    }
  }, [activeTask, isRunning, isWorkSession]);

  const loadTasks = useCallback(async (force: boolean = false) => {
    if (!isAuthenticated) {
      const fallbackTasks = getInitialActiveTask(FALLBACK_TASKS);
      setTasks(fallbackTasks);
      setError(null);
      if (!isRunning) {
        const active = fallbackTasks.find(t => t.active);
        if (active) setTimeLeft(active.duration * 60);
      }
      return;
    }
    if (!force && tasks.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/timer/tasks", {
        credentials: "include",
      });
      if (response.status === 401) {
        const fallbackTasks = getInitialActiveTask(FALLBACK_TASKS);
        setTasks(fallbackTasks);
        const active = fallbackTasks.find(t => t.active);
        if (active && !isRunning) setTimeLeft(active.duration * 60);
        setError(null);
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to load timer tasks (${response.status})`);
      }
      const dataRaw = await response.json();
      let normalizedData = normalizeServerTasks(dataRaw);
      
      let finalData = getInitialActiveTask(normalizedData);
      
      setTasks(prev => {
        const currentActive = prev.find(p => p.active);
        const hasMatch = currentActive && finalData.some(n => n.id === currentActive.id);
        
        if (hasMatch) {
          finalData = finalData.map(n => ({ ...n, active: n.id === currentActive?.id }));
        }
        
        return finalData;
      });

      const active = finalData.find(t => t.active);
      if (active && (!isRunning)) {
        setTimeLeft(active.duration * 60);
      }
    } catch (err) {
      let fallbackTasks = getInitialActiveTask(FALLBACK_TASKS);
      setTasks(fallbackTasks);
      const active = fallbackTasks.find(t => t.active);
      if (active && (!isRunning)) setTimeLeft(active.duration * 60);
      setError("Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tasks.length, isRunning]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // switch between work and break when a session ends
  const handleSessionEnd = useCallback(() => {
    if (isWorkSession) {
      setReflectionOpen(true);
      setTimeout(() => {
        setIsWorkSession(false);
        setTimeLeft(BREAK_SESSION_SECONDS);
        setTargetEndTime(null);
      }, 100);
    } else {
      setIsWorkSession(true);
      setTimeLeft(activeTask ? activeTask.duration * 60 : WORK_SESSION_SECONDS);
      setSessionCount(c => c + 1);
      setTargetEndTime(null);
    }
  }, [isWorkSession, activeTask]);

  useEffect(() => {
    if (!isRunning || !targetEndTime) return;

    let lastTick = Date.now();

    const id = window.setInterval(() => {
      const now = Date.now();
      const remaining = Math.ceil((targetEndTime - now) / 1000);
      
      if (isWorkSession) {
        const deltaSeconds = Math.round((now - lastTick) / 1000);
        if (deltaSeconds > 0) {
          setTotalFocusSeconds(s => s + deltaSeconds);
        }
      }
      lastTick = now;

      if (remaining <= 0) {
        window.clearInterval(id);
        setIsRunning(false);
        setTimeLeft(0);
        handleSessionEnd();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [isRunning, targetEndTime, isWorkSession, handleSessionEnd]);

  const startTimer = useCallback(() => {
    if (isRunning) return;
    if (!tasks.some(t => t.active)) {
      alert("Please select a task before starting.");
      return;
    }
    setIsRunning(true);
    setTargetEndTime(Date.now() + timeLeft * 1000);
  }, [isRunning, tasks, timeLeft]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    setTargetEndTime(null);
  }, []);

  const skipSession = useCallback(() => {
    setIsRunning(false);
    setTargetEndTime(null);
    if (isWorkSession) {
      setIsWorkSession(false);
      setTimeLeft(BREAK_SESSION_SECONDS);
    } else {
      setIsWorkSession(true);
      setTimeLeft(activeTask ? activeTask.duration * 60 : WORK_SESSION_SECONDS);
      setSessionCount(c => c + 1);
    }
  }, [isWorkSession, activeTask]);

  // pick which task to focus on
  const selectTask = useCallback((taskId: string, fallbackDuration?: number, fallbackTask?: Partial<TimerDTO>) => {
    const selected = tasks.find(t => t.id === taskId)

    if (!isRunning) {
      if (selected) {
        setTimeLeft(selected.duration * 60)
      } else if (fallbackDuration !== undefined) {
        setTimeLeft(fallbackDuration * 60)
      }
    }

    setTasks(prev => {
      const existing = prev.find(t => t.id === taskId)
      if (existing) {
        return prev.map(task => ({ ...task, active: task.id === taskId }))
      }

      if (fallbackDuration !== undefined) {
        const addedTask: TimerDTO = {
          id: taskId,
          title: fallbackTask?.title ?? "New Task",
          type: (fallbackTask?.type as TimerDTO["type"]) ?? "memory",
          duration: fallbackTask?.duration ?? fallbackDuration,
          completed: fallbackTask?.completed ?? false,
          active: true,
          tags: fallbackTask?.tags ?? [],
        }
        return [
          ...prev.map(task => ({ ...task, active: false })),
          addedTask,
        ]
      }

      return prev.map(task => ({ ...task, active: task.id === taskId }))
    })
  }, [tasks, isRunning])

  const submitReflection = useCallback(async (rating: number, text: string) => {
    if (!activeTask) return;
    try {
      const reflectionData: SessionReflectionDTO = {
        taskId: activeTask.id,
        sessionNumber: sessionCount,
        focusRating: rating,
        reflection: text,
        totalFocusSeconds: totalFocusSeconds,
        completedAt: new Date().toISOString(),
      };
      
      fetch("/api/timer/reflections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reflectionData),
      }).catch(e => console.warn(e));

      try {
        if (!activeTask.id.startsWith("fallback-") && !activeTask.id.startsWith("added-")) {
          await planWorkflowApi.updateDailyTask(activeTask.id, {
            status: "completed"
          });
        }
      } catch (err) {
        console.warn("Failed to sync task completion to Daily Plan", err);
      }

      let nextDuration = WORK_SESSION_SECONDS;
      
      setTasks(prev => {
        const next = prev.map(t => t.id === activeTask.id ? { ...t, completed: true, active: false } : t);
        const nextIncomplete = next.find(t => !t.completed);
        if (nextIncomplete) {
          nextDuration = nextIncomplete.duration * 60;
          return next.map(t => ({ ...t, active: t.id === nextIncomplete.id }));
        }
        return next;
      });

      setReflectionOpen(false);
      setIsWorkSession(true);
      
      setTimeout(() => setTimeLeft(nextDuration), 0);
      
      setSessionCount(c => c + 1);
    } catch (err) {
      console.error(err);
    }
  }, [activeTask, sessionCount, totalFocusSeconds]);

  const cancelReflection = useCallback(() => {
    setReflectionOpen(false);
    setIsWorkSession(false);
    setTimeLeft(BREAK_SESSION_SECONDS);
  }, []);

  const updateTasks = useCallback((newTasks: TimerDTO[]) => setTasks(newTasks), []);

  return (
    <TimerContext.Provider value={{
      tasks, loading, error, activeTask,
      isRunning, isWorkSession, sessionCount, timeLeft, totalFocusSeconds, reflectionOpen,
      ambientSound,
      startTimer, pauseTimer, skipSession, selectTask, loadTasks, submitReflection, cancelReflection, updateTasks, setAmbientSound
    }}>
      {children}
    </TimerContext.Provider>
  );
};
