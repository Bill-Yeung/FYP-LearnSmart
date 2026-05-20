export type TaskType = "memory" | "logic" | "script" | "understanding";

export interface ServerTaskDTO {
  id: string;
  title: string;
  type: TaskType;
  status: "pending" | "in-progress" | "completed";
  duration_minutes: number;
  remaining_minutes?: number;
  userId?: string;
  projectId?: string;
  createdBy?: string;
  updatedBy?: string;
  scriptId?: string;
  knowledgeId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimerDTO {
  id: string;
  title: string;
  type: TaskType;
  duration: number; // in minutes
  completed: boolean;
  active?: boolean;
  tags: string[];
  remainingMinutes?: number;
  userId?: string;
  projectId?: string;
  createdBy?: string;
  updatedBy?: string;
  scriptId?: string;
  knowledgeId?: string;
}

export interface TimerSessionDTO {
  sessionCount: number;
  totalFocusSeconds: number; // in seconds
  isWorkSession: boolean;
  timeLeft: number; // in seconds
}

export interface PlanSummaryDTO {
  userId: string;
  totalStudyMinutes: number;
  totalTasks: number;
  completedTasks: number;
  learnLaterCount: number;
  masteryDistribution: {
    unfamiliar: number;
    familiar: number;
    proficient: number;
    mastered: number;
  };
  missedConcepts: Array<{ knowledgeId: string; points: number }>;
  recommendations: string[];
  longTermGoals?: Array<{
    id: number;
    label: string;
    horizon: "2-weeks" | "1-month" | "3-months";
    progress: number;
  }>;
  weekTemplate?: Array<{
    day: string;
    date?: string;
    focus: string;
    blocks: number;
  }>;
  aiPlan?: {
    basedOn: string;
    strengths?: string[];
    improvements?: string[];
    actions: string[];
    predictive_insight?: string;
  };
  abilityScores?: Record<string, number>;
  dailyStudyHeatmap?: Array<{ date: string; minutes: number }>;
  recentActivities?: Array<{
    time: string;
    title: string;
    delta: string;
    type: string;
  }>;
  total_scripts?: number;
  completed_scenes?: number;
  answered_questions?: number;
}

export interface DailyPlanTaskDTO {
  id: string;
  title: string;
  type: TaskType;
  status: "pending" | "in-progress" | "completed";
  durationMinutes: number;
  userId: string;
  knowledgeId?: string;
  scriptId?: string;
  tags?: string[];
  createdAt?: string;
}

export interface CreateDailyPlanTaskDTO {
  title: string;
  type: TaskType;
  durationMinutes: number;
  knowledgeId?: string;
  scriptId?: string;
  tags?: string[];
}

export interface UpdateDailyPlanTaskDTO {
  status?: "pending" | "in-progress" | "completed";
  type?: "memory" | "logic" | "script" | "understanding" | string;
  durationMinutes?: number;
  title?: string;
  tags?: string[];
}

export interface SessionReflectionDTO {
  taskId: string;
  sessionNumber: number;
  focusRating: number; // 1-5
  reflection: string;
  totalFocusSeconds: number;
  completedAt: string;
}