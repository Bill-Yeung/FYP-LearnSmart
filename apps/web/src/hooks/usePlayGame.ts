import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import * as api from "../api/playGame"
import { normalizeChunkText } from "../lib/text"
import type {
  ScriptDTO,
  UserProgressDTO,
  ClueDTO,
  KnowledgeDTO,
  SequencingItemDTO,
  LearnLaterListDTO,
  EndingDTO,
  ChunkDTO
} from "../types/game.dto"

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

export function usePlayGame() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const scriptId = params.get('scriptId') || (location.state as { scriptId?: string })?.scriptId

  const [script, setScript] = useState<ScriptDTO | null>(null)

  const [progress, setProgress] = useState<UserProgressDTO | null>(null)
  const [learnLater, setLearnLater] = useState<LearnLaterListDTO | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [freeTextAnswer, setFreeTextAnswer] = useState('')
  const [sequencingOrder, setSequencingOrder] = useState<string[]>([])
  const [sequencingItems, setSequencingItems] = useState<SequencingItemDTO[]>([])
  const [wrongCount, setWrongCount] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [currentHint, setCurrentHint] = useState('')
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [canSubmit, setCanSubmit] = useState(true)
  const [canNext, setCanNext] = useState(false)
  const [usedShowAnswer, setUsedShowAnswer] = useState(false)
  const [detectiveAskCount, setDetectiveAskCount] = useState(0)
  const [detectiveIsThinking, setDetectiveIsThinking] = useState(false)
  const [wrongAttemptValues, setWrongAttemptValues] = useState<string[]>([])

  const [selectedClue, setSelectedClue] = useState<ClueDTO | null>(null)
  const [knowledgeIndex, setKnowledgeIndex] = useState<number | null>(null)
  const [showWrongModal, setShowWrongModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedNote, setSelectedNote] = useState<{title: string, content: string, knowledgeId?: string} | null>(null)
  const [lastWrongAnswer, setLastWrongAnswer] = useState<string>('')
  const [wrongAnswerRationale, setWrongAnswerRationale] = useState<string>('')
  const [highlightedClues, setHighlightedClues] = useState<string[]>([])
  const [showAchievement, setShowAchievement] = useState(false)
  const [achievedEnding, setAchievedEnding] = useState<EndingDTO | null>(null)
  const [selectedChunk, setSelectedChunk] = useState<ChunkDTO | null>(null)
  const [characterTrust, setCharacterTrust] = useState<Record<string, number>>({})
  const [wrongAnswerReviewData, setWrongAnswerReviewData] = useState<{
    clues: Array<{ name: string; description: string }>,
    suggestedKnowledge: Array<{ name: string; description: string }>,
    autoAddedItems: Array<{ name: string; source: string }>
  } | null>(null)

  const currentQuestion = useMemo(() => {
    if (!script) return null
    return script.questions[currentQuestionIndex] || null
  }, [script, currentQuestionIndex])

  const currentScene = useMemo(() => {
    if (!script || !currentQuestion) return null
    return script.scenes.find(s => s.sceneId === currentQuestion.sceneId) || null
  }, [script, currentQuestion])

  const sceneClues = useMemo(() => {
    if (!script || !currentScene) return []
    return script.clues.filter(c =>
      c.foundInScene === currentScene.sceneId ||
      (currentScene.clues && currentScene.clues.includes(c.clueId))
    )
  }, [script, currentScene])

  const sceneQuestions = useMemo(() => {
    if (!script || !currentScene) return []
    return script.questions
      .filter(q => q.sceneId === currentScene.sceneId)
      .sort((a, b) => a.order - b.order)
  }, [script, currentScene])

  const sceneCharacters = useMemo(() => {
    if (!script || !currentScene) return []
    return script.characters.filter(c => currentScene.charactersPresent.includes(c.characterId))
  }, [script, currentScene])

  const unlockedClues = useMemo(() => {
    if (!sceneClues || !progress) return []
    return sceneClues.filter(c => progress.unlockedClues.includes(c.clueId))
  }, [sceneClues, progress])

  const knowledgeMap = useMemo(() => {
    if (!script) return new Map<string, KnowledgeDTO>()
    return new Map(script.knowledgeBase.map(k => [k.knowledgeId, k]))
  }, [script])

  const caseFiles = useMemo(() => {
    if (!script || !currentScene) return []

    const knowledgeIds = new Set<string>()
    sceneClues.forEach(clue => {
      clue.relatedKnowledge.forEach(id => knowledgeIds.add(id))
    })
    sceneQuestions.forEach(q => {
      knowledgeIds.add(q.knowledgeId)
      q.relatedKnowledge?.forEach(id => knowledgeIds.add(id))
    })

    return Array.from(knowledgeIds)
      .map(id => knowledgeMap.get(id))
      .filter((k): k is KnowledgeDTO => k !== undefined)
  }, [script, currentScene, sceneClues, sceneQuestions, knowledgeMap])

  const sceneContext = useMemo(() => {
    if (!currentScene) return null
    return {
      title: currentScene.title || `Scene ${currentScene.order || 1}`,
      location: currentScene.location || 'Unknown Location',
      description: currentScene.description || 'You arrive at the scene.',
      characters: sceneCharacters.map(c => c.name).join(', ') || 'No one else is here'
    }
  }, [currentScene, sceneCharacters])

  const isInLearnLater = (knowledgeId: string) => {
    return learnLater?.items.some(item => item.knowledgeId === knowledgeId && !item.isLearned && item.scriptId === scriptId) || false
  }

  const getCharacterTrust = (characterId: string): number => {
    return characterTrust[characterId] ?? 50
  }

  const adjustCharacterTrust = (characterId: string, delta: number) => {
    setCharacterTrust(prev => ({
      ...prev,
      [characterId]: Math.max(0, Math.min(100, (prev[characterId] ?? 50) + delta))
    }))
  }

  const getPersonalNote = (knowledgeId: string) => {
    return learnLater?.items.find(item => item.knowledgeId === knowledgeId && item.scriptId === scriptId)?.personalNotes || null
  }

  const getClueLearnLaterStatus = (clue: ClueDTO) => {
    return clue.relatedKnowledge.some(kId => isInLearnLater(kId))
  }

  const getCharacterKnowledgeNames = (characterId: string) => {
    const character = script?.characters.find(c => c.characterId === characterId)
    if (!character) return []
    return character.knowledgePoints.map(kId => ({
      knowledgeId: kId,
      name: knowledgeMap.get(kId)?.name || kId,
      inLearnLater: isInLearnLater(kId)
    }))
  }

  // load script, progress and learn-later list; jump the user to their first unanswered question
  useEffect(() => {
    if (!scriptId) {
      navigate('/game/my-scripts')
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const scriptData = await api.getScript(scriptId)
        const normalizedScriptData: ScriptDTO = {
          ...scriptData,
          questions: toArray(scriptData?.questions),
          scenes: toArray(scriptData?.scenes),
          clues: toArray(scriptData?.clues).map((clue: any) => ({
            ...clue,
            relatedKnowledge: toArray(clue?.relatedKnowledge),
          })),
          knowledgeBase: toArray(scriptData?.knowledgeBase),
          characters: toArray(scriptData?.characters).map((char: any) => ({
            ...char,
            knowledgePoints: toArray(char?.knowledgePoints),
          })),
          endings: toArray(scriptData?.endings),
        }

        setScript(normalizedScriptData)
        const initialTrust = normalizedScriptData.characters?.reduce<Record<string, number>>((acc, char) => {
          acc[char.characterId] = 50
          return acc
        }, {})
        setCharacterTrust(initialTrust)

        const progressData = await api.getUserProgress(scriptId)
        setProgress(progressData)

        if (progressData.answeredQuestions && progressData.answeredQuestions.length > 0 && normalizedScriptData.questions?.length > 0) {
          const firstUnansweredIndex = normalizedScriptData.questions.findIndex(q => !progressData.answeredQuestions.includes(q.questionId))
          if (firstUnansweredIndex !== -1) {
            setCurrentQuestionIndex(firstUnansweredIndex)
          } else {
            setCurrentQuestionIndex(normalizedScriptData.questions.length - 1)
            setShowAchievement(true)
          }
        }

        if (normalizedScriptData.documentHash) {
          try {
            const chunks = await api.getParsedDocumentChunks(normalizedScriptData.documentHash)
            normalizedScriptData.knowledgeBase.forEach(knowledge => {
              const matchedChunks = chunks.filter(chunk =>
                chunk.mainConcepts?.includes(knowledge.name) ||
                chunk.secondaryConcepts?.includes(knowledge.name)
              )
              if (matchedChunks.length > 0) {
                knowledge.relatedChunksText = matchedChunks.map(c => normalizeChunkText(c.text))
              }
            })
            normalizedScriptData.clues.forEach(clue => {
              const relatedKnowledgeNames = clue.relatedKnowledge
                .map(kId => normalizedScriptData.knowledgeBase.find(kb => kb.knowledgeId === kId)?.name)
                .filter(Boolean)
              const matchedChunks = chunks.filter(chunk =>
                relatedKnowledgeNames.some(name =>
                  chunk.mainConcepts?.includes(name as string) ||
                  chunk.secondaryConcepts?.includes(name as string)
                )
              )
              if (matchedChunks.length > 0) {
                clue.relatedChunks = matchedChunks.map(c => ({ id: c.id, title: c.sectionTitle || `Chunk ${c.id}`, text: normalizeChunkText(c.text) }))
              }
            })
          } catch (e) {
            console.error("Failed to load chunks to decorate script", e)
          }
        }

        const learnLaterData = await api.getLearnLaterList()
        setLearnLater(learnLaterData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [scriptId, navigate])

  // reset the answer ui whenever the current question changes
  useEffect(() => {
    setSelectedOption(null)
    setFreeTextAnswer('')
    setSequencingOrder([])
    setWrongCount(0)
    setDetectiveAskCount(0)
    setShowHint(false)
    setCanSubmit(true)
    setCanNext(false)
    setFeedback(null)

    if (currentQuestion?.type === 'sequencing' && currentQuestion.items) {
      setSequencingItems([...currentQuestion.items])
      setSequencingOrder(currentQuestion.items.map(item => item.itemId))
    }
  }, [currentQuestion])

  const handleShowAnswer = async () => {
    if (!currentQuestion || !scriptId) return

    let answerText = "Unknown"

    if (currentQuestion.type === 'multiple_choice') {
      const correctOpt = currentQuestion.options?.find(o => o.isCorrect)
      if (correctOpt) answerText = correctOpt.content
    } else if (currentQuestion.type === 'fill_in_blank') {
      answerText = currentQuestion.correctAnswer || "Unknown"
    } else if (currentQuestion.type === 'sequencing') {
      if (currentQuestion.correctOrder && currentQuestion.items) {
        const texts = currentQuestion.correctOrder
          .map(seqId => currentQuestion.items?.find(i => i.itemId === seqId)?.content)
          .filter(Boolean)
        answerText = texts.length > 0 ? texts.join(" ➔ ") : "Refer to the correct logical sequence"
      } else {
        answerText = "Refer to the correct logical sequence"
      }
    } else if (currentQuestion.type === 'short_answer') {
      answerText = "Refer to the suggested knowledge to formulate your answer."
    }

    setFeedback({ message: `💡 Hint (Correct Answer): ${answerText}`, type: 'info' })
    setUsedShowAnswer(true)

    const knowledgeIds = [currentQuestion.knowledgeId, ...(currentQuestion.relatedKnowledge || [])]
    let added = false
    for (const kId of knowledgeIds) {
      if (kId && !isInLearnLater(kId)) {
        try {
          await api.addToLearnLater({
            knowledgeId: kId,
            scriptId,
            triggerType: 'question',
            triggerId: currentQuestion.questionId
          })
          added = true
        } catch (e) {
          console.error("Failed to add to learn later", e)
        }
      }
    }

    if (added) {
      api.getLearnLaterList().then(setLearnLater).catch(console.error)
    }
  }

  // ask the server for a detective-style hint, passing previous wrong attempts as context
  const handleAskDetective = async () => {
    if (!currentQuestion || !scriptId) return
    const nextAskCount = detectiveAskCount + 1
    setDetectiveAskCount(nextAskCount)
    setDetectiveIsThinking(true)
    setShowHint(true)
    setCurrentHint('')

    try {
      const response = await api.askDetective({
        scriptId,
        sceneId: currentQuestion.sceneId,
        questionId: currentQuestion.questionId,
        wrongAnswers: wrongAttemptValues,
        askCount: nextAskCount
      })
      setCurrentHint(response.feedback || 'The detective is drawing a blank. Look closer at the evidence.')
    } catch (error) {
      console.error(error)
      setCurrentHint('The communication broke down. Keep trying rookie!')
    } finally {
      setDetectiveIsThinking(false)
    }
  }

  const handleSubmit = async () => {
    if (!currentQuestion || !progress || !script || !currentScene) return

    let localIsCorrect = false
    let feedbackMessage = ''
    let unlockClues: string[] = []

    if (currentQuestion.type === 'multiple_choice') {
      if (!selectedOption) {
        setFeedback({ message: 'Please select an option', type: 'error' })
        return
      }
      const selectedOptionDetails = currentQuestion.options?.find(opt => opt.optionId === selectedOption)
      if (selectedOptionDetails) {
        localIsCorrect = selectedOptionDetails.isCorrect
        feedbackMessage = selectedOptionDetails.feedback || ''
        unlockClues = selectedOptionDetails.unlockClues || []
      }
    } else if (currentQuestion.type === 'sequencing') {
      if (!sequencingOrder.length) {
        setFeedback({ message: 'Please arrange the items', type: 'error' })
        return
      }
      localIsCorrect = JSON.stringify(sequencingOrder) === JSON.stringify(currentQuestion.correctOrder)
      feedbackMessage = localIsCorrect ? 'Correct order!' : 'Incorrect order. Try again.'
    } else if (currentQuestion.type === 'fill_in_blank') {
      if (!freeTextAnswer || !freeTextAnswer.trim()) {
        setFeedback({ message: 'Please enter your answer.', type: 'error' })
        return
      }
      feedbackMessage = ''
      unlockClues = []
    } else if (currentQuestion.type === 'short_answer') {
      if (!freeTextAnswer || !freeTextAnswer.trim()) {
        setFeedback({ message: 'Please provide your response.', type: 'error' })
        return
      }
      localIsCorrect = true
      feedbackMessage = 'Your answer has been recorded and will be reviewed for learning outcomes.'
      unlockClues = []
    }

    let isCorrect = localIsCorrect
    let backendFeedbackMessage = ''

    try {
      const res = await api.submitAnswer(scriptId!, {
        questionId: currentQuestion.questionId,
        sceneId: currentQuestion.sceneId,
        knowledgeId: currentQuestion.knowledgeId,
        selectedOption: currentQuestion.type === 'multiple_choice' ? (selectedOption || undefined) : undefined,
        sequencingOrder: currentQuestion.type === 'sequencing' ? sequencingOrder : undefined,
        answerText: (currentQuestion.type === 'fill_in_blank' || currentQuestion.type === 'short_answer') ? freeTextAnswer.trim() : undefined,
        attemptNumber: wrongCount + 1,
        hintsUsed: usedShowAnswer ? 999 : (showHint ? 1 : 0)
      })
      
      if (currentQuestion.type !== 'multiple_choice' && currentQuestion.type !== 'sequencing') {
        isCorrect = res.isCorrect
        if (res.feedback) {
          backendFeedbackMessage = res.feedback
        }
      } else {
        isCorrect = res.isCorrect
        if (res.feedback) {
          backendFeedbackMessage = res.feedback
        }
      }
    } catch (err) {
      console.error("Failed to submit answer:", err)
      setFeedback({ message: 'Error submitting answer. Please try again.', type: 'error' })
      return
    }

    feedbackMessage = backendFeedbackMessage || feedbackMessage


    if (currentQuestion.speaker) {
      const speakerChar = script.characters.find(char => char.name === currentQuestion.speaker)
      if (speakerChar) {
        const oldTrust = getCharacterTrust(speakerChar.characterId)
        const delta = isCorrect ? 8 : -4
        adjustCharacterTrust(speakerChar.characterId, isCorrect ? 8 : -4)
        const newTrust = Math.max(0, Math.min(100, oldTrust + delta))
        if (isCorrect) {
          feedbackMessage += ` ${speakerChar.name} feels more confident in you.`
        } else {
          feedbackMessage += ` ${speakerChar.name} becomes a bit more suspicious.`
        }
        if (feedbackMessage.length < 250) {
          feedbackMessage += ` (${speakerChar.name} trust: ${newTrust}%).`
        }
      }
    }

    if (isCorrect) {
      setFeedback({ message: (feedbackMessage || 'Correct!') + (unlockClues.length > 0 ? ` You uncovered: ${unlockClues.map(cId => script?.clues.find(c => c.clueId === cId)?.name || 'New Evidence').join(', ')}!` : ''), type: 'success' })
      setCanSubmit(false)
      setCanNext(true)

      setProgress(prev => {
        if (!prev) return prev
        return {
          ...prev,
          unlockedClues: [...new Set([...prev.unlockedClues, ...unlockClues])],
          answeredQuestions: [...new Set([...prev.answeredQuestions, currentQuestion.questionId])],
          correctAnswers: [...new Set([...prev.correctAnswers, currentQuestion.questionId])]
        }
      })
    } else {
      const selectedAnswerText = currentQuestion.options?.find(o => o.optionId === selectedOption)?.content || ''
      setLastWrongAnswer(selectedAnswerText)
      setWrongAnswerRationale(feedbackMessage && feedbackMessage !== 'Incorrect. Try again.' && feedbackMessage !== 'Not quite, please try again.' ? feedbackMessage : 'Review the clues and evidence gathered so far, and reconsider your approach.')

      const knowledgeIds = [currentQuestion.knowledgeId, ...(currentQuestion.relatedKnowledge || [])]
      const suggestedKnowledge = knowledgeIds
        .map(id => knowledgeMap.get(id))
        .filter((k): k is KnowledgeDTO => !!k)
        .map(k => ({ name: k.name, description: k.description }))

      const globallyUnlockedClues = script.clues.filter(c => progress.unlockedClues.includes(c.clueId))
      const relatedGloballyUnlockedClues = globallyUnlockedClues.filter(c => c.relatedKnowledge.some(id => knowledgeIds.includes(id)))

      const clues = relatedGloballyUnlockedClues.map(c => ({ name: c.name, description: c.description }))
      setHighlightedClues(relatedGloballyUnlockedClues.map(c => c.clueId))

      const autoAddedItems: Array<{name: string, source: string}> = []
      const newLearnLaterIds: string[] = []

      for (const kId of knowledgeIds) {
        if (!isInLearnLater(kId)) {
          newLearnLaterIds.push(kId)
          await api.addToLearnLater({
            knowledgeId: kId,
            scriptId: scriptId!,
            triggerType: 'question',
            triggerId: currentQuestion.questionId
          }).catch(console.error)
          const k = knowledgeMap.get(kId)
          if (k) {
            autoAddedItems.push({ name: k.name, source: 'Incorrect reasoning' })
          }
        }
      }

      if (newLearnLaterIds.length > 0) {
        api.getLearnLaterList().then(setLearnLater).catch(console.error)
      }

      setWrongAnswerReviewData({ clues, suggestedKnowledge, autoAddedItems })
      setShowWrongModal(true)

      const newWrongCount = wrongCount + 1
      setFeedback({
        message: feedbackMessage || (newWrongCount >= 2 ? 'Incorrect. You seem stuck, try asking the Detective!' : 'Incorrect. Try again.'),
        type: 'error'
      })
      setWrongCount(newWrongCount)

      let attemptedVal = String(freeTextAnswer.trim() || selectedOption || 'Unknown')
      if (currentQuestion.type === 'multiple_choice' && selectedOption) {
        attemptedVal = currentQuestion.options?.find(o => o.optionId === selectedOption)?.content || attemptedVal
      }
      setWrongAttemptValues(prev => [...prev, attemptedVal])
    }
  }

  const handleReportAndSkip = async (issueType: string, userComment: string) => {
    if (!currentQuestion || !progress || !script || !currentScene) return

    try {
      setSaving(true)
      await api.reportQuestionIssue(scriptId!, {
        questionId: currentQuestion.questionId,
        sceneId: currentQuestion.sceneId,
        issueType,
        userComment
      })
      
      setProgress(prev => {
        if (!prev) return prev
        return {
          ...prev,
          answeredQuestions: [...new Set([...prev.answeredQuestions, currentQuestion.questionId])],
          wrongAnswers: [...new Set([...prev.wrongAnswers, currentQuestion.questionId])]
        }
      })
      
      setCanSubmit(false)
      setCanNext(true)
      setShowReportModal(false)
      setShowWrongModal(false)
      
      setFeedback({ message: 'Thank you for your feedback! The issue has been recorded and the question skipped.', type: 'success' })
    } catch (error) {
      setFeedback({ message: 'Failed to submit report. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // advance to the next question, mark the scene complete when we cross a scene boundary
  const handleNext = async () => {
    if (!currentQuestion || !progress || !script || !currentScene) return

    setUsedShowAnswer(false)
    setHighlightedClues([])

    if (currentQuestionIndex < script.questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1
      const nextSceneId = script.questions[nextIndex].sceneId
      setCurrentQuestionIndex(nextIndex)

      if (nextSceneId !== currentScene.sceneId) {
        const updatedProgress = {
          ...progress,
          currentSceneId: nextSceneId,
          completedScenes: [...new Set([...progress.completedScenes, currentScene.sceneId])]
        }

        setProgress(updatedProgress)
        await api.updateUserProgress(scriptId!, {
          currentSceneId: nextSceneId,
          completedScenes: updatedProgress.completedScenes
        })
      }
    } else {
      const updatedProgress = {
        ...progress,
        completedScenes: [...new Set([...progress.completedScenes, currentScene.sceneId])]
      }
      setProgress(updatedProgress)
      await api.updateUserProgress(scriptId!, {
        completedScenes: updatedProgress.completedScenes
      })
      setCanNext(false)
      setShowAchievement(true)
    }
  }

  const handlePlayAgain = async () => {
    try {
      setLoading(true)
      if (scriptId) {
        await api.resetProgress(scriptId)
      }
      window.location.reload()
    } catch (error) {
      console.error(error)
      setFeedback({ message: 'Failed to reset progress', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handlePreNode = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
      setFeedback(null)
      setSelectedOption(null)
      setShowHint(false)
    }
  }

  const handleOpenLearnMore = () => {
    if (!currentQuestion || !script) return

    const idx = caseFiles.findIndex(k => k.knowledgeId === currentQuestion.knowledgeId)
    if (idx >= 0) {
      setKnowledgeIndex(idx)
    }
  }

  const handleDragEnd = (result: { source: { index: number }; destination: { index: number } | null }) => {
    if (!result.destination) return
    const items = Array.from(sequencingItems)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)
    setSequencingItems(items)
    setSequencingOrder(items.map(item => item.itemId))
  }

  const handleSaveProgress = async () => {
    if (!scriptId) return

    setSaving(true)

    try {
      const currentAnswer = currentQuestion && (selectedOption || sequencingOrder.length > 0) ? {
        questionId: currentQuestion.questionId,
        sceneId: currentQuestion.sceneId,
        knowledgeId: currentQuestion.knowledgeId,
        selectedOption: selectedOption || undefined,
        sequencingOrder: currentQuestion.type === 'sequencing' && sequencingOrder.length > 0 ? sequencingOrder : undefined,
        attemptNumber: wrongCount + 1,
        hintsUsed: showHint ? 1 : 0
      } : undefined

      await api.saveProgress(scriptId, {
        progress: progress || undefined,
        currentAnswer: currentAnswer
      })
      setFeedback({ message: 'Progress saved!', type: 'success' })
    } catch {
      setFeedback({ message: 'Failed to save progress', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetProgress = async () => {
    if (!scriptId) return
    if (!window.confirm('Are you sure you want to restart this script? All your progress will be lost.')) return

    try {
      await api.resetProgress(scriptId)
      window.location.reload()
    } catch (error) {
      console.error(error)
      setFeedback({ message: 'Failed to reset progress', type: 'error' })
    }
  }

  const handleViewLearnLater = () => {
    navigate('/game/script-learning', { state: { scriptId, scriptTitle: script?.title } })
  }

  const handleAddToLearnLater = async (knowledgeId: string) => {
    if (!scriptId) return

    try {
      await api.addToLearnLater({
        knowledgeId,
        scriptId,
        triggerType: 'manual',
        triggerId: currentQuestion?.questionId || currentScene?.sceneId || 'manual_add'
      })

      const learnLaterData = await api.getLearnLaterList(scriptId)
      setLearnLater(learnLaterData)
      setFeedback({ message: 'Added to learn later!', type: 'success' })
    } catch (err) {
      console.error("Error adding to learn later:", err)
      setFeedback({ message: 'Failed to add to learn later', type: 'error' })
    }
  }

  const handleMarkAsLearned = async () => {
    if (knowledgeIndex === null || !scriptId) return
    const knowledge = caseFiles[knowledgeIndex]

    try {
      await api.markAsMastered({ knowledgeId: knowledge.knowledgeId, scriptId })
      const learnLaterData = await api.getLearnLaterList(scriptId)
      setLearnLater(learnLaterData)
      setKnowledgeIndex(null)
      setFeedback({ message: 'Marked as learned!', type: 'success' })
    } catch (err) {
      console.error("Error marking as learned:", err)
      setFeedback({ message: 'Failed to mark as learned', type: 'error' })
    }
  }

  const handleLearnMorePrev = () => {
    if (knowledgeIndex === null || knowledgeIndex <= 0) return
    setKnowledgeIndex(knowledgeIndex - 1)
  }

  const handleLearnMoreNext = () => {
    if (knowledgeIndex === null || knowledgeIndex >= caseFiles.length - 1) return
    setKnowledgeIndex(knowledgeIndex + 1)
  }

  const handleViewChunk = async (chunkId: string) => {
    try {
      if (!script?.documentHash) {
        setFeedback({ message: 'Cannot load chunk: missing document reference', type: 'error' })
        return
      }
      const chunks = await api.getParsedDocumentChunks(script.documentHash)
      const chunk = chunks.find(c => c.id === chunkId)
      if (chunk) {
        setSelectedChunk(chunk)
      } else {
        setFeedback({ message: `Chunk ${chunkId} not found`, type: 'error' })
      }
    } catch (err) {
      console.error('Error loading chunk:', err)
      setFeedback({ message: 'Failed to load chunk content', type: 'error' })
    }
  }

  useEffect(() => {
    if (!script || !progress || !showAchievement) return

    for (const ending of script.endings || []) {
      const scenesUnlocked = ending.unlockConditions?.requiredScenes?.every(sceneId => progress.completedScenes.includes(sceneId)) ?? true
      const questionsUnlocked = ending.unlockConditions?.requiredQuestions?.every(qId => progress.answeredQuestions.includes(qId)) ?? true
      const cluesUnlocked = ending.unlockConditions?.requiredClues?.every(clueId => progress.unlockedClues.includes(clueId)) ?? true
      const trustUnlocked = ending.unlockConditions?.requiredCharacterTrust?.every(({ characterId, minTrust }) => (characterTrust[characterId] ?? 50) >= minTrust) ?? true
      if (scenesUnlocked && questionsUnlocked && cluesUnlocked && trustUnlocked) {
        if (achievedEnding?.endingId !== ending.endingId) {
          setAchievedEnding(ending)
          api.completeGame(scriptId!, { endingId: ending.endingId }).catch(console.error)
        }
        return
      }
    }
    setAchievedEnding(null)
  }, [script, progress, showAchievement, achievedEnding, scriptId, characterTrust])

  return {
    script,
    progress,
    learnLater,
    loading,
    error,
    saving,
    currentQuestion,
    currentScene,
    sceneClues,
    sceneCharacters,
    unlockedClues,
    caseFiles,
    sceneContext,
    currentHint,
    detectiveIsThinking,
    canSubmit,
    canNext,
    showHint,
    feedback,
    selectedClue,
    knowledgeIndex,
    showWrongModal,
    showReportModal,
    selectedNote,
    lastWrongAnswer,
    wrongAnswerRationale,
    highlightedClues,
    showAchievement,
    achievedEnding,
    selectedChunk,
    wrongAnswerReviewData,
    scriptId,
    currentQuestionIndex,
    selectedOption,
    freeTextAnswer,
    sequencingOrder,
    sequencingItems,
    wrongAttemptValues,
    isInLearnLater,
    getClueLearnLaterStatus,
    characterTrust,
    getCharacterTrust,
    adjustCharacterTrust,
    getPersonalNote,
    getCharacterKnowledgeNames,
    knowledgeMap,
    setLearnLater,
    handleSubmit,
    handleAskDetective,
    handleShowAnswer,
    handleNext,
    handlePlayAgain,
    handlePreNode,
    handleOpenLearnMore,
    handleDragEnd,
    handleSaveProgress,
    handleResetProgress,
    handleViewLearnLater,
    handleAddToLearnLater,
    handleMarkAsLearned,
    handleLearnMorePrev,
    handleLearnMoreNext,
    handleViewChunk,
    handleReportAndSkip,
    setSelectedClue,
    setKnowledgeIndex,
    setShowWrongModal,
    setShowReportModal,
    setSelectedNote,
    setSelectedChunk,
    setFeedback,
    setSelectedOption,
    setFreeTextAnswer
  }
}
