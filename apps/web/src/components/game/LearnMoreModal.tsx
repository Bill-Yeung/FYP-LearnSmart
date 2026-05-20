import React, { useEffect, useState } from "react"
import { Button } from "../index"
import { ChunkCard } from "./ChunkCard"
import type { KnowledgeDTO } from "../../types/game.dto"
import { FileText, Bot, Pin, CheckCircle2, Check } from "lucide-react"

export interface LearnMoreModalProps {
  knowledge: KnowledgeDTO
  onClose: () => void
  onAddToLearnLater: () => void
  onMarkAsLearned: () => void
  isInLearnLater: boolean
  onPrev?: () => void
  onNext?: () => void
  onDeepDive?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

export const LearnMoreModal: React.FC<LearnMoreModalProps> = ({
  knowledge,
  onClose,
  onAddToLearnLater,
  onMarkAsLearned,
  isInLearnLater,
  onPrev,
  onNext,
  onDeepDive,
  hasPrev,
  hasNext
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-xl transform transition-all duration-300 ease-out ${
          mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                {knowledge.name}
              </h2>
              <span className="inline-block mt-1 text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded">
                {knowledge.category} · Level {knowledge.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="px-3 py-1 rounded text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                ← Prev
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="px-3 py-1 rounded text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                Next →
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="prose dark:prose-invert max-w-none mb-6">
            <div className="text-gray-700 dark:text-gray-300">
              {knowledge.description.split(/\n\s*\n/).map((paragraph, i) => (
                <p key={i} className="mb-3 whitespace-pre-wrap leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            {knowledge.relatedChunksText && knowledge.relatedChunksText.length > 0 && (
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 flex items-center mb-4">
                  <FileText className="w-5 h-5 mr-2 text-indigo-400" /> Origin Context
                </h3>
                <div className="space-y-4">
                  {knowledge.relatedChunksText.map((chunkText, idx) => (
                    <ChunkCard
                      key={`related-${idx}`}
                      chunk={{
                        id: `related-${idx}`,
                        text: chunkText,
                        mainConcepts: [],
                        secondaryConcepts: [],
                        summary: "",
                        sectionTitle: `Document Excerpt ${idx + 1}`,
                      }}
                      showFullText
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 flex-wrap">
            {onDeepDive && (
              <Button variant="primary" onClick={onDeepDive} className="flex items-center gap-2">
                <Bot className="w-4 h-4" /> Deep Dive (AI Tutor)
              </Button>
            )}
            {!isInLearnLater ? (
              <Button variant="secondary" onClick={onAddToLearnLater} className="flex items-center gap-2">
                <Pin className="w-4 h-4" /> Add to Learn Later
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={onMarkAsLearned} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Mark as Learned
                </Button>
                <div className="flex items-center px-4 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
                    <Check className="w-4 h-4 mr-1" /> In Learn Later List
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}