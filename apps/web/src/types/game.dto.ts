export interface OptionDTO {
  optionId: string
  content: string
  isCorrect: boolean
  feedback: string
  unlockClues?: string[]
  showHint?: string
}

export interface SequencingItemDTO {
  itemId: string
  content: string
}

export interface LearnMoreDTO {
  knowledgeId: string
  buttonText?: string
  useAIPlaceholder?: boolean
}

export interface QuestionDTO {
  questionId: string
  sceneId: string
  order: number
  type: 'multiple_choice' | 'sequencing' | 'fill_in_blank' | 'short_answer'
  speaker?: string
  speakerEmotion?: string
  speakerDialogue?: string
  content: string
  knowledgeId: string
  relatedKnowledge?: string[]
  difficulty?: number
  maxAttempts: number
  masteryReward: number
  hints?: { hintId: string; content: string; unlockAfterAttempts: number }[]
  options?: OptionDTO[]
  items?: SequencingItemDTO[]
  correctOrder?: string[]
  correctAnswer?: string
  acceptableAnswers?: string[]
  learnMore: LearnMoreDTO
}

export interface SceneDTO {
  sceneId: string
  act: number
  order: number
  title: string
  location: string
  description: string
  charactersPresent: string[]
  clues: string[]
  questions: string[]

}

export interface CharacterDTO {
  characterId: string
  name: string
  role: string
  occupation?: string
  background?: string
  personality?: string
  secret?: string
  knowledgePoints: string[]
  goal?: string
  scenes: string[]
}

export interface ClueDTO {
  clueId: string
  name: string
  type?: 'physical' | 'documentary' | 'digital' | 'testimonial'
  description: string
  foundInScene?: string
  foundBy?: string
  reveals?: string
  relatedKnowledge: string[]
  relatedChunks?: Array<{ id: string; title: string; text?: string }>
  isInLearnLater?: boolean
}

export interface KnowledgeDTO {
  knowledgeId: string
  scriptId?: string
  name: string
  description: string
  category?: string
  difficulty?: number
  appearsIn?: string[]
  relatedKnowledge?: string[]
  relatedChunksText?: string[]
}

export interface EndingDTO {
  endingId: string
  type: 'truth' | 'false' | 'unresolved'
  title: string
  content: string
  debrief: string
  summary: string
  unlockConditions: {
    requiredScenes: string[]
    requiredQuestions: string[]
    requiredClues: string[]
    requiredCharacterTrust?: Array<{ characterId: string; minTrust: number }>
  }
}

export interface EvidenceDTO {
  evidenceId: string
  name: string
  type: 'Physical' | 'Documentary'
  description: string
  foundLocation: string
  relatedKnowledge: string[]
  clueIds: string[]
}

export interface ScriptDTO {
  scriptId: string
  documentHash?: string
  version?: string
  title: string
  logline?: string
  educational_goals?: string[]
  scenes: SceneDTO[]
  questions: QuestionDTO[]
  clues: ClueDTO[]
  characters: CharacterDTO[]
  knowledgeBase: KnowledgeDTO[]
  evidence?: EvidenceDTO[]
  endings: EndingDTO[]
  timeLimit?: number | null
  hintPenalty?: number
  masteryRewardBase?: number
  maxAttemptsDefault?: number
}

export interface UserProgressDTO {
  userId: string
  scriptId: string
  currentSceneId: string
  completedScenes: string[]
  unlockedClues: string[]
  collectedEvidence: string[]
  answeredQuestions: string[]
  correctAnswers: string[]
  wrongAnswers: string[]
  lastUpdated: string
}

export interface UserLearnLaterItemDTO {
  knowledgeId: string
  addedAt: string
  sourceSceneId: string
  sourceQuestionId: string
  isLearned: boolean
  learnedAt?: string
}

export interface UserLearnLaterDTO {
  userId: string
  learnLaterList: UserLearnLaterItemDTO[]
}

export interface UserAnswerRecordDTO {
  questionId: string
  knowledgeId: string
  selectedOption?: string
  sequencingOrder?: string[]
  isCorrect: boolean
  timestamp: string
  sceneId: string
  attemptNumber: number
  hintsUsed: number
  masteryEarned: number
}

export interface UserAnswerDTO {
  userId: string
  answers: UserAnswerRecordDTO[]
}

