from typing import Any
import asyncpg
import json

class AIRepository:
    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def create_call(
        self,
        prompt: str,
        provider: str | None,
        model: str | None,
        response: str,
        metadata: dict | None = None) -> dict[str, Any]:

        row = await self.db.fetchrow(
            """
            INSERT INTO ai_calls (prompt, provider, model, response, metadata)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            prompt,
            provider,
            model,
            response,
            json.dumps(metadata) if metadata else None)

        return dict(row) if row else {}
