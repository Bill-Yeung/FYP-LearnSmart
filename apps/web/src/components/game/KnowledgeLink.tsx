import React from "react"
import type { KnowledgeDTO } from "../../types/game.dto"
import { BookOpen, ExternalLink } from "lucide-react"

interface KnowledgeLinkProps {
  knowledge: KnowledgeDTO
  variant?: 'compact' | 'full'
  showIcon?: boolean
  onClick: (knowledgeId: string) => void
}

export const KnowledgeLink: React.FC<KnowledgeLinkProps> = ({
  knowledge,
  variant = 'compact',
  showIcon = false,
  onClick
}) => {
  if (variant === 'compact') {
    return (
      <button
        onClick={() => onClick(knowledge.knowledgeId)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-700/50"
        title={`Click to learn more about: ${knowledge.name}`}
      >
        {showIcon && <BookOpen className="w-3 h-3" />}
        {knowledge.name}
        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
      </button>
    )
  }

  return (
    <button
      onClick={() => onClick(knowledge.knowledgeId)}
      className="w-full text-left p-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      title={`Click to learn more about: ${knowledge.name}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="font-medium text-blue-900 dark:text-blue-100 truncate">
            {knowledge.name}
          </span>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0 ml-2" />
      </div>
      {knowledge.description && (
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 line-clamp-2">
          {knowledge.description}
        </p>
      )}
    </button>
  )
}
