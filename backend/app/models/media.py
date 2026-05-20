from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from enum import Enum


class MediaType(str, Enum):
    PDF = "pdf"
    WORD = "word"
    EXCEL = "excel"
    POWERPOINT = "powerpoint"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"
    WEBSITE_LINK = "website_link"

class StorageMethod(str, Enum):
    LOCAL_PATH = "local_path"
    EXTERNAL_URL = "external_url"


class MediaSearchRequest(BaseModel):
    query: str | None = None
    source_id: UUID | None = None
    media_type: MediaType | None = None
    programming_language: str | None = None
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class MediaResponse(BaseModel):
    id: UUID
    source_id: UUID | None
    source_title: str | None
    media_type: str
    storage_method: str
    file_url: str
    programming_language: str | None
    language: str | None
    pages: list[int] | None
    extraction_location: str | None
    checksum: str | None
    created_at: datetime

    class Config:
        from_attributes = True

class MediaDetailResponse(BaseModel):
    id: UUID
    source_id: UUID | None
    source_title: str | None
    media_type: str
    storage_method: str
    file_url: str
    programming_language: str | None
    language: str | None
    pages: list[int] | None
    extraction_location: str | None
    content: str | None
    subject_hints: list[str] | None
    metadata: dict | None
    checksum: str | None
    created_at: datetime

    class Config:
        from_attributes = True

class MediaListResponse(BaseModel):
    total: int
    media: list[MediaResponse]
    media_types: dict[str, int]

class SourceMediaSummaryResponse(BaseModel):
    source_id: UUID
    source_title: str
    total_media: int
    media_by_type: dict[str, int]
    programming_languages: list[str]
    has_images: bool
    has_code: bool

class CodeSnippetResponse(BaseModel):
    id: UUID
    source_id: UUID | None
    source_title: str | None
    programming_language: str
    file_url: str
    pages: list[int] | None
    extraction_location: str | None
    created_at: datetime

    class Config:
        from_attributes = True
