
import type { TemplatePayload } from "../../../../shared/types"

export interface GameTemplateResponse {
  id: string
  version: number
  status: TemplatePayload["status"] | "ready" | "archived"
  created_at: string
  updated_at: string
  basic: TemplatePayload["basic"]
  content: TemplatePayload["content"]
  difficulty: TemplatePayload["difficulty"]
  quiz: TemplatePayload["quiz"]
}

export interface SubjectOption {
  id: string
  code: string
  name: string | null
}

export interface GameTemplateListItem {
  id: string
  name: string
  target_level: string | null
  subject_id: string | null
  subject_code: string | null
  subject_name: string | null
  status: GameTemplateResponse["status"]
  version: number
  created_at: string
  updated_at: string
}

export async function createTemplate(
  payload: TemplatePayload
): Promise<GameTemplateResponse> {
  const res = await fetch("/api/game/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed with status ${res.status}`)
  }

  return res.json()
}

export async function listTemplates(): Promise<GameTemplateListItem[]> {
  const res = await fetch("/api/game/templates")
  if (!res.ok) {
    throw new Error(`Failed to load templates: ${res.status}`)
  }
  return res.json()
}

export async function listSubjects(): Promise<SubjectOption[]> {
  const res = await fetch("/api/subjects")
  if (!res.ok) {
    throw new Error(`Failed to load subjects: ${res.status}`)
  }
  return res.json()
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const res = await fetch(`/api/game/templates/${templateId}`, {
    method: "DELETE"
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Failed to delete template: ${res.status}`)
  }
}

export async function duplicateTemplate(templateId: string): Promise<GameTemplateResponse> {
  const res = await fetch(`/api/game/templates/${templateId}/duplicate`, {
    method: "POST"
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Failed to duplicate template: ${res.status}`)
  }
  return res.json()
}

export async function getTemplate(templateId: string): Promise<GameTemplateResponse> {
  const res = await fetch(`/api/game/templates/${templateId}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Failed to get template: ${res.status}`)
  }
  return res.json()
}

export async function updateTemplate(templateId: string, payload: TemplatePayload): Promise<GameTemplateResponse> {
  const res = await fetch(`/api/game/templates/${templateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Failed to update template: ${res.status}`)
  }
  return res.json()
}