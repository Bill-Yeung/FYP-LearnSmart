from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.follow_repository import FollowRepository
from app.repositories.activity_feed_repository import ActivityFeedRepository

router = APIRouter(prefix="/follows", tags=["Follows"])

@router.post("/{user_id}")
async def follow_user(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    repo = FollowRepository(db)
    created = await repo.follow(current_user["id"], user_id)
    if not created:
        return {"message": "Already following this user"}

    try:
        target = await db.fetchrow("SELECT username, display_name FROM users WHERE id = $1", user_id)
        af = ActivityFeedRepository(db)
        await af.create_activity(
            actor_id=current_user["id"],
            activity_type="followed",
            entity_type="user",
            entity_id=user_id,
            entity_preview={"description": f"Followed {target['display_name'] or target['username']}" if target else None},
        )
    except Exception:
        pass

    return {"message": "Followed successfully"}

@router.delete("/{user_id}")
async def unfollow_user(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    repo = FollowRepository(db)
    removed = await repo.unfollow(current_user["id"], user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Not following this user")
    return {"message": "Unfollowed successfully"}

@router.get("/check/{user_id}")
async def check_following(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    repo = FollowRepository(db)
    is_following = await repo.is_following(current_user["id"], user_id)
    return {"is_following": is_following}

@router.get("/following")
async def list_following(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    repo = FollowRepository(db)
    users = await repo.get_following(current_user["id"], page, page_size)
    total = await repo.count_following(current_user["id"])
    return {"users": users, "total": total, "page": page, "page_size": page_size}

@router.get("/followers")
async def list_followers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    repo = FollowRepository(db)
    users = await repo.get_followers(current_user["id"], page, page_size)
    total = await repo.count_followers(current_user["id"])
    return {"users": users, "total": total, "page": page, "page_size": page_size}
