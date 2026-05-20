from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.follow_repository import FollowRepository

router = APIRouter(prefix="/friendships", tags=["Friendships"])

class FriendUser(BaseModel):
    id: str
    username: str
    email: str
    display_name: Optional[str] = None


class FriendshipResponse(BaseModel):
    id: str
    user_id: str
    friend_id: str
    status: str 
    created_at: datetime
    updated_at: Optional[datetime] = None
    friend: FriendUser


@router.get("")
async def get_friendships(
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    try:

        if status:
            query = """
                SELECT
                    f.id, f.user_id, f.friend_id, f.status,
                    f.created_at, f.accepted_at,
                    u.id as friend_user_id, u.username, u.email, u.display_name
                FROM friendships f
                JOIN users u ON f.friend_id = u.id
                WHERE f.user_id = $1 AND f.status = $2
                ORDER BY f.created_at DESC
            """
            rows = await db.fetch(query, current_user["id"], status)
        else:
            query = """
                SELECT
                    f.id, f.user_id, f.friend_id, f.status,
                    f.created_at, f.accepted_at,
                    u.id as friend_user_id, u.username, u.email, u.display_name
                FROM friendships f
                JOIN users u ON f.friend_id = u.id
                WHERE f.user_id = $1
                ORDER BY f.created_at DESC
            """
            rows = await db.fetch(query, current_user["id"])

        friendships = []
        for row in rows:
            friendships.append({
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "friend_id": str(row["friend_id"]),
                "status": row["status"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["accepted_at"].isoformat() if row["accepted_at"] else None,
                "friend": {
                    "id": str(row["friend_user_id"]),
                    "username": row["username"],
                    "email": row["email"],
                    "display_name": row["display_name"]
                }
            })

        incoming_query = """
            SELECT
                f.id, f.user_id, f.friend_id, f.status,
                f.created_at, f.accepted_at,
                u.id as sender_user_id, u.username, u.email, u.display_name
            FROM friendships f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        """
        incoming_rows = await db.fetch(incoming_query, current_user["id"])

        incoming_requests = []
        for row in incoming_rows:
            incoming_requests.append({
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "friend_id": str(row["friend_id"]),
                "status": row["status"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": None,
                "sender": {
                    "id": str(row["sender_user_id"]),
                    "username": row["username"],
                    "email": row["email"],
                    "display_name": row["display_name"]
                }
            })

        return {"friendships": friendships, "incoming_requests": incoming_requests}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch friendships: {str(e)}")

@router.get("/search-users")
async def search_users(
    q: str = "",
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    if len(q.strip()) < 1:
        return {"users": []}

    query = """
        SELECT u.id, u.username, u.display_name,
               CASE WHEN EXISTS (
                   SELECT 1 FROM friendships
                   WHERE (user_id = $1 AND friend_id = u.id AND status = 'accepted')
                      OR (friend_id = $1 AND user_id = u.id AND status = 'accepted')
               ) THEN TRUE ELSE FALSE END AS is_friend,
               CASE WHEN EXISTS (
                   SELECT 1 FROM friendships
                   WHERE (user_id = $1 AND friend_id = u.id AND status = 'pending')
                      OR (friend_id = $1 AND user_id = u.id AND status = 'pending')
               ) THEN TRUE ELSE FALSE END AS is_pending
        FROM users u
        WHERE u.id != $1
          AND u.role != 'admin'
          AND (u.username ILIKE $2 OR u.display_name ILIKE $2)
        ORDER BY
          CASE WHEN u.username ILIKE $3 THEN 0 ELSE 1 END,
          u.username
        LIMIT 10
    """
    pattern = f"%{q.strip()}%"
    prefix = f"{q.strip()}%"
    rows = await db.fetch(query, current_user["id"], pattern, prefix)

    return {"users": [
        {
            "id": str(r["id"]),
            "username": r["username"],
            "display_name": r["display_name"],
            "is_friend": r["is_friend"],
            "is_pending": r["is_pending"],
        }
        for r in rows
    ]}

@router.post("/request")
async def send_friend_request(
    friend_username: str,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    try:
        friend = await db.fetchrow(
            "SELECT id, username, email, display_name FROM users WHERE username = $1",
            friend_username
        )

        if not friend:
            raise HTTPException(status_code=404, detail="User not found")

        if friend["id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="Cannot add yourself as friend")

        existing = await db.fetchrow(
            "SELECT id, status FROM friendships WHERE user_id = $1 AND friend_id = $2",
            current_user["id"], friend["id"]
        )

        if existing:
            if existing["status"] == "accepted":
                raise HTTPException(status_code=400, detail="Already friends")
            elif existing["status"] == "pending":
                raise HTTPException(status_code=400, detail="Friend request already sent")
            elif existing["status"] == "blocked":
                raise HTTPException(status_code=400, detail="Cannot send friend request")

        friendship = await db.fetchrow(
            """
            INSERT INTO friendships (user_id, friend_id, status)
            VALUES ($1, $2, 'pending')
            RETURNING id, user_id, friend_id, status, created_at
            """,
            current_user["id"], friend["id"]
        )

        return {
            "friendship": {
                "id": str(friendship["id"]),
                "user_id": str(friendship["user_id"]),
                "friend_id": str(friendship["friend_id"]),
                "status": friendship["status"],
                "created_at": friendship["created_at"].isoformat(),
                "friend": {
                    "id": str(friend["id"]),
                    "username": friend["username"],
                    "email": friend["email"],
                    "display_name": friend["display_name"]
                }
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send friend request: {str(e)}")

@router.post("/{friendship_id}/accept")
async def accept_friend_request(
    friendship_id: int,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    try:

        friendship = await db.fetchrow(
            "SELECT * FROM friendships WHERE id = $1 AND friend_id = $2",
            friendship_id, current_user["id"]
        )

        if not friendship:
            raise HTTPException(status_code=404, detail="Friend request not found")

        if friendship["status"] != "pending":
            raise HTTPException(status_code=400, detail="Friend request is not pending")

        await db.execute(
            "UPDATE friendships SET status = 'accepted', accepted_at = NOW() WHERE id = $1",
            friendship_id
        )

        await db.execute(
            """
            INSERT INTO friendships (user_id, friend_id, status)
            VALUES ($1, $2, 'accepted')
            ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted', accepted_at = NOW()
            """,
            current_user["id"], friendship["user_id"]
        )

        follow_repo = FollowRepository(db)
        await follow_repo.follow(current_user["id"], friendship["user_id"])
        await follow_repo.follow(friendship["user_id"], current_user["id"])

        return {"message": "Friend request accepted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to accept friend request: {str(e)}")

@router.delete("/{friendship_id}")
async def remove_friend(
    friendship_id: int,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)
):

    try:

        friendship = await db.fetchrow(
            "SELECT * FROM friendships WHERE id = $1 AND (user_id = $2 OR friend_id = $2)",
            friendship_id, current_user["id"]
        )

        if not friendship:
            raise HTTPException(status_code=404, detail="Friendship not found")

        await db.execute("DELETE FROM friendships WHERE id = $1", friendship_id)

        if friendship["status"] == "accepted":
            other_user_id = (
                friendship["friend_id"]
                if friendship["user_id"] == current_user["id"]
                else friendship["user_id"]
            )
            await db.execute(
                "DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2",
                other_user_id, current_user["id"]
            )

            follow_repo = FollowRepository(db)
            await follow_repo.unfollow(current_user["id"], other_user_id)
            await follow_repo.unfollow(other_user_id, current_user["id"])

        return {"message": "Friendship removed"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove friend: {str(e)}")
