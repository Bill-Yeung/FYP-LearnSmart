from __future__ import annotations
import uuid
from typing import Any, Dict, Optional

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP, VARCHAR
from sqlalchemy import Text, Integer

class Base(DeclarativeBase):
    pass

class Source(Base):
    __tablename__ = "sources_v2"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    document_name: Mapped[Optional[str]] = mapped_column(VARCHAR, nullable=True)
    document_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    document_type: Mapped[Optional[str]] = mapped_column(VARCHAR, nullable=True)
    processing_status: Mapped[Optional[str]] = mapped_column(VARCHAR, nullable=True)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processing_started_at: Mapped[Optional[Any]] = mapped_column(TIMESTAMP, nullable=True)
    processing_completed_at: Mapped[Optional[Any]] = mapped_column(TIMESTAMP, nullable=True)
    chunks_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

class ContentParseV2(Base):
    __tablename__ = "content_parses_v2"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(VARCHAR, nullable=False, default="created")
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chunking_strategy: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[Optional[Any]] = mapped_column(TIMESTAMP, nullable=True)
    started_at: Mapped[Optional[Any]] = mapped_column(TIMESTAMP, nullable=True)
    completed_at: Mapped[Optional[Any]] = mapped_column(TIMESTAMP, nullable=True)

class ContentChunkV2(Base):
    __tablename__ = "content_chunks_v2"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    meta: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[Optional[Any]] = mapped_column(TIMESTAMP, nullable=True)

class Script(Base):
    __tablename__ = "scripts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    parse_id_v2: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    outline_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
