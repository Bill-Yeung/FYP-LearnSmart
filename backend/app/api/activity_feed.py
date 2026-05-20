from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import json

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.activity_feed_repository import ActivityFeedRepository

router = APIRouter(prefix="/activity-feed", tags=["Activity Feed"])

def _get_activity_type_label(activity_type: str) -> str:
    labels = {
        "shared": "Shared a Resource",
        "commented": "Commented",
        "liked": "Liked",
        "achieved": "Earned a Badge",
        "milestone_reached": "Reached a Milestone",
        "joined_community": "Joined a Community",
        "created_content": "Created Content",
        "completed_challenge": "Completed a Challenge",
        "started_mentoring": "Started Mentoring",
        "followed": "Followed",
        "streak_milestone": "Study Streak",
    }
    return labels.get(activity_type, activity_type.replace("_", " ").title())


def _format_activity(row: dict, has_liked: bool = False) -> dict:
    preview = row.get("entity_preview") or {}
    if isinstance(preview, str):
        try:
            preview = json.loads(preview)
        except (json.JSONDecodeError, TypeError):
            preview = {}

    return {
        "id": str(row["id"]),
        "type": row["activity_type"],
        "user": {
            "id": str(row["actor_id"]),
            "username": row.get("actor_username", ""),
            "display_name": row.get("actor_display_name") or row.get("actor_username") or "Unknown",
            "avatar_url": row.get("actor_avatar_url"),
        },
        "content": {
            "title": _get_activity_type_label(row["activity_type"]),
            "description": preview.get("description")
                or preview.get("title")
                or preview.get("challenge_title")
                or preview.get("thread_title")
                or preview.get("badge_name")
                or "",
            "link": preview.get("link"),
            "preview": preview,
        },
        "entity_type": row["entity_type"],
        "entity_id": str(row["entity_id"]),
        "likes": row.get("like_count", 0),
        "comments": row.get("comment_count", 0),
        "is_liked": has_liked,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }

@router.get("")
async def list_activity_feed(
    feed_type: str = Query("all", regex="^(all|following|community|classmates)$"),
    community_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    
    try:
        repo = ActivityFeedRepository(db)
        rows = await repo.list_activities(
            feed_type=feed_type,
            user_id=current_user["id"],
            community_id=community_id,
            page=page,
            page_size=page_size,
        )
        total = await repo.count_activities(
            feed_type=feed_type,
            user_id=current_user["id"],
            community_id=community_id,
        )

        activities = []
        for row in rows:
            liked = await repo.has_liked(row["id"], current_user["id"])
            activities.append(_format_activity(row, has_liked=liked))

        return {"activities": activities, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{activity_id}/like")
async def toggle_like(
    activity_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ActivityFeedRepository(db)
        result = await repo.toggle_like(activity_id, current_user["id"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{activity_id}/comments")
async def list_comments(
    activity_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ActivityFeedRepository(db)
        rows = await repo.list_comments(activity_id, limit=limit)
        comments = []
        for r in rows:
            comments.append({
                "id": str(r["id"]),
                "content": r["content"],
                "user": {
                    "id": str(r["user_id"]),
                    "username": r.get("username"),
                    "display_name": r.get("display_name"),
                    "avatar_url": r.get("avatar_url"),
                },
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            })
        return {"comments": comments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{activity_id}/comments")
async def create_comment(
    activity_id: str,
    content: str = Query(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ActivityFeedRepository(db)
        comment = await repo.create_comment(
            activity_id=activity_id,
            user_id=current_user["id"],
            content=content,
        )
        return {
            "comment": {
                "id": str(comment["id"]),
                "content": comment["content"],
                "created_at": comment["created_at"].isoformat() if comment.get("created_at") else None,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
