import asyncpg
from uuid import UUID

class RelationshipRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_concept_relationships(
        self,
        concept_id: UUID,
        language: str = "en",
        direction: str = "both" ) -> list[asyncpg.Record]:

        if direction == "outgoing":
            return await self.db.fetch(
                """
                SELECT 
                    cr.id,
                    cr.relationship_id,
                    cr.source_concept_id,
                    cr.target_concept_id,
                    cr.created_by,
                    cr.created_at,
                    r.relationship_type,
                    rt.name as relationship_name,
                    ct_target.title as target_title,
                    ct_target.description as target_description,
                    c_target.concept_type as target_type,
                    c_target.difficulty_level as target_difficulty
                FROM concept_relationships cr
                JOIN relationships r ON cr.relationship_id = r.id
                JOIN concepts c_target ON cr.target_concept_id = c_target.id
                LEFT JOIN relationship_translations rt ON r.id = rt.relationship_id AND rt.language = $2
                LEFT JOIN concept_translations ct_target ON c_target.id = ct_target.concept_id AND ct_target.language = $2
                WHERE cr.source_concept_id = $1
                ORDER BY r.relationship_type, ct_target.title
                """,
                concept_id, language)
        elif direction == "incoming":
            return await self.db.fetch(
                """
                SELECT 
                    cr.id,
                    cr.relationship_id,
                    cr.source_concept_id,
                    cr.target_concept_id,
                    cr.created_by,
                    cr.created_at,
                    r.relationship_type,
                    rt.name as relationship_name,
                    ct_source.title as source_title,
                    ct_source.description as source_description,
                    c_source.concept_type as source_type,
                    c_source.difficulty_level as source_difficulty
                FROM concept_relationships cr
                JOIN relationships r ON cr.relationship_id = r.id
                JOIN concepts c_source ON cr.source_concept_id = c_source.id
                LEFT JOIN relationship_translations rt ON r.id = rt.relationship_id AND rt.language = $2
                LEFT JOIN concept_translations ct_source ON c_source.id = ct_source.concept_id AND ct_source.language = $2
                WHERE cr.target_concept_id = $1
                ORDER BY r.relationship_type, ct_source.title
                """,
                concept_id, language)
        else:
            return await self.db.fetch(
                """
                SELECT 
                    cr.id,
                    cr.relationship_id,
                    cr.source_concept_id,
                    cr.target_concept_id,
                    cr.created_by,
                    cr.created_at,
                    r.relationship_type,
                    rt.name as relationship_name,
                    ct_source.title as source_title,
                    ct_target.title as target_title,
                    c_source.concept_type as source_type,
                    c_target.concept_type as target_type,
                    c_source.difficulty_level as source_difficulty,
                    c_target.difficulty_level as target_difficulty
                FROM concept_relationships cr
                JOIN relationships r ON cr.relationship_id = r.id
                JOIN concepts c_source ON cr.source_concept_id = c_source.id
                JOIN concepts c_target ON cr.target_concept_id = c_target.id
                LEFT JOIN relationship_translations rt ON r.id = rt.relationship_id AND rt.language = $2
                LEFT JOIN concept_translations ct_source ON c_source.id = ct_source.concept_id AND ct_source.language = $2
                LEFT JOIN concept_translations ct_target ON c_target.id = ct_target.concept_id AND ct_target.language = $2
                WHERE (cr.source_concept_id = $1 OR cr.target_concept_id = $1)
                ORDER BY r.relationship_type, ct_target.title
                """,
                concept_id, language)

    async def get_by_type(
        self,
        concept_id: UUID,
        relationship_type: str,
        language: str = "en") -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT 
                cr.id,
                cr.relationship_id,
                cr.source_concept_id,
                cr.target_concept_id,
                cr.created_at,
                r.relationship_type,
                ct.title as related_concept_title,
                ct.description as related_concept_description,
                c.concept_type,
                c.difficulty_level
            FROM concept_relationships cr
            JOIN relationships r ON cr.relationship_id = r.id
            JOIN concepts c ON cr.target_concept_id = c.id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.language = $3
            WHERE cr.source_concept_id = $1
              AND r.relationship_type = $2
            ORDER BY ct.title
            """,
            concept_id, relationship_type, language)

    async def get_discovered_relationship_by_name(self, suggested_relationship: str) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            "SELECT * FROM discovered_relationships WHERE suggested_relationship = $1",
            suggested_relationship)


    async def create_type(
        self,
        relationship_type: str,
        direction: str = "unidirectional",
        strength: float = 1.0) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO relationships (relationship_type, direction, strength)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            relationship_type, direction, strength)

    async def find_type_by_name(self, relationship_type: str) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            "SELECT id FROM relationships WHERE relationship_type = $1 LIMIT 1",
            relationship_type)

    async def create_concept_relationship(
        self,
        relationship_id: UUID,
        source_concept_id: UUID,
        target_concept_id: UUID,
        strength: float | None = None,
        created_by: UUID | None = None) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            INSERT INTO concept_relationships (relationship_id, source_concept_id, target_concept_id, strength, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            RETURNING *
            """,
            relationship_id, source_concept_id, target_concept_id, strength, created_by)

    async def add_translation(
        self,
        relationship_id: UUID,
        language: str,
        name: str,
        description: str | None = None,
        is_primary: bool = False,
        translation_quality: str = "llm") -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            INSERT INTO relationship_translations (relationship_id, language, name, description, is_primary, translation_quality)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (relationship_id, language) DO NOTHING
            RETURNING *
            """,
            relationship_id, language, name, description, is_primary, translation_quality)

    async def upsert_discovered_relationship(
        self,
        suggested_relationship: str,
        example_context: dict | None = None) -> asyncpg.Record | None:

        import json
        existing = await self.get_discovered_relationship_by_name(suggested_relationship)
        if existing:
            contexts = existing["example_contexts"] or []
            if example_context and len(contexts) < 10:
                contexts.append(example_context)
            return await self.db.fetchrow(
                """
                UPDATE discovered_relationships
                SET occurrence_count = occurrence_count + 1,
                    last_seen_at = CURRENT_TIMESTAMP,
                    example_contexts = $2::jsonb
                WHERE suggested_relationship = $1
                RETURNING *
                """,
                suggested_relationship, json.dumps(contexts))
        else:
            contexts = [example_context] if example_context else []
            return await self.db.fetchrow(
                """
                INSERT INTO discovered_relationships (suggested_relationship, example_contexts)
                VALUES ($1, $2::jsonb)
                RETURNING *
                """,
                suggested_relationship, json.dumps(contexts))

    async def link_to_source(
        self,
        relationship_id: int,
        source_id: UUID,
        pages: list[int] | None = None,
        location: str | None = None,
        created_by: UUID | None = None) -> asyncpg.Record | None:
  
        return await self.db.fetchrow(
            """
            INSERT INTO relationship_sources (relationship_id, source_id, pages, location, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (relationship_id, source_id) DO UPDATE SET
                pages = COALESCE(EXCLUDED.pages, relationship_sources.pages),
                location = COALESCE(EXCLUDED.location, relationship_sources.location)
            RETURNING *
            """,
            relationship_id, source_id, pages, location, created_by)

    async def get_by_source(
        self,
        source_id: UUID,
        language: str = "en",
        limit: int = 100,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        relationships = await self.db.fetch(
            """
            SELECT DISTINCT ON (cr.id)
                cr.id,
                r.relationship_type,
                cr.strength,
                r.direction,
                cr.created_at,
                rt.description,
                rt.language,
                source_ct.title AS source_concept_title,
                target_ct.title AS target_concept_title,
                cr.source_concept_id,
                cr.target_concept_id,
                rs.pages,
                rs.location AS source_location
            FROM concept_relationships cr
            INNER JOIN relationships r ON cr.relationship_id = r.id
            INNER JOIN relationship_sources rs ON cr.id = rs.relationship_id
            LEFT JOIN relationship_translations rt ON r.id = rt.relationship_id AND rt.is_primary = TRUE
            LEFT JOIN concepts source_c ON cr.source_concept_id = source_c.id
            LEFT JOIN concepts target_c ON cr.target_concept_id = target_c.id
            LEFT JOIN concept_translations source_ct ON source_c.id = source_ct.concept_id AND source_ct.is_primary = TRUE
            LEFT JOIN concept_translations target_ct ON target_c.id = target_ct.concept_id AND target_ct.is_primary = TRUE
            WHERE rs.source_id = $1
            ORDER BY cr.id, cr.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            source_id, limit, offset)

        total = await self.db.fetchval(
            """
            SELECT COUNT(DISTINCT cr.id)
            FROM concept_relationships cr
            INNER JOIN relationship_sources rs ON cr.id = rs.relationship_id
            WHERE rs.source_id = $1
            """,
            source_id)

        return relationships, total or 0

