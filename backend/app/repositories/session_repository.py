import asyncpg
from uuid import UUID
from datetime import datetime
import hashlib

class SessionRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    async def get_by_id(self, session_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            """
            SELECT * FROM user_sessions
            WHERE id = $1 AND expires_at > NOW()
            """,
            session_id)

    async def get_by_token_hash(self, token_hash: str) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            """
            SELECT * FROM user_sessions
            WHERE token_hash = $1 AND expires_at > NOW()
            """,
            token_hash)

    async def get_user_sessions(self, user_id: UUID) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT id, ip_address::text, user_agent, created_at, last_activity
            FROM user_sessions
            WHERE user_id = $1 AND expires_at > NOW()
            ORDER BY last_activity DESC
            """,
            user_id)

    async def create(
        self,
        session_id: UUID,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        ip_address: str | None = None,
        user_agent: str | None = None) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
            VALUES ($1, $2, $3, $4::inet, $5, $6)
            RETURNING *
            """,
            session_id, user_id, token_hash, ip_address, user_agent, expires_at)

    async def delete(self, session_id: UUID) -> bool:

        result = await self.db.execute(
            "DELETE FROM user_sessions WHERE id = $1",
            session_id)
        
        return result == "DELETE 1"

    async def delete_by_token_hash(self, token_hash: str) -> bool:

        result = await self.db.execute(
            "DELETE FROM user_sessions WHERE token_hash = $1",
            token_hash)
        
        return result == "DELETE 1"

    async def delete_user_sessions(self, user_id: UUID) -> int:

        result = await self.db.execute(
            "DELETE FROM user_sessions WHERE user_id = $1",
            user_id)
        
        return int(result.split()[1])

    async def delete_all_except(self, user_id: UUID, keep_session_id: UUID) -> int:

        result = await self.db.execute(
            """
            DELETE FROM user_sessions
            WHERE user_id = $1 AND id <> $2
            """,
            user_id, keep_session_id)

        return int(result.split()[1])

    async def delete_oldest_sessions(self, user_id: UUID, keep_count: int = 5) -> int:

        result = await self.db.execute(
            """
            DELETE FROM user_sessions
            WHERE user_id = $1 AND id NOT IN (
                SELECT id FROM user_sessions
                WHERE user_id = $1
                ORDER BY last_activity DESC
                LIMIT $2
            )
            """,
            user_id, keep_count)
        
        return int(result.split()[1])
