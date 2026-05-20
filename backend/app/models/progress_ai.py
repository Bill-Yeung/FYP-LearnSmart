from pydantic import BaseModel, Field


class GroupAnalyticsRequest(BaseModel):
    cohort: str = Field(..., min_length=1)
    range: str = Field(..., min_length=1)
    classmateCount: int = Field(default=0, ge=0)
    assignmentCount: int = Field(default=0, ge=0)
    dueSoonCount: int = Field(default=0, ge=0)
    dueByWeekday: list[int] = Field(default_factory=list)


class GroupAnalyticsResponse(BaseModel):
    summary: str
    privacy_check: str
    signals: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class WeakTopicInput(BaseModel):
    topic: str = Field(..., min_length=1)
    errors: int = Field(default=0, ge=0)
    masteredPct: int = Field(default=0, ge=0, le=100)


class LearningPathwayRequest(BaseModel):
    goal: str = Field(..., min_length=1)
    timeBudget: int = Field(..., ge=10, le=180)
    targetDifficulty: str = Field(..., min_length=1)
    weakTopics: list[WeakTopicInput] = Field(default_factory=list)
    dueErrors: int = Field(default=0, ge=0)
    scheduledFlashcards: int = Field(default=0, ge=0)
    questionCount: int = Field(default=0, ge=0)
    savedLearningPaths: list[str] = Field(default_factory=list)


class LearningPathwayResponse(BaseModel):
    session_plan: list[str] = Field(default_factory=list)
    rationale: str
    recommended_order: list[str] = Field(default_factory=list)
    watchouts: list[str] = Field(default_factory=list)
