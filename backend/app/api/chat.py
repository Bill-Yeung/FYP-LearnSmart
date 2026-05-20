from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel
from datetime import datetime, timezone
from pathlib import Path
import logging
import mimetypes

from app.core.dependencies import get_current_user
from app.core.config import settings
from app.core.database import get_postgres
from app.repositories.chat_repository import ChatRepository
from app.services.messaging.websocket_manager import websocket_manager
from app.services.messaging.notification_service import notification_service, NotificationType
from app.services.infrastructure.file_storage_service import file_storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


class CreateRoomRequest(BaseModel):
    room_type: str
    name: Optional[str] = None
    description: Optional[str] = None
    community_id: Optional[UUID] = None
    is_private: bool = True
    max_participants: int = 50

class CreateDirectRoomRequest(BaseModel):
    recipient_id: UUID

class SendMessageRequest(BaseModel):
    content: str
    message_type: str = 'text'
    reply_to_id: Optional[UUID] = None
    attachments: Optional[List[dict]] = None
    mentions: Optional[List[UUID]] = None

class EditMessageRequest(BaseModel):
    content: str

class AddMemberRequest(BaseModel):
    user_id: UUID
    role: str = 'member'

class ReactionRequest(BaseModel):
    emoji: str

@router.get("/rooms")
async def get_user_rooms(
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)
    rooms = await chat_repo.get_user_chat_rooms(current_user["id"])

    for room in rooms:
        if room["room_type"] == "direct":
            members = await chat_repo.get_room_members(room["id"])
            other_user = next((m for m in members if str(m["user_id"]) != str(current_user["id"])), None)

            if other_user:
                room["other_user_online"] = notification_service.get_active_connections(str(other_user["user_id"])) > 0
            else:
                room["other_user_online"] = False

    return {"rooms": rooms}

