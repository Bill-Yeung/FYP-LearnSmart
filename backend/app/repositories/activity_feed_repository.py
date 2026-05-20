from typing import Optional
import json


class ActivityFeedRepository:

    def __init__(self, db):
        self.db = db

    async def create_activity(
        self,
        actor_id: str,
        activity_type: str,
        entity_type: str,
        entity_id: str,
        entity_preview: Optional[dict] = None,
        community_id: Optional[str] = None,
        visibility: str = "public",
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO activity_feed
                (actor_id, activity_type, entity_type, entity_id,
                 entity_preview, community_id, visibility)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
            RETURNING *
            """,
            actor_id, activity_type, entity_type, entity_id,
            json.dumps(entity_preview) if entity_preview else None,
            community_id, visibility,
        )
        return dict(row)

    async def list_activities(
        self,
        feed_type: str = "all",
        user_id: Optional[str] = None,
        community_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list:
        conditions = []
        args: list = []
        idx = 1

        if feed_type == "community" and community_id:
            conditions.append(f"af.community_id = ${idx}")
            args.append(community_id)
            idx += 1
        elif feed_type == "following" and user_id:
            conditions.append(
                f"""af.actor_id IN (
                    SELECT following_id FROM user_follows
                    WHERE follower_id = ${idx}
                )"""
            )
            args.append(user_id)
            idx += 1
        elif feed_type == "classmates" and user_id:
            conditions.append(
                f"""af.actor_id IN (
                    SELECT DISTINCT ce2.student_id
                    FROM class_enrollments ce1
                    JOIN class_enrollments ce2
                        ON ce2.class_id = ce1.class_id
                        AND ce2.student_id != ce1.student_id
                        AND ce2.status = 'active'
                    WHERE ce1.student_id = ${idx}
                      AND ce1.status = 'active'
                )"""
            )
            args.append(user_id)
            idx += 1

        conditions.append("af.visibility IN ('public', 'community')")

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        rows = await self.db.fetch(
            f"""
            SELECT af.*,
                   u.username AS actor_username,
                   u.display_name AS actor_display_name,
                   up.avatar_url AS actor_avatar_url
            FROM activity_feed af
            JOIN users u ON u.id = af.actor_id
            LEFT JOIN user_profiles up ON up.user_id = af.actor_id
            {where}
            ORDER BY af.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *args, page_size, (page - 1) * page_size,
        )
        return [dict(r) for r in rows]

    async def count_activities(
        self,
        feed_type: str = "all",
        user_id: Optional[str] = None,
        community_id: Optional[str] = None,
    ) -> int:
        conditions = []
        args: list = []
        idx = 1

        if feed_type == "community" and community_id:
            conditions.append(f"af.community_id = ${idx}")
            args.append(community_id)
            idx += 1
        elif feed_type == "following" and user_id:
            conditions.append(
                f"""af.actor_id IN (
                    SELECT following_id FROM user_follows
                    WHERE follower_id = ${idx}
                )"""
            )
            args.append(user_id)
            idx += 1
        elif feed_type == "classmates" and user_id:
            conditions.append(
                f"""af.actor_id IN (
                    SELECT DISTINCT ce2.student_id
                    FROM class_enrollments ce1
                    JOIN class_enrollments ce2
                        ON ce2.class_id = ce1.class_id
                        AND ce2.student_id != ce1.student_id
                        AND ce2.status = 'active'
                    WHERE ce1.student_id = ${idx}
                      AND ce1.status = 'active'
                )"""
            )
            args.append(user_id)
            idx += 1

        conditions.append("af.visibility IN ('public', 'community')")
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        return await self.db.fetchval(
            f"SELECT COUNT(*) FROM activity_feed af {where}", *args,
        )

    async def toggle_like(self, activity_id: str, user_id: str) -> dict:
        existing = await self.db.fetchval(
            "SELECT 1 FROM likes WHERE entity_type = 'activity' AND entity_id = $1 AND user_id = $2",
            activity_id, user_id,
        )
        if existing:
            await self.db.execute(
                "DELETE FROM likes WHERE entity_type = 'activity' AND entity_id = $1 AND user_id = $2",
                activity_id, user_id,
            )
            await self.db.execute(
                "UPDATE activity_feed SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1",
                activity_id,
            )
            return {"liked": False}
        else:
            await self.db.execute(
                "INSERT INTO likes (entity_type, entity_id, user_id) VALUES ('activity', $1, $2) ON CONFLICT DO NOTHING",
                activity_id, user_id,
            )
            await self.db.execute(
                "UPDATE activity_feed SET like_count = like_count + 1 WHERE id = $1",
                activity_id,
            )
            return {"liked": True}

    async def has_liked(self, activity_id: str, user_id: str) -> bool:
        val = await self.db.fetchval(
            "SELECT 1 FROM likes WHERE entity_type = 'activity' AND entity_id = $1 AND user_id = $2",
            activity_id, user_id,
        )
        return val is not None

    async def list_comments(self, activity_id: str, limit: int = 50) -> list:
        rows = await self.db.fetch(
            """
            SELECT ac.*, u.username, u.display_name, up.avatar_url
            FROM activity_comments ac
            JOIN users u ON u.id = ac.user_id
            LEFT JOIN user_profiles up ON up.user_id = ac.user_id
            WHERE ac.activity_id = $1 AND ac.is_deleted = FALSE
            ORDER BY ac.created_at ASC
            LIMIT $2
            """,
            activity_id, limit,
        )
        return [dict(r) for r in rows]

    async def create_comment(
        self,
        activity_id: str,
        user_id: str,
        content: str,
        parent_comment_id: Optional[str] = None,
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO activity_comments (activity_id, user_id, content, parent_comment_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            activity_id, user_id, content, parent_comment_id,
        )
        await self.db.execute(
            "UPDATE activity_feed SET comment_count = comment_count + 1 WHERE id = $1",
            activity_id,
        )
        return dict(row)
