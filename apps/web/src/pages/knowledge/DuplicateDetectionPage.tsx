import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"

type ConceptSummary = {
  id: string
  title: string
  concept_type: string
  description: string
}

type DuplicateGroup = {
  concept_a: ConceptSummary
  concept_b: ConceptSummary
  similarity_score: number
  tier: "exact" | "high" | "moderate"
  suggested_action: string
}

export function DuplicateDetectionPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => {
    loadDuplicates()
  }, [])

  async function loadDuplicates() {
    setLoading(true)
    try {
      const data = await apiClient.get<{ duplicate_groups: DuplicateGroup[] }>("/api/documents/duplicates/scan")
      setGroups(data?.duplicate_groups || [])
    } catch (err) {
      console.error("Failed to scan duplicates:", err)
    } finally {
      setLoading(false)
    }
  }

  // send the chosen action (merge/link/keep) and drop the pair from the list
  async function handleResolve(conceptA: string, conceptB: string, action: string) {
    const key = `${conceptA}-${conceptB}`
    setResolving(key)
    try {
      await apiClient.post("/api/documents/duplicates/resolve", {
        concept_a_id: conceptA,
        concept_b_id: conceptB,
        action
      })
      setGroups(prev => prev.filter(g =>
        !((g.concept_a.id === conceptA && g.concept_b.id === conceptB) ||
          (g.concept_a.id === conceptB && g.concept_b.id === conceptA))
      ))
    } catch (err) {
      console.error("Failed to resolve duplicate:", err)
    } finally {
      setResolving(null)
    }
  }

  function getTierColor(tier: string) {
    switch (tier) {
      case "exact": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      case "moderate": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Duplicate Detection</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Scanning for duplicate concepts...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <span className="ml-3 text-gray-500">Analyzing concepts...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Duplicate Detection</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {groups.length} potential duplicate{groups.length !== 1 ? " pairs" : " pair"} found
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 text-lg font-medium text-gray-900 dark:text-white">No duplicates found</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your knowledge base looks clean!</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group, idx) => {
            const key = `${group.concept_a.id}-${group.concept_b.id}`
            const isResolving = resolving === key
            return (
              <Card key={idx}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getTierColor(group.tier))}>
                      {group.tier} match
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {(group.similarity_score * 100).toFixed(0)}% similar
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Concept A */}
                  <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{group.concept_a.title}</h4>
                    <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                      {group.concept_a.concept_type}
                    </span>
                    {group.concept_a.description && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                        {group.concept_a.description}
                      </p>
                    )}
                  </div>

                  {/* Concept B */}
                  <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{group.concept_b.title}</h4>
                    <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                      {group.concept_b.concept_type}
                    </span>
                    {group.concept_b.description && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                        {group.concept_b.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => handleResolve(group.concept_a.id, group.concept_b.id, "merge")}
                    disabled={isResolving}
                    className="text-xs"
                  >
                    {isResolving ? "..." : "Merge"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleResolve(group.concept_a.id, group.concept_b.id, "link")}
                    disabled={isResolving}
                    className="text-xs"
                  >
                    Link
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleResolve(group.concept_a.id, group.concept_b.id, "keep_separate")}
                    disabled={isResolving}
                    className="text-xs"
                  >
                    Keep Separate
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
