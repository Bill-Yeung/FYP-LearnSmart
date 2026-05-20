import asyncpg
import json
from uuid import UUID
from typing import Any

class TeachBackRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def create_session(
        self,
        *,
        user_id: UUID | None,
        concept_id: UUID | None,
        concept_title: str | None,
        explanation: str,
        target_level: str,
        language: str,
        analysis: dict[str, Any]
    ) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO feynman_sessions (
                user_id, concept_id, concept_title,
                explanation, target_level, language, analysis
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
            RETURNING id, concept_title, analysis, created_at
            """,
            user_id,
            concept_id,
            concept_title,
            explanation,
            target_level,
            language,
            json.dumps(analysis)
        )

    async def list_recent_by_user(self, user_id: UUID, limit: int = 10) -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT id, concept_title, created_at,
                   (analysis->>'score')::float AS score
            FROM feynman_sessions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            user_id,
            limit
        )
