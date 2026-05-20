import asyncpg
from uuid import UUID

# whitelist of columns clients are allowed to PATCH; rejects anything else
ALLOWED_FIELDS = {
    "email_notifications",
    "push_notifications",
    "study_reminders",
    "community_updates",
    "profile_visibility",
    "show_online_status",
    "allow_friend_requests",
}


class UserPreferencesRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get(self, user_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM user_preferences WHERE user_id = $1",
            user_id)

    async def upsert_defaults(self, user_id: UUID) -> asyncpg.Record:
        # creates the row with defaults if missing; returns existing row otherwise
        return await self.db.fetchrow(
            """
            INSERT INTO user_preferences (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO UPDATE
              SET user_id = EXCLUDED.user_id
            RETURNING *
            """,
            user_id)

    async def patch(self, user_id: UUID, **fields) -> asyncpg.Record:
        # filter to allowed columns only, drop None (means "not provided")
        clean = {k: v for k, v in fields.items() if k in ALLOWED_FIELDS and v is not None}
        if not clean:
            return await self.get(user_id)

        # build dynamic SET clause with positional params
        set_parts = []
        values = []
        for i, (k, v) in enumerate(clean.items(), start=2):
            set_parts.append(f"{k} = ${i}")
            values.append(v)

        query = f"""
            UPDATE user_preferences
            SET {', '.join(set_parts)}, updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
        """
        return await self.db.fetchrow(query, user_id, *values)
