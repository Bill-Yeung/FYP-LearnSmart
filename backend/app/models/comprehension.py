from typing import Literal

from pydantic import BaseModel, Field


Difficulty = Literal["easy", "medium", "hard"]
QuestionType = Literal["why", "how"]
OutputStyle = Literal["analogy", "metaphor", "both"]
AudienceLevel = Literal["beginner", "intermediate", "advanced"]
OutputLanguage = Literal["english", "chinese"]
AnalogyDomain = Literal["everyday", "cooking", "sports", "travel", "music", "nature", "tech", "money"]
BrainstormSectionName = Literal["who", "what", "why", "how"]
SocraticDifficulty = Literal["guided", "standard", "challenge"]
SocraticAction = Literal["follow-up", "hint", "feedback", "wrap-up"]
DialogueRole = Literal["assistant", "user"]
RewriteLevel = Literal["light", "standard", "strong"]


class ComprehensionContext(BaseModel):
    subjectName: str | None = None
    documentId: str | None = None
    documentName: str | None = None
    documentConcepts: list[str] = Field(default_factory=list)


class WhyHowGenerateRequest(BaseModel):
    sourceText: str = Field(..., min_length=1)
    focusConcept: str | None = None
    difficulty: Difficulty = "medium"
    count: int = Field(default=6, ge=1, le=20)
    includeWhy: bool = True
    includeHow: bool = True
    context: ComprehensionContext | None = None


class WhyHowQuestion(BaseModel):
    type: QuestionType
    difficulty: Difficulty
    question: str = Field(..., min_length=1)
    rationale: str = ""
    focus: str | None = None


class WhyHowGenerateResponse(BaseModel):
    questions: list[WhyHowQuestion] = Field(default_factory=list)


class AnalogyGenerateRequest(BaseModel):
    concept: str = Field(..., min_length=1)
    context: str = ""
    domain: AnalogyDomain = "everyday"
    audience: AudienceLevel = "beginner"
    style: OutputStyle = "both"
    language: OutputLanguage = "english"
    source: ComprehensionContext | None = None


class MappingPair(BaseModel):
    left: str
    right: str


class AnalogyResult(BaseModel):
    kind: Literal["analogy", "metaphor"]
    title: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    mapping: list[MappingPair] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    language: OutputLanguage
    audience: AudienceLevel


class AnalogyGenerateResponse(BaseModel):
    results: list[AnalogyResult] = Field(default_factory=list)


class BrainstormInputSection(BaseModel):
    response: str = ""
    bullets: list[str] = Field(default_factory=list)


class BrainstormStructureRequest(BaseModel):
    topic: str = ""
    context: str = ""
    active: BrainstormSectionName = "what"
    markdown: str = ""
    source: ComprehensionContext | None = None


class StructuredSection(BaseModel):
    heading: str = Field(..., min_length=1)
    content: str = ""
    bullets: list[str] = Field(default_factory=list)


class BrainstormStructureResponse(BaseModel):
    title: str | None = None
    summary: str | None = None
    sections: list[StructuredSection] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)


class DialogueMessageInput(BaseModel):
    role: DialogueRole
    text: str = Field(..., min_length=1)
    tag: str | None = None


class SocraticRespondRequest(BaseModel):
    action: SocraticAction
    concept: str = ""
    goal: str = ""
    context: str = ""
    difficulty: SocraticDifficulty = "standard"
    messages: list[DialogueMessageInput] = Field(default_factory=list)
    source: ComprehensionContext | None = None


class SocraticRespondResponse(BaseModel):
    assistant_message: str = Field(..., min_length=1)
    observations: list[str] = Field(default_factory=list)


class SimplifyRewriteRequest(BaseModel):
    original: str = Field(..., min_length=1)
    language: OutputLanguage = "english"
    level: RewriteLevel = "standard"
    context: ComprehensionContext | None = None


class SimplifyRewriteResponse(BaseModel):
    original: str
    simplified: str = Field(..., min_length=1)
    language: OutputLanguage
    level: RewriteLevel
