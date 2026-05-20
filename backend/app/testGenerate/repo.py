from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker

from app.core.database import get_postgres
from .model import Base, Source, ContentParseV2, ContentChunkV2, Script


class TestGenerateRepository:
    def __init__(self, session_factory: sessionmaker):
        self.session_factory = session_factory

    async def create_source(self, *, filename: str, filepath: str, filetype: str) -> Source:
        async with self.session_factory() as session:
            async with session.begin():
                src = Source(
                    id=uuid.uuid4(),
                    document_name=filename,
                    document_path=filepath,
                    document_type=filetype,
                    processing_status="processing_started",
                    processing_started_at=datetime.utcnow(),
                    chunks_count=0,
                )
                session.add(src)
                await session.flush()  # Ensures the object is persisted and ID is generated
                return src

    async def create_parse(self, *, source_id: uuid.UUID, chunking_strategy: Dict[str, Any]) -> ContentParseV2:
        async with self.session_factory() as session:
            async with session.begin():
                parse = ContentParseV2(
                    id=uuid.uuid4(),
                    source_id=source_id,
                    status="running",
                    chunking_strategy=chunking_strategy,
                    created_at=datetime.utcnow(),
                    started_at=datetime.utcnow(),
                )
                session.add(parse)
                await session.flush()
                return parse

    async def insert_chunks(self, *, parse_id: uuid.UUID, chunks: List[Dict[str, Any]]) -> int:
        async with self.session_factory() as session:
            async with session.begin():
                now = datetime.utcnow()
                rows = [
                    ContentChunkV2(
                        id=uuid.uuid4(),
                        parse_id=parse_id,
                        chunk_index=c.get("chunk_index", i),
                        content=c["content"],
                        meta=c.get("meta", {}),
                        created_at=now,
                    )
                    for i, c in enumerate(chunks)
                ]
                session.add_all(rows)
                await session.flush()
                return len(rows)

    async def update_source_done(self, *, source_id: uuid.UUID, chunks_count: int) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                src = await session.get(Source, source_id)
                src.processing_status = "processing_completed"
                src.processing_completed_at = datetime.utcnow()
                src.processing_error = None
                src.chunks_count = chunks_count
                session.add(src)

    async def update_source_failed(self, *, source_id: uuid.UUID, error: str) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                src = await session.get(Source, source_id)
                src.processing_status = "processing_failed"
                src.processing_completed_at = datetime.utcnow()
                src.processing_error = error
                session.add(src)

    async def update_parse_done(self, *, parse_id: uuid.UUID) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                parse = await session.get(ContentParseV2, parse_id)
                parse.status = "completed"
                parse.completed_at = datetime.utcnow()
                parse.error = None
                session.add(parse)

    async def update_parse_failed(self, *, parse_id: uuid.UUID, error: str) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                parse = await session.get(ContentParseV2, parse_id)
                parse.status = "failed"
                parse.completed_at = datetime.utcnow()
                parse.error = error
                session.add(parse)

    async def create_script_placeholder(self, *, source_id: uuid.UUID, parse_id: uuid.UUID) -> Script:
        async with self.session_factory() as session:
            async with session.begin():
                script = Script(
                    id=uuid.uuid4(),
                    source_id=source_id,
                    parse_id_v2=parse_id,
                    status="draft",
                    outline_json=None,
                )
                session.add(script)
                await session.flush()
                return script

    async def list_chunks(self, *, parse_id: uuid.UUID) -> List[ContentChunkV2]:
        async with self.session_factory() as session:
            async with session.begin():
                result = await session.execute(
                    select(ContentChunkV2).where(ContentChunkV2.parse_id == parse_id).order_by(ContentChunkV2.chunk_index)
                )
                return result.scalars().all()

    async def create_chunk(self, *, parse_id: uuid.UUID, chunk: dict) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                chunk_record = ContentChunkV2(
                    id=uuid.uuid4(),
                    parse_id=parse_id,
                    chunk_index=chunk.get("chunk_index", 0),
                    content=chunk["content"],
                    meta=chunk["meta"],
                    created_at=datetime.utcnow(),
                )
                session.add(chunk_record)

    async def update_parse_status(self, *, parse_id: uuid.UUID, status: str) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                result = await session.execute(
                    text(
                        """
                        UPDATE content_parses_v2
                        SET status = :status
                        WHERE id = :parse_id
                        """
                    ),
                    {"status": status, "parse_id": parse_id},
                )
