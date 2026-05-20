from typing import Dict, Any, List, Optional

class SharedContentRepository:

    def __init__(self, db):
        self.db = db

    async def create_shared_content(
        self,
        user_id: str,
        entity_type: str,
        entity_id: str,
        title: str,
        description: Optional[str] = None,
        visibility: str = "public",
        community_ids: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        row = await self.db.fetchrow(
            """
            INSERT INTO shared_content
                (user_id, entity_type, entity_id, title, description,
                 visibility, community_ids, tags, published_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *
            """,
            user_id, entity_type, entity_id, title, description,
            visibility, community_ids or [], tags or [],
        )
        return dict(row)

    async def get_shared_content(self, content_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            SELECT sc.*, u.username, u.display_name
            FROM shared_content sc
            JOIN users u ON sc.user_id = u.id
            WHERE sc.id = $1
            """,
            content_id,
        )
        return dict(row) if row else None

    async def list_shared_content(
        self,
        community_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conditions = ["sc.status = 'published'"]
        params: list = []
        idx = 1

        if community_id:
            conditions.append(f"${ idx}::uuid = ANY(sc.community_ids)")
            params.append(community_id)
            idx += 1

        if entity_type:
            conditions.append(f"sc.entity_type = ${idx}")
            params.append(entity_type)
            idx += 1

        where = " AND ".join(conditions)
        params.extend([limit, offset])

        rows = await self.db.fetch(
            f"""
            SELECT sc.*, u.username, u.display_name
            FROM shared_content sc
            JOIN users u ON sc.user_id = u.id
            WHERE {where}
            ORDER BY sc.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *params,
        )
        return [dict(r) for r in rows]

    async def count_shared_content(
        self, community_id: Optional[str] = None, entity_type: Optional[str] = None
    ) -> int:
        conditions = ["status = 'published'"]
        params: list = []
        idx = 1

        if community_id:
            conditions.append(f"${idx}::uuid = ANY(community_ids)")
            params.append(community_id)
            idx += 1

        if entity_type:
            conditions.append(f"entity_type = ${idx}")
            params.append(entity_type)
            idx += 1

        where = " AND ".join(conditions)
        return await self.db.fetchval(
            f"SELECT COUNT(*) FROM shared_content WHERE {where}", *params
        )

    async def rate_content(
        self, content_id: str, user_id: str, rating: int, review_text: Optional[str] = None
    ) -> Dict[str, Any]:
        row = await self.db.fetchrow(
            """
            INSERT INTO content_ratings (shared_content_id, user_id, rating, review_text)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (shared_content_id, user_id) DO UPDATE
            SET rating = $3, review_text = $4, updated_at = NOW()
            RETURNING *
            """,
            content_id, user_id, rating, review_text,
        )
        await self.db.execute(
            """
            UPDATE shared_content
            SET average_rating = (
                SELECT AVG(rating) FROM content_ratings WHERE shared_content_id = $1
            ),
            rating_count = (
                SELECT COUNT(*) FROM content_ratings WHERE shared_content_id = $1
            )
            WHERE id = $1
            """,
            content_id,
        )
        return dict(row)

    async def record_download(
        self, content_id: str, user_id: str, action_type: str = "view"
    ) -> None:
        await self.db.execute(
            """
            INSERT INTO content_downloads (shared_content_id, user_id, action_type)
            VALUES ($1, $2, $3)
            ON CONFLICT (shared_content_id, user_id, action_type) DO NOTHING
            """,
            content_id, user_id, action_type,
        )
        counter = {
            "view": "view_count",
            "download": "download_count",
            "save": "download_count",
        }.get(action_type)
        if counter:
            await self.db.execute(
                f"UPDATE shared_content SET {counter} = {counter} + 1 WHERE id = $1",
                content_id,
            )

    async def toggle_like(self, content_id: str, user_id: str) -> bool:

        existing = await self.db.fetchrow(
            "SELECT id FROM likes WHERE user_id = $1 AND entity_type = 'shared_content' AND entity_id = $2",
            user_id, content_id,
        )
        if existing:
            await self.db.execute(
                "DELETE FROM likes WHERE user_id = $1 AND entity_type = 'shared_content' AND entity_id = $2",
                user_id, content_id,
            )
            await self.db.execute(
                "UPDATE shared_content SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1",
                content_id,
            )
            return False
        else:
            await self.db.execute(
                "INSERT INTO likes (user_id, entity_type, entity_id) VALUES ($1, 'shared_content', $2)",
                user_id, content_id,
            )
            await self.db.execute(
                "UPDATE shared_content SET like_count = like_count + 1 WHERE id = $1",
                content_id,
            )
            return True

    async def has_liked(self, user_id: str, content_id: str) -> bool:
        row = await self.db.fetchrow(
            "SELECT 1 FROM likes WHERE user_id = $1 AND entity_type = 'shared_content' AND entity_id = $2",
            user_id, content_id,
        )
        return row is not None

    async def has_saved(self, user_id: str, content_id: str) -> bool:
        row = await self.db.fetchrow(
            "SELECT 1 FROM content_downloads WHERE user_id = $1 AND shared_content_id = $2 AND action_type = 'save'",
            user_id, content_id,
        )
        return row is not None
