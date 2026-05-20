from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class ExampleResponse(BaseModel):
    concept_id: UUID
    example_id: UUID
    concept_title: str
    concept_description: str | None
    difficulty_level: str | None
    context: str | None
    outcome: str | None
    language: str

    class Config:
        from_attributes = True

class ExampleDetailResponse(BaseModel):
    concept_id: UUID
    example_id: UUID
    concept_title: str
    concept_description: str | None
    difficulty_level: str | None
    context: str | None
    inputs: dict | None = None
    outcome: str | None
    lessons_learned: str | None
    media_refs: list[UUID] | None = None
    language: str
    created_at: datetime

    class Config:
        from_attributes = True

class ExampleListResponse(BaseModel):
    total: int
    examples: list[ExampleResponse]
