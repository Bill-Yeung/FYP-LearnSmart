import React, { useEffect, useState } from "react"
import { Button } from "../index"
import { ClueInfoCard } from "./ClueInfoCard"
import type { ClueDTO, KnowledgeDTO, ScriptDTO } from "../../types/game.dto"
import { Pin, Link, Check } from "lucide-react"

export interface ClueModalProps {
  clue: ClueDTO
  knowledgeMap: Map<string, KnowledgeDTO>
  script?: ScriptDTO
  isInLearnLater: (knowledgeId: string) => boolean
  onAddToLearnLater: (knowledgeId: string) => void
  onViewKnowledge?: (knowledgeId: string) => void
  onClose: () => void
}

export const ClueModal: React.FC<ClueModalProps> = ({ 
  clue, 
  knowledgeMap,
  script,
  isInLearnLater,
  onAddToLearnLater,
  onViewKnowledge,
  onClose 
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-xl transform transition-all duration-300 ease-out flex flex-col max-h-[85vh] ${
          mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 flex items-center">
              <Pin className="w-5 h-5 mr-1.5" /> {clue.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg font-mono text-sm mb-4">
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {clue.description}
            </p>
          </div>

          {(clue.foundBy || clue.reveals) && script && (
            <div className="mb-4">
              <ClueInfoCard clue={clue} characters={script.characters} compact={false} />
            </div>
          )}

          {/* Related Knowledge */}
          {clue.relatedKnowledge.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <Link className="w-4 h-4 mr-1.5" /> Related Knowledge:
              </div>
              <div className="flex flex-wrap gap-2">
                {clue.relatedKnowledge.map(kId => {
                  const knowledge = knowledgeMap.get(kId)
                  const inLearnLater = isInLearnLater(kId)
                  return knowledge ? (
                    <button
                      key={kId}
                      onClick={() => onViewKnowledge?.(kId)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        inLearnLater
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700/50'
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700/50'
                      }`}
                      title={`Click to learn more: ${knowledge.name}`}
                    >
                      {knowledge.name}
                      {inLearnLater && <Check className="w-3 h-3" />}
                    </button>
                  ) : (
                    <span key={kId} className="text-xs text-gray-500">{kId}</span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="secondary" 
              onClick={() => onAddToLearnLater(clue.relatedKnowledge[0])}
              className="flex items-center gap-2"
            >
              <Pin className="w-4 h-4" /> Add to Learn Later
            </Button>
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}