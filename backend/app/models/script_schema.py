from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class ScriptHint(BaseModel):
    hintId: str
    content: str
    unlockAfterAttempts: int = 1

class ScriptLearnMore(BaseModel):
    knowledgeId: str
    buttonText: str = "Learn More"

class ScriptCharacter(BaseModel):
    characterId: str
    name: str
    role: str
    age: int = 0
    occupation: str
    background: str
    personality: str
    secret: str
    knowledgePoints: List[str] = Field(default_factory=list)
    goal: str
    scenes: List[str] = Field(default_factory=list)

class ScriptScene(BaseModel):
    sceneId: str
    act: int
    order: int
    title: str
    location: str
    description: str
    charactersPresent: List[str] = Field(default_factory=list)
    clues: List[str] = Field(default_factory=list)

class ScriptClue(BaseModel):
    clueId: str
    name: str
    type: str  # e.g. documentary, physical, digital, testimonial
    description: str
    foundInScene: str
    foundBy: str
    reveals: str
    relatedKnowledge: List[str] = Field(default_factory=list)

class ScriptOption(BaseModel):
    optionId: str
    content: str
    isCorrect: bool
    feedback: str
    unlockClues: List[str] = Field(default_factory=list)
    showHint: Optional[str] = None

class ScriptSequenceItem(BaseModel):
    itemId: str
    content: str

class ScriptQuestion(BaseModel):
    questionId: str
    sceneId: str
    order: int
    type: str 
    difficulty: int
    content: str
    knowledgeId: str
    relatedKnowledge: List[str] = Field(default_factory=list)
    hints: List[ScriptHint] = Field(default_factory=list)
    maxAttempts: int = 3
    learnMore: Optional[ScriptLearnMore] = None

    masteryReward: Optional[int] = None
    options: Optional[List[ScriptOption]] = None

    items: Optional[List[ScriptSequenceItem]] = None
    correctOrder: Optional[List[str]] = None

    feedbackCorrect: Optional[str] = None
    feedbackIncorrect: Optional[str] = None

    correctAnswers: Optional[List[str]] = None

class ScriptKnowledgePoint(BaseModel):
    knowledgeId: str
    name: str
    description: str
    category: str
    difficulty: int
    appearsIn: List[str] = Field(default_factory=list)
    relatedKnowledge: List[str] = Field(default_factory=list)

class ScriptEvidence(BaseModel):
    evidenceId: str
    name: str
    type: str
    description: str
    foundLocation: str
    relatedKnowledge: List[str] = Field(default_factory=list)
    clueIds: List[str] = Field(default_factory=list)

class ScriptUnlockConditions(BaseModel):
    requiredScenes: List[str] = Field(default_factory=list)
    requiredQuestions: List[str] = Field(default_factory=list)
    requiredClues: List[str] = Field(default_factory=list)

class ScriptEnding(BaseModel):
    endingId: str
    type: str
    unlockConditions: ScriptUnlockConditions
    title: str
    content: str
    debrief: str
    summary: str

class ScriptPuzzleConfig(BaseModel):
    timeLimit: Optional[int] = None
    hintPenalty: int = 10
    masteryRewardBase: int = 2
    maxAttemptsDefault: int = 3

class GeneratedGameScriptDTO(BaseModel):
    scriptId: str
    version: str = "1.0"
    title: str
    logline: str
    educational_goals: List[str] = Field(default_factory=list)

    characters: List[ScriptCharacter] = Field(default_factory=list)
    scenes: List[ScriptScene] = Field(default_factory=list)
    clues: List[ScriptClue] = Field(default_factory=list)
    questions: List[ScriptQuestion] = Field(default_factory=list)

    knowledgeBase: List[ScriptKnowledgePoint] = Field(default_factory=list)
    evidence: List[ScriptEvidence] = Field(default_factory=list)
    endings: List[ScriptEnding] = Field(default_factory=list)

    puzzleConfig: ScriptPuzzleConfig
    has_quiz: bool = False
    template_difficulty: Optional[Dict[str, int]] = None