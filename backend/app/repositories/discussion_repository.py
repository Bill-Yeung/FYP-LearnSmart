from typing import Dict, Any, List, Optional

class DiscussionRepository:

    def __init__(self, db):
        self.db = db

    async def create_thread(
        self,
        community_id: str,
        user_id: str,
        title: str,
        content: str,
        thread_type: str = "discussion",
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        row = await self.db.fetchrow(
            """
            INSERT INTO discussion_threads
                (community_id, user_id, title, content, thread_type, tags)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """,
            community_id, user_id, title, content, thread_type, tags or [],
        )
        return dict(row)

    async def get_thread(self, thread_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            SELECT dt.*, u.username, u.display_name, u.email
            FROM discussion_threads dt
            JOIN users u ON dt.user_id = u.id
            WHERE dt.id = $1
            """,
            thread_id,
        )
        return dict(row) if row else None

    async def list_threads(
        self,
        community_id: str,
        limit: int = 20,
        offset: int = 0,
        thread_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        conditions = ["dt.community_id = $1", "dt.status != 'removed'"]
        params: list = [community_id]
        idx = 2

        if thread_type:
            conditions.append(f"dt.thread_type = ${idx}")
            params.append(thread_type)
            idx += 1

        where = " AND ".join(conditions)
        params.extend([limit, offset])

        rows = await self.db.fetch(
            f"""
            SELECT dt.*, u.username, u.display_name
            FROM discussion_threads dt
            JOIN users u ON dt.user_id = u.id
            WHERE {where}
            ORDER BY dt.is_pinned DESC, dt.last_activity_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *params,
        )
        return [dict(r) for r in rows]

    async def count_threads(
        self, community_id: str, thread_type: Optional[str] = None
    ) -> int:
        if thread_type:
            return await self.db.fetchval(
                "SELECT COUNT(*) FROM discussion_threads WHERE community_id = $1 AND thread_type = $2 AND status != 'removed'",
                community_id, thread_type,
            )
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM discussion_threads WHERE community_id = $1 AND status != 'removed'",
            community_id,
        )

    async def increment_view_count(self, thread_id: str) -> None:
        await self.db.execute(
            "UPDATE discussion_threads SET view_count = view_count + 1 WHERE id = $1",
            thread_id,
        )

    async def pin_thread(self, thread_id: str, pinned: bool) -> None:
        status = "pinned" if pinned else "open"
        await self.db.execute(
            "UPDATE discussion_threads SET is_pinned = $2, status = $3 WHERE id = $1",
            thread_id, pinned, status,
        )

    async def create_reply(
        self,
        thread_id: str,
        user_id: str,
        content: str,
        parent_reply_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = await self.db.fetchrow(
            """
            INSERT INTO discussion_replies (thread_id, user_id, content, parent_reply_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            thread_id, user_id, content, parent_reply_id,
        )
        await self.db.execute(
            "UPDATE discussion_threads SET reply_count = reply_count + 1, last_activity_at = NOW() WHERE id = $1",
            thread_id,
        )
        return dict(row)

    async def list_replies(
        self,
        thread_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT dr.*, u.username, u.display_name
            FROM discussion_replies dr
            JOIN users u ON dr.user_id = u.id
            WHERE dr.thread_id = $1 AND dr.is_hidden = FALSE
            ORDER BY dr.created_at ASC
            LIMIT $2 OFFSET $3
            """,
            thread_id, limit, offset,
        )
        return [dict(r) for r in rows]

    async def count_replies(self, thread_id: str) -> int:
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM discussion_replies WHERE thread_id = $1 AND is_hidden = FALSE",
            thread_id,
        )

    async def toggle_thread_like(self, thread_id: str, user_id: str) -> bool:

        existing = await self.db.fetchval(
            "SELECT id FROM likes WHERE user_id = $1 AND entity_type = 'discussion_thread' AND entity_id = $2",
            user_id, thread_id,
        )
        if existing:
            await self.db.execute("DELETE FROM likes WHERE id = $1", existing)
            await self.db.execute(
                "UPDATE discussion_threads SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1",
                thread_id,
            )
            return False
        else:
            await self.db.execute(
                "INSERT INTO likes (user_id, entity_type, entity_id) VALUES ($1, 'discussion_thread', $2)",
                user_id, thread_id,
            )
            await self.db.execute(
                "UPDATE discussion_threads SET like_count = like_count + 1 WHERE id = $1",
                thread_id,
            )
            return True

    async def toggle_reply_like(self, reply_id: str, user_id: str) -> bool:

        existing = await self.db.fetchval(
            "SELECT id FROM likes WHERE user_id = $1 AND entity_type = 'discussion_reply' AND entity_id = $2",
            user_id, reply_id,
        )
        if existing:
            await self.db.execute("DELETE FROM likes WHERE id = $1", existing)
            await self.db.execute(
                "UPDATE discussion_replies SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1",
                reply_id,
            )
            return False
        else:
            await self.db.execute(
                "INSERT INTO likes (user_id, entity_type, entity_id) VALUES ($1, 'discussion_reply', $2)",
                user_id, reply_id,
            )
            await self.db.execute(
                "UPDATE discussion_replies SET like_count = like_count + 1 WHERE id = $1",
                reply_id,
            )
            return True

    async def has_liked(self, user_id: str, entity_type: str, entity_id: str) -> bool:
        return bool(await self.db.fetchval(
            "SELECT 1 FROM likes WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3",
            user_id, entity_type, entity_id,
        ))
