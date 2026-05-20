import asyncpg
from uuid import UUID

class ConceptRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, concept_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM concepts WHERE id = $1",
            concept_id)

    async def get_with_translation(
        self,
        concept_id: UUID,
        language: str = "en") -> asyncpg.Record | None:
        return await self.db.fetchrow(
            """
            SELECT c.*, ct.title, ct.description, ct.keywords
            FROM concepts c
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE c.id = $1 AND (ct.language = $2 OR ct.is_primary = TRUE)
            ORDER BY CASE WHEN ct.language = $2 THEN 0 ELSE 1 END
            LIMIT 1
            """,
            concept_id, language)

    async def get_all(
        self,
        language: str = "en",
        limit: int = 100,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        total = await self.db.fetchval(
            """
            SELECT COUNT(DISTINCT c.id)
            FROM concepts c
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE ct.language = $1 OR ct.is_primary = TRUE
            """,
            language)

        concepts = await self.db.fetch(
            """
            SELECT c.*, ct.title, ct.description
            FROM concepts c
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE ct.language = $1 OR ct.is_primary = TRUE
            ORDER BY c.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            language, limit, offset)

        return concepts, total or 0

    async def get_by_type(
        self,
        concept_type: str,
        language: str = "en",
        limit: int = 100,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        total = await self.db.fetchval(
            """
            SELECT COUNT(DISTINCT c.id)
            FROM concepts c
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE c.concept_type = $1 AND (ct.language = $2 OR ct.is_primary = TRUE)
            """,
            concept_type, language)

        concepts = await self.db.fetch(
            """
            SELECT c.*, ct.title, ct.description
            FROM concepts c
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE c.concept_type = $1 AND (ct.language = $2 OR ct.is_primary = TRUE)
            ORDER BY c.created_at DESC
            LIMIT $3 OFFSET $4
            """,
            concept_type, language, limit, offset)

        return concepts, total or 0

    async def search_by_title(
        self,
        query: str,
        language: str = "en",
        limit: int = 50,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        total = await self.db.fetchval(
            """
            SELECT COUNT(*)
            FROM concepts c
            JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE ct.language = $2 AND ct.title % $1
            """,
            query, language)

        concepts = await self.db.fetch(
            """
            SELECT c.*, ct.title, ct.description,
                   similarity(ct.title, $1) AS score
            FROM concepts c
            JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE ct.language = $2 AND ct.title % $1
            ORDER BY score DESC
            LIMIT $3 OFFSET $4
            """,
            query, language, limit, offset)

        return concepts, total or 0

    async def create(
        self,
        concept_type: str,
        created_by: UUID | None = None,
        difficulty_level: str | None = None,
        estimated_study_time_minutes: int | None = None,
        formula_latex: str | None = None,
        base_form: str | None = None,
        is_public: bool = False) -> asyncpg.Record:
        return await self.db.fetchrow(
            """
            INSERT INTO concepts (
                concept_type, created_by, difficulty_level,
                estimated_study_time_minutes, formula_latex,
                base_form, is_public, is_system_generated
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            concept_type, created_by, difficulty_level,
            estimated_study_time_minutes, formula_latex,
            base_form, is_public, created_by is None)

    async def update(self, concept_id: UUID, **fields) -> asyncpg.Record | None:

        if not fields:
            return await self.get_by_id(concept_id)

        set_clauses = []
        values = []
        for i, (key, value) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(value)

        values.append(concept_id)
        query = f"""
            UPDATE concepts
            SET {', '.join(set_clauses)},
                updated_at = CURRENT_TIMESTAMP,
                version = version + 1
            WHERE id = ${len(values)}
            RETURNING *
        """

        return await self.db.fetchrow(query, *values)

    async def delete(self, concept_id: UUID) -> bool:
        result = await self.db.execute(
            "DELETE FROM concepts WHERE id = $1",
            concept_id)
        return result == "DELETE 1"

    async def add_translation(
        self,
        concept_id: UUID,
        language: str,
        title: str,
        description: str,
        keywords: list[str] | None = None,
        formula_plain_text: str | None = None,
        created_by: UUID | None = None,
        is_primary: bool = False,
        translation_quality: str = "source") -> asyncpg.Record:
        return await self.db.fetchrow(
            """
            INSERT INTO concept_translations (
                concept_id, language, title, description, keywords,
                formula_plain_text, created_by, is_primary, translation_quality
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (concept_id, language)
            DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                keywords = EXCLUDED.keywords,
                formula_plain_text = EXCLUDED.formula_plain_text,
                translation_date = CURRENT_TIMESTAMP
            RETURNING *
            """,
            concept_id, language, title, description, keywords,
            formula_plain_text, created_by, is_primary, translation_quality)

    async def update_title(
        self,
        concept_id: UUID,
        language: str,
        new_title: str) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            UPDATE concept_translations
            SET title = $3, translation_date = CURRENT_TIMESTAMP
            WHERE concept_id = $1 AND language = $2
            RETURNING *
            """,
            concept_id, language, new_title)

    async def append_description(
        self,
        concept_id: UUID,
        language: str,
        new_description: str,
        new_keywords: list[str] | None = None) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            UPDATE concept_translations
            SET description = description || E'\n\n' || $3,
                keywords = (
                    SELECT array_agg(DISTINCT kw)
                    FROM unnest(COALESCE(keywords, ARRAY[]::text[]) || COALESCE($4, ARRAY[]::text[])) AS kw
                ),
                translation_date = CURRENT_TIMESTAMP
            WHERE concept_id = $1 AND language = $2
            RETURNING *
            """,
            concept_id, language, new_description, new_keywords)

    async def link_to_source(
        self,
        concept_id: UUID,
        source_id: UUID,
        pages: list[int] | None = None,
        location: str | None = None,
        created_by: UUID | None = None) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO concept_sources (concept_id, source_id, pages, location, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (concept_id, source_id) DO UPDATE SET
                pages = COALESCE(EXCLUDED.pages, concept_sources.pages),
                location = COALESCE(EXCLUDED.location, concept_sources.location)
            RETURNING *
            """,
            concept_id, source_id, pages, location, created_by)

    async def find_similar_by_title(
        self,
        title: str,
        language: str = "en",
        similarity_threshold: float = 0.4,
        limit: int = 5) -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT c.id, c.concept_type, ct.title, ct.description,
                   similarity(ct.title, $1) AS title_similarity
            FROM concepts c
            JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE ct.language = $2
              AND similarity(ct.title, $1) >= $3
            ORDER BY title_similarity DESC
            LIMIT $4
            """,
            title, language, similarity_threshold, limit)

    async def find_exact_match(
        self,
        title: str,
        concept_type: str,
        language: str = "en") -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            SELECT c.id, c.concept_type, c.difficulty_level, ct.title, ct.description
            FROM concepts c
            JOIN concept_translations ct ON c.id = ct.concept_id
            WHERE LOWER(ct.title) = LOWER($1)
              AND c.concept_type = $2
              AND ct.language = $3
            LIMIT 1
            """,
            title, concept_type, language)

    async def get_by_ids(
        self,
        concept_ids: list[UUID]) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT DISTINCT ON (c.id)
                c.id, c.concept_type, c.difficulty_level,
                ct.title, ct.description, ct.keywords
            FROM concepts c
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.is_primary = TRUE
            WHERE c.id = ANY($1::uuid[])
            ORDER BY c.id, c.created_at DESC
            LIMIT 500
            """,
            concept_ids)

    async def get_by_documents(
        self,
        document_ids: list[UUID],
        user_id: UUID) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT DISTINCT ON (c.id)
                c.id, c.concept_type, c.difficulty_level,
                ct.title, ct.description, ct.keywords
            FROM concepts c
            INNER JOIN concept_sources cs ON c.id = cs.concept_id
            INNER JOIN sources s ON cs.source_id = s.id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.is_primary = TRUE
            WHERE cs.source_id = ANY($1::uuid[])
              AND s.uploaded_by = $2 AND s.deleted_at IS NULL
            ORDER BY c.id, c.created_at DESC
            LIMIT 500
            """,
            document_ids, user_id)

    async def get_all_for_user(
        self,
        user_id: UUID) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT DISTINCT ON (c.id)
                c.id, c.concept_type, c.difficulty_level,
                ct.title, ct.description, ct.keywords
            FROM concepts c
            INNER JOIN concept_sources cs ON c.id = cs.concept_id
            INNER JOIN sources s ON cs.source_id = s.id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.is_primary = TRUE
            WHERE s.uploaded_by = $1 AND s.deleted_at IS NULL
            ORDER BY c.id, c.created_at DESC
            LIMIT 500
            """,
            user_id)

    async def get_by_subject(
        self,
        subject_id: UUID,
        user_id: UUID,
        relevance: str | None = None) -> list[asyncpg.Record]:

        params: list = [subject_id, user_id]
        relevance_clause = ""
        if relevance:
            relevance_clause = " AND csub.relevance = $3"
            params.append(relevance)

        return await self.db.fetch(
            f"""
            SELECT DISTINCT ON (c.id)
                c.id, c.concept_type, c.difficulty_level,
                ct.title, ct.description, ct.keywords,
                csub.relevance, csub.exam_board, csub.module_key
            FROM concepts c
            INNER JOIN concept_subjects csub ON c.id = csub.concept_id
            INNER JOIN concept_sources cs ON c.id = cs.concept_id
            INNER JOIN sources s ON cs.source_id = s.id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.is_primary = TRUE
            WHERE csub.subject_id = $1
              AND s.uploaded_by = $2 AND s.deleted_at IS NULL
              {relevance_clause}
            ORDER BY c.id, c.created_at DESC
            LIMIT 500
            """,
            *params)

    async def link_to_subject(
        self,
        concept_id: UUID,
        subject_id: UUID,
        relevance: str = "core",
        exam_board: str | None = None,
        module_key: str | None = None,
        created_by: UUID | None = None) -> asyncpg.Record:
        return await self.db.fetchrow(
            """
            INSERT INTO concept_subjects (concept_id, subject_id, relevance, exam_board, module_key, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (concept_id, subject_id) DO UPDATE SET
                relevance = EXCLUDED.relevance,
                exam_board = EXCLUDED.exam_board,
                module_key = EXCLUDED.module_key
            RETURNING *
            """,
            concept_id, subject_id, relevance, exam_board, module_key, created_by)

    async def get_by_source(
        self,
        source_id: UUID,
        language: str = "en",
        limit: int = 100,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        concepts = await self.db.fetch(
            """
            SELECT DISTINCT ON (c.id)
                c.id,
                c.concept_type,
                c.difficulty_level,
                c.created_at,
                ct.title,
                ct.description,
                ct.keywords,
                ct.language,
                cs.pages,
                cs.location AS source_location,
                s.document_name
            FROM concepts c
            INNER JOIN concept_sources cs ON c.id = cs.concept_id
            INNER JOIN sources s ON cs.source_id = s.id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.is_primary = TRUE
            WHERE cs.source_id = $1
            ORDER BY c.id, c.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            source_id, limit, offset)

        total = await self.db.fetchval(
            """
            SELECT COUNT(DISTINCT c.id)
            FROM concepts c
            INNER JOIN concept_sources cs ON c.id = cs.concept_id
            WHERE cs.source_id = $1
            """,
            source_id)

        return concepts, total or 0

