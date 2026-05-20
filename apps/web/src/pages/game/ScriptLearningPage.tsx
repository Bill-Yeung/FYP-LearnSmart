import { useEffect, useState, useMemo, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { BookOpen, FileText, Check, ArrowRight, Play, ArrowLeft } from "lucide-react"
import { Card, Button } from "../../components"
import { EditableNoteModal } from "../../components/shared/EditableNoteModal"
import * as api from "../../api/playGame"
import type { LearnLaterListDTO } from "../../types/game.dto"

export function ScriptLearningPage() {
  const [learnLater, setLearnLater] = useState<LearnLaterListDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'learned'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'name-asc' | 'name-desc'>('recent')
  const [selectedNote, setSelectedNote] = useState<{title: string, content: string, knowledgeId?: string, scriptId?: string} | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const searchParams = new URLSearchParams(location.search)
  const scriptIdFromQuery = searchParams.get('scriptId')
  const highlightedKnowledgeIdFromQuery = searchParams.get('knowledgeId')
  const scriptIdToFilter = (location.state as any)?.scriptId || scriptIdFromQuery
  const highlightedKnowledgeId = (location.state as any)?.knowledgeId || highlightedKnowledgeIdFromQuery
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
   
  const scriptTitle = (location.state as any)?.scriptTitle

  useEffect(() => {
    const fetchList = async () => {
      try {
        const data = await api.getLearnLaterList(scriptIdToFilter)
        setLearnLater(data)
      } catch (err) {
        console.error("Failed to load learn later list", err)
      } finally {
        setLoading(false)
      }
    }
    fetchList()
  }, [scriptIdToFilter])

  useEffect(() => {
    if (!highlightedKnowledgeId || !learnLater?.items?.length) return
    const element = itemRefs.current[highlightedKnowledgeId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedKnowledgeId, learnLater])
 
  // filter by pending/learned + search term, then sort by date or name
  const items = useMemo(() => {
    if (!learnLater?.items) return []
    const search = searchTerm.trim().toLowerCase()
    const filtered = learnLater.items.filter(item => {
      const candidateFields = [
        item.name,
        item.description,
        item.scriptTitle ?? '',
        item.moduleName ?? '',
        item.subject_code ?? '',
        (item as any).documentName ?? ''
      ]
      return (filter === 'learned' ? item.isLearned : !item.isLearned)
        && (!search || candidateFields.some(field => field?.toLowerCase().includes(search)))
    })
    const sorted = filtered.sort((a, b) => {
      if (sortOrder === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      if (sortOrder === 'oldest') return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
      if (sortOrder === 'name-asc') return a.name.localeCompare(b.name)
      if (sortOrder === 'name-desc') return b.name.localeCompare(a.name)
      return 0
    })
    return sorted
  }, [learnLater, filter, searchTerm, sortOrder])

  // group items by their script/document/module so the ui can show them in sections
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof items> = {}
    items.forEach(item => {
      const moduleName = item.moduleName || item.scriptTitle || 'Unknown Script'
      const documentName = (item as any).documentName || (item as any).document || ''
      const subjectCode = item.subject_code?.trim()
      const title = documentName ? `${subjectCode ? `${subjectCode} - ` : ''}${documentName} - ${moduleName}` : (subjectCode ? `${subjectCode} - ${moduleName}` : moduleName)
      if (!groups[title]) {
        groups[title] = []
      }
      groups[title].push(item)
    })
    return groups
  }, [items])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500 animate-pulse">Loading your learning list...</div>
      </div>
    )
  }

  const handleMarkLearned = async (e: React.MouseEvent, knowledgeId: string, scriptId: string) => {
    e.stopPropagation()
    try {
      await api.markAsMastered({ knowledgeId, scriptId })
      const data = await api.getLearnLaterList(scriptIdToFilter)
      setLearnLater(data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-24 mt-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 inline-block" /> Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white min-w-0">
              {scriptTitle ? `${scriptTitle} - Learn Later` : 'Learn More List'}
            </h1>
           </div>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {scriptTitle 
              ? 'Review the concepts, clues, and questions you saved from this script.' 
              : 'Review the concepts, clues, and questions you saved during gameplay.'}
          </p>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filter === 'pending' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setFilter('pending')}
          >
            To Learn ({(learnLater?.items || []).filter(i => !i.isLearned).length})
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filter === 'learned' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setFilter('learned')}
          >
            Learned ({(learnLater?.items || []).filter(i => i.isLearned).length})
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by concept, description, script title, module, subject code, or document name..."
          className="w-full md:max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="sortOrder" className="text-sm text-gray-500 dark:text-gray-400">Sort:</label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <BookOpen className="w-12 h-12 mx-auto text-blue-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {filter === 'pending' ? "You're all caught up!" : "No learned items yet"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {filter === 'pending' 
              ? "Your to-learn list is empty. Play some games and save concepts to review them here when you miss questions or want to dive deeper!"
              : "Items you mark as learned will appear here"}
          </p>
          {filter === 'pending' && (
            <Button variant="primary" className="mt-6" onClick={() => navigate("/game/my-scripts")}>
              Play Script Kill
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-12 mt-8">
          {Object.entries(groupedItems).map(([title, items]) => (
            <div key={title} className="mb-10">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 mb-6 pb-3">
                <h2 className="text-[1.35rem] font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h2>
                <Button 
                  variant="primary" 
                  className="text-sm px-5 py-2 font-medium shadow-sm transition-transform hover:scale-105 active:scale-95"
                  onClick={() => navigate(`/game/play?scriptId=${items[0].scriptId}`, { state: { scriptId: items[0].scriptId } })}
                >
                  <Play className="w-4 h-4 mr-2 inline-block" /> PLAY
                </Button>
              </div>
              <div className="grid gap-6 md:gap-7 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
                 {items.map((item, index) => {
                   const isHighlighted = item.knowledgeId && item.knowledgeId === highlightedKnowledgeId
                    return (
                  <div
                    key={index}
                    ref={(el) => { if (item.knowledgeId) itemRefs.current[item.knowledgeId] = el }}
                    onClick={() => navigate(`/game/learn-more?id=${item.knowledgeId}`, { state: { isInLearnLater: true, scriptId: item.scriptId } })}
                    className={`group relative flex flex-col h-full p-6 md:p-7 xl:p-8 rounded-3xl bg-white dark:bg-slate-900/80 border transition-all duration-500 cursor-pointer ${
                      isHighlighted 
                        ? 'border-blue-400 shadow-[0_8px_30px_rgb(59,130,246,0.15)] ring-1 ring-blue-400/30 dark:border-blue-500' 
                        : 'border-slate-200/60 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-slate-300 dark:border-slate-800 dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] dark:hover:border-slate-700'
                    } ${item.isLearned ? 'opacity-60 grayscale-[0.2]' : ''}`}
                   >
                     {isHighlighted && (
                       <span className="absolute -top-3 -right-2 z-10 inline-flex items-center rounded-full bg-blue-500 px-3 py-1 text-[11px] uppercase tracking-wider font-bold text-white shadow-sm dark:bg-blue-600">
                         Current Focus
                       </span>
                     )}
                     <div className="flex-1 flex flex-col">
                       <div className="flex justify-between items-start gap-2 mb-3">
                         <span className={`text-[11px] font-bold tracking-wide uppercase ${
                           item.triggerType === 'question' ? 'text-rose-500 dark:text-rose-400' :
                           item.triggerType === 'clue' ? 'text-blue-500 dark:text-blue-400' :
                           'text-slate-400 dark:text-slate-500'
                         }`}>
                           {item.triggerType === 'question' ? 'Missed Question' : 
                            item.triggerType === 'clue' ? 'From Clue' : 'Saved manually'}
                         </span>
                         <span className="text-[11px] text-slate-400 font-medium">
                           {new Date(item.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                         </span>
                       </div>
 
                       <h3 className="text-[1.1rem] font-bold text-slate-800 dark:text-white leading-snug mb-2 line-clamp-2 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                         {item.name}
                       </h3>
                       <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                         {item.description}
                       </p>
 
                       {(item.triggerInfo?.wrongAnswer || item.triggerInfo?.questionContent || item.triggerInfo?.clueName) && (
                         <div className="mt-5 pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-2.5">
                           {item.triggerType === 'question' && item.triggerInfo?.questionContent && (
                             <p className="text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                               "{item.triggerInfo.questionContent}"
                             </p>
                           )}
                           {item.triggerType === 'question' && item.triggerInfo?.wrongAnswer && (
                             <p className="text-[12px] text-rose-500/90 dark:text-rose-400/90 line-clamp-1">
                               <span className="font-medium mr-1 text-slate-700 dark:text-slate-300">You answered:</span> 
                               {item.triggerInfo.wrongAnswer}
                             </p>
                           )}
                           {item.triggerType === 'clue' && item.triggerInfo?.clueName && (
                             <p className="text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                               Clue: {item.triggerInfo.clueName}
                             </p>
                           )}
                         </div>
                       )}
 
                       {item.personalNotes && (
                         <div className="mt-5">
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               if (item.personalNotes) {
                                 setSelectedNote({ title: item.name, content: item.personalNotes, knowledgeId: item.knowledgeId, scriptId: item.scriptId });
                               }
                             }}
                             className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-blue-700 bg-blue-50/80 border border-blue-100 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-900/50 transition-colors"
                           >
                             <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                             View My Notes
                           </button>
                         </div>
                       )}
                     </div>
                    
                     <div className="flex items-center justify-between gap-3 mt-7 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                       {!item.isLearned ? (
                         <button
                           className="text-[13px] font-semibold text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400 transition-colors flex items-center"
                           onClick={(e) => handleMarkLearned(e, item.knowledgeId, item.scriptId)}
                         >
                           <Check className="w-4 h-4 mr-1.5" /> Mark as learned
                         </button>
                       ) : <div />}
                       
                       <button
                         className="text-[13px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center group-hover:translate-x-1 transition-all"
                         onClick={(e) => {
                           e.stopPropagation()
                           navigate(`/game/learn-more?id=${item.knowledgeId}`, { state: { isInLearnLater: true, scriptId: item.scriptId } })
                         }}
                       >
                         Learn more <ArrowRight className="w-4 h-4 ml-1" />
                       </button>
                     </div>
                  </div>
                 )})}
               </div>
            </div>
          ))}
        </div>
      )}

      <EditableNoteModal
        isOpen={!!selectedNote}
        onClose={() => setSelectedNote(null)}
        title={`My Notes: ${selectedNote?.title}`}
        initialContent={selectedNote?.content}
        onSave={async (newContent) => {
          if (selectedNote?.knowledgeId && selectedNote?.scriptId) {
            try {
              await api.updateLearningProgress({
                knowledgeId: selectedNote.knowledgeId,
                scriptId: selectedNote.scriptId,
                personalNotes: newContent,
              });
              
              setLearnLater(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  items: prev.items.map(item => 
                    item.knowledgeId === selectedNote.knowledgeId && item.scriptId === selectedNote.scriptId
                      ? { ...item, personalNotes: newContent }
                      : item
                  )
                };
              });

              setSelectedNote({ ...selectedNote, content: newContent });
            } catch (err) {
              console.error("Failed to update personal note:", err);
            }
          }
        }}
      />
    </div>
  )
}
