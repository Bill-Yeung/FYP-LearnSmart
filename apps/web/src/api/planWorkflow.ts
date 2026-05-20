import type {
  PlanSummaryDTO,
  DailyPlanTaskDTO,
  CreateDailyPlanTaskDTO,
  UpdateDailyPlanTaskDTO,
} from "../types/planWorkflow.dto"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Request failed with status ${res.status}`)
  }
  return res.json()
}

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('learnsmart-tokens')
    if (!raw) return null
    return JSON.parse(raw).access_token
  } catch (err) {
    return null
  }
}

export async function getPlanSummary(): Promise<PlanSummaryDTO> {
  const token = getAccessToken()
  const res = await fetch(`/api/plan-workflow/summary`, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    credentials: "include",
  })
  return handleResponse<PlanSummaryDTO>(res)
}

export async function getDailyPlanTasks(date?: string): Promise<DailyPlanTaskDTO[]> {
  const token = getAccessToken()
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  const res = await fetch(`/api/plan-workflow/daily-tasks${query}`, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    credentials: "include",
  })
  return handleResponse<DailyPlanTaskDTO[]>(res)
}

export async function createDailyTask(payload: CreateDailyPlanTaskDTO, date?: string): Promise<DailyPlanTaskDTO> {
  const token = getAccessToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  const res = await fetch(`/api/plan-workflow/daily-tasks${query}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  })
  return handleResponse<DailyPlanTaskDTO>(res)
}

export async function updateDailyTask(
  taskId: string,
  payload: UpdateDailyPlanTaskDTO
): Promise<DailyPlanTaskDTO> {
  const token = getAccessToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`/api/plan-workflow/daily-tasks/${taskId}`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  })
  return handleResponse<DailyPlanTaskDTO>(res)
}

export async function deleteDailyTask(taskId: string): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(`/api/plan-workflow/daily-tasks/${taskId}`, {
    method: "DELETE",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    credentials: "include",
  })
  await handleResponse<void>(res)
}

export async function generateWeeklyPlan(startDate?: string): Promise<{ weekTemplate: Array<Record<string, any>> }> {
  const token = getAccessToken()
  const query = startDate ? `?start_date=${encodeURIComponent(startDate)}` : ""
  const res = await fetch(`/api/plan-workflow/weekly-plan/generate${query}`, {
    method: "POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    credentials: "include",
  })
  return handleResponse<{ weekTemplate: Array<Record<string, any>> }>(res)
}
