import type {
  ScriptDTO,
  UserProgressDTO,
  UserAnswerDTO,
  ClueDTO,
  KnowledgeDTO,
  ChunkDTO,
  SceneDTO,
  SceneResponseDTO,
  AnswerResultDTO,
  LearnLaterListDTO,
  AddToLearnLaterRequestDTO,
  MarkMasteredRequestDTO,
  ScriptReportDTO,
  LearningProgressDTO,
  UpdateLearningProgressRequestDTO
} from "../types/game.dto"

export class ApiError extends Error {
  status: number
  
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
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

// scripts and scenes
export async function getScript(scriptId: string): Promise<ScriptDTO> {
  const res = await fetch(`/api/game/play/${scriptId}`, {
    credentials: 'include'
  })
  const data = await handleResponse<any>(res)
  if (data.script) {
    return data.script
  }
  return data
}

export async function getScript2(scriptId: string): Promise<ScriptDTO> {
  const res = await fetch(`/api/game/play/${scriptId}`, {
    credentials: 'include'
  })
  const data = await handleResponse<any>(res)
  if (data.script) {
    return data.script
  }
  return data
}

export async function getAllScenes(scriptId: string): Promise<SceneDTO[]> {
  if (!scriptId || !scriptId.trim()) {
    throw new ApiError(400, 'Script ID is required')
  }

  const res = await fetch(`/api/game/scenes?scriptId=${encodeURIComponent(scriptId)}`, {
    credentials: 'include'
  })
  return handleResponse<SceneDTO[]>(res)
}

export async function getSceneContext(sceneId: string): Promise<SceneResponseDTO> {
  const res = await fetch(`/api/game/scene/${sceneId}/context`, {
    credentials: 'include'
  })
  return handleResponse<SceneResponseDTO>(res)
}

export async function submitAnswer(
  scriptId: string,
  data: {
    questionId: string
    sceneId: string
    knowledgeId: string
    selectedOption?: string
    sequencingOrder?: string[]
    answerText?: string
    attemptNumber: number
    hintsUsed: number
  }
): Promise<AnswerResultDTO> {
  const res = await fetch(`/api/game/submit-answer?scriptId=${scriptId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  return handleResponse<AnswerResultDTO>(res)
}

export async function reportQuestionIssue(
  scriptId: string,
  data: {
    questionId: string
    sceneId: string
    issueType: string
    userComment: string
  }
): Promise<{success: boolean, message: string}> {
  const res = await fetch(`/api/game/report-issue?scriptId=${scriptId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  return handleResponse<{success: boolean, message: string}>(res)
}

export async function getUserAnswers(scriptId: string): Promise<UserAnswerDTO[]> {
  const res = await fetch(`/api/game/answers/${scriptId}`, {
    credentials: 'include'
  })
  return handleResponse<UserAnswerDTO[]>(res)
}

export async function askDetective(
  data: {
    scriptId: string
    sceneId: string
    questionId: string
    wrongAnswers: string[]
    askCount: number
  }
) {
  const response = await fetch(`/api/game/ask-detective`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    throw new Error('Failed to ask detective')
  }
  return response.json()
}

export async function getUserProgress(scriptId: string): Promise<UserProgressDTO> {
  const res = await fetch(`/api/game/progress/${scriptId}`, {
    credentials: 'include'
  })
  return handleResponse<UserProgressDTO>(res)
}

export async function updateUserProgress(
  scriptId: string, 
  data: Partial<UserProgressDTO>
): Promise<UserProgressDTO> {
  const res = await fetch(`/api/game/update-progress?scriptId=${scriptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })
  return handleResponse<UserProgressDTO>(res)
}

export async function resetProgress(scriptId: string): Promise<void> {
  const res = await fetch(`/api/game/progress/${scriptId}/reset`, {
    method: 'POST',
    credentials: 'include'
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Failed to reset progress: ${res.status}`)
  }
}

export async function saveProgress(scriptId: string, data?: any): Promise<void> {
  const res = await fetch(`/api/game/progress/${scriptId}/save`, {
    method: 'POST',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: data ? JSON.stringify(data) : undefined
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Failed to save progress: ${res.status}`)
  }
}

export async function getLearnLaterList(scriptId?: string): Promise<LearnLaterListDTO> {
  const query = scriptId ? `?scriptId=${encodeURIComponent(scriptId)}` : ''
  const res = await fetch(`/api/game/learn-later/list${query}`, {
    credentials: 'include'
  })
  return handleResponse<LearnLaterListDTO>(res)
}

export async function addToLearnLater(data: AddToLearnLaterRequestDTO): Promise<void> {
  const res = await fetch(`/api/game/learn-later`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })
  
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Failed to add to learn later: ${res.status}`)
  }
  
  const json = await res.json().catch(() => null)
  if (json && json.success === false) {
    throw new Error(json.message || "Failed to add to learn later")
  }
}

export async function markAsMastered(data: MarkMasteredRequestDTO & { scriptId?: string }): Promise<void> {
  const query = new URLSearchParams()
  if (data.scriptId) query.append('scriptId', data.scriptId)
  const res = await fetch(`/api/game/knowledge/master?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ knowledgeId: data.knowledgeId })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Failed to mark as mastered: ${res.status}`)
  }
}

export async function getKnowledge(knowledgeId: string): Promise<KnowledgeDTO> {
  const res = await fetch(`/api/game/knowledge/${knowledgeId}`, {
    credentials: 'include'
  })
  return handleResponse<KnowledgeDTO>(res)
}

export async function getKnowledges(knowledgeIds: string[]): Promise<KnowledgeDTO[]> {
  const params = new URLSearchParams()
  knowledgeIds.forEach(id => params.append('ids', id))
  
  const res = await fetch(`/api/game/knowledge/batch?${params.toString()}`, {
    credentials: 'include'
  })
  return handleResponse<KnowledgeDTO[]>(res)
}

export async function getAllChunks(documentHash: string): Promise<ChunkDTO[]> {
  if (!documentHash) {
    throw new ApiError(400, 'Document hash is required')
  }
  
  const res = await fetch(`/api/game/chunks?hash=${encodeURIComponent(documentHash)}`, {
    credentials: 'include'
  })
  return handleResponse<ChunkDTO[]>(res)
}

export async function getParsedDocumentChunks(documentHash: string): Promise<ChunkDTO[]> {
  if (!documentHash) {
    throw new ApiError(400, 'Document hash is required')
  }
  
  const res = await fetch(`/api/game/parsed-document-chunks?document_hash=${encodeURIComponent(documentHash)}`, {
    credentials: 'include'
  })
  const data = await handleResponse<{ documentHash: string; chunks: ChunkDTO[]; totalChunks: number }>(res)
  return data.chunks || []
}

export async function withErrorHandling<T>(
  apiCall: Promise<T>,
  errorMessage: string = 'Request failed'
): Promise<T | null> {
  try {
    return await apiCall
  } catch (error) {
    console.error(`${errorMessage}:`, error)
    return null
  }
}

// finishing and reports
export async function completeGame(scriptId: string, data: { endingId: string }): Promise<{ success: boolean }> {
  const url = `/api/game/progress/${scriptId}/complete`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })
  return handleResponse<{ success: boolean }>(res)
}

