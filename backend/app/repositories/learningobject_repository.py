import json
import asyncpg
from uuid import UUID

class LearningObjectRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def create(
        self,
        concept_id: UUID,
        format: str | None = None,
        duration_minutes: int | None = None,
        media_refs: list[UUID] | None = None,
        xapi_metadata: dict | None = None,
        target_concept_ids: list[UUID] | None = None,
        assessment_ids: list[UUID] | None = None,
        success_criteria: dict | None = None) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO learning_object_details (
                concept_id, format, duration_minutes, media_refs,
                xapi_metadata, target_concept_ids, assessment_ids, success_criteria
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            concept_id, format, duration_minutes, media_refs,
            json.dumps(xapi_metadata) if xapi_metadata else None,
            target_concept_ids, assessment_ids,
            json.dumps(success_criteria) if success_criteria else None)

    async def add_translation(
        self,
        learning_object_id: UUID,
        language: str,
        learning_objectives: list[str] | None = None,
        is_primary: bool = False,
        created_by: UUID | None = None,
        translation_quality: str = "llm") -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            INSERT INTO learning_object_translations (
                learning_object_id, language, learning_objectives,
                is_primary, created_by, translation_quality
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (learning_object_id, language) DO NOTHING
            RETURNING *
            """,
            learning_object_id, language, learning_objectives,
            is_primary, created_by, translation_quality)

    async def get_by_id(self, concept_id: UUID, language: str = "en") -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            SELECT
                c.id as concept_id,
                c.concept_type,
                c.difficulty_level,
                c.created_at,
                lod.id as learning_object_id,
                lod.format,
                lod.duration_minutes,
                lod.media_refs,
                lod.xapi_metadata,
                lod.target_concept_ids,
                lod.assessment_ids,
                lod.success_criteria,
                lot.learning_objectives,
                lot.language,
                lot.is_primary,
                ct.title as concept_title,
                ct.description as concept_description
            FROM concepts c
            JOIN learning_object_details lod ON c.id = lod.concept_id
            JOIN learning_object_translations lot ON lod.id = lot.learning_object_id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.language = lot.language
            WHERE c.id = $1
              AND lot.language = $2
              AND c.concept_type = 'learning_object'
            LIMIT 1
            """,
            concept_id, language)

