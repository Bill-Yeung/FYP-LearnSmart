from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List

import logging

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.discussion_repository import DiscussionRepository
from app.repositories.community_repository import CommunityRepository
from app.repositories.gamification_repository import GamificationRepository
from app.repositories.activity_feed_repository import ActivityFeedRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discussions", tags=["Discussions"])

def _format_thread(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "community_id": str(row["community_id"]),
        "title": row["title"],
        "content": row["content"],
        "thread_type": row.get("thread_type", "discussion"),
        "status": row.get("status", "open"),
        "is_pinned": row.get("is_pinned", False),
        "view_count": row.get("view_count", 0),
        "reply_count": row.get("reply_count", 0),
        "like_count": row.get("like_count", 0),
        "tags": row.get("tags") or [],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "last_activity_at": row["last_activity_at"].isoformat() if row.get("last_activity_at") else None,
        "author": {
            "id": str(row["user_id"]),
            "username": row.get("username"),
            "display_name": row.get("display_name"),
        },
    }

def _format_reply(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "thread_id": str(row["thread_id"]),
        "parent_reply_id": str(row["parent_reply_id"]) if row.get("parent_reply_id") else None,
        "content": row["content"],
        "is_accepted": row.get("is_accepted", False),
        "like_count": row.get("like_count", 0),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "author": {
            "id": str(row["user_id"]),
            "username": row.get("username"),
            "display_name": row.get("display_name"),
        },
    }

