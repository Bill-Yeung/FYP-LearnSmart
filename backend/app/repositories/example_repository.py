import asyncpg
from uuid import UUID

class ExampleRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, concept_id: UUID, language: str = "en") -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            SELECT
                c.id as concept_id,
                c.concept_type,
                c.difficulty_level,
                c.created_at,
                ed.id as example_id,
                ed.media_refs,
                et.context,
                et.inputs,
                et.outcome,
                et.lessons_learned,
                et.language,
                et.is_primary,
                ct.title as concept_title,
                ct.description as concept_description
            FROM concepts c
            JOIN example_details ed ON c.id = ed.concept_id
            JOIN example_translations et ON ed.id = et.example_id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.language = et.language
            WHERE c.id = $1
              AND et.language = $2
              AND c.concept_type = 'example'
            LIMIT 1
            """,
            concept_id, language)


    async def create(
        self,
        concept_id: UUID,
        media_refs: list[UUID] | None = None) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO example_details (concept_id, media_refs)
            VALUES ($1, $2)
            RETURNING *
            """,
            concept_id, media_refs)

    async def add_translation(
        self,
        example_id: UUID,
        language: str,
        context: str | None = None,
        inputs: str | None = None,
        outcome: str | None = None,
        lessons_learned: str | None = None,
        is_primary: bool = False,
        translation_quality: str = "llm") -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO example_translations (
                example_id, language, context, inputs, outcome,
                lessons_learned, is_primary, translation_quality
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (example_id, language) DO UPDATE SET
                context = EXCLUDED.context,
                inputs = EXCLUDED.inputs,
                outcome = EXCLUDED.outcome,
                lessons_learned = EXCLUDED.lessons_learned
            RETURNING *
            """,
            example_id, language, context, inputs, outcome,
            lessons_learned, is_primary, translation_quality)
