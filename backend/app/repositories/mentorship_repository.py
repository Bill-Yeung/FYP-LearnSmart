from typing import Optional

class MentorshipRepository:

    def __init__(self, db):
        self.db = db

    async def list_available_mentors(
        self,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list:
        conditions = []
        args: list = []
        idx = 1

        if search:
            conditions.append(
                f"(u.display_name ILIKE ${idx} OR u.username ILIKE ${idx} OR mp.subjects::text ILIKE ${idx})"
            )
            args.append(f"%{search}%")
            idx += 1

        where_extra = (" AND " + " AND ".join(conditions)) if conditions else ""
        rows = await self.db.fetch(
            f"""
            SELECT mp.user_id AS id, u.username, u.display_name,
                   up.avatar_url, mp.subjects, mp.bio,
                   mp.is_available, mp.sessions_completed, mp.rating,
                   COALESCE(rs.total_score, 0) AS reputation_score
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            LEFT JOIN user_profiles up ON up.user_id = mp.user_id
            LEFT JOIN reputation_scores rs ON rs.user_id = mp.user_id AND rs.community_id IS NULL
            WHERE TRUE {where_extra}
            ORDER BY mp.rating DESC, mp.sessions_completed DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *args, page_size, (page - 1) * page_size,
        )
        return [dict(r) for r in rows]

    async def register_as_mentor(
        self,
        user_id: str,
        subjects: list,
        bio: Optional[str] = None,
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO mentor_profiles (user_id, subjects, bio, is_available)
            VALUES ($1, $2::text[], $3, TRUE)
            ON CONFLICT (user_id)
            DO UPDATE SET subjects = $2::text[], bio = COALESCE($3, mentor_profiles.bio),
                          is_available = TRUE, updated_at = CURRENT_TIMESTAMP
            RETURNING *
            """,
            user_id, subjects, bio,
        )
        return dict(row)

    async def set_availability(self, user_id: str, available: bool) -> None:
        await self.db.execute(
            "UPDATE mentor_profiles SET is_available = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
            user_id, available,
        )

    async def create_mentorship(
        self,
        mentor_id: str,
        mentee_id: str,
        subject: str,
        topic_focus: Optional[str] = None,
        community_id: Optional[str] = None,
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO mentorships
                (mentor_id, mentee_id, subject, topic_focus, community_id, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            ON CONFLICT (mentor_id, mentee_id) DO NOTHING
            RETURNING *
            """,
            mentor_id, mentee_id, subject, topic_focus, community_id,
        )
        if not row:
            raise ValueError("Mentorship already exists between these users")
        return dict(row)

    async def get_mentorship(self, mentorship_id: str) -> Optional[dict]:
        row = await self.db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1", mentorship_id,
        )
        return dict(row) if row else None

    async def list_mentorships(self, user_id: str) -> list:

        rows = await self.db.fetch(
            """
            SELECT m.*,
                   mentor.username AS mentor_username,
                   mentor.display_name AS mentor_display_name,
                   mup.avatar_url AS mentor_avatar_url,
                   mp.subjects AS mentor_subjects,
                   mentee.username AS mentee_username,
                   mentee.display_name AS mentee_display_name,
                   eup.avatar_url AS mentee_avatar_url,
                   COALESCE(rs.total_score, 0) AS mentor_reputation_score
            FROM mentorships m
            JOIN users mentor ON mentor.id = m.mentor_id
            JOIN users mentee ON mentee.id = m.mentee_id
            LEFT JOIN user_profiles mup ON mup.user_id = m.mentor_id
            LEFT JOIN user_profiles eup ON eup.user_id = m.mentee_id
            LEFT JOIN mentor_profiles mp ON mp.user_id = m.mentor_id
            LEFT JOIN reputation_scores rs ON rs.user_id = m.mentor_id AND rs.community_id IS NULL
            WHERE m.mentor_id = $1 OR m.mentee_id = $1
            ORDER BY
                CASE m.status
                    WHEN 'active' THEN 0
                    WHEN 'pending' THEN 1
                    ELSE 2
                END,
                m.created_at DESC
            """,
            user_id,
        )
        return [dict(r) for r in rows]

    async def update_mentorship_status(
        self, mentorship_id: str, status: str, user_id: str,
    ) -> Optional[dict]:
        row = await self.db.fetchrow(
            """
            UPDATE mentorships
            SET status = $2::varchar,
                started_at = CASE WHEN $2::varchar = 'active' THEN CURRENT_TIMESTAMP ELSE started_at END,
                ended_at = CASE WHEN $2::varchar IN ('completed', 'declined', 'cancelled') THEN CURRENT_TIMESTAMP ELSE ended_at END
            WHERE id = $1 AND (mentor_id = $3 OR mentee_id = $3)
            RETURNING *
            """,
            mentorship_id, status, user_id,
        )
        return dict(row) if row else None

    async def get_mentorship_stats(self, user_id: str) -> dict:
        row = await self.db.fetchrow(
            """
            SELECT
                COUNT(*) FILTER (WHERE status = 'active') AS active_count,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
                COALESCE(SUM(sessions_count), 0)::int AS total_sessions
            FROM mentorships
            WHERE mentor_id = $1 OR mentee_id = $1
            """,
            user_id,
        )
        return dict(row) if row else {"active_count": 0, "pending_count": 0, "total_sessions": 0}
