from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from enum import Enum


class LearningObjectFormat(str, Enum):
    VIDEO = "video"
    INTERACTIVE = "interactive"
    SLIDE = "slide"
    QUIZ = "quiz"
    SIMULATION = "simulation"


class LearningObjectResponse(BaseModel):
    concept_id: UUID
    learning_object_id: UUID
    concept_title: str
    concept_description: str | None
    difficulty_level: str | None
    format: str
    duration_minutes: int | None
    learning_objectives: list[str] | None = None
    language: str

    class Config:
        from_attributes = True

class LearningObjectDetailResponse(BaseModel):
    concept_id: UUID
    learning_object_id: UUID
    concept_title: str
    concept_description: str | None
    difficulty_level: str | None
    format: str
    duration_minutes: int | None
    media_refs: list[UUID] | None = None
    xapi_metadata: dict | None = None
    target_concept_ids: list[UUID] | None = None
    assessment_ids: list[UUID] | None = None
    success_criteria: dict | None = None
    learning_objectives: list[str] | None = None
    language: str
    created_at: datetime

    class Config:
        from_attributes = True

class LearningObjectListResponse(BaseModel):
    total: int
    learning_objects: list[LearningObjectResponse]
    formats: dict[str, int]