@router.post("/rooms")
async def create_room(
    request: CreateRoomRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    room = await chat_repo.create_chat_room(
        room_type=request.room_type,
        created_by=current_user["id"],
        name=request.name,
        description=request.description,
        community_id=request.community_id,
        is_private=request.is_private,
        max_participants=request.max_participants
    )

    await chat_repo.add_room_member(
        room_id=room['id'],
        user_id=current_user["id"],
        role='owner'
    )

    return {"room": room}

@router.post("/rooms/direct")
async def create_or_get_direct_room(
    request: CreateDirectRoomRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    room = await chat_repo.get_or_create_direct_room(
        user1_id=current_user["id"],
        user2_id=request.recipient_id
    )

    recipient = await db.fetchrow(
        "SELECT COALESCE(display_name, username) as name FROM users WHERE id = $1",
        request.recipient_id
    )
    if recipient:
        room["name"] = recipient["name"]
    room["other_user_online"] = notification_service.get_active_connections(str(request.recipient_id)) > 0

    return {"room": room}

@router.get("/rooms/{room_id}")
async def get_room(
    room_id: UUID,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    is_member = await chat_repo.is_room_member(room_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    room = await chat_repo.get_chat_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    return {"room": room}

@router.get("/rooms/{room_id}/members")
async def get_room_members(
    room_id: UUID,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    is_member = await chat_repo.is_room_member(room_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    members = await chat_repo.get_room_members(room_id)
    return {"members": members}

@router.post("/rooms/{room_id}/members")
async def add_room_member(
    room_id: UUID,
    request: AddMemberRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)
    members = await chat_repo.get_room_members(room_id)
    current_member = next((m for m in members if str(m['user_id']) == str(current_user["id"])), None)

    if not current_member or current_member['role'] not in ['owner', 'admin']:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    member = await chat_repo.add_room_member(
        room_id=room_id,
        user_id=request.user_id,
        role=request.role,
        invited_by=current_user["id"]
    )

    await websocket_manager.broadcast_to_room(
        room_id=str(room_id),
        message={
            "type": "member_added",
            "room_id": str(room_id),
            "user_id": str(request.user_id),
            "invited_by": current_user["id"]
        }
    )

    return {"member": member}

@router.delete("/rooms/{room_id}/members/{user_id}")
async def remove_room_member(
    room_id: UUID,
    user_id: UUID,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)
    members = await chat_repo.get_room_members(room_id)
    current_member = next((m for m in members if str(m['user_id']) == str(current_user["id"])), None)

    is_self = str(user_id) == str(current_user["id"])
    has_permission = current_member and current_member['role'] in ['owner', 'admin']

    if not (is_self or has_permission):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    await chat_repo.remove_room_member(room_id, user_id)

    await websocket_manager.broadcast_to_room(
        room_id=str(room_id),
        message={
            "type": "member_removed",
            "room_id": str(room_id),
            "user_id": str(user_id)
        }
    )

    return {"success": True}

@router.post("/rooms/{room_id}/mute")
async def toggle_room_mute(
    room_id: UUID,
    is_muted: bool,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    await chat_repo.toggle_mute(room_id, current_user["id"], is_muted)

    return {"success": True, "is_muted": is_muted}


@router.get("/rooms/{room_id}/messages")
async def get_messages(
    room_id: UUID,
    limit: int = Query(50, le=100),
    before: Optional[UUID] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    is_member = await chat_repo.is_room_member(room_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    messages = await chat_repo.get_messages(room_id, limit, before)

    for message in messages:
        if message.get('created_at') and isinstance(message['created_at'], datetime):
            message['created_at'] = message['created_at'].replace(tzinfo=timezone.utc).isoformat()
        if message.get('edited_at') and isinstance(message['edited_at'], datetime):
            message['edited_at'] = message['edited_at'].replace(tzinfo=timezone.utc).isoformat()

    return {"messages": messages}

@router.post("/rooms/{room_id}/messages")
async def send_message(
    room_id: UUID,
    request: SendMessageRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    is_member = await chat_repo.is_room_member(room_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    message = await chat_repo.create_message(
        room_id=room_id,
        user_id=current_user["id"],
        content=request.content,
        message_type=request.message_type,
        is_encrypted=True,
        reply_to_id=request.reply_to_id,
        attachments=request.attachments,
        mentions=request.mentions
    )

    preview = request.content[:100] if len(request.content) > 100 else request.content
    await chat_repo.update_room_last_message(room_id, preview)

    message['username'] = current_user['username']
    message['display_name'] = current_user.get('display_name')

    formatted_message = {
        "id": str(message['id']),
        "chat_room_id": str(message['chat_room_id']),
        "user_id": str(message['user_id']),
        "username": message['username'],
        "display_name": message.get('display_name'),
        "content": message['content'],
        "message_type": message['message_type'],
        "is_edited": message.get('is_edited', False),
        "reply_to_id": str(message['reply_to_id']) if message.get('reply_to_id') else None,
        "attachments": message.get('attachments'),
        "mentions": [str(m) for m in (message.get('mentions') or [])],
        "read_by": message.get('read_by', {}),  # {user_id: timestamp}
        "created_at": message['created_at'].replace(tzinfo=timezone.utc).isoformat() if isinstance(message['created_at'], datetime) else str(message['created_at'])
    }

    await websocket_manager.broadcast_to_room(
        room_id=str(room_id),
        message={
            "type": "new_message",
            "room_id": str(room_id),
            "message": formatted_message
        },
        exclude_user=str(current_user["id"])
    )

    members = await chat_repo.get_room_members(room_id)
    for member in members:
        member_id = str(member["user_id"])
        if member_id != str(current_user["id"]):
            await notification_service.notify(
                user_id=member_id,
                event_type=NotificationType.CHAT_NEW_MESSAGE,
                data={
                    "title": f"New message from {current_user.get('display_name') or current_user['username']}",
                    "message": preview,
                    "room_id": str(room_id),
                    "sender_id": str(current_user["id"]),
                    "sender_username": current_user["username"],
                },
                persist=False
            )

    return {"message": formatted_message}

MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024

@router.post("/rooms/{room_id}/upload")
async def upload_chat_file(
    room_id: UUID,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    is_member = await chat_repo.is_room_member(room_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    content = await file.read()
    if len(content) > MAX_CHAT_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10MB limit")

    file_id = str(uuid4())
    result = await file_storage_service.save_file(
        file=content,
        filename=file.filename or "attachment",
        subdirectory="chat",
        file_id=file_id
    )

    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    return {
        "file_id": file_id,
        "filename": file.filename,
        "file_size": result["file_size"],
        "file_url": f"/api/chat/files/{file_id}/{file.filename}",
        "content_type": content_type
    }

@router.get("/files/{file_id}/{filename}")
async def serve_chat_file(
    file_id: str,
    filename: str,
    current_user = Depends(get_current_user)
):

    chat_dir = Path(settings.upload_dir) / "chat"
    matches = list(chat_dir.glob(f"{file_id}.*")) if chat_dir.exists() else []
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = matches[0]
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=content_type
    )

@router.put("/messages/{message_id}")
async def edit_message(
    message_id: UUID,
    request: EditMessageRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)
    existing = await db.fetchrow(
        "SELECT user_id FROM chat_messages WHERE id = $1 AND is_deleted = FALSE",
        message_id,
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Message not found")
    if str(existing["user_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Cannot edit another user's message")

    message = await chat_repo.edit_message(message_id, request.content)

    await websocket_manager.broadcast_to_room(
        room_id=str(message['chat_room_id']),
        message={
            "type": "message_edited",
            "room_id": str(message['chat_room_id']),
            "message_id": str(message_id),
            "content": request.content,
            "edited_at": message['edited_at'].isoformat()
        }
    )

    return {"message": message}

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: UUID,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    existing = await db.fetchrow(
        "SELECT user_id, chat_room_id FROM chat_messages WHERE id = $1 AND is_deleted = FALSE",
        message_id,
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Message not found")
    if str(existing["user_id"]) != str(current_user["id"]) and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Cannot delete another user's message")

    await chat_repo.delete_message(message_id)

    return {"success": True}

@router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: UUID,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)
    await chat_repo.mark_message_read(message_id, current_user["id"])
    return {"success": True}

@router.post("/rooms/{room_id}/read")
async def mark_room_read(
    room_id: UUID,
    up_to_message_id: Optional[UUID] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)
    await chat_repo.mark_room_messages_read(
        room_id, current_user["id"], up_to_message_id
    )

    return {"success": True}

@router.post("/messages/{message_id}/reactions")
async def add_reaction(
    message_id: UUID,
    request: ReactionRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    message = await chat_repo.add_reaction(
        message_id, current_user["id"], request.emoji
    )

    await websocket_manager.broadcast_to_room(
        room_id=str(message['chat_room_id']),
        message={
            "type": "reaction_added",
            "room_id": str(message['chat_room_id']),
            "message_id": str(message_id),
            "user_id": current_user["id"],
            "emoji": request.emoji,
            "reactions": message['reactions']
        }
    )

    return {"message": message}

@router.delete("/messages/{message_id}/reactions/{emoji}")
async def remove_reaction(
    message_id: UUID,
    emoji: str,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    chat_repo = ChatRepository(db)

    message = await chat_repo.remove_reaction(
        message_id, current_user["id"], emoji
    )

    await websocket_manager.broadcast_to_room(
        room_id=str(message['chat_room_id']),
        message={
            "type": "reaction_removed",
            "room_id": str(message['chat_room_id']),
            "message_id": str(message_id),
            "user_id": current_user["id"],
            "emoji": emoji,
            "reactions": message['reactions']
        }
    )

    return {"message": message}

@router.websocket("/ws")
async def global_websocket_endpoint(
    websocket: WebSocket,
    db = Depends(get_postgres)
):

    from jose import jwt, JWTError
    from app.core.config import settings

    token = websocket.cookies.get("access_token")
    if not token:
        logger.warning("WebSocket connection rejected - no access token cookie")
        await websocket.close(code=1008, reason="No access token")
        return

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            logger.warning("WebSocket connection rejected - invalid token payload")
            await websocket.close(code=1008, reason="Invalid token")
            return
    except JWTError as e:
        logger.error(f"WebSocket JWT error: {e}")
        await websocket.close(code=1008, reason="Invalid token")
        return

    await websocket_manager.connect(user_id, websocket)
    logger.info(f"User {user_id} connected to global WebSocket")

    from app.repositories.user_repository import UserRepository
    user_repo = UserRepository(db)
    await user_repo.update_last_seen(UUID(user_id), platform='web')

    subscribed_rooms = set()
    chat_repo = ChatRepository(db)

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            room_id = data.get("room_id")

            if message_type == "subscribe":
                if not room_id:
                    continue

                is_member = await chat_repo.is_room_member(UUID(room_id), UUID(user_id))
                if not is_member:
                    await websocket.send_json({
                        "type": "error",
                        "room_id": room_id,
                        "message": "Not a member of this room"
                    })
                    continue

                websocket_manager.subscribe_to_room(user_id, room_id)
                subscribed_rooms.add(room_id)
                logger.info(f"User {user_id} subscribed to room {room_id}")

            elif message_type == "unsubscribe":
                if room_id in subscribed_rooms:
                    websocket_manager.unsubscribe_from_room(user_id, room_id)
                    subscribed_rooms.remove(room_id)
                    logger.info(f"User {user_id} unsubscribed from room {room_id}")

            elif message_type == "typing_start":
                if room_id in subscribed_rooms:
                    await websocket_manager.broadcast_typing_start(
                        room_id=room_id,
                        user_id=user_id,
                        username=data.get("username", "Unknown")
                    )

            elif message_type == "typing_stop":
                if room_id in subscribed_rooms:
                    await websocket_manager.broadcast_typing_stop(
                        room_id=room_id,
                        user_id=user_id
                    )

            elif message_type == "read_receipt":
                message_id = data.get("message_id")
                if not room_id or not message_id:
                    continue
                if room_id not in subscribed_rooms:
                    is_member = await chat_repo.is_room_member(UUID(room_id), UUID(user_id))
                    if not is_member:
                        logger.warning(f"Read receipt rejected - user {user_id} not member of room {room_id}")
                        continue
                logger.info(f"Marking message {message_id} as read by user {user_id} in room {room_id}")
                await chat_repo.mark_message_read(UUID(message_id), UUID(user_id))
                await websocket_manager.broadcast_to_room(
                    room_id=room_id,
                    message={
                        "type": "read_receipt",
                        "room_id": room_id,
                        "message_id": message_id,
                        "user_id": user_id
                    },
                    exclude_user=user_id
                )

            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected from global WebSocket")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        for room_id in subscribed_rooms:
            websocket_manager.unsubscribe_from_room(user_id, room_id)
        websocket_manager.disconnect(user_id, websocket)
        await user_repo.update_last_seen(UUID(user_id), platform='web')
