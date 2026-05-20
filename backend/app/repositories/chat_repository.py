from typing import Optional, List, Dict, Any
from uuid import UUID
import asyncpg
import json

class ChatRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def create_chat_room(
        self,
        room_type: str,
        created_by: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        community_id: Optional[UUID] = None,
        is_private: bool = True,
        max_participants: int = 50
    ) -> Dict[str, Any]:

        row = await self.db.fetchrow("""
            INSERT INTO chat_rooms (
                room_type, name, description, community_id,
                is_private, max_participants, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        """, room_type, name, description, community_id, is_private, max_participants, created_by)
        return dict(row)

    async def get_chat_room(self, room_id: UUID) -> Optional[Dict[str, Any]]:

        row = await self.db.fetchrow("""
            SELECT * FROM chat_rooms
            WHERE id = $1 AND is_archived = FALSE
        """, room_id)
        return dict(row) if row else None

    async def get_user_chat_rooms(self, user_id: UUID) -> List[Dict[str, Any]]:

        rows = await self.db.fetch("""
            SELECT
                r.*,
                crm.is_muted,
                -- For direct chats, get the other user's display name
                CASE
                    WHEN r.room_type = 'direct' THEN (
                        SELECT COALESCE(u.display_name, u.username)
                        FROM chat_room_members crm2
                        JOIN users u ON crm2.user_id = u.id
                        WHERE crm2.room_id = r.id
                        AND crm2.user_id != $2
                        AND crm2.is_active = TRUE
                        LIMIT 1
                    )
                    ELSE r.name
                END as name,
                COUNT(DISTINCT m.id) FILTER (
                    WHERE m.created_at > crm.joined_at
                    AND m.user_id != $2
                    AND (
                        m.read_by IS NULL
                        OR NOT m.read_by ? $1::text
                    )
                ) as unread_count
            FROM chat_rooms r
            INNER JOIN chat_room_members crm ON r.id = crm.room_id
            LEFT JOIN chat_messages m ON r.id = m.chat_room_id
            WHERE crm.user_id = $2
                AND crm.is_active = TRUE
                AND r.is_archived = FALSE
            GROUP BY r.id, crm.is_muted, crm.joined_at
            ORDER BY r.last_message_at DESC NULLS LAST, r.created_at DESC
        """, str(user_id), user_id)
        return [dict(row) for row in rows]

    async def get_or_create_direct_room(
        self, user1_id: UUID, user2_id: UUID
    ) -> Dict[str, Any]:

        row = await self.db.fetchrow("""
            SELECT r.*
            FROM chat_rooms r
            INNER JOIN chat_room_members m1 ON r.id = m1.room_id
            INNER JOIN chat_room_members m2 ON r.id = m2.room_id
            WHERE r.room_type = 'direct'
                AND r.is_archived = FALSE
                AND m1.user_id = $1
                AND m2.user_id = $2
                AND m1.is_active = TRUE
                AND m2.is_active = TRUE
            LIMIT 1
        """, user1_id, user2_id)

        if row:
            return dict(row)

        room = await self.db.fetchrow("""
            INSERT INTO chat_rooms (room_type, is_private, created_by)
            VALUES ('direct', TRUE, $1)
            RETURNING *
        """, user1_id)

        await self.db.execute("""
            INSERT INTO chat_room_members (room_id, user_id, role)
            VALUES
                ($1, $2, 'owner'),
                ($1, $3, 'member')
        """, room['id'], user1_id, user2_id)

        await self.db.execute("""
            UPDATE chat_rooms SET member_count = 2
            WHERE id = $1
        """, room['id'])

        return dict(room)

    async def update_room_last_message(
        self, room_id: UUID, preview: str
    ) -> None:

        await self.db.execute("""
            UPDATE chat_rooms
            SET last_message_at = CURRENT_TIMESTAMP,
                last_message_preview = $1,
                message_count = message_count + 1
            WHERE id = $2
        """, preview, room_id)

    async def add_room_member(
        self,
        room_id: UUID,
        user_id: UUID,
        role: str = 'member',
        invited_by: Optional[UUID] = None
    ) -> Dict[str, Any]:

        row = await self.db.fetchrow("""
            INSERT INTO chat_room_members (room_id, user_id, role, invited_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (room_id, user_id)
            DO UPDATE SET is_active = TRUE, left_at = NULL
            RETURNING *
        """, room_id, user_id, role, invited_by)

        await self.db.execute("""
            UPDATE chat_rooms
            SET member_count = (
                SELECT COUNT(*) FROM chat_room_members
                WHERE room_id = $1 AND is_active = TRUE
            )
            WHERE id = $1
        """, room_id)

        return dict(row)

    async def remove_room_member(self, room_id: UUID, user_id: UUID) -> None:

        await self.db.execute("""
            UPDATE chat_room_members
            SET is_active = FALSE, left_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND user_id = $2
        """, room_id, user_id)

        await self.db.execute("""
            UPDATE chat_rooms
            SET member_count = (
                SELECT COUNT(*) FROM chat_room_members
                WHERE room_id = $1 AND is_active = TRUE
            )
            WHERE id = $1
        """, room_id)

    async def get_room_members(self, room_id: UUID) -> List[Dict[str, Any]]:

        rows = await self.db.fetch("""
            SELECT
                crm.*,
                u.username,
                u.display_name,
                up.avatar_url
            FROM chat_room_members crm
            INNER JOIN users u ON crm.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE crm.room_id = $1 AND crm.is_active = TRUE
            ORDER BY crm.joined_at
        """, room_id)
        return [dict(row) for row in rows]

    async def is_room_member(self, room_id: UUID, user_id: UUID) -> bool:

        result = await self.db.fetchval("""
            SELECT EXISTS(
                SELECT 1 FROM chat_room_members
                WHERE room_id = $1 AND user_id = $2 AND is_active = TRUE
            )
        """, room_id, user_id)
        return result

    async def toggle_mute(
        self, room_id: UUID, user_id: UUID, is_muted: bool
    ) -> None:

        await self.db.execute("""
            UPDATE chat_room_members
            SET is_muted = $1
            WHERE room_id = $2 AND user_id = $3
        """, is_muted, room_id, user_id)

    async def create_message(
        self,
        room_id: UUID,
        user_id: UUID,
        content: str,
        message_type: str = 'text',
        is_encrypted: bool = True,
        reply_to_id: Optional[UUID] = None,
        attachments: Optional[List[Dict]] = None,
        mentions: Optional[List[UUID]] = None
    ) -> Dict[str, Any]:

        row = await self.db.fetchrow("""
            INSERT INTO chat_messages (
                chat_room_id, user_id, content, message_type,
                is_encrypted, reply_to_id, attachments, mentions
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """,
            room_id, user_id, content, message_type,
            is_encrypted, reply_to_id,
            json.dumps(attachments) if attachments else None,
            mentions
        )
        return dict(row)

    async def get_messages(
        self,
        room_id: UUID,
        limit: int = 50,
        before: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:

        if before:
            rows = await self.db.fetch("""
                SELECT
                    m.*,
                    u.username,
                    u.display_name,
                    up.avatar_url
                FROM chat_messages m
                INNER JOIN users u ON m.user_id = u.id
                LEFT JOIN user_profiles up ON u.id = up.user_id
                WHERE m.chat_room_id = $1
                    AND m.is_deleted = FALSE
                    AND m.created_at < (
                        SELECT created_at FROM chat_messages WHERE id = $2
                    )
                ORDER BY m.created_at DESC
                LIMIT $3
            """, room_id, before, limit)
        else:
            rows = await self.db.fetch("""
                SELECT
                    m.*,
                    u.username,
                    u.display_name,
                    up.avatar_url
                FROM chat_messages m
                INNER JOIN users u ON m.user_id = u.id
                LEFT JOIN user_profiles up ON u.id = up.user_id
                WHERE m.chat_room_id = $1 AND m.is_deleted = FALSE
                ORDER BY m.created_at DESC
                LIMIT $2
            """, room_id, limit)

        messages = [dict(row) for row in rows]
        return list(reversed(messages))

    async def mark_message_read(
        self, message_id: UUID, user_id: UUID
    ) -> None:

        await self.db.execute("""
            UPDATE chat_messages
            SET read_by = COALESCE(read_by, '{}'::jsonb) || jsonb_build_object($1::text, NOW()::text)
            WHERE id = $2
        """, str(user_id), message_id)

    async def mark_room_messages_read(
        self, room_id: UUID, user_id: UUID, up_to_message_id: Optional[UUID] = None
    ) -> None:

        if up_to_message_id:
            await self.db.execute("""
                UPDATE chat_messages
                SET read_by = COALESCE(read_by, '{}'::jsonb) || jsonb_build_object($1::text, NOW()::text)
                WHERE chat_room_id = $2
                    AND id <= $3
                    AND user_id != $4
                    AND (read_by IS NULL OR NOT read_by ? $1::text)
            """, str(user_id), room_id, up_to_message_id, user_id)
        else:
            await self.db.execute("""
                UPDATE chat_messages
                SET read_by = COALESCE(read_by, '{}'::jsonb) || jsonb_build_object($1::text, NOW()::text)
                WHERE chat_room_id = $2
                    AND user_id != $3
                    AND (read_by IS NULL OR NOT read_by ? $1::text)
            """, str(user_id), room_id, user_id)

    async def edit_message(
        self, message_id: UUID, content: str
    ) -> Dict[str, Any]:

        row = await self.db.fetchrow("""
            UPDATE chat_messages
            SET content = $1, is_edited = TRUE, edited_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        """, content, message_id)
        return dict(row)

    async def delete_message(self, message_id: UUID) -> None:

        await self.db.execute("""
            UPDATE chat_messages
            SET is_deleted = TRUE, content = '[deleted]'
            WHERE id = $1
        """, message_id)

    async def add_reaction(
        self, message_id: UUID, user_id: UUID, emoji: str
    ) -> Dict[str, Any]:

        row = await self.db.fetchrow("""
            SELECT reactions FROM chat_messages WHERE id = $1
        """, message_id)
        raw = row['reactions'] if row and row['reactions'] else {}
        reactions = json.loads(raw) if isinstance(raw, str) else dict(raw)

        if emoji not in reactions:
            reactions[emoji] = []
        if str(user_id) not in reactions[emoji]:
            reactions[emoji].append(str(user_id))

        updated_row = await self.db.fetchrow("""
            UPDATE chat_messages
            SET reactions = $1::jsonb
            WHERE id = $2
            RETURNING *
        """, json.dumps(reactions), message_id)
        return dict(updated_row)

    async def remove_reaction(
        self, message_id: UUID, user_id: UUID, emoji: str
    ) -> Dict[str, Any]:

        row = await self.db.fetchrow("""
            SELECT reactions FROM chat_messages WHERE id = $1
        """, message_id)
        raw = row['reactions'] if row and row['reactions'] else {}
        reactions = json.loads(raw) if isinstance(raw, str) else dict(raw)

        if emoji in reactions and str(user_id) in reactions[emoji]:
            reactions[emoji].remove(str(user_id))
            if not reactions[emoji]:
                del reactions[emoji]

        updated_row = await self.db.fetchrow("""
            UPDATE chat_messages
            SET reactions = $1::jsonb
            WHERE id = $2
            RETURNING *
        """, json.dumps(reactions), message_id)
        return dict(updated_row)
