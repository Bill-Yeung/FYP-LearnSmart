from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

class TeachBackRequest(BaseModel):
    concept_id: UUID | None = None
    concept_title: str | None = Field(default=None, max_length=255)
    explanation: str = Field(..., min_length=10)
    target_level: str = Field(default="beginner", max_length=40)
    language: str = Field(default="en", max_length=10)
    follow_up: dict | None = None

class TeachBackAnalysis(BaseModel):
    missing_terms: list[str] = []
    logical_gaps: list[str] = []
    unclear_reasoning: list[str] = []
    analogies: list[str] = []
    follow_up_questions: list[str] = []
    revised_explanation: str | None = None
    summary: str | None = None
    score: float | None = None

class TeachBackResponse(BaseModel):
    session_id: UUID
    concept_title: str | None
    analysis: TeachBackAnalysis
    created_at: datetime

class TeachBackHistoryItem(BaseModel):
    session_id: UUID
    concept_title: str | None
    created_at: datetime
    score: float | None = None

class TeachBackHistoryResponse(BaseModel):
    items: list[TeachBackHistoryItem]
