from pydantic import BaseModel, Field

class SimplifyExplanationRequest(BaseModel):
    explanation: str = Field(..., min_length=1, description="The explanation to simplify")
    targetGradeLevel: str = Field(..., description="Target grade level: 6, 9, 12, or University")

class SimplifyExplanationResponse(BaseModel):
    simplified: str = Field(..., description="The simplified explanation")

class ReflectionTeachingRequest(BaseModel):
    explanation: str = Field(..., min_length=1, description="The student's explanation")
    concept: str = Field(default="Unspecified", description="The concept being taught")
    target_level: str = Field(default="intermediate", description="Target teaching level")

class ReflectionTeachingAnalysis(BaseModel):
    strengths: list[str] = Field(default=[], description="What the student did well")
    areas_for_improvement: list[str] = Field(default=[], description="Areas to improve")
    reflection_questions: list[str] = Field(default=[], description="Questions for deeper reflection")
    suggested_resources: list[str] = Field(default=[], description="Suggested learning resources")
    next_steps: str = Field(default="", description="Recommended next steps for learning")
    confidence_level: float = Field(default=0.0, ge=0.0, le=100.0, description="Confidence level (0-100)")

class ReflectionTeachingResponse(BaseModel):
    analysis: ReflectionTeachingAnalysis
    original_explanation: str = Field(..., description="The original student explanation")


class FlaggedSegment(BaseModel):
    phrase: str = Field(..., description="The phrase in the explanation that was flagged")
    issue: str = Field(..., description="Short description of the issue")
    severity: str = Field(..., description="critical|major|minor")
    fix: str | None = Field(None, description="Suggested fix or rewrite for the flagged phrase")


class StyleSuggestion(BaseModel):
    phrase: str | None = Field(None, description="Phrase to target for stylistic suggestion")
    suggestion: str = Field(..., description="Suggested style change or rewording")


class CheckUnderstandingRequest(BaseModel):
    explanation: str = Field(..., min_length=1)
    concept: str | None = Field(None)
    conceptDefinition: str | None = Field(None)
    strictness: str | None = Field(None)
    follow_up: dict | None = Field(None)
    returnStyleNotes: bool | None = Field(False)


class CheckUnderstandingResponse(BaseModel):
    original: str
    concept: str | None = None
    conceptDefinition: str | None = None
    flagged: list[FlaggedSegment] = Field(default_factory=list)
    styleSuggestions: list[StyleSuggestion] = Field(default_factory=list)
    verdict: str | None = None
    confidence: float | None = None
    follow_up_questions: list[str] | None = None
