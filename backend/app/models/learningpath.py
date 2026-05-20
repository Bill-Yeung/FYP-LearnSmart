from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class LearningPathCreate(BaseModel):
    title: str = Field(..., min_length = 1, max_length = 255)
    description: str | None = None
    target_concept_id: UUID | None = None
    language: str = "en"

class LearningPathStepCreate(BaseModel):
    target_concept_id: UUID
    title: str
    instructions: str | None = None
    order_index: int
    estimated_duration_minutes: int | None = None

class PrerequisiteCheckRequest(BaseModel):
    concept_id: UUID
    user_id: UUID


class PrerequisiteResponse(BaseModel):
    prerequisite_concept_id: UUID
    prerequisite_title: str
    is_mandatory: bool
    order_index: int

    class Config:
        from_attributes = True

class LearningPathNodeResponse(BaseModel):
    concept_id: UUID
    title: str
    description: str | None
    concept_type: str
    difficulty_level: str | None
    depth: int
    is_mandatory: bool

    class Config:
        from_attributes = True

class LearningPathTreeResponse(BaseModel):
    target_concept_id: UUID
    target_concept_title: str
    prerequisites: list[LearningPathNodeResponse]
    total_prerequisites: int
    max_depth: int

class LearningPathStepResponse(BaseModel):
    id: int
    path_id: UUID
    concept_id: UUID
    step_order: int
    is_required: bool
    estimated_time_minutes: int | None
    concept_title: str
    notes: str | None
    language: str

    class Config:
        from_attributes = True

class LearningPathResponse(BaseModel):
    id: UUID
    target_concept_id: UUID | None
    created_by: UUID | None
    title: str
    description: str | None
    language: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LearningPathDetailResponse(BaseModel):
    id: UUID
    target_concept_id: UUID | None
    created_by: UUID | None
    title: str
    description: str | None
    language: str
    steps: list[LearningPathStepResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PrerequisiteCheckResponse(BaseModel):
    concept_id: UUID
    concept_title: str
    has_prerequisites: bool
    total_prerequisites: int
    completed_prerequisites: int
    missing_prerequisites: list[PrerequisiteResponse]
    can_proceed: bool
