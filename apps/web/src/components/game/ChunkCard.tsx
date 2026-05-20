import { Button } from "../../components"
import type { ChunkDTO } from "../../types/game.dto"
import { normalizeChunkText } from "../../lib/text"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { useMemo } from "react"
import { Pin } from "lucide-react"

export interface ChunkCardProps {
  chunk: ChunkDTO
  showFullText?: boolean
  onViewChunk?: (chunkId: string) => void
  className?: string
}

export function ChunkCard({ chunk, showFullText = false, onViewChunk, className }: ChunkCardProps) {
  const renderedContent = useMemo(() => {
    try {
      const normalized = normalizeChunkText(chunk.text)
      const rawHtml = marked.parse(normalized, { 
        breaks: true, 
        gfm: true 
      })
      return DOMPurify.sanitize(rawHtml as string)
    } catch (e) {
      console.error("Error parsing chunk markdown:", e)
      return ""
    }
  }, [chunk.text])

  return (
    <details 
      className={`group relative bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-lg border border-indigo-100 dark:border-indigo-800/30 ${className ?? ""}`}
      open={showFullText}
    >
      <summary className="mb-2 flex cursor-pointer list-none flex-wrap items-center gap-2 outline-none">
        <span className="font-semibold text-indigo-700 dark:text-indigo-300 text-sm inline-flex items-center">
          <Pin className="w-4 h-4 mr-1 text-indigo-500" /> 
          {chunk.sectionTitle || `Chunk ${chunk.id}`}
        </span>
        {chunk.pageNumber !== undefined && (
          <span className="text-xs text-gray-500 dark:text-gray-400">Page {chunk.pageNumber}</span>
        )}
        <span className="ml-auto text-xs font-medium text-indigo-500 dark:text-indigo-400 group-open:hidden hover:underline">
          ▼ Expand
        </span>
        <span className="ml-auto text-xs font-medium text-indigo-500 dark:text-indigo-400 hidden group-open:block hover:underline">
          ▲ Collapse
        </span>
      </summary>

      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-lg" />

      <div className="mt-4">
        {chunk.summary && (
          <div className="mb-4 p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-sm text-indigo-700 dark:text-indigo-300">
            <strong className="mr-1">Summary:</strong> {chunk.summary}
          </div>
        )}

        <div 
          className="text-gray-700 dark:text-gray-300 mb-4 font-sans text-sm leading-relaxed border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 prose dark:prose-invert max-w-none prose-sm prose-p:my-2 prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 outline-none break-words overflow-x-auto pb-4 pr-4"
          style={{ scrollbarGutter: 'stable' }}
          dangerouslySetInnerHTML={{ __html: renderedContent || normalizeChunkText(chunk.text) }}
        />

        <div className="flex flex-wrap gap-2 items-center mb-2">
          {chunk.mainConcepts?.map((concept) => (
            <span key={`main-${concept}`} className="rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 dark:bg-emerald-900/30 dark:text-emerald-200">
              {concept}
            </span>
          ))}
          {chunk.secondaryConcepts?.map((concept) => (
            <span key={`secondary-${concept}`} className="rounded-full bg-blue-100 text-blue-700 text-[11px] px-2 py-0.5 dark:bg-blue-900/30 dark:text-blue-200">
              {concept}
            </span>
          ))}
        </div>

        {onViewChunk && (
          <div className="flex justify-end mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.preventDefault()
                onViewChunk(chunk.id)
              }}
              className="text-xs"
            >
              View as Modal
            </Button>
          </div>
        )}
      </div>
    </details>
  )
}