export interface ChunkDTO {
  id: string
  text: string
  mainConcepts: string[]
  secondaryConcepts: string[]
  summary: string
  pageNumber?: number
  sectionTitle?: string
}

export interface KnowledgeWithChunksDTO extends KnowledgeDTO {
  chunks: ChunkDTO[]
}

export interface QuestionSupportDTO {
  questionId: string
  supportingChunks: {
    chunkId: string
    relevance: 'high' | 'medium' | 'low'
    excerpt?: string
  }[]
  extensionChunks: string[]
}

export interface SceneResponseDTO {
  sceneId: string
  progress: {
    cluesFound: number
    totalClues: number
    questionsAnswered: number
    totalQuestions: number
  }
  learnLaterCount: number
}

export interface AnswerResultDTO {
  isCorrect: boolean
  feedback: string
  autoAddedToLearnLater?: Array<{
    knowledgeId: string
    name: string
  }>
  progress: {
    cluesFound: number
    questionsAnswered: number
    cluesUnlocked?: string[]
  }
  questionStatus?: {
    attemptsRemaining: number
    isLocked: boolean
  }
}

export interface AIPlaceholderDTO {
  knowledgeId: string
  feature: 'explain' | 'summary' | 'quiz'
  status: 'coming_soon'
  message: string
}

export interface AddToLearnLaterRequestDTO {
  knowledgeId: string
  scriptId?: string
  triggerType: 'clue' | 'question' | 'manual'
  triggerId: string
  wrongAnswer?: string
}

export interface LearnLaterListDTO {
  items: Array<{
    knowledgeId: string
    scriptId: string
    scriptTitle?: string
    documentName?: string
    name: string
    description: string
    triggerType: 'clue' | 'question' | 'manual'
    triggerInfo: {
      clueId?: string
      clueName?: string
      questionId?: string
      questionContent?: string
      wrongAnswer?: string
    }
    addedAt: string
    relatedChunks: Array<{
      chunkId: string
      summary: string
    }>
    isLearned?: boolean
    learnedAt?: string
    personalNotes?: string
    subject_code?: string
    moduleName?: string
  }>
  masteredCount: number
  totalCount: number
}

export interface MarkMasteredRequestDTO {
  knowledgeId: string
}

export interface ScriptReportStatsDTO {
  totalTimeMinutes: number
  completionRate: number
  sessions: number
  lastReviewed: string
  activity: number[]
}

export interface ConceptStatDTO {
  knowledgeId: string
  icon: string
  text: string
  isMastered: boolean
  personalNotes?: string
  masteryLevel?: number
  correctCount?: number
  totalAttempts?: number
  hintsUsed?: number
  lastAttemptDate?: string
}

export interface PerformanceStatsDTO {
  totalQuestions: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number
  firstAttemptAccuracy: number
  improvementRate: number
  averageTimePerQuestion: number
  hintsUsageRate: number
}

export interface WrongAnswerConceptDTO {
  knowledgeId: string
  conceptName: string
  icon: string
  errorCount: number
  hintsUsedTotal: number
  lastErrorDate: string
  relatedQuestions?: string[]
  personalNotes?: string
}

export interface ReviewRecommendationDTO {
  conceptId: string
  conceptName: string
  reason: string
  priority: number
  suggestedResources?: Array<{ type: string; action: string }>
}

export interface ScriptReportDTO {
  scriptId: string
  name: string
  moduleName?: string
  documentName?: string
  stats: ScriptReportStatsDTO
  historyStats?: ScriptReportStatsDTO
  keyConcepts: ConceptStatDTO[]
  performance: PerformanceStatsDTO
  wrongAnswerConcepts?: WrongAnswerConceptDTO[]
  reviewRecommendations?: ReviewRecommendationDTO[]
}

export interface LearningProgressDTO {
  knowledgeId: string
  timeSpentMinutes: number
  quizAttempts: number
  quizPassedAt?: string | null
  aiContentViewed: Record<string, boolean>
  personalNotes?: string | null
  masteryLevel: 'unfamiliar' | 'familiar' | 'proficient' | 'mastered'
  updatedAt?: string
}

export interface UpdateLearningProgressRequestDTO {
  knowledgeId: string
  timeSpentMinutes?: number
  quizAttempts?: number
  quizPassed?: boolean
  aiContentViewed?: Record<string, boolean>
  personalNotes?: string
  masteryLevel?: 'unfamiliar' | 'familiar' | 'proficient' | 'mastered'
}