from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum


class ConceptType(str, Enum):
    definition = "definition"
    procedure = "procedure"
    example = "example"
    assessment = "assessment"
    learning_object = "learning_object"
    entity = "entity"
    formula = "formula"

class DifficultyLevel(str, Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"

class TranslationQuality(str, Enum):
    source = "source"
    llm = "llm"
    user_verified = "user_verified"


class ConceptBase(BaseModel):
    concept_type: ConceptType
    difficulty_level: DifficultyLevel | None = None
    estimated_study_time_minutes: int | None = None
    formula_latex: str | None = None
    base_form: str | None = None


class ConceptCreate(ConceptBase):
    is_public: bool = False
    title: str = Field(min_length = 1, max_length = 255)
    description: str
    language: str = Field(default = "en", max_length = 10)
    keywords: list[str] | None = None

class ConceptUpdate(BaseModel):
    concept_type: ConceptType | None = None
    difficulty_level: DifficultyLevel | None = None
    estimated_study_time_minutes: int | None = None
    is_public: bool | None = None

class ConceptTranslationCreate(BaseModel):
    language: str = Field(max_length = 10)
    title: str = Field(min_length = 1, max_length = 255)
    description: str
    keywords: list[str] | None = None
    formula_plain_text: str | None = None


class ConceptTranslationResponse(BaseModel):
    id: int
    concept_id: UUID
    language: str
    title: str
    description: str
    keywords: list[str] | None = None
    formula_plain_text: str | None = None
    is_primary: bool
    translation_quality: TranslationQuality | None = None
    translation_date: datetime

    class Config:
        from_attributes = True

class ConceptResponse(ConceptBase):
    id: UUID
    created_by: UUID | None = None
    is_system_generated: bool
    is_public: bool
    created_at: datetime
    updated_at: datetime
    version: int
    qdrant_synced_at: datetime | None = None
    embedding_model: str | None = None
    title: str | None = None
    description: str | None = None

    class Config:
        from_attributes = True

class ConceptDetailResponse(ConceptResponse):
    translations: list[ConceptTranslationResponse] = []
    taxonomy_codes: list[str] = []

    class Config:
        from_attributes = True