export async function getScriptReport(scriptId: string): Promise<ScriptReportDTO> {
  const url = `/api/game/progress/${scriptId}/report`
  const res = await fetch(url, { credentials: 'include' })
  return handleResponse<ScriptReportDTO>(res)
}

export async function updateLearningProgress(data: UpdateLearningProgressRequestDTO & { scriptId?: string }): Promise<{ success: boolean; knowledgeId: string }> {
  const params = new URLSearchParams()
  params.append('knowledgeId', data.knowledgeId)
  if (data.scriptId) params.append('scriptId', data.scriptId)
  if (data.timeSpentMinutes !== undefined) {
    params.append('timeSpentMinutes', data.timeSpentMinutes.toString())
  }
  if (data.quizAttempts !== undefined) {
    params.append('quizAttempts', data.quizAttempts.toString())
  }
  if (data.quizPassed !== undefined) {
    params.append('quizPassed', data.quizPassed.toString())
  }
  if (data.aiContentViewed !== undefined) {
    params.append('aiContentViewed', JSON.stringify(data.aiContentViewed))
  }
  if (data.personalNotes !== undefined) {
    params.append('personalNotes', data.personalNotes)
  }
  if (data.masteryLevel !== undefined) {
    params.append('masteryLevel', data.masteryLevel)
  }

  const res = await fetch(`/api/game/learning-progress?${params.toString()}`, {
    method: 'POST',
    credentials: 'include'
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Failed to update learning progress: ${res.status}`)
  }
  return handleResponse<{ success: boolean; knowledgeId: string }>(res)
}

export async function getLearningProgress(knowledgeId: string, scriptId?: string): Promise<LearningProgressDTO> {
  const params = new URLSearchParams()
  if (scriptId) params.append('scriptId', scriptId)
  const url = `/api/game/learning-progress/${knowledgeId}` + (scriptId ? `?${params.toString()}` : '')
  const res = await fetch(url, {
    credentials: 'include'
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Failed to get learning progress: ${res.status}`)
  }
  return handleResponse<LearningProgressDTO>(res)
}