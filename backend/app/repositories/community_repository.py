import re
import uuid
from typing import Dict, Any, List, Optional


class CommunityRepository:

    def __init__(self, db):
        self.db = db


    @staticmethod
    def _slugify(name: str) -> str:
        slug = name.lower().strip()
        slug = re.sub(r"[^a-z0-9\s-]", "", slug)
        slug = re.sub(r"[\s]+", "-", slug)
        slug = re.sub(r"-+", "-", slug).strip("-")
        return slug[:80] or "community"

    async def _generate_url_id(self, name: str) -> str:
        base = self._slugify(name)
        url_id = base
        suffix = 1
        while True:
            exists = await self.db.fetchval(
                "SELECT 1 FROM communities WHERE url_id = $1", url_id
            )
            if not exists:
                return url_id
            url_id = f"{base}-{suffix}"
            suffix += 1


    async def create_community(
        self,
        name: str,
        description: Optional[str],
        community_type: str,
        created_by: str,
        max_members: Optional[int] = None,
        color_theme: Optional[str] = None,
    ) -> Dict[str, Any]:
        url_id = await self._generate_url_id(name)
        row = await self.db.fetchrow(
            """
            INSERT INTO communities (name, url_id, description, community_type,
                                     max_members, color_theme, created_by, member_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
            RETURNING *
            """,
            name, url_id, description, community_type,
            max_members, color_theme, created_by,
        )

        await self.db.execute(
            """
            INSERT INTO community_members (community_id, user_id, role, status)
            VALUES ($1, $2, 'owner', 'active')
            """,
            row["id"], created_by,
        )
        return dict(row)

    async def get_community_by_url_id(self, url_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            SELECT c.*, u.username as creator_username, u.display_name as creator_display_name
            FROM communities c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.url_id = $1
            """,
            url_id,
        )
        return dict(row) if row else None

    async def list_communities(
        self,
        user_id: Optional[str] = None,
        filter_mode: str = "discover",
        search: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        conditions = []
        params: list = []
        idx = 1

        if filter_mode == "my" and user_id:
            conditions.append(
                f"c.id IN (SELECT community_id FROM community_members WHERE user_id = ${idx} AND status = 'active' AND role != 'pending')"
            )
            params.append(user_id)
            idx += 1
        else:
            conditions.append("c.community_type IN ('public', 'course_based', 'private', 'invite_only')")
            if user_id:
                conditions.append(
                    f"c.id NOT IN (SELECT community_id FROM community_members WHERE user_id = ${idx} AND status = 'active' AND role != 'pending')"
                )
                params.append(user_id)
                idx += 1

        if search:
            conditions.append(f"(c.name ILIKE ${idx} OR c.description ILIKE ${idx})")
            params.append(f"%{search}%")
            idx += 1

        where = " AND ".join(conditions) if conditions else "TRUE"

        query = f"""
            SELECT c.*, u.username as creator_username, u.display_name as creator_display_name
            FROM communities c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE {where}
            ORDER BY c.member_count DESC, c.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        params.extend([limit, offset])

        rows = await self.db.fetch(query, *params)
        return [dict(r) for r in rows]

    async def count_communities(
        self,
        user_id: Optional[str] = None,
        filter_mode: str = "discover",
        search: Optional[str] = None,
    ) -> int:
        conditions = []
        params: list = []
        idx = 1

        if filter_mode == "my" and user_id:
            conditions.append(
                f"c.id IN (SELECT community_id FROM community_members WHERE user_id = ${idx} AND status = 'active' AND role != 'pending')"
            )
            params.append(user_id)
            idx += 1
        else:
            conditions.append("c.community_type IN ('public', 'course_based', 'private', 'invite_only')")
            if user_id:
                conditions.append(
                    f"c.id NOT IN (SELECT community_id FROM community_members WHERE user_id = ${idx} AND status = 'active' AND role != 'pending')"
                )
                params.append(user_id)
                idx += 1

        if search:
            conditions.append(f"(c.name ILIKE ${idx} OR c.description ILIKE ${idx})")
            params.append(f"%{search}%")
            idx += 1

        where = " AND ".join(conditions) if conditions else "TRUE"
        return await self.db.fetchval(
            f"SELECT COUNT(*) FROM communities c WHERE {where}", *params
        )

    async def update_community(
        self, url_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        allowed = {"name", "description", "community_type", "max_members", "color_theme"}
        fields = {k: v for k, v in updates.items() if k in allowed and v is not None}
        if not fields:
            return await self.get_community_by_url_id(url_id)

        set_parts = []
        params: list = []
        idx = 1
        for k, v in fields.items():
            set_parts.append(f"{k} = ${idx}")
            params.append(v)
            idx += 1

        set_parts.append("updated_at = NOW()")
        params.append(url_id)

        row = await self.db.fetchrow(
            f"UPDATE communities SET {', '.join(set_parts)} WHERE url_id = ${idx} RETURNING *",
            *params,
        )
        return dict(row) if row else None


    async def get_member(self, community_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            "SELECT * FROM community_members WHERE community_id = $1 AND user_id = $2",
            community_id, user_id,
        )
        return dict(row) if row else None

    async def get_member_role(self, community_id: str, user_id: str) -> Optional[str]:
        return await self.db.fetchval(
            "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2 AND status = 'active'",
            community_id, user_id,
        )

    async def join_community(self, community_id: str, user_id: str) -> Dict[str, Any]:
        row = await self.db.fetchrow(
            """
            INSERT INTO community_members (community_id, user_id, role, status)
            VALUES ($1, $2, 'member', 'active')
            ON CONFLICT (community_id, user_id) DO UPDATE SET status = 'active', joined_at = NOW()
            RETURNING *
            """,
            community_id, user_id,
        )
        await self.db.execute(
            "UPDATE communities SET member_count = member_count + 1 WHERE id = $1",
            community_id,
        )
        return dict(row)

    async def leave_community(self, community_id: str, user_id: str) -> None:
        await self.db.execute(
            "UPDATE community_members SET status = 'left' WHERE community_id = $1 AND user_id = $2",
            community_id, user_id,
        )
        await self.db.execute(
            "UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1",
            community_id,
        )

    async def get_members(
        self, community_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT cm.*, u.username, u.email, u.display_name
            FROM community_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.community_id = $1 AND cm.status = 'active' AND cm.role != 'pending'
            ORDER BY
                CASE cm.role
                    WHEN 'owner' THEN 0
                    WHEN 'admin' THEN 1
                    WHEN 'moderator' THEN 2
                    ELSE 3
                END,
                cm.joined_at
            LIMIT $2 OFFSET $3
            """,
            community_id, limit, offset,
        )
        return [dict(r) for r in rows]

    async def count_members(self, community_id: str) -> int:
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM community_members WHERE community_id = $1 AND status = 'active' AND role != 'pending'",
            community_id,
        )


    async def update_member_role(
        self, community_id: str, user_id: str, role: str
    ) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            UPDATE community_members SET role = $1
            WHERE community_id = $2 AND user_id = $3 AND status = 'active'
            RETURNING *
            """,
            role, community_id, user_id,
        )
        return dict(row) if row else None

    async def transfer_ownership(
        self, community_id: str, old_owner_id: str, new_owner_id: str
    ) -> None:
        await self.db.execute(
            "UPDATE community_members SET role = 'admin' WHERE community_id = $1 AND user_id = $2",
            community_id, old_owner_id,
        )
        await self.db.execute(
            "UPDATE community_members SET role = 'owner' WHERE community_id = $1 AND user_id = $2",
            community_id, new_owner_id,
        )
        await self.db.execute(
            "UPDATE communities SET created_by = $1 WHERE id = $2",
            new_owner_id, community_id,
        )

    async def remove_member(self, community_id: str, user_id: str) -> None:
        await self.db.execute(
            "UPDATE community_members SET status = 'removed' WHERE community_id = $1 AND user_id = $2",
            community_id, user_id,
        )
        await self.db.execute(
            "UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1",
            community_id,
        )


    async def add_pending_member(self, community_id: str, user_id: str) -> Dict[str, Any]:

        row = await self.db.fetchrow(
            """
            INSERT INTO community_members (community_id, user_id, role, status)
            VALUES ($1, $2, 'pending', 'active')
            ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'pending', status = 'active', joined_at = NOW()
            RETURNING *
            """,
            community_id, user_id,
        )
        return dict(row)

    async def approve_member(self, community_id: str, user_id: str) -> Optional[Dict[str, Any]]:

        row = await self.db.fetchrow(
            """
            UPDATE community_members SET role = 'member', joined_at = NOW()
            WHERE community_id = $1 AND user_id = $2 AND role = 'pending' AND status = 'active'
            RETURNING *
            """,
            community_id, user_id,
        )
        if row:
            await self.db.execute(
                "UPDATE communities SET member_count = member_count + 1 WHERE id = $1",
                community_id,
            )
        return dict(row) if row else None

    async def reject_member(self, community_id: str, user_id: str) -> bool:

        result = await self.db.execute(
            "DELETE FROM community_members WHERE community_id = $1 AND user_id = $2 AND role = 'pending'",
            community_id, user_id,
        )
        return "DELETE 1" in result

    async def get_pending_members(
        self, community_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT cm.*, u.username, u.email, u.display_name
            FROM community_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.community_id = $1 AND cm.role = 'pending' AND cm.status = 'active'
            ORDER BY cm.joined_at DESC
            LIMIT $2 OFFSET $3
            """,
            community_id, limit, offset,
        )
        return [dict(r) for r in rows]

    async def count_pending_members(self, community_id: str) -> int:
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM community_members WHERE community_id = $1 AND role = 'pending' AND status = 'active'",
            community_id,
        )


    async def create_invitation(
        self,
        community_id: str,
        invited_by: str,
        invited_email: Optional[str] = None,
        invited_user_id: Optional[str] = None,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        code = str(uuid.uuid4())[:8]
        row = await self.db.fetchrow(
            """
            INSERT INTO community_invitations
                (community_id, invited_email, invited_user_id, invited_by, invitation_code, message)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """,
            community_id, invited_email, invited_user_id, invited_by, code, message,
        )
        return dict(row)

    async def get_user_invitation(self, community_id: str, user_id: str) -> Optional[Dict[str, Any]]:

        row = await self.db.fetchrow(
            """
            SELECT * FROM community_invitations
            WHERE community_id = $1 AND invited_user_id = $2 AND status = 'pending'
            ORDER BY created_at DESC LIMIT 1
            """,
            community_id, user_id,
        )
        return dict(row) if row else None

    async def accept_invitation(self, invitation_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            UPDATE community_invitations SET status = 'accepted', responded_at = NOW()
            WHERE id = $1 AND status = 'pending'
            RETURNING *
            """,
            invitation_id,
        )
        return dict(row) if row else None

    async def decline_invitation(self, invitation_id: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            """
            UPDATE community_invitations SET status = 'declined', responded_at = NOW()
            WHERE id = $1 AND status = 'pending'
            RETURNING *
            """,
            invitation_id,
        )
        return dict(row) if row else None

    async def get_user_invitations(self, user_id: str) -> List[Dict[str, Any]]:

        rows = await self.db.fetch(
            """
            SELECT ci.*, c.name as community_name, c.url_id as community_url_id,
                   c.description as community_description, c.community_type,
                   c.member_count, c.color_theme,
                   u.username as invited_by_username, u.display_name as invited_by_display_name
            FROM community_invitations ci
            JOIN communities c ON ci.community_id = c.id
            JOIN users u ON ci.invited_by = u.id
            WHERE ci.invited_user_id = $1 AND ci.status = 'pending'
            ORDER BY ci.created_at DESC
            """,
            user_id,
        )
        return [dict(r) for r in rows]

    async def get_leaderboard(
        self, community_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT cm.user_id, cm.contribution_points,
                   u.username, u.display_name
            FROM community_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.community_id = $1 AND cm.status = 'active'
            ORDER BY cm.contribution_points DESC
            LIMIT $2
            """,
            community_id, limit,
        )
        return [dict(r) for r in rows]
