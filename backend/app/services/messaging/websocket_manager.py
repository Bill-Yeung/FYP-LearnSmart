from typing import Dict, Set
from fastapi import WebSocket
import logging
import json

logger = logging.getLogger(__name__)

class WebSocketManager:
    
    def __init__(self):
        self.connections: Dict[str, Set[WebSocket]] = {}
        self.room_subscribers: Dict[str, Set[str]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:

        try:
            await websocket.accept()

            if user_id not in self.connections:
                self.connections[user_id] = set()
            self.connections[user_id].add(websocket)

            logger.info(f"WebSocket connected: user={user_id}, total_connections={len(self.connections[user_id])}")
            return True

        except Exception as e:
            logger.error(f"WebSocket connection failed: user={user_id}, error={e}")
            return False

    def disconnect(self, user_id: str, websocket: WebSocket):

        if user_id in self.connections:
            self.connections[user_id].discard(websocket)

            # If user has no more connections, remove from all rooms
            if not self.connections[user_id]:
                del self.connections[user_id]
                self._remove_user_from_all_rooms(user_id)
                logger.info(f"WebSocket disconnected: user={user_id} (all connections closed)")
            else:
                logger.info(f"WebSocket disconnected: user={user_id}, remaining={len(self.connections[user_id])}")

    def _remove_user_from_all_rooms(self, user_id: str):

        for room_id in list(self.room_subscribers.keys()):
            self.room_subscribers[room_id].discard(user_id)
            if not self.room_subscribers[room_id]:
                del self.room_subscribers[room_id]

    def is_online(self, user_id: str) -> bool:
        return user_id in self.connections and len(self.connections[user_id]) > 0

    def subscribe_to_room(self, user_id: str, room_id: str):

        if room_id not in self.room_subscribers:
            self.room_subscribers[room_id] = set()
        self.room_subscribers[room_id].add(user_id)
        logger.debug(f"Room subscription: user={user_id} joined room={room_id}")

    def unsubscribe_from_room(self, user_id: str, room_id: str):

        if room_id in self.room_subscribers:
            self.room_subscribers[room_id].discard(user_id)
            if not self.room_subscribers[room_id]:
                del self.room_subscribers[room_id]
            logger.debug(f"Room subscription: user={user_id} left room={room_id}")

    def get_room_subscribers(self, room_id: str) -> Set[str]:

        return self.room_subscribers.get(room_id, set()).copy()

    def get_user_rooms(self, user_id: str) -> Set[str]:

        return {
            room_id for room_id, subscribers in self.room_subscribers.items()
            if user_id in subscribers
        }

    async def broadcast_to_room(
        self,
        room_id: str,
        message: dict,
        exclude_user: str | None = None
    ):

        if room_id not in self.room_subscribers:
            return

        for user_id in self.room_subscribers[room_id]:
            if user_id == exclude_user:
                continue
            await self.send_to_user(user_id, message)

    async def send_to_user(self, user_id: str, message: dict):

        if user_id not in self.connections:
            return

        dead_connections: Set[WebSocket] = set()

        for websocket in self.connections[user_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to user={user_id}: {e}")
                dead_connections.add(websocket)

        for ws in dead_connections:
            self.connections[user_id].discard(ws)

        if user_id in self.connections and not self.connections[user_id]:
            del self.connections[user_id]
            self._remove_user_from_all_rooms(user_id)

    async def send_to_users(self, user_ids: list[str], message: dict):

        for user_id in user_ids:
            await self.send_to_user(user_id, message)

    async def broadcast_typing_start(self, room_id: str, user_id: str, username: str):

        await self.broadcast_to_room(
            room_id = room_id,
            message = {
                "type": "typing_start",
                "room_id": room_id,
                "user_id": user_id,
                "username": username
            },
            exclude_user = user_id
        )

    async def broadcast_typing_stop(self, room_id: str, user_id: str):

        await self.broadcast_to_room(
            room_id = room_id,
            message = {
                "type": "typing_stop",
                "room_id": room_id,
                "user_id": user_id
            },
            exclude_user = user_id
        )

    async def broadcast_presence(self, user_id: str, status: str, username: str | None = None):
        
        user_rooms = self.get_user_rooms(user_id)

        message = {
            "type": "presence",
            "user_id": user_id,
            "status": status
        }
        if username:
            message["username"] = username

        for room_id in user_rooms:
            await self.broadcast_to_room(
                room_id = room_id,
                message = message,
                exclude_user = user_id
            )

    def get_online_users_in_room(self, room_id: str) -> Set[str]:

        if room_id not in self.room_subscribers:
            return set()

        return {
            user_id for user_id in self.room_subscribers[room_id]
            if self.is_online(user_id)
        }

    def get_stats(self) -> dict:

        total_connections = sum(len(ws_set) for ws_set in self.connections.values())

        return {
            "online_users": len(self.connections),
            "total_connections": total_connections,
            "active_rooms": len(self.room_subscribers),
            "room_details": {
                room_id: len(subscribers)
                for room_id, subscribers in self.room_subscribers.items()
            }
        }

# Global instance
websocket_manager = WebSocketManager()
