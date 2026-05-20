import asyncpg
from uuid import UUID

class UserRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, user_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM users WHERE id = $1",
            user_id)

    async def get_by_email(self, email: str) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
            email)

    async def get_all(self, limit: int = 100, offset: int = 0) -> list[asyncpg.Record]:
        return await self.db.fetch(
            "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            limit, offset)

    async def get_by_role(self, role: str, limit: int = 100) -> list[asyncpg.Record]:
        return await self.db.fetch(
            "SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2",
            role, limit)

    async def create(
        self,
        username: str,
        email: str,
        password_hash: str,
        role: str = "student",
        display_name: str | None = None) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO users (username, email, password_hash, role, display_name)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            username, email, password_hash, role, display_name)

    async def update(self, user_id: UUID, **fields) -> asyncpg.Record | None:

        if not fields:
            return await self.get_by_id(user_id)

        set_clauses = []
        values = []
        for i, (key, value) in enumerate(fields.items(), start = 1):
            set_clauses.append(f"{key} = ${i}")
            values.append(value)

        values.append(user_id)
        query = f"""
            UPDATE users
            SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${len(values)}
            RETURNING *
        """

        return await self.db.fetchrow(query, *values)

    async def update_password(self, user_id: UUID, password_hash: str) -> bool:

        result = await self.db.execute(
            """
            UPDATE users
            SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            """,
            password_hash, user_id)
        
        return result == "UPDATE 1"

    async def update_last_login(self, user_id: UUID) -> bool:

        result = await self.db.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
            user_id)

        return result == "UPDATE 1"

    async def update_last_seen(self, user_id: UUID, platform: str = 'web') -> bool:

        result = await self.db.execute(
            """
            UPDATE device
            SET last_seen_at = now()
            WHERE id = $1 AND platform = $2
            """,
            user_id, platform)

        if result == "UPDATE 0":
            await self.db.execute(
                """
                INSERT INTO device (id, platform, last_seen_at)
                VALUES ($1, $2, now())
                """,
                user_id, platform)

        return True

    async def deactivate(self, user_id: UUID) -> bool:

        result = await self.db.execute(
            "UPDATE users SET is_active = FALSE WHERE id = $1",
            user_id)

        return result == "UPDATE 1"

    async def activate(self, user_id: UUID) -> bool:

        result = await self.db.execute(
            "UPDATE users SET is_active = TRUE WHERE id = $1",
            user_id)

        return result == "UPDATE 1"

    async def delete(self, user_id: UUID) -> bool:

        result = await self.db.execute(
            "DELETE FROM users WHERE id = $1",
            user_id)
        
        return result == "DELETE 1"

    async def get_profile(self, user_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM user_profiles WHERE user_id = $1",
            user_id)

    async def create_profile(self, user_id: UUID, **fields) -> asyncpg.Record:

        columns = ["user_id"] + list(fields.keys())
        placeholders = [f"${i}" for i in range(1, len(columns) + 1)]
        values = [user_id] + list(fields.values())

        query = f"""
            INSERT INTO user_profiles ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING *
        """

        return await self.db.fetchrow(query, *values)

    async def update_profile(self, user_id: UUID, **fields) -> asyncpg.Record | None:

        if not fields:
            return await self.get_profile(user_id)

        set_clauses = []
        values = []
        for i, (key, value) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(value)

        values.append(user_id)
        query = f"""
            UPDATE user_profiles
            SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ${len(values)}
            RETURNING *
        """

        return await self.db.fetchrow(query, *values)

    async def email_exists(self, email: str) -> bool:

        result = await self.db.fetchval(
            "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))",
            email)
        
        return result

    async def username_exists(self, username: str) -> bool:

        result = await self.db.fetchval(
            "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
            username)

        return result

    async def get_by_oauth(self, provider: str, oauth_id: str) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2",
            provider, oauth_id)

    async def create_oauth_user(
        self,
        email: str,
        oauth_provider: str,
        oauth_id: str,
        display_name: str | None = None,
        role: str = "student") -> asyncpg.Record:

        username_base = email.split("@")[0]
        username = username_base

        counter = 1
        while await self.username_exists(username):
            username = f"{username_base}{counter}"
            counter += 1

        return await self.db.fetchrow(
            """
            INSERT INTO users (
                username, email, password_hash, role, display_name,
                oauth_provider, oauth_id, email_verified
            )
            VALUES ($1, $2, '', $3, $4, $5, $6, TRUE)
            RETURNING *
            """,
            username, email, role, display_name, oauth_provider, oauth_id)

    async def link_oauth(
        self,
        user_id: UUID,
        oauth_provider: str,
        oauth_id: str) -> bool:

        result = await self.db.execute(
            """
            UPDATE users
            SET oauth_provider = $1, oauth_id = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            """,
            oauth_provider, oauth_id, user_id)

        return result == "UPDATE 1"
