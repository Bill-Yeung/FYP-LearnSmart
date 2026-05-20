from typing import Optional
from datetime import datetime

class ChallengeRepository:

    def __init__(self, db):
        self.db = db

    async def create_challenge(
        self,
        community_id: str,
        created_by: str,
        title: str,
        challenge_type: str,
        starts_at: datetime,
        ends_at: datetime,
        status: str = "upcoming",
        description: Optional[str] = None,
        instructions: Optional[str] = None,
        max_participants: Optional[int] = None,
        rewards: Optional[str] = None,
        judging_criteria: Optional[str] = None,
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO challenges
                (community_id, created_by, title, description, instructions,
                 challenge_type, starts_at, ends_at, status,
                 max_participants, rewards, judging_criteria)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11::jsonb, $12::jsonb)
            RETURNING *
            """,
            community_id, created_by, title, description, instructions,
            challenge_type, starts_at, ends_at, status,
            max_participants, rewards, judging_criteria,
        )
        return dict(row)

    async def get_challenge(self, challenge_id: str) -> Optional[dict]:
        row = await self.db.fetchrow(
            "SELECT * FROM challenges WHERE id = $1", challenge_id,
        )
        return dict(row) if row else None

    async def list_challenges(
        self,
        community_id: Optional[str] = None,
        status: Optional[str] = None,
        user_id: Optional[str] = None,
        joined_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> list:
        conditions = []
        args: list = []
        idx = 1

        if community_id:
            conditions.append(f"c.community_id = ${idx}")
            args.append(community_id)
            idx += 1

        if status:
            conditions.append(f"c.status = ${idx}")
            args.append(status)
            idx += 1

        if joined_only and user_id:
            conditions.append(
                f"EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = c.id AND cp.user_id = ${idx})"
            )
            args.append(user_id)
            idx += 1

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        rows = await self.db.fetch(
            f"""
            SELECT c.*,
                   com.name AS community_name,
                   com.url_id AS community_url_id
            FROM challenges c
            LEFT JOIN communities com ON com.id = c.community_id
            {where}
            ORDER BY c.starts_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *args, page_size, (page - 1) * page_size,
        )
        return [dict(r) for r in rows]

    async def count_challenges(
        self,
        community_id: Optional[str] = None,
        status: Optional[str] = None,
        user_id: Optional[str] = None,
        joined_only: bool = False,
    ) -> int:
        conditions = []
        args: list = []
        idx = 1

        if community_id:
            conditions.append(f"c.community_id = ${idx}")
            args.append(community_id)
            idx += 1
        if status:
            conditions.append(f"c.status = ${idx}")
            args.append(status)
            idx += 1
        if joined_only and user_id:
            conditions.append(
                f"EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = c.id AND cp.user_id = ${idx})"
            )
            args.append(user_id)
            idx += 1

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        return await self.db.fetchval(
            f"SELECT COUNT(*) FROM challenges c {where}", *args,
        )

    async def join_challenge(self, challenge_id: str, user_id: str) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO challenge_participants (challenge_id, user_id, status)
            VALUES ($1, $2, 'registered')
            ON CONFLICT (challenge_id, user_id) DO NOTHING
            RETURNING *
            """,
            challenge_id, user_id,
        )
        if row:
            await self.db.execute(
                "UPDATE challenges SET participant_count = participant_count + 1 WHERE id = $1",
                challenge_id,
            )
            return dict(row)
        raise ValueError("Already joined this challenge")

    async def get_participant(self, challenge_id: str, user_id: str) -> Optional[dict]:
        row = await self.db.fetchrow(
            "SELECT * FROM challenge_participants WHERE challenge_id = $1 AND user_id = $2",
            challenge_id, user_id,
        )
        return dict(row) if row else None

    async def create_submission(
        self,
        challenge_id: str,
        user_id: str,
        title: str,
        description: Optional[str] = None,
    ) -> dict:
        row = await self.db.fetchrow(
            """
            INSERT INTO challenge_submissions
                (challenge_id, user_id, title, description, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *
            """,
            challenge_id, user_id, title, description,
        )
        await self.db.execute(
            """
            UPDATE challenge_participants
            SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
            WHERE challenge_id = $1 AND user_id = $2
            """,
            challenge_id, user_id,
        )
        await self.db.execute(
            "UPDATE challenges SET submission_count = submission_count + 1 WHERE id = $1",
            challenge_id,
        )
        return dict(row)

    async def get_user_submission(self, challenge_id: str, user_id: str) -> Optional[dict]:
        row = await self.db.fetchrow(
            "SELECT * FROM challenge_submissions WHERE challenge_id = $1 AND user_id = $2 ORDER BY submitted_at DESC LIMIT 1",
            challenge_id, user_id,
        )
        return dict(row) if row else None

    async def score_submission(
        self,
        submission_id: str,
        scores: dict,
        final_score: float,
        feedback: str,
        status: str = "approved",
    ) -> dict:
        row = await self.db.fetchrow(
            """
            UPDATE challenge_submissions
            SET scores = $2::jsonb,
                final_score = $3,
                judge_feedback = $4,
                status = $5,
                judged_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            """,
            submission_id, scores, final_score, feedback, status,
        )
        if not row:
            raise ValueError("Submission not found")
        return dict(row)

    async def list_submissions(self, challenge_id: str) -> list:
        rows = await self.db.fetch(
            """
            SELECT cs.*, u.username, u.display_name
            FROM challenge_submissions cs
            JOIN users u ON u.id = cs.user_id
            WHERE cs.challenge_id = $1
            ORDER BY cs.final_score DESC NULLS LAST, cs.submitted_at
            """,
            challenge_id,
        )
        return [dict(r) for r in rows]

    async def finalize_challenge(self, challenge_id: str) -> dict:

        submissions = await self.db.fetch(
            """
            SELECT id, user_id, final_score FROM challenge_submissions
            WHERE challenge_id = $1 AND final_score IS NOT NULL
            ORDER BY final_score DESC, submitted_at ASC
            """,
            challenge_id,
        )

        for i, sub in enumerate(submissions):
            rank = i + 1
            status = "winner" if rank == 1 else "approved"
            await self.db.execute(
                "UPDATE challenge_submissions SET rank = $1, status = $2, judged_at = NOW() WHERE id = $3",
                rank, status, sub["id"],
            )

        await self.db.execute(
            "UPDATE challenges SET status = 'completed' WHERE id = $1",
            challenge_id,
        )

        challenge = await self.get_challenge(challenge_id)
        return {
            "challenge": dict(challenge) if challenge else {},
            "rankings": [
                {"user_id": str(s["user_id"]), "rank": i + 1, "score": float(s["final_score"])}
                for i, s in enumerate(submissions)
            ],
        }
