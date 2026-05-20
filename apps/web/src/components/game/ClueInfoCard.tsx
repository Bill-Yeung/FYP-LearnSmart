import React from "react"
import type { ClueDTO, CharacterDTO } from "../../types/game.dto"
import { Info } from "lucide-react"

interface ClueInfoCardProps {
  clue: ClueDTO
  characters: CharacterDTO[]
  compact?: boolean
}

export const ClueInfoCard: React.FC<ClueInfoCardProps> = ({ 
  clue, 
  characters, 
  compact = false 
}) => {
  const getCharacterName = (identifier: string): string => {
    if (!identifier) return identifier
    
    const character = characters.find(c => 
      c.characterId === identifier || c.name.toLowerCase() === identifier.toLowerCase()
    )
    return character?.name || identifier
  }

  const isCharacterId = (str: string): boolean => {
    return /^[A-Z]+_\d+$/.test(str) || /^[a-f0-9-]{36}$/.test(str)
  }

  const getFoundByDisplay = (): { type: 'character' | 'location' | 'method'; display: string } => {
    if (!clue.foundBy) return { type: 'method', display: '' }
    
    if (isCharacterId(clue.foundBy)) {
      return {
        type: 'character',
        display: getCharacterName(clue.foundBy)
      }
    }
    
    return {
      type: 'method',
      display: clue.foundBy
    }
  }

  const foundByInfo = getFoundByDisplay()

  if (compact) {
    return (
      <div className="text-xs space-y-0.5 text-indigo-600 dark:text-indigo-300">
        {clue.foundBy && (
          <div className="flex items-start gap-1">
            <span className="font-semibold flex-shrink-0">Found:</span>
            <span className="flex-1">
              {foundByInfo.type === 'character' ? (
                <span className="inline-flex items-center gap-1">
                  <span className="bg-indigo-100 dark:bg-indigo-900/30 px-1 py-0.5 rounded">
                    {foundByInfo.display}
                  </span>
                </span>
              ) : (
                foundByInfo.display
              )}
            </span>
          </div>
        )}
        {clue.reveals && (
          <div className="flex items-start gap-1">
            <span className="font-semibold flex-shrink-0">Reveals:</span>
            <span className="line-clamp-1">{clue.reveals}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clue.foundBy && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-semibold text-blue-700 dark:text-blue-400">Found by: </span>
                {foundByInfo.type === 'character' ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs border border-blue-200 dark:border-blue-700">
                        {foundByInfo.display}
                      </span>
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      This clue was discovered from {foundByInfo.display}
                    </p>
                  </>
                ) : (
                  <span className="text-gray-700 dark:text-gray-300">{foundByInfo.display}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {clue.reveals && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-semibold text-amber-700 dark:text-amber-400">Reveals: </span>
                <span className="text-gray-700 dark:text-gray-300">{clue.reveals}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
