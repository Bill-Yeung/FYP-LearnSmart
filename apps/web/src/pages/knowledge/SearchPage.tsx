import React, { useState, useEffect, useRef } from "react"
import { Card } from "../../components/ui/Card"
import { apiClient } from "../../lib/api"
import { cn } from "../../../../../shared/utils"

type SearchResult = {
  concept_id: string
  title: string
  description: string
  concept_type: string
  difficulty_level?: string
  score: number
  match_type: "keyword" | "semantic" | "both"
}

type SearchResponse = {
  results: SearchResult[]
  total: number
  query: string
  search_type: string
}

export function SearchPage() {
  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState<"hybrid" | "semantic" | "keyword">("keyword")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(), 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, searchType])

  async function doSearch() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const data = await apiClient.get<SearchResponse>(
        `/api/documents/search/query?q=${encodeURIComponent(query)}&search_type=${searchType}&limit=30`
      )
      setResults(data?.results || [])
      setSearched(true)
    } catch (err) {
      console.error("Search failed:", err)
    } finally {
      setLoading(false)
    }
  }

  function getMatchBadge(matchType: string) {
    switch (matchType) {
      case "semantic": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
      case "keyword": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      case "both": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  // wrap each query term inside <mark> so the result text gets a yellow highlight
  function highlightMatch(text: string): React.ReactNode[] {
    if (!query.trim() || !text) return [text]
    const terms = query.trim().split(/\s+/).filter(Boolean)
    const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
    const regex = new RegExp(`(${pattern})`, "gi")
    // String.split with a single capture group: even indices = non-match, odd = match
    const parts = text.split(regex)
    return parts.map((part, i) =>
      i % 2 === 1
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
        : part
    )
  }

  const searchTypes = [
    { key: "keyword" as const, label: "Keyword" },
    { key: "semantic" as const, label: "Semantic" },
    { key: "hybrid" as const, label: "Hybrid" }
  ]

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Search Knowledge Base</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Find concepts across all your documents</p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search concepts..."
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
      </div>

      {/* Search Type Toggle */}
      <div className="mb-6 flex gap-2">
        {searchTypes.map(st => (
          <button
            key={st.key}
            onClick={() => setSearchType(st.key)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              searchType === st.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <div>
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>

          {results.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No results found for "{query}"
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {results.map(result => (
                <Card key={result.concept_id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {highlightMatch(result.title)}
                      </h3>
                      {result.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {highlightMatch(result.description.slice(0, 200))}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                          {result.concept_type}
                        </span>
                        {result.difficulty_level && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize">
                            {result.difficulty_level}
                          </span>
                        )}
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getMatchBadge(result.match_type))}>
                          {result.match_type}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(result.score * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{(result.score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
