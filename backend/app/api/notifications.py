from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import logging

from app.models import UserResponse
from app.core.dependencies import get_current_user, get_postgres
from app.repositories import UserRepository
from app.repositories.notification_repository import NotificationRepository
from app.services.messaging.notification_service import notification_service
from app.services import AuthService
from uuid import UUID

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])

async def get_user_from_token(token: str, db) -> dict | None:

    payload = AuthService.decode_token(token)
    if payload is None or payload.get("type") != "access":
        return None

    user_id_str = payload.get("sub")
    if user_id_str is None:
        return None

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        return None

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if user is None or not user["is_active"]:
        return None
    return user

@router.get("/stream")
async def notification_stream(
    request: Request,
    db = Depends(get_postgres)):

    access_token = request.cookies.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication provided")

    user = await get_user_from_token(access_token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token")

    user_id = str(user["id"])

    repo = NotificationRepository(db)
    unread_notifications = await repo.get_unread_by_user(user_id, limit=50)

    async def event_generator():

        queue = await notification_service.connect(user_id)

        try:

            yield f"data: {json.dumps({'type': 'connection.established', 'message': 'Connected to notification stream'})}\n\n"

            for notif in unread_notifications:

                action_data = notif.get("action_data") or {}
                original_type = action_data.get("original_type", notif["notification_type"])

                message = {
                    "type": original_type,
                    "data": {
                        "title": notif["title"],
                        "message": notif["body"],
                        "document_id": str(notif["entity_id"]) if notif.get("entity_id") else None,
                        "status": action_data.get("status"),
                        **{k: v for k, v in action_data.items() if k != "original_type"}},
                    "timestamp": notif["created_at"].isoformat() if notif.get("created_at") else None,
                    "id": str(notif["id"])}
                yield f"data: {json.dumps(message)}\n\n"

            while True:

                try:
                    message = await asyncio.wait_for(queue.get(), timeout = 30.0)
                    sse_message = f"data: {json.dumps(message)}\n\n"
                    yield sse_message

                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"

        except asyncio.CancelledError:
            logger.info(f"SSE stream cancelled for user {user_id}")

        finally:
            await notification_service.disconnect(user_id, queue)
            logger.info(f"SSE stream closed for user {user_id}")

    return StreamingResponse(
        event_generator(),
        media_type = "text/event-stream",
        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"})

@router.get("")
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = NotificationRepository(db)
    user_id = str(current_user["id"])

    if unread_only:
        notifications = await repo.get_unread_by_user(user_id, limit)
    else:
        notifications = await repo.get_recent_by_user(user_id, limit)

    result = []
    for notif in notifications:
        action_data = notif.get("action_data") or {}
        original_type = action_data.get("original_type", notif["notification_type"])

        result.append({
            "id": str(notif["id"]),
            "type": original_type,
            "data": {
                "title": notif["title"],
                "message": notif["body"],
                "document_id": str(notif["entity_id"]) if notif.get("entity_id") else None,
                "status": action_data.get("status"),
                **{k: v for k, v in action_data.items() if k != "original_type"}},
            "timestamp": notif["created_at"].isoformat() if notif.get("created_at") else None,
            "is_read": notif["is_read"]})

    unread_count = await repo.get_unread_count(user_id)

    return {
        "notifications": result,
        "unread_count": unread_count}

@router.post("/mark-read/{notification_id}")
async def mark_notification_read(
    notification_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = NotificationRepository(db)
    success = await repo.mark_as_read(notification_id, str(current_user["id"]))

    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"success": True}

@router.post("/mark-all-read")
async def mark_all_notifications_read(
    
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = NotificationRepository(db)
    count = await repo.mark_all_as_read(str(current_user["id"]))

    return {"success": True, "marked_count": count}

@router.get("/activity")
async def get_activity_feed(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    user_id = str(current_user["id"])
    repo = NotificationRepository(db)

    rows = await db.fetch(
        """
        SELECT n.id, n.notification_type, n.title, n.body, n.entity_id,
               n.action_data, n.is_read, n.created_at,
               s.document_name, s.document_type
        FROM notifications n
        LEFT JOIN sources s ON n.entity_id = s.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3
        """,
        UUID(user_id), limit, offset)

    activities = []
    for row in rows:
        action_data_raw = row.get("action_data")

        if isinstance(action_data_raw, str):
            import json
            try:
                action_data = json.loads(action_data_raw)
            except:
                action_data = {}
        else:
            action_data = action_data_raw or {}

        original_type = action_data.get("original_type", row["notification_type"])

        activities.append({
            "id": str(row["id"]),
            "type": original_type,
            "title": row["title"],
            "message": row["body"],
            "document_name": row["document_name"],
            "document_type": row["document_type"],
            "document_id": str(row["entity_id"]) if row.get("entity_id") else None,
            "timestamp": row["created_at"].isoformat() if row.get("created_at") else None,
            "is_read": row["is_read"]})

    return {"activities": activities, "total": len(activities)}

@router.get("/stats")
async def get_notification_stats(current_user = Depends(get_current_user)):

    stats = notification_service.get_stats()
    user_connections = notification_service.get_active_connections(str(current_user["id"]))

    return {
        **stats,
        "current_user_connections": user_connections}

class CreateNotificationRequest(BaseModel):
    notification_type: str = "system"
    title: str
    body: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    action_url: str | None = None
    action_data: dict | None = None
    expires_at: str | None = None

@router.post("/create")
async def create_notification(
    payload: CreateNotificationRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    try:
        repo = NotificationRepository(db)
        
        entity_id = None
        if payload.entity_id:
            try:
                entity_id = UUID(payload.entity_id)
            except ValueError:
                pass
        
        expires_at = None
        if payload.expires_at:
            try:
                expires_at = payload.expires_at
            except Exception:
                pass
        
        notification_id = await repo.create(
            user_id=str(current_user["id"]),
            notification_type=payload.notification_type,
            title=payload.title,
            body=payload.body,
            entity_type=payload.entity_type,
            entity_id=entity_id,
            action_url=payload.action_url,
            action_data=payload.action_data or {},
            expires_at=expires_at
        )
        
        await notification_service.send({
            "type": payload.notification_type,
            "data": {
                "title": payload.title,
                "message": payload.body,
                "entity_id": payload.entity_id,
                **(payload.action_data or {})
            },
            "id": str(notification_id)
        }, str(current_user["id"]))
        
        return {
            "id": str(notification_id),
            "message": "Notification created successfully"
        }
    except Exception as e:
        logger.exception(f"Failed to create notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))
