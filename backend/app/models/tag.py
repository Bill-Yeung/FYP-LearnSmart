from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum


class EntityType(str, Enum):
    source = "source"
    concept = "concept"
    subject = "subject"
    diagram = "diagram"
    flashcard = "flashcard"
    learning_path = "learning_path"
    shared_content = "shared_content"
    vr_scenario = "vr_scenario"
    generated_script = "generated_script"


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=50)

class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=50)

class TagApplyRequest(BaseModel):
    entity_type: EntityType
    entity_id: UUID

class BulkTagApplyRequest(BaseModel):
    tag_ids: list[UUID]
    entity_type: EntityType
    entity_id: UUID


class TagResponse(BaseModel):
    id: UUID
    name: str
    url_id: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    is_system: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TagWithStatsResponse(TagResponse):
    concept_count: int = 0
    source_count: int = 0
    subject_count: int = 0
    diagram_count: int = 0
    flashcard_count: int = 0
    learning_path_count: int = 0
    shared_content_count: int = 0
    vr_scenario_count: int = 0
    generated_script_count: int = 0

class TagListResponse(BaseModel):
    tags: list[TagWithStatsResponse]
    total: int
    page: int
    page_size: int

class TagApplicationResponse(BaseModel):
    id: int
    tag_id: UUID
    entity_type: EntityType
    entity_id: UUID
    applied_at: datetime
    applied_by: UUID | None = None

    class Config:
        from_attributes = True

class EntityTagsResponse(BaseModel):
    entity_type: EntityType
    entity_id: UUID
    tags: list[TagResponse]

class TaggedEntityResponse(BaseModel):
    entity_type: EntityType
    entity_id: UUID
    applied_at: datetime

class TaggedEntitiesResponse(BaseModel):
    tag_id: UUID
    entities: list[TaggedEntityResponse]
    total: int
    page: int
    page_size: int


def generate_url_id(name: str) -> str:

    import re
    url_id = name.lower().strip()
    url_id = re.sub(r'[^\w\s-]', '', url_id)
    url_id = re.sub(r'[\s_]+', '-', url_id)
    url_id = re.sub(r'-+', '-', url_id)
    return url_id[:100]
