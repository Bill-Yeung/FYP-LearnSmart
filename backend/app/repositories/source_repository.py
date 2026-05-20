import asyncpg
from uuid import UUID
from app.models.document import ProcessingStatus

class SourceRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, source_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM sources WHERE id = $1 AND deleted_at IS NULL",
            source_id)

    async def get_all(
        self,
        limit: int = 100,
        offset: int = 0,
        user_id: UUID | None = None) -> tuple[list[asyncpg.Record], int]:

        if user_id:
            total = await self.db.fetchval(
                "SELECT COUNT(*) FROM sources WHERE uploaded_by = $1 AND deleted_at IS NULL",
                user_id)
            sources = await self.db.fetch(
                """
                SELECT * FROM sources
                WHERE uploaded_by = $1 AND deleted_at IS NULL
                ORDER BY uploaded_at DESC
                LIMIT $2 OFFSET $3
                """,
                user_id, limit, offset)
        else:
            total = await self.db.fetchval(
                "SELECT COUNT(*) FROM sources WHERE deleted_at IS NULL")
            sources = await self.db.fetch(
                "SELECT * FROM sources WHERE deleted_at IS NULL ORDER BY uploaded_at DESC LIMIT $1 OFFSET $2",
                limit, offset)

        return sources, total or 0

    async def get_by_user(
        self,
        user_id: UUID,
        document_type: str | None = None,
        status: str | None = None,
        subject_id: UUID | None = None,
        limit: int = 100,
        offset: int = 0,
        sort_by: str = "uploaded_at") -> tuple[list[asyncpg.Record], int]:

        conditions = ["s.uploaded_by = $1", "s.deleted_at IS NULL"]
        params: list = [user_id]
        param_count = 1
        joins = ""

        if document_type:
            param_count += 1
            conditions.append(f"s.document_type = ${param_count}")
            params.append(document_type)

        if status:
            param_count += 1
            conditions.append(f"s.processing_status = ${param_count}")
            params.append(status)

        if subject_id:
            param_count += 1
            joins = f" INNER JOIN source_subjects ss ON s.id = ss.source_id AND ss.subject_id = ${param_count}"
            params.append(subject_id)

        where_clause = " AND ".join(conditions)

        valid_sorts = {"uploaded_at", "document_name", "updated_at"}
        order_by = f"s.{sort_by}" if sort_by in valid_sorts else "s.uploaded_at"

        total = await self.db.fetchval(
            f"SELECT COUNT(*) FROM sources s{joins} WHERE {where_clause}",
            *params)

        rows = await self.db.fetch(
            f"""
            SELECT
                s.id, s.document_name, s.document_type, s.processing_status,
                s.author, s.language, s.is_public, s.uploaded_at,
                s.concepts_extracted, s.relationships_extracted
            FROM sources s{joins}
            WHERE {where_clause}
            ORDER BY {order_by} DESC
            LIMIT ${param_count + 1} OFFSET ${param_count + 2}
            """,
            *params, limit, offset)

        return rows, total or 0

    async def search_keyword(
        self,
        user_id: UUID,
        query: str,
        title_only: bool,
        document_type: str | None,
        status: str | None,
        subject_id: UUID | None,
        limit: int,
        offset: int) -> tuple[list[asyncpg.Record], int]:

        conditions = ["s.uploaded_by = $1", "s.deleted_at IS NULL"]
        params: list = [user_id]
        param_count = 1
        joins = ""

        param_count += 1
        if title_only:
            search_condition = f"s.document_name ILIKE ${param_count}"
        else:
            search_condition = f"(s.document_name ILIKE ${param_count} OR s.full_text ILIKE ${param_count})"
        conditions.append(search_condition)
        params.append(f"%{query}%")

        if document_type:
            param_count += 1
            conditions.append(f"s.document_type = ${param_count}")
            params.append(document_type)

        if status:
            param_count += 1
            conditions.append(f"s.processing_status = ${param_count}")
            params.append(status)

        if subject_id:
            param_count += 1
            joins = f" INNER JOIN source_subjects ss ON s.id = ss.source_id AND ss.subject_id = ${param_count}"
            params.append(subject_id)

        where_clause = " AND ".join(conditions)

        total = await self.db.fetchval(
            f"SELECT COUNT(*) FROM sources s{joins} WHERE {where_clause}",
            *params)

        rows = await self.db.fetch(
            f"""
            SELECT
                s.id, s.document_name, s.document_type, s.processing_status,
                s.author, s.language, s.is_public, s.uploaded_at,
                s.concepts_extracted, s.relationships_extracted
            FROM sources s{joins}
            WHERE {where_clause}
            ORDER BY s.uploaded_at DESC
            LIMIT ${param_count + 1} OFFSET ${param_count + 2}
            """,
            *params, limit, offset)

        return rows, total or 0

    async def get_by_ids(
        self,
        user_id: UUID,
        document_ids: list[str],
        document_type: str | None = None,
        status: str | None = None,
        subject_id: UUID | None = None) -> list[asyncpg.Record]:

        conditions = ["s.uploaded_by = $1", "s.deleted_at IS NULL", f"s.id = ANY($2::uuid[])"]
        params: list = [user_id, document_ids]
        param_count = 2
        joins = ""

        if document_type:
            param_count += 1
            conditions.append(f"s.document_type = ${param_count}")
            params.append(document_type)

        if status:
            param_count += 1
            conditions.append(f"s.processing_status = ${param_count}")
            params.append(status)

        if subject_id:
            param_count += 1
            joins = f" INNER JOIN source_subjects ss ON s.id = ss.source_id AND ss.subject_id = ${param_count}"
            params.append(subject_id)

        where_clause = " AND ".join(conditions)

        rows = await self.db.fetch(
            f"""
            SELECT
                s.id, s.document_name, s.document_type, s.processing_status,
                s.author, s.language, s.is_public, s.uploaded_at,
                s.concepts_extracted, s.relationships_extracted
            FROM sources s{joins}
            WHERE {where_clause}
            """,
            *params)

        return rows

    async def get_by_id_and_user(
        self,
        source_id: UUID,
        user_id: UUID) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            SELECT *
            FROM sources
            WHERE id = $1 AND uploaded_by = $2 AND deleted_at IS NULL
            """,
            source_id, user_id)

    async def get_status_by_id_and_user(
        self,
        source_id: UUID,
        user_id: UUID) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            SELECT processing_status, processing_error
            FROM sources
            WHERE id = $1 AND uploaded_by = $2
            """,
            source_id, user_id)

    async def get_path_and_deleted(
        self,
        source_id: UUID,
        user_id: UUID) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            "SELECT document_path, deleted_at FROM sources WHERE id = $1 AND uploaded_by = $2",
            source_id, user_id)

    async def find_by_checksum(self, checksum: str) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT id, document_name FROM sources WHERE checksum = $1 AND deleted_at IS NULL",
            checksum)

    async def create(
        self,
        document_name: str,
        document_type: str,
        language: str | None = None,
        document_path: str | None = None,
        author: str | None = None,
        publication_year: int | None = None,
        processing_status: ProcessingStatus = ProcessingStatus.pending,
        uploaded_by: UUID | None = None,
        is_public: bool = False,
        checksum: str | None = None) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO sources (
                document_name, document_type, language, document_path,
                author, publication_year, processing_status, uploaded_by, is_public, checksum
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            """,
            document_name, document_type, language, document_path,
            author, publication_year, processing_status.value, uploaded_by, is_public, checksum)

    async def update_status(
        self,
        source_id: UUID,
        status: ProcessingStatus,
        error_message: str | None = None) -> asyncpg.Record | None:

        if status == ProcessingStatus.processing:
            return await self.db.fetchrow(
                """
                UPDATE sources
                SET processing_status = $1,
                    processing_error = $2,
                    processing_started_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
                """,
                status.value, error_message, source_id)
        elif status == ProcessingStatus.completed:
            return await self.db.fetchrow(
                """
                UPDATE sources
                SET processing_status = $1,
                    processing_error = $2,
                    processing_completed_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
                """,
                status.value, error_message, source_id)
        else:
            return await self.db.fetchrow(
                """
                UPDATE sources
                SET processing_status = $1,
                    processing_error = $2
                WHERE id = $3
                RETURNING *
                """,
                status.value, error_message, source_id)

    async def update_extraction_counts(
        self,
        source_id: UUID,
        concepts_extracted: int,
        relationships_extracted: int) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            UPDATE sources
            SET concepts_extracted = $1,
                relationships_extracted = $2
            WHERE id = $3
            RETURNING *
            """,
            concepts_extracted, relationships_extracted, source_id)

    async def update_ai_summary(
        self,
        source_id: UUID,
        ai_summary: str) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            UPDATE sources
            SET ai_summary = $1,
                ai_summary_generated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            """,
            ai_summary, source_id)

    async def update_full_text(
        self,
        source_id: UUID,
        full_text: str) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            UPDATE sources
            SET full_text = $1
            WHERE id = $2
            RETURNING id
            """,
            full_text, source_id)

    async def soft_delete(self, source_id: UUID) -> bool:

        result = await self.db.execute(
            "UPDATE sources SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1",
            source_id)
        return result == "UPDATE 1"

    async def restore(self, source_id: UUID, user_id: UUID) -> bool:

        result = await self.db.execute(
            "UPDATE sources SET deleted_at = NULL WHERE id = $1 AND uploaded_by = $2 AND deleted_at IS NOT NULL",
            source_id, user_id)
        return result == "UPDATE 1"

    async def hard_delete(self, source_id: UUID) -> bool:

        result = await self.db.execute(
            "DELETE FROM sources WHERE id = $1",
            source_id)
        return result == "DELETE 1"

    async def get_deleted_by_user(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        total = await self.db.fetchval(
            "SELECT COUNT(*) FROM sources WHERE uploaded_by = $1 AND deleted_at IS NOT NULL",
            user_id)

        rows = await self.db.fetch(
            """
            SELECT
                id, document_name, document_type, processing_status,
                author, language, is_public, uploaded_at, deleted_at,
                concepts_extracted, relationships_extracted
            FROM sources
            WHERE uploaded_by = $1 AND deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id, limit, offset)

        return rows, total or 0

    async def get_expired_deleted(self, days: int = 30) -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT id, document_path
            FROM sources
            WHERE deleted_at IS NOT NULL
              AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
            """,
            days)

    async def get_subjects(self, source_id: UUID) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT sub.id, sub.code, sub.name
            FROM subjects sub
            INNER JOIN source_subjects ss ON sub.id = ss.subject_id
            WHERE ss.source_id = $1
            ORDER BY sub.code
            """,
            source_id)

    async def link_to_subjects(
        self,
        source_id: UUID,
        subject_ids: list[UUID]) -> None:
        for sid in subject_ids:
            await self.db.execute(
                """
                INSERT INTO source_subjects (source_id, subject_id)
                VALUES ($1, $2)
                ON CONFLICT (source_id, subject_id) DO NOTHING
                """,
                source_id, sid)

