from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum
from typing import List


class DocumentType(str, Enum):

    # Documents
    pdf = "pdf"
    word = "word"
    excel = "excel"
    powerpoint = "powerpoint"

    # Media
    video = "video"
    audio = "audio"
    image = "image"

    # Text
    text = "text"

class ProcessingStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class DocumentUploadRequest(BaseModel):
    title: str = Field(min_length = 1, max_length = 255)
    subject: str | None = None
    lcc_code: str | None = Field(default = None, description = "Library of Congress Classification code")
    language: str = Field(default = "en", max_length = 40)
    metadata: dict | None = None

class TextUploadRequest(DocumentUploadRequest):
    content: str = Field(min_length = 1, description = "Text content to process")

class ProcessingResultResponse(BaseModel):
    success: bool
    document_id: UUID
    title: str
    document_type: DocumentType
    status: ProcessingStatus
    message: str | None = None

class UploadedDocumentInfo(BaseModel):
    document_id: UUID
    title: str
    document_type: DocumentType

class MultiUploadResultResponse(BaseModel):
    success: bool
    documents: list[UploadedDocumentInfo]
    status: ProcessingStatus
    message: str | None = None

class SubjectInfo(BaseModel):
    id: str
    code: str
    name: str

class DocumentListItemResponse(BaseModel):
    id: UUID
    document_name: str
    document_type: DocumentType
    processing_status: ProcessingStatus
    author: str | None = None
    language: str | None = None
    is_public: bool
    uploaded_at: datetime
    concepts_extracted: int
    relationships_extracted: int
    subjects: list[SubjectInfo] = []

    class Config:
        from_attributes = True

class DocumentListResponse(BaseModel):
    documents: list[DocumentListItemResponse]
    total: int
    page: int
    page_size: int

class DocumentDetailResponse(BaseModel):
    id: UUID
    document_name: str
    document_path: str | None = None
    document_type: DocumentType
    language: str | None = None
    author: str | None = None
    publication_year: int | None = None
    uploaded_by: UUID | None = None
    is_public: bool
    uploaded_at: datetime
    processing_status: ProcessingStatus
    processing_error: str | None = None
    processing_started_at: datetime | None = None
    processing_completed_at: datetime | None = None
    concepts_extracted: int
    relationships_extracted: int
    ai_summary: str | None = None
    ai_summary_generated_at: datetime | None = None
    subjects: list[SubjectInfo] = []
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True

class Chunk(BaseModel):
    id: str
    text: str
    pages: List[int] = []
    start_pos: int = 0
    end_pos: int = 0
    summary: str = ""
    chunk_type: str = "paragraph"
    has_examples: bool = False
    main_concepts: List[str] = []
    has_definitions: bool = False
    secondary_concepts: List[str] = []

class Concept(BaseModel):
    id: str
    title: str
    aliases: List[str] = []
    keywords: List[str] = []
    confidence: float = 1.0
    difficulty: int = 3
    description: str
    concept_type: str = "general"
    extracted_from: List[str] = []
    related_concepts: List[str] = []

class Relationship(BaseModel):
    id: str
    type: str = "related_to"
    source: str
    target: str
    evidence: str = ""
    strength: float = 0.5
    bidirectional: bool = False

class QualityMetrics(BaseModel):
    total_chunks: int = 0
    missing_links: List[str] = []
    coverage_score: float = 0.0
    total_concepts: int = 0
    consistency_score: float = 0.0
    total_relationships: int = 0

class DocumentMetadata(BaseModel):
    title: str
    language: str = "en"
    main_topic: str = ""
    difficulty_level: str = "medium"
    estimated_reading_time: str = ""

class ConceptChunkMapping(BaseModel):
    concept: str
    context: str = ""
    chunk_id: str
    positions: List[int] = []
    concept_id: str
    importance: str = "mention"

class ParsedJsonResponse(BaseModel):
    chunks: List[Chunk]
    concepts: List[Concept]
    relationships: List[Relationship]
    quality_metrics: QualityMetrics
    document_metadata: DocumentMetadata
    concept_chunk_mapping: List[ConceptChunkMapping]
