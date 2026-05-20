export type DocumentAnalysisModule = {
  name: string
  topic_count?: number
}

export type DocumentAnalysisResult = {
  concept: number
  structure: number
  apply: number
  difficulty_score: number
  modules?: DocumentAnalysisModule[]
}

export async function analyzeDocumentTemp(file: File): Promise<DocumentAnalysisResult> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch("/api/game/analyze-temp", {
    method: "POST",
    body: formData
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Analysis failed with status ${res.status}`)
  }

  const data = (await res.json()) as DocumentAnalysisResult
  return data
}

export async function getParsedJson(documentHash: string): Promise<any> {
  if (!documentHash) {
    return null;
  }
  const res = await fetch(`/api/game/parsed-json/${documentHash}`)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Failed to fetch parsed JSON with status ${res.status}`)
  }

  const data = await res.json()
  return data
}