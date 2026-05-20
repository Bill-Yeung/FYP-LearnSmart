import asyncpg
import json
from uuid import UUID

class MediaRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, media_id: UUID) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            "SELECT * FROM extracted_media WHERE id = $1",
            media_id)

    async def find_by_checksum(self, checksum: str) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            "SELECT id, file_url FROM extracted_media WHERE checksum = $1",
            checksum)

    async def get_by_source(
        self,
        source_id: UUID,
        media_type: str | None = None) -> list[asyncpg.Record]:

        if media_type:
            return await self.db.fetch(
                """
                SELECT * FROM extracted_media
                WHERE source_id = $1 AND media_type = $2
                ORDER BY pages, created_at
                """,
                source_id, media_type)
        else:
            return await self.db.fetch(
                """
                SELECT * FROM extracted_media
                WHERE source_id = $1
                ORDER BY media_type, pages, created_at
                """,
                source_id)

    async def get_by_type(
        self,
        media_type: str,
        limit: int = 100,
        offset: int = 0) -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT em.*, s.document_name as source_title
            FROM extracted_media em
            LEFT JOIN sources s ON em.source_id = s.id
            WHERE em.media_type = $1
            ORDER BY em.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            media_type, limit, offset)

    async def search_by_metadata(
        self,
        metadata_key: str,
        metadata_value: str,
        media_type: str | None = None,
        limit: int = 50) -> list[asyncpg.Record]:

        if media_type:
            return await self.db.fetch(
                """
                SELECT em.*, s.document_name as source_title
                FROM extracted_media em
                LEFT JOIN sources s ON em.source_id = s.id
                WHERE em.media_type = $1
                  AND em.metadata->>$2 = $3
                ORDER BY em.created_at DESC
                LIMIT $4
                """,
                media_type, metadata_key, metadata_value, limit)
        else:
            return await self.db.fetch(
                """
                SELECT em.*, s.document_name as source_title
                FROM extracted_media em
                LEFT JOIN sources s ON em.source_id = s.id
                WHERE em.metadata->>$1 = $2
                ORDER BY em.created_at DESC
                LIMIT $3
                """,
                metadata_key, metadata_value, limit)

    async def create(
        self,
        source_id: UUID,
        media_type: str,
        storage_method: str = "local_path",
        language: str = "en",
        file_url: str | None = None,
        checksum: str | None = None,
        pages: list[int] | None = None,
        extraction_location: str | None = None,
        metadata: dict | None = None,
        content: str | None = None) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO extracted_media (
                source_id, media_type, storage_method,
                language, file_url, checksum, pages, extraction_location,
                metadata, content
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            """,
            source_id,
            media_type,
            storage_method,
            language,
            file_url,
            checksum,
            pages,
            extraction_location,
            json.dumps(metadata) if metadata else None,
            content)

