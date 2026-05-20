from typing import Optional

class ContentRequestRepository:

    def __init__(self, db):
        self.db = db

    async def create_request(
        self,
        created_by: str,
        title: str,
        request_type: str,
        description: Optional[str] = None,
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO content_requests (created_by, title, request_type, description, status)
            VALUES ($1, $2, $3, $4, 'open')
            RETURNING *
            """,
            created_by, title, request_type, description,
        )
        return dict(row)

    async def get_request(self, request_id: str) -> Optional[dict]:
        row = await self.db.fetchrow(
            """
            SELECT cr.*,
                   u.username AS creator_username,
                   u.display_name AS creator_display_name,
                   up.avatar_url AS creator_avatar_url
            FROM content_requests cr
            JOIN users u ON u.id = cr.created_by
            LEFT JOIN user_profiles up ON up.user_id = cr.created_by
            WHERE cr.id = $1
            """,
            request_id,
        )
        return dict(row) if row else None

    async def list_requests(
        self,
        tab: str = "all",
        user_id: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list:
        conditions = []
        args: list = []
        idx = 1

        if tab == "my" and user_id:
            conditions.append(f"cr.created_by = ${idx}")
            args.append(user_id)
            idx += 1

        if category and category != "all":
            conditions.append(f"cr.request_type = ${idx}")
            args.append(category)
            idx += 1

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        rows = await self.db.fetch(
            f"""
            SELECT cr.*,
                   u.username AS creator_username,
                   u.display_name AS creator_display_name,
                   up.avatar_url AS creator_avatar_url
            FROM content_requests cr
            JOIN users u ON u.id = cr.created_by
            LEFT JOIN user_profiles up ON up.user_id = cr.created_by
            {where}
            ORDER BY cr.total_votes DESC, cr.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *args, page_size, (page - 1) * page_size,
        )
        return [dict(r) for r in rows]

    async def count_requests(
        self,
        tab: str = "all",
        user_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> int:
        conditions = []
        args: list = []
        idx = 1

        if tab == "my" and user_id:
            conditions.append(f"cr.created_by = ${idx}")
            args.append(user_id)
            idx += 1

        if category and category != "all":
            conditions.append(f"cr.request_type = ${idx}")
            args.append(category)
            idx += 1

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        return await self.db.fetchval(
            f"SELECT COUNT(*) FROM content_requests cr {where}", *args,
        )

    async def toggle_vote(self, request_id: str, user_id: str, coins: int = 0) -> dict:
        existing = await self.db.fetchrow(
            "SELECT * FROM content_request_votes WHERE request_id = $1 AND user_id = $2",
            request_id, user_id,
        )
        if existing:
            await self.db.execute(
                "DELETE FROM content_request_votes WHERE request_id = $1 AND user_id = $2",
                request_id, user_id,
            )
            await self.db.execute(
                "UPDATE content_requests SET total_votes = total_votes - 1 WHERE id = $1",
                request_id,
            )
            return {"voted": False}
        else:
            await self.db.execute(
                "INSERT INTO content_request_votes (request_id, user_id, coins_contributed) VALUES ($1, $2, $3)",
                request_id, user_id, coins,
            )
            await self.db.execute(
                "UPDATE content_requests SET total_votes = total_votes + 1 WHERE id = $1",
                request_id,
            )
            return {"voted": True}

    async def has_voted(self, request_id: str, user_id: str) -> bool:
        val = await self.db.fetchval(
            "SELECT 1 FROM content_request_votes WHERE request_id = $1 AND user_id = $2",
            request_id, user_id,
        )
        return val is not None

    async def add_contribution(
        self, request_id: str, user_id: str, content: str,
        resource_id: Optional[str] = None, resource_type: Optional[str] = None,
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO content_request_contributions
                (request_id, user_id, content, resource_id, resource_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            request_id, user_id, content, resource_id, resource_type,
        )
        await self.db.execute(
            """
            UPDATE content_requests
            SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'open'
            """,
            request_id,
        )
        return dict(row)

    async def list_contributions(self, request_id: str) -> list:
        rows = await self.db.fetch(
            """
            SELECT c.*,
                   u.username,
                   u.display_name,
                   up.avatar_url
            FROM content_request_contributions c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN user_profiles up ON up.user_id = c.user_id
            WHERE c.request_id = $1
            ORDER BY c.created_at ASC
            """,
            request_id,
        )
        return [dict(r) for r in rows]

    async def count_contributions(self, request_id: str) -> int:
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM content_request_contributions WHERE request_id = $1",
            request_id,
        )

    async def mark_complete(self, request_id: str, user_id: str) -> Optional[dict]:
        row = await self.db.fetchrow(
            """
            UPDATE content_requests
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND created_by = $2 AND status IN ('open', 'in_progress')
            RETURNING *
            """,
            request_id, user_id,
        )
        return dict(row) if row else None
