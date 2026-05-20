import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"

type ConceptDetail = {
  id: string
  title: string
  concept_type: string
  difficulty_level?: string
  description?: string
  keywords?: string[]
  language: string
}

export function ConceptComparisonPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [concepts, setConcepts] = useState<ConceptDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ids = searchParams.get("ids")?.split(",").filter(Boolean) || []

  useEffect(() => {
    if (ids.length >= 2) loadConcepts()
    else setError("At least 2 concept IDs required")
  }, [ids.join(",")])

  async function loadConcepts() {
    try {
      const data = await apiClient.post<{ concepts: ConceptDetail[] }>(
        "/api/documents/concepts/compare",
        { concept_ids: ids }
      )
      setConcepts(data?.concepts || [])
    } catch (err) {
      console.error("Failed to compare concepts:", err)
      setError("Failed to load concepts for comparison")
    } finally {
      setLoading(false)
    }
  }

  // intersect the keyword sets of every concept to find ones common to all
  function getSharedKeywords(): Set<string> {
    if (concepts.length < 2) return new Set()
    const allKeywordSets = concepts.map(c => new Set((c.keywords || []).map(k => k.toLowerCase())))
    const shared = new Set<string>()
    for (const kw of allKeywordSets[0]) {
      if (allKeywordSets.every(s => s.has(kw))) shared.add(kw)
    }
    return shared
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (error || concepts.length < 2) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <div className="py-8 text-center">
            <p className="text-red-500">{error || "Not enough concepts to compare"}</p>
            <Button variant="secondary" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
          </div>
        </Card>
      </div>
    )
  }

  const sharedKeywords = getSharedKeywords()

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Concept Comparison</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Comparing {concepts.length} concepts side by side</p>
      </div>

      {/* Shared Keywords */}
      {sharedKeywords.size > 0 && (
        <Card className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Shared Keywords</h3>
          <div className="flex flex-wrap gap-1">
            {Array.from(sharedKeywords).map(kw => (
              <span key={kw} className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                {kw}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Side-by-side Columns */}
      <div className={cn("grid gap-4", concepts.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {concepts.map(concept => (
          <Card key={concept.id}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{concept.title}</h3>

            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</p>
                <span className="mt-0.5 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                  {concept.concept_type}
                </span>
              </div>

              {concept.difficulty_level && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Difficulty</p>
                  <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 capitalize">
                    {concept.difficulty_level}
                  </span>
                </div>
              )}

              {concept.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</p>
                  <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{concept.description}</p>
                </div>
              )}

              {concept.keywords && concept.keywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Keywords</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {concept.keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs",
                          sharedKeywords.has(kw.toLowerCase())
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        )}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
