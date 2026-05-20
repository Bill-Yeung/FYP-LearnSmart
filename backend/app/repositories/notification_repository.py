import json
import logging
from uuid import UUID

logger = logging.getLogger(__name__)

class NotificationRepository:

    def __init__(self, db):
        self.db = db

    async def create(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        body: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        action_data: dict | None = None) -> dict | None:

        _SYSTEM_PREFIXES = ("document.", "flashcard.", "error_book.")
        db_type = "system" if notification_type.startswith(_SYSTEM_PREFIXES) else notification_type

        if action_data is None:
            action_data = {}
        action_data["original_type"] = notification_type

        query = """
            INSERT INTO notifications (
                user_id, notification_type, title, body,
                entity_type, entity_id, action_data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        """

        try:

            row = await self.db.fetchrow(
                query,
                UUID(user_id),
                db_type,
                title,
                body,
                entity_type,
                UUID(entity_id) if entity_id else None,
                json.dumps(action_data) if action_data else None)

            return self._parse_notification(row) if row else None
        
        except Exception as e:

            logger.error(f"Failed to create notification: {e}")
            return None

    def _parse_notification(self, row) -> dict:

        notif = dict(row)
        if notif.get("action_data"):

            if isinstance(notif["action_data"], str):
                try:
                    notif["action_data"] = json.loads(notif["action_data"])
                except json.JSONDecodeError:
                    notif["action_data"] = {}
        return notif

    async def get_unread_by_user(self, user_id: str, limit: int = 50) -> list[dict]:

        query = """
            SELECT * FROM notifications
            WHERE user_id = $1 AND is_read = FALSE AND is_archived = FALSE
            ORDER BY created_at DESC
            LIMIT $2
        """

        rows = await self.db.fetch(query, UUID(user_id), limit)
        return [self._parse_notification(row) for row in rows]

    async def get_recent_by_user(self, user_id: str, limit: int = 50) -> list[dict]:

        query = """
            SELECT * FROM notifications
            WHERE user_id = $1 AND is_archived = FALSE
            ORDER BY created_at DESC
            LIMIT $2
        """

        rows = await self.db.fetch(query, UUID(user_id), limit)
        return [self._parse_notification(row) for row in rows]

    async def mark_as_read(self, notification_id: str, user_id: str) -> bool:

        query = """
            UPDATE notifications
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
        """

        result = await self.db.execute(
            query,
            UUID(notification_id),
            UUID(user_id))
        return result == "UPDATE 1"

    async def mark_all_as_read(self, user_id: str) -> int:

        query = """
            UPDATE notifications
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = FALSE
        """

        result = await self.db.execute(
            query,
            UUID(user_id))
        
        try:
            return int(result.split()[1])
        except:
            return 0

    async def get_unread_count(self, user_id: str) -> int:

        query = """
            SELECT COUNT(*) FROM notifications
            WHERE user_id = $1 AND is_read = FALSE AND is_archived = FALSE
        """

        return await self.db.fetchval(query, UUID(user_id))

    async def delete(self, notification_id: str, user_id: str) -> bool:

        query = """
            DELETE FROM notifications
            WHERE id = $1 AND user_id = $2
        """

        result = await self.db.execute(query, UUID(notification_id), UUID(user_id))
        return result == "DELETE 1"
