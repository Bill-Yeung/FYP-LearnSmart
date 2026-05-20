from typing import Optional

class FollowRepository:
    def __init__(self, db):
        self.db = db

    async def follow(self, follower_id: str, following_id: str) -> bool:

        existing = await self.db.fetchval(
            "SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2",
            follower_id, following_id,
        )
        if existing:
            return False
        await self.db.execute(
            "INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)",
            follower_id, following_id,
        )
        return True

    async def unfollow(self, follower_id: str, following_id: str) -> bool:

        result = await self.db.execute(
            "DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2",
            follower_id, following_id,
        )
        return result == "DELETE 1"

    async def is_following(self, follower_id: str, following_id: str) -> bool:
        val = await self.db.fetchval(
            "SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2",
            follower_id, following_id,
        )
        return val is not None

    async def get_following(self, user_id: str, page: int = 1, page_size: int = 20) -> list:

        rows = await self.db.fetch(
            """
            SELECT u.id, u.username, u.display_name, u.email,
                   up.avatar_url, uf.created_at AS followed_at
            FROM user_follows uf
            JOIN users u ON u.id = uf.following_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE uf.follower_id = $1
            ORDER BY uf.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id, page_size, (page - 1) * page_size,
        )
        return [dict(r) for r in rows]

    async def get_followers(self, user_id: str, page: int = 1, page_size: int = 20) -> list:

        rows = await self.db.fetch(
            """
            SELECT u.id, u.username, u.display_name, u.email,
                   up.avatar_url, uf.created_at AS followed_at
            FROM user_follows uf
            JOIN users u ON u.id = uf.follower_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE uf.following_id = $1
            ORDER BY uf.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id, page_size, (page - 1) * page_size,
        )
        return [dict(r) for r in rows]

    async def count_following(self, user_id: str) -> int:
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM user_follows WHERE follower_id = $1", user_id,
        )

    async def count_followers(self, user_id: str) -> int:
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM user_follows WHERE following_id = $1", user_id,
        )
