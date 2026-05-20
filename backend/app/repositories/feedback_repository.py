from typing import Dict, Any, List, Optional

class FeedbackRepository:

    def __init__(self, db):
        self.db = db

    async def create_feedback_request(
        self,
        user_id: str,
        entity_type: str,
        entity_id: str,
        title: str,
        description: Optional[str] = None,
        specific_questions: Optional[List[str]] = None,
        community_id: Optional[str] = None,
        points_offered: int = 0,
    ) -> Dict[str, Any]:
        row = await self.db.fetchrow(
            """
            INSERT INTO feedback_requests
                (user_id, entity_type, entity_id, title, description,
                 specific_questions, community_id, points_offered)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            user_id, entity_type, entity_id, title, description,
            specific_questions or [], community_id, points_offered,
        )
        return dict(row)

    async def get_feedback_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            SELECT fr.*, u.username, u.display_name
            FROM feedback_requests fr
            JOIN users u ON fr.user_id = u.id
            WHERE fr.id = $1
            """,
            request_id,
        )
        return dict(row) if row else None

    async def list_feedback_requests(
        self,
        community_id: Optional[str] = None,
        status: str = "open",
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conditions = ["fr.status = $1"]
        params: list = [status]
        idx = 2

        if community_id:
            conditions.append(f"fr.community_id = ${idx}")
            params.append(community_id)
            idx += 1

        where = " AND ".join(conditions)
        params.extend([limit, offset])

        rows = await self.db.fetch(
            f"""
            SELECT fr.*, u.username, u.display_name
            FROM feedback_requests fr
            JOIN users u ON fr.user_id = u.id
            WHERE {where}
            ORDER BY fr.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *params,
        )
        return [dict(r) for r in rows]

    async def count_feedback_requests(
        self, community_id: Optional[str] = None, status: str = "open"
    ) -> int:
        if community_id:
            return await self.db.fetchval(
                "SELECT COUNT(*) FROM feedback_requests WHERE community_id = $1 AND status = $2",
                community_id, status,
            )
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM feedback_requests WHERE status = $1", status
        )

    async def submit_feedback(
        self,
        request_id: str,
        reviewer_id: str,
        recipient_id: str,
        content: str,
        rating: Optional[int] = None,
    ) -> Dict[str, Any]:
        row = await self.db.fetchrow(
            """
            INSERT INTO peer_feedback (feedback_request_id, reviewer_id, recipient_id, content, rating)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            request_id, reviewer_id, recipient_id, content, rating,
        )

        await self.db.execute(
            """
            UPDATE feedback_requests
            SET current_responses = current_responses + 1,
                status = CASE
                    WHEN current_responses + 1 >= max_responses THEN 'completed'
                    ELSE 'in_progress'
                END
            WHERE id = $1
            """,
            request_id,
        )
        return dict(row)

