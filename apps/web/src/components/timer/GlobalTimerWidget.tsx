import React, { useState, useEffect, useRef } from "react";
import { useTimer } from "../../contexts";
import { Play, Pause, Square, Loader, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../index";

export const GlobalTimerWidget: React.FC = () => {
  const {
    isRunning,
    isWorkSession,
    timeLeft,
    activeTask,
    startTimer,
    pauseTimer,
    skipSession,
    reflectionOpen,
    submitReflection,
    cancelReflection
  } = useTimer();

  const [expanded, setExpanded] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [reflectionRating, setReflectionRating] = useState<number | null>(null);

  const [dismissed, setDismissed] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isStudyPage = 
    location.pathname.startsWith("/classroom") ||
    location.pathname.startsWith("/detective") ||
    location.pathname.startsWith("/game") ||
    location.pathname.startsWith("/knowledge");

  useEffect(() => {
    if (isRunning) {
      setDismissed(false);
    }
  }, [isRunning]);

  // Re-show widget when route/task context changes, so users always have a way back.
  useEffect(() => {
    if (activeTask) {
      setDismissed(false);
    }
  }, [location.pathname, activeTask?.id]);

  // play a bell sound and show a browser notification when session ends
  useEffect(() => {
    if (reflectionOpen) {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/bell.mp3");
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn("Beep play blocked:", e));

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Focus Session Ended", {
          body: "Time to reflect! Great job staying focused."
        });
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [reflectionOpen]);

  const handleSubmitReflection = async () => {
    if (!activeTask || reflectionRating === null) {
      alert("Please fill in all fields and rate your focus.");
      return;
    }
    await submitReflection(reflectionRating, reflectionText);
    setReflectionText("");
    setReflectionRating(null);
  };

  const handleCancelReflection = () => {
    cancelReflection();
    setReflectionText("");
    setReflectionRating(null);
  };

  if (reflectionOpen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative z-[101]">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">🎯 Session reflection</h2>
          {activeTask && (
            <p className="mb-3 text-sm font-medium text-sky-700 bg-sky-50 px-3 py-2 rounded-lg">
              Task: <span className="font-semibold">{activeTask.title}</span>
            </p>
          )}
          <p className="mb-3 text-sm text-slate-700">
            What did you complete in this Pomodoro? Any obstacles you noticed?
          </p>
          <textarea
            className="mt-1 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Write a short reflection..."
            value={reflectionText}
            onChange={e => setReflectionText(e.target.value)}
          />
          <div className="mt-4 text-sm text-slate-700">
            <div>Rate your focus this session:</div>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setReflectionRating(rating)}
                  className={
                    "flex-1 rounded-full border px-2 py-1 text-xs transition " +
                    (reflectionRating === rating
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")
                  }
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
              onClick={handleCancelReflection}
            >
              Skip
            </Button>
            <Button
              variant="primary"
              className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed"
              onClick={handleSubmitReflection}
              disabled={reflectionRating === null}
            >
              Save reflection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (location.pathname === "/plan-workflow/work-timer" || location.pathname === "/plan-workflow/work-timer/") {
    return null;
  }

  if (dismissed) {
    return null;
  }

  if (!isStudyPage && !isRunning && !reflectionOpen) {
    return null;
  }

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  const bgColor = isWorkSession ? "bg-sky-500" : "bg-emerald-500";
  const hoverBgColor = isWorkSession ? "hover:bg-sky-600" : "hover:bg-emerald-600";

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-3 font-sans transition-all duration-300">
      
      {/* Expanded Details */}
      {expanded && activeTask && (
        <div className="w-72 overflow-hidden rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 animate-in slide-in-from-bottom-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {isWorkSession ? "Focus Session" : "Break Time"}
          </div>
          <h4 className="mb-4 truncate text-sm font-semibold text-slate-800" title={activeTask.title}>
            {activeTask.title}
          </h4>
          
          <div className="flex items-center justify-between">
            <div className="text-3xl font-light tabular-nums tracking-tight text-slate-900">
              {minutes}:{seconds}
            </div>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={isRunning ? pauseTimer : startTimer}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm transition-transform active:scale-95 ${bgColor} ${hoverBgColor}`}
              >
                {isRunning ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 ml-0.5" fill="currentColor" />}
              </button>
              <button 
                onClick={skipSession}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 active:scale-95"
                title="Skip Session"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => {
                setExpanded(false);
                navigate("/plan-workflow/work-timer");
            }}
            className="mt-4 w-full rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          >
            Open Full Timer Dashboard
          </button>
        </div>
      )}

      {/* Floating Pill Button + Optional Dismiss */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDismissed(true)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-sm transition hover:bg-slate-200 hover:text-slate-600 focus:outline-none"
          title="Dismiss timer until next session"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95 ${bgColor} ${hoverBgColor}`}
        >
          <div className="relative flex h-5 w-5 items-center justify-center">
            {isRunning ? (
              <Loader className="absolute h-5 w-5 animate-spin opacity-80" />
            ) : (
              <Pause className="absolute h-3 w-3" fill="currentColor" />
            )}
            {isRunning && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </div>
          <span className="tabular-nums tracking-tight">
            {minutes}:{seconds}
          </span>
        </button>
      </div>

    </div>
  );
};
