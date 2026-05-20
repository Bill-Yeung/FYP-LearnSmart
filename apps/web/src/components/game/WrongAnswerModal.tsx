import React, { useEffect, useState } from "react"
import { Button } from "../index"
import { Lightbulb, Search, BookOpen, Pin, ClipboardList } from "lucide-react"

export interface WrongAnswerModalProps {
  selectedAnswer: string
  rationale?: string
  clues: Array<{ name: string; description: string }>
  suggestedKnowledge: Array<{ name: string; description: string }>
  autoAddedItems: Array<{ name: string; source: string }>
  onContinue: () => void
  onViewLearnLater: () => void
  onReportIssue?: () => void
}

export const WrongAnswerModal: React.FC<WrongAnswerModalProps> = ({
  selectedAnswer,
  rationale,
  clues,
  suggestedKnowledge,
  autoAddedItems,
  onContinue,
  onViewLearnLater,
  onReportIssue
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4 transition-all">
      <div 
        className={`bg-white dark:bg-gray-900 rounded-2xl w-full max-w-xl sm:max-w-[34rem] shadow-2xl border border-rose-200/80 dark:border-rose-900/40 overflow-hidden transform transition-all duration-300 ease-out ${mounted ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}
      >
        <div className="bg-rose-50 dark:bg-rose-900/35 px-5 py-4 border-b border-rose-100 dark:border-rose-800/50 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-200">Incorrect Deduction</h2>
            <p className="text-sm text-rose-600 dark:text-rose-300">Oops! Evidence suggests a different path—let’s carefully recheck and try again.</p>
          </div>
        </div>
        
        <div className="p-5 space-y-5 max-h-[72vh] overflow-y-auto custom-scrollbar">
          {/* Answer Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your Hypothesis</h3>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 italic border-l-4 border-l-red-400">
              "{selectedAnswer}"
            </div>
            {rationale && (
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 text-sm rounded-lg border border-orange-200 dark:border-orange-800/50 flex items-start gap-2 shadow-sm">
                <span className="text-orange-600 dark:text-orange-400 mt-0.5"><Lightbulb className="w-4 h-4" /></span>
                <div>
                  <span className="font-semibold mb-1 block">Detective's Note:</span>
                  <span className="opacity-90">{rationale}</span>
                </div>
              </div>
            )}
          </div>
          
          {clues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <span><Search className="w-4 h-4" /></span> Overlooked Clues
              </h3>
              <div className="grid gap-2">
                {clues.map((clue, idx) => (
                  <div key={idx} className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                    <div className="text-sm font-bold text-teal-900 dark:text-teal-200">{clue.name}</div>
                    <div className="text-sm text-teal-700 dark:text-teal-300/90 mt-1">{clue.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {suggestedKnowledge.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <span><BookOpen className="w-4 h-4" /></span> Suggested Theory
              </h3>
              <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-3 space-y-2">
                {suggestedKnowledge.map((k, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="mt-0.5 text-blue-400">•</div>
                    <div>
                      <span className="font-semibold text-sky-900 dark:text-sky-200 mr-2">{k.name}</span>
                      <span className="text-sm text-sky-700 dark:text-sky-300/80">{k.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {autoAddedItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span><Pin className="w-4 h-4" /></span> Added to Case File
              </h3>
              <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3 space-y-2">
                {autoAddedItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 text-sm text-amber-800 dark:text-amber-200">
                    <div className="mt-0.5 text-amber-400">•</div>
                    <div>{item.name} <span className="opacity-70 text-xs ml-1">(From {item.source})</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center gap-3 rounded-b-2xl">
          <div>
            {onReportIssue && (
              <button 
                onClick={onReportIssue}
                className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                Does this theory look absurd? Report & Skip
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onViewLearnLater} className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> View Case Files
            </Button>
            <Button variant="primary" onClick={onContinue} className="shadow-md hover:shadow-lg transition-all">
              Continue Investigation
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}