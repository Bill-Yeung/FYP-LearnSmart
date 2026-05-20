import React, { useEffect, useState } from "react"
import { Button } from "../index"
import { ChunkCard } from "./ChunkCard"
import type { ChunkDTO } from "../../types/game.dto"

export interface ChunkModalProps {
  chunk: ChunkDTO
  onClose: () => void
}

export const ChunkModal: React.FC<ChunkModalProps> = ({ chunk, onClose }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-xl transform transition-all duration-300 ease-out flex flex-col max-h-[90vh] ${
          mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            📄 Document Excerpt Detail
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          <ChunkCard chunk={chunk} showFullText={true} />
        </div>
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}