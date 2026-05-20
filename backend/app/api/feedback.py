from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
import logging

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.feedback_repository import FeedbackRepository
from app.repositories.gamification_repository import GamificationRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["Feedback"])

def _format_request(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "entity_type": row["entity_type"],
        "entity_id": str(row["entity_id"]),
        "title": row["title"],
        "description": row.get("description"),
        "specific_questions": row.get("specific_questions") or [],
        "community_id": str(row["community_id"]) if row.get("community_id") else None,
        "status": row.get("status", "open"),
        "max_responses": row.get("max_responses", 5),
        "current_responses": row.get("current_responses", 0),
        "points_offered": row.get("points_offered", 0),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "author": {
            "username": row.get("username"),
            "display_name": row.get("display_name"),
        },
    }

@router.get("/requests")
async def list_feedback_requests(
    community_id: Optional[str] = None,
    status: str = "open",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = FeedbackRepository(db)
        offset = (page - 1) * page_size
        requests = await repo.list_feedback_requests(
            community_id=community_id,
            status=status,
            limit=page_size,
            offset=offset,
        )
        total = await repo.count_feedback_requests(community_id=community_id, status=status)

        return {
            "requests": [_format_request(r) for r in requests],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests")
async def create_feedback_request(
    entity_type: str,
    entity_id: str,
    title: str,
    description: Optional[str] = None,
    specific_questions: Optional[List[str]] = None,
    community_id: Optional[str] = None,
    points_offered: int = 0,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = FeedbackRepository(db)
        req = await repo.create_feedback_request(
            user_id=current_user["id"],
            entity_type=entity_type,
            entity_id=entity_id,
            title=title,
            description=description,
            specific_questions=specific_questions,
            community_id=community_id,
            points_offered=points_offered,
        )
        return {"request": _format_request({**req, "username": None, "display_name": None})}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/{request_id}/respond")
async def submit_feedback(
    request_id: str,
    content: str,
    rating: Optional[int] = Query(None, ge=1, le=5),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = FeedbackRepository(db)
        req = await repo.get_feedback_request(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Feedback request not found")

        if req["user_id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="Cannot give feedback on your own request")

        if req["status"] == "completed":
            raise HTTPException(status_code=400, detail="Request already completed")

        feedback = await repo.submit_feedback(
            request_id=request_id,
            reviewer_id=current_user["id"],
            recipient_id=str(req["user_id"]),
            content=content,
            rating=rating,
        )

        try:
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("give_feedback")
            if rule and not await gam.check_daily_limit(current_user["id"], "give_feedback"):
                await gam.award_points(
                    user_id=current_user["id"],
                    action_type="give_feedback",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    rule_id=str(rule["id"]),
                    action_id=str(feedback["id"]),
                    community_id=str(req["community_id"]) if req.get("community_id") else None,
                    description="Gave peer feedback",
                )
        except Exception:
            logger.debug("Failed to award points for give_feedback", exc_info=True)

        return {
            "feedback": {
                "id": str(feedback["id"]),
                "content": feedback["content"],
                "rating": feedback.get("rating"),
                "created_at": feedback["created_at"].isoformat() if feedback.get("created_at") else None,
            },
            "message": "Feedback submitted",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/responses/{feedback_id}/helpful")
async def mark_feedback_helpful(
    feedback_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        feedback = await db.fetchrow(
            "SELECT * FROM peer_feedback WHERE id = $1", feedback_id
        )
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")
        if str(feedback["recipient_id"]) != str(current_user["id"]):
            raise HTTPException(status_code=403, detail="Only the feedback recipient can mark it as helpful")
        if feedback.get("is_helpful"):
            return {"message": "Already marked as helpful"}

        await db.execute(
            "UPDATE peer_feedback SET is_helpful = TRUE WHERE id = $1", feedback_id
        )

        try:
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("feedback_helpful")
            reviewer_id = str(feedback["reviewer_id"])
            if rule and not await gam.check_daily_limit(reviewer_id, "feedback_helpful"):
                community_id = None
                if feedback.get("feedback_request_id"):
                    req = await db.fetchrow(
                        "SELECT community_id FROM feedback_requests WHERE id = $1",
                        feedback["feedback_request_id"],
                    )
                    if req and req.get("community_id"):
                        community_id = str(req["community_id"])
                await gam.award_points(
                    user_id=reviewer_id,
                    action_type="feedback_helpful",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    rule_id=str(rule["id"]),
                    action_id=feedback_id,
                    community_id=community_id,
                    description="Your feedback was marked as helpful",
                )
        except Exception:
            logger.debug("Failed to award points for feedback_helpful", exc_info=True)

        return {"message": "Feedback marked as helpful"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
