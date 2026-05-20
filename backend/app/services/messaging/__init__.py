"""
Messaging Services

Provides real-time communication and notification capabilities:
- WebSocket connections for live updates
- Server-Sent Events (SSE) for notifications
- Push notifications
- Email notifications
"""
from app.services.messaging.notification_service import (
    notification_service,
    NotificationType
)
from app.services.messaging.websocket_manager import (
    WebSocketManager,
    websocket_manager
)
from app.services.messaging.email_service import (
    EmailService,
    email_service
)

__all__ = [
    "notification_service",
    "NotificationType",
    "WebSocketManager",
    "websocket_manager",
    "EmailService",
    "email_service"
]