@router.get("")
async def list_threads(
    community_id: str,
    thread_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)
        offset = (page - 1) * page_size
        threads = await repo.list_threads(
            community_id=community_id,
            limit=page_size,
            offset=offset,
            thread_type=thread_type,
        )
        total = await repo.count_threads(community_id, thread_type=thread_type)

        formatted = []
        for t in threads:
            ft = _format_thread(t)
            ft["has_liked"] = await repo.has_liked(
                current_user["id"], "discussion_thread", str(t["id"])
            )
            formatted.append(ft)

        return {
            "threads": formatted,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def create_thread(
    community_id: str = Query(...),
    title: str = Query(...),
    content: str = Query(...),
    thread_type: str = Query("discussion"),
    tags: Optional[List[str]] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:

        comm_repo = CommunityRepository(db)
        role = await comm_repo.get_member_role(community_id, current_user["id"])
        if not role:
            raise HTTPException(status_code=403, detail="You must be a member to post")

        repo = DiscussionRepository(db)
        thread = await repo.create_thread(
            community_id=community_id,
            user_id=current_user["id"],
            title=title,
            content=content,
            thread_type=thread_type,
            tags=tags,
        )

        full = await repo.get_thread(str(thread["id"]))

        try:
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("discussion_post")
            if rule and not await gam.check_daily_limit(current_user["id"], "discussion_post"):
                await gam.award_points(
                    user_id=current_user["id"],
                    action_type="discussion_post",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    rule_id=str(rule["id"]),
                    action_id=str(thread["id"]),
                    community_id=community_id,
                    description="Posted a discussion",
                )
        except Exception:
            logger.debug("Failed to award points for discussion_post", exc_info=True)

        try:
            af = ActivityFeedRepository(db)
            await af.create_activity(
                actor_id=current_user["id"],
                activity_type="created_content",
                entity_type="discussion_thread",
                entity_id=str(thread["id"]),
                entity_preview={"title": title, "description": content[:200]},
                community_id=community_id,
            )
        except Exception:
            logger.debug("Failed to log thread activity", exc_info=True)

        return {"thread": _format_thread(full)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{thread_id}")
async def get_thread(
    thread_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)
        thread = await repo.get_thread(thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        await repo.increment_view_count(thread_id)

        formatted = _format_thread(thread)
        formatted["has_liked"] = await repo.has_liked(
            current_user["id"], "discussion_thread", thread_id
        )
        return {"thread": formatted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{thread_id}/replies")
async def list_replies(
    thread_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)
        offset = (page - 1) * page_size
        replies = await repo.list_replies(thread_id, limit=page_size, offset=offset)
        total = await repo.count_replies(thread_id)

        formatted = []
        for r in replies:
            fr = _format_reply(r)
            fr["has_liked"] = await repo.has_liked(
                current_user["id"], "discussion_reply", str(r["id"])
            )
            formatted.append(fr)

        return {"replies": formatted, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{thread_id}/replies")
async def create_reply(
    thread_id: str,
    content: str,
    parent_reply_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)

        thread = await repo.get_thread(thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        if thread.get("status") in ("closed", "removed"):
            raise HTTPException(status_code=400, detail="This thread is closed and no longer accepts replies")

        comm_repo = CommunityRepository(db)
        role = await comm_repo.get_member_role(str(thread["community_id"]), current_user["id"])
        if not role:
            raise HTTPException(status_code=403, detail="You must be a member to reply")

        reply = await repo.create_reply(
            thread_id=thread_id,
            user_id=current_user["id"],
            content=content,
            parent_reply_id=parent_reply_id,
        )

        try:
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("discussion_reply")
            if rule and not await gam.check_daily_limit(current_user["id"], "discussion_reply"):
                await gam.award_points(
                    user_id=current_user["id"],
                    action_type="discussion_reply",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    rule_id=str(rule["id"]),
                    action_id=str(reply["id"]),
                    community_id=str(thread["community_id"]),
                    description="Replied to a discussion",
                )
        except Exception:
            logger.debug("Failed to award points for discussion_reply", exc_info=True)

        try:
            af = ActivityFeedRepository(db)
            await af.create_activity(
                actor_id=current_user["id"],
                activity_type="commented",
                entity_type="discussion_reply",
                entity_id=str(reply["id"]),
                entity_preview={"thread_title": thread.get("title", ""), "description": content[:200]},
                community_id=str(thread["community_id"]),
            )
        except Exception:
            logger.debug("Failed to log reply activity", exc_info=True)

        return {"reply": _format_reply({**reply, "username": None, "display_name": None})}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{thread_id}/like")
async def toggle_thread_like(
    thread_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)
        liked = await repo.toggle_thread_like(thread_id, current_user["id"])

        if liked:
            try:
                thread = await repo.get_thread(thread_id)
                if thread and str(thread["user_id"]) != str(current_user["id"]):
                    gam = GamificationRepository(db)
                    rule = await gam.get_point_rule("content_liked")
                    if rule and not await gam.check_daily_limit(str(thread["user_id"]), "content_liked"):
                        await gam.award_points(
                            user_id=str(thread["user_id"]),
                            action_type="content_liked",
                            points=rule["points_awarded"],
                            point_type_id=str(rule["point_type_id"]),
                            rule_id=str(rule["id"]),
                            action_id=thread_id,
                            community_id=str(thread["community_id"]) if thread.get("community_id") else None,
                            description="Your discussion received a like",
                        )
            except Exception:
                logger.debug("Failed to award points for content_liked", exc_info=True)

        thread = await repo.get_thread(thread_id)
        like_count = thread["like_count"] if thread else 0
        return {"liked": liked, "like_count": like_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/replies/{reply_id}/like")
async def toggle_reply_like(
    reply_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)
        liked = await repo.toggle_reply_like(reply_id, current_user["id"])

        if liked:
            try:
                reply_row = await db.fetchrow(
                    """SELECT dr.user_id, dt.community_id
                       FROM discussion_replies dr
                       JOIN discussion_threads dt ON dt.id = dr.thread_id
                       WHERE dr.id = $1""", reply_id
                )
                if reply_row and str(reply_row["user_id"]) != str(current_user["id"]):
                    gam = GamificationRepository(db)
                    rule = await gam.get_point_rule("content_liked")
                    if rule and not await gam.check_daily_limit(str(reply_row["user_id"]), "content_liked"):
                        await gam.award_points(
                            user_id=str(reply_row["user_id"]),
                            action_type="content_liked",
                            points=rule["points_awarded"],
                            point_type_id=str(rule["point_type_id"]),
                            rule_id=str(rule["id"]),
                            action_id=reply_id,
                            community_id=str(reply_row["community_id"]) if reply_row.get("community_id") else None,
                            description="Your reply received a like",
                        )
            except Exception:
                logger.debug("Failed to award points for content_liked on reply", exc_info=True)

        return {"liked": liked}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{thread_id}/replies/{reply_id}/accept")
async def accept_answer(
    thread_id: str,
    reply_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)
        thread = await repo.get_thread(thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        if str(thread["user_id"]) != str(current_user["id"]):
            raise HTTPException(status_code=403, detail="Only the thread author can accept answers")

        reply_check = await db.fetchrow(
            "SELECT id FROM discussion_replies WHERE id = $1 AND thread_id = $2",
            reply_id, thread_id,
        )
        if not reply_check:
            raise HTTPException(status_code=404, detail="Reply not found in this thread")

        if thread.get("accepted_reply_id"):
            await db.execute(
                "UPDATE discussion_replies SET is_accepted = FALSE WHERE id = $1",
                thread["accepted_reply_id"],
            )

        await db.execute(
            "UPDATE discussion_replies SET is_accepted = TRUE WHERE id = $1 AND thread_id = $2",
            reply_id, thread_id,
        )
        await db.execute(
            "UPDATE discussion_threads SET is_answered = TRUE, accepted_reply_id = $1 WHERE id = $2",
            reply_id, thread_id,
        )

        try:
            reply_row = await db.fetchrow("SELECT user_id FROM discussion_replies WHERE id = $1", reply_id)
            if reply_row and str(reply_row["user_id"]) != str(current_user["id"]):
                gam = GamificationRepository(db)
                rule = await gam.get_point_rule("answer_accepted")
                if rule and not await gam.check_daily_limit(str(reply_row["user_id"]), "answer_accepted"):
                    await gam.award_points(
                        user_id=str(reply_row["user_id"]),
                        action_type="answer_accepted",
                        points=rule["points_awarded"],
                        point_type_id=str(rule["point_type_id"]),
                        rule_id=str(rule["id"]),
                        action_id=reply_id,
                        community_id=str(thread["community_id"]) if thread.get("community_id") else None,
                        description="Your answer was accepted",
                    )
        except Exception:
            logger.debug("Failed to award points for answer_accepted", exc_info=True)

        return {"message": "Answer accepted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{thread_id}/pin")
async def pin_thread(
    thread_id: str,
    pinned: bool = True,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = DiscussionRepository(db)
        thread = await repo.get_thread(thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        comm_repo = CommunityRepository(db)
        role = await comm_repo.get_member_role(str(thread["community_id"]), current_user["id"])
        if role not in ("owner", "admin", "moderator"):
            raise HTTPException(status_code=403, detail="Only moderators can pin threads")

        await repo.pin_thread(thread_id, pinned)
        return {"message": f"Thread {'pinned' if pinned else 'unpinned'}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
