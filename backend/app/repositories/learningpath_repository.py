import asyncpg
from uuid import UUID

class LearningPathRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_prerequisites(self, concept_id: UUID, language: str = "en") -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT 
                cr.id as relationship_instance_id,
                cr.source_concept_id as prerequisite_concept_id,
                cr.target_concept_id as concept_id,
                cr.relationship_id,
                cr.strength,
                r.relationship_type,
                c.concept_type,
                c.difficulty_level,
                ct.title as prerequisite_title,
                ct.description as prerequisite_description
            FROM concept_relationships cr
            JOIN relationships r ON cr.relationship_id = r.id
            JOIN concepts c ON cr.source_concept_id = c.id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.language = $2
            WHERE cr.target_concept_id = $1
              AND r.relationship_type IN ('prerequisite_of', 'has_prerequisite')
            ORDER BY cr.strength DESC
            """,
            concept_id, language)

    async def get_user_learning_paths(
        self,
        user_id: UUID,
        language: str = "en",
        limit: int = 100) -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT 
                lp.id,
                lp.target_concept_id,
                lp.created_by,
                lp.created_at,
                lp.updated_at,
                lpt.title,
                lpt.description,
                lpt.language,
                ct.title as target_concept_title
            FROM learning_paths lp
            LEFT JOIN learning_path_translations lpt ON lp.id = lpt.learning_path_id AND lpt.language = $2
            LEFT JOIN concepts c ON lp.target_concept_id = c.id
            LEFT JOIN concept_translations ct ON c.id = ct.concept_id AND ct.language = $2
            WHERE lp.created_by = $1
            ORDER BY lp.created_at DESC
            LIMIT $3
            """,
            user_id, language, limit)

    async def create(
        self,
        target_concept_id: UUID | None = None,
        created_by: UUID | None = None
    ) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO learning_paths (target_concept_id, created_by)
            VALUES ($1, $2)
            RETURNING *
            """,
            target_concept_id, created_by)

    async def add_translation(
        self,
        learning_path_id: UUID,
        language: str,
        title: str,
        description: str | None = None,
        is_primary: bool = True,
        translation_quality: str = "llm"
    ) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO learning_path_translations
                (learning_path_id, language, title, description, is_primary, translation_quality)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """,
            learning_path_id, language, title, description, is_primary, translation_quality)

    async def update(
        self,
        path_id: UUID,
        target_concept_id: UUID | None = None
    ) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            UPDATE learning_paths
            SET target_concept_id = COALESCE($2, target_concept_id),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            path_id, target_concept_id)

    async def delete(self, path_id: UUID) -> bool:

        await self.db.execute(
            "DELETE FROM learning_path_translations WHERE learning_path_id = $1",
            path_id)

        step_ids = await self.db.fetch(
            "SELECT id FROM learning_path_steps WHERE path_id = $1",
            path_id)

        for step_row in step_ids:
            await self.db.execute(
                "DELETE FROM learning_path_step_translations WHERE step_id = $1",
                step_row["id"])

        await self.db.execute(
            "DELETE FROM learning_path_steps WHERE path_id = $1",
            path_id)

        result = await self.db.execute(
            "DELETE FROM learning_paths WHERE id = $1",
            path_id)

        return result == "DELETE 1"

    async def add_step(
        self,
        path_id: UUID,
        concept_id: UUID,
        step_order: int,
        is_required: bool = True,
        estimated_time_minutes: int | None = None
    ) -> asyncpg.Record | None:

        return await self.db.fetchrow(
            """
            INSERT INTO learning_path_steps
                (path_id, concept_id, step_order, is_required, estimated_time_minutes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (path_id, step_order) DO NOTHING
            RETURNING *
            """,
            path_id, concept_id, step_order, is_required, estimated_time_minutes)

    async def add_step_translation(
        self,
        step_id: UUID,
        language: str,
        notes: str | None = None,
        is_primary: bool = True,
        translation_quality: str = "llm"
    ) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO learning_path_step_translations
                (step_id, language, notes, is_primary, translation_quality)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            step_id, language, notes, is_primary, translation_quality)

