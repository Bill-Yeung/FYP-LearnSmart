import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from app.repositories.notification_repository import NotificationRepository

logger = logging.getLogger(__name__)

class NotificationType(str, Enum):

    DOCUMENT_PENDING = "document.pending"
    DOCUMENT_PROCESSING = "document.processing"
    DOCUMENT_COMPLETED = "document.completed"
    DOCUMENT_FAILED = "document.failed"

    DOCUMENT_DELETED = "document.deleted"

    SYSTEM_ALERT = "system.alert"
    SYSTEM_MAINTENANCE = "system.maintenance"
    SYSTEM_UPDATE = "system.update"

    COMMUNITY_MENTION = "community.mention"
    COMMUNITY_COMMENT = "community.comment"
    COMMUNITY_LIKE = "community.like"
    COMMUNITY_FOLLOW = "community.follow"
    COMMUNITY_SHARE = "community.share"

    CHAT_NEW_MESSAGE = "chat.new_message"

    USER_ACHIEVEMENT = "user.achievement"
    USER_QUOTA_WARNING = "user.quota_warning"
    USER_SUBSCRIPTION_EXPIRING = "user.subscription_expiring"
    USER_MESSAGE = "user.message"

@dataclass
class Notification:
    event_type: str
    user_id: str
    data: dict[str, any]
    timestamp: datetime = field(default_factory = lambda: datetime.now(timezone.utc))
    id: str | None = None

class NotificationService:

    def __init__(self, max_queue_size: int = 100):

        self.connections: dict[str, set[asyncio.Queue]] = {}
        self.max_queue_size = max_queue_size

    async def connect(self, user_id: str) -> asyncio.Queue:

        queue = asyncio.Queue(maxsize = self.max_queue_size)

        if user_id not in self.connections:
            self.connections[user_id] = set()

        self.connections[user_id].add(queue)
        logger.info(f"SSE connection established for user {user_id} (total: {len(self.connections[user_id])})")

        return queue

    async def disconnect(self, user_id: str, queue: asyncio.Queue):

        if user_id in self.connections:
            self.connections[user_id].discard(queue)

            if not self.connections[user_id]:
                del self.connections[user_id]

            logger.info(f"SSE connection closed for user {user_id} (remaining: {len(self.connections.get(user_id, []))})")

    async def notify(
        self,
        user_id: str,
        event_type: NotificationType | str,
        data: dict[str, any],
        notification_id: str | None = None,
        persist: bool = True,
        db = None):

        event_type_str = event_type.value if isinstance(event_type, NotificationType) else event_type

        if persist and db is not None:

            repo = NotificationRepository(db)

            db_notification = await repo.create(
                user_id = user_id,
                notification_type = event_type_str,
                title = data.get("title", event_type_str),
                body = data.get("message"),
                entity_type = "source" if "document_id" in data else None,
                entity_id = data.get("document_id"),
                action_data = data)

            if db_notification:
                notification_id = str(db_notification["id"])

        notification = Notification(
            event_type = event_type_str,
            user_id = user_id,
            data = data,
            id = notification_id)
        
        await self._broadcast(notification)

    async def _broadcast(self, notification: Notification):

        user_id = notification.user_id

        if user_id == "broadcast":
            target_users = list(self.connections.keys())
        else:
            target_users = [user_id] if user_id in self.connections else []

        if not target_users:
            return

        message = {
            "type": notification.event_type,
            "data": notification.data,
            "timestamp": notification.timestamp.isoformat(),
            "id": notification.id}

        for target_user in target_users:
            await self._send_to_user(target_user, message)

    async def _send_to_user(self, user_id: str, message: dict):

        if user_id not in self.connections:
            return

        dead_queues = []
        for queue in self.connections[user_id]:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                dead_queues.append(queue)
                logger.warning(f"Queue full for user {user_id}, dropping oldest connection")

        for queue in dead_queues:
            await self.disconnect(user_id, queue)

        if self.connections.get(user_id):
            logger.debug(f"Sent {message['type']} notification to {len(self.connections[user_id])} connections for user {user_id}")

    def get_active_connections(self, user_id: str | None = None) -> int:

        if user_id:
            return len(self.connections.get(user_id, []))
        
        return sum(len(queues) for queues in self.connections.values())

    def get_stats(self) -> dict:

        return {
            "total_users": len(self.connections),
            "total_connections": self.get_active_connections(),
            "users": {
                user_id: len(queues)
                for user_id, queues in self.connections.items()}}

# Global instance
notification_service = NotificationService()
