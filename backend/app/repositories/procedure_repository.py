import asyncpg
from uuid import UUID

class ProcedureRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, concept_id: UUID, language: str = "en") -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            SELECT
                c.id as concept_id,
                c.concept_type,
                c.difficulty_level,
                c.estimated_study_time_minutes,
                c.created_at,
                pd.id as procedure_id,
                pd.expected_duration_minutes,
                pd.stored_in_neo4j,
                pt.purpose,
                pt.preconditions,
                pt.failure_modes,
                pt.verification_checks,
                pt.steps,
                pt.language,
                pt.is_primary,
                ct.title as concept_title,
                ct.description as concept_description
            FROM concepts c
            JOIN procedure_details pd ON c.id = pd.concept_id
            JOIN procedure_translations pt ON pd.id = pt.procedure_id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.language = pt.language
            WHERE c.id = $1
              AND pt.language = $2
              AND c.concept_type = 'procedure'
            LIMIT 1
            """,
            concept_id, language)


    async def create(
        self,
        concept_id: UUID,
        expected_duration_minutes: int | None = None,
        stored_in_neo4j: bool = False) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO procedure_details (concept_id, expected_duration_minutes, stored_in_neo4j)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            concept_id, expected_duration_minutes, stored_in_neo4j)

    async def add_translation(
        self,
        procedure_id: UUID,
        language: str,
        purpose: str | None = None,
        preconditions: str | None = None,
        steps: str | None = None,
        failure_modes: str | None = None,
        verification_checks: str | None = None,
        is_primary: bool = False,
        translation_quality: str = "llm") -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO procedure_translations (
                procedure_id, language, purpose, preconditions, steps,
                failure_modes, verification_checks, is_primary, translation_quality
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (procedure_id, language) DO UPDATE SET
                purpose = EXCLUDED.purpose,
                preconditions = EXCLUDED.preconditions,
                steps = EXCLUDED.steps,
                failure_modes = EXCLUDED.failure_modes,
                verification_checks = EXCLUDED.verification_checks
            RETURNING *
            """,
            procedure_id, language, purpose, preconditions, steps,
            failure_modes, verification_checks, is_primary, translation_quality)
