from typing import Optional

class ReputationRepository:

    def __init__(self, db):
        self.db = db

    async def get_user_reputation(
        self, user_id: str, community_id: Optional[str] = None,
    ) -> Optional[dict]:
        if community_id:
            row = await self.db.fetchrow(
                "SELECT * FROM reputation_scores WHERE user_id = $1 AND community_id = $2",
                user_id, community_id,
            )
        else:
            
            row = await self.db.fetchrow(
                """
                SELECT user_id,
                       SUM(teaching_score)::int AS teaching_score,
                       SUM(content_score)::int AS content_score,
                       SUM(feedback_score)::int AS feedback_score,
                       SUM(engagement_score)::int AS engagement_score,
                       SUM(reliability_score)::int AS reliability_score,
                       (SUM(teaching_score) + SUM(content_score) + SUM(feedback_score)
                        + SUM(engagement_score) + SUM(reliability_score))::int AS total_score
                FROM reputation_scores
                WHERE user_id = $1
                GROUP BY user_id
                """,
                user_id,
            )
        return dict(row) if row else None

    async def get_reputation_level(self, total_score: int) -> Optional[dict]:
        row = await self.db.fetchrow(
            """
            SELECT * FROM reputation_levels
            WHERE is_global = TRUE AND min_score <= $1
                  AND (max_score IS NULL OR max_score >= $1)
            ORDER BY min_score DESC
            LIMIT 1
            """,
            total_score,
        )
        return dict(row) if row else None

    async def get_next_level(self, total_score: int) -> Optional[dict]:
        row = await self.db.fetchrow(
            """
            SELECT * FROM reputation_levels
            WHERE is_global = TRUE AND min_score > $1
            ORDER BY min_score ASC
            LIMIT 1
            """,
            total_score,
        )
        return dict(row) if row else None

    async def get_all_levels(self) -> list:
        rows = await self.db.fetch(
            "SELECT * FROM reputation_levels WHERE is_global = TRUE ORDER BY min_score ASC",
        )
        return [dict(r) for r in rows]

    async def get_rank_percentile(self, user_id: str) -> int:

        total_score = await self.db.fetchval(
            """
            SELECT COALESCE(
                (SELECT SUM(teaching_score + content_score + feedback_score + engagement_score + reliability_score)
                 FROM reputation_scores WHERE user_id = $1), 0)
            """,
            user_id,
        )
        total_users = await self.db.fetchval(
            "SELECT COUNT(DISTINCT user_id) FROM reputation_scores",
        )
        if not total_users or total_users == 0:
            return 100
        users_below = await self.db.fetchval(
            """
            SELECT COUNT(DISTINCT user_id) FROM reputation_scores
            GROUP BY user_id
            HAVING SUM(teaching_score + content_score + feedback_score + engagement_score + reliability_score) < $1
            """,
            total_score,
        )
        users_below = users_below or 0
        return max(1, 100 - int((users_below / total_users) * 100))

    async def list_events(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list:
        rows = await self.db.fetch(
            """
            SELECT * FROM reputation_events
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id, limit, offset,
        )
        return [dict(r) for r in rows]

    async def get_breakdown(self, user_id: str) -> list:

        rep = await self.get_user_reputation(user_id)
        if not rep:
            return [
                {"category": "teaching", "score": 0, "label": "Teaching", "icon": "mortar-board"},
                {"category": "content", "score": 0, "label": "Content", "icon": "book"},
                {"category": "feedback", "score": 0, "label": "Feedback", "icon": "message-circle"},
                {"category": "engagement", "score": 0, "label": "Engagement", "icon": "users"},
                {"category": "reliability", "score": 0, "label": "Reliability", "icon": "shield"},
            ]
        return [
            {"category": "teaching", "score": rep.get("teaching_score", 0), "label": "Teaching", "icon": "mortar-board"},
            {"category": "content", "score": rep.get("content_score", 0), "label": "Content", "icon": "book"},
            {"category": "feedback", "score": rep.get("feedback_score", 0), "label": "Feedback", "icon": "message-circle"},
            {"category": "engagement", "score": rep.get("engagement_score", 0), "label": "Engagement", "icon": "users"},
            {"category": "reliability", "score": rep.get("reliability_score", 0), "label": "Reliability", "icon": "shield"},
        ]
