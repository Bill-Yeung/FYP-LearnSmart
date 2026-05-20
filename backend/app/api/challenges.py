"""API router for challenges (UC-608, UC-609)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
import logging

from app.core.dependencies import get_current_user
from app.core.database import get_postgres, postgres_db
from app.repositories.challenge_repository import ChallengeRepository
from app.repositories.gamification_repository import GamificationRepository
from app.services.ai.challenge_scorer import score_submission as ai_score_submission
from app.services.infrastructure.task_queue_manager import task_queue_manager, QueueType

class CriterionItem(BaseModel):
    name: str
    description: str = ""
    weight: int = 25

class CreateChallengeRequest(BaseModel):
    title: str
    challenge_type: str
    starts_at: str
    ends_at: str
    community_id: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    max_participants: Optional[int] = None
    winner_points: Optional[int] = None
    participant_points: Optional[int] = None
    judging_criteria: Optional[List[CriterionItem]] = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/challenges", tags=["Challenges"])

async def _score_in_background(
    submission_id: str,
    challenge_title: str,
    challenge_description: str | None,
    challenge_instructions: str | None,
    challenge_type: str,
    judging_criteria: list[dict] | None,
    submission_title: str,
    submission_description: str | None,
):

    try:
        result = await ai_score_submission(
            challenge_title=challenge_title,
            challenge_description=challenge_description,
            challenge_instructions=challenge_instructions,
            challenge_type=challenge_type,
            judging_criteria=judging_criteria,
            submission_title=submission_title,
            submission_description=submission_description,
        )
        async with postgres_db.pool.acquire() as conn:
            repo = ChallengeRepository(conn)
            await repo.score_submission(
                submission_id=submission_id,
                scores=json.dumps(result["scores"]),
                final_score=result["final_score"],
                feedback=result["feedback"],
            )
        logger.info("Background AI scoring completed for submission %s", submission_id)
    except Exception:
        logger.warning("Background AI scoring failed for submission %s", submission_id, exc_info=True)

def _format_challenge(row: dict, user_id: str | None = None, participant=None, submission=None) -> dict:
    c = {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "instructions": row.get("instructions"),
        "challenge_type": row["challenge_type"],
        "status": row["status"],
        "starts_at": row["starts_at"].isoformat() if row.get("starts_at") else None,
        "ends_at": row["ends_at"].isoformat() if row.get("ends_at") else None,
        "max_participants": row.get("max_participants"),
        "participant_count": row.get("participant_count", 0),
        "submission_count": row.get("submission_count", 0),
        "rewards": json.loads(row["rewards"]) if isinstance(row.get("rewards"), str) else row.get("rewards"),
        "judging_criteria": json.loads(row["judging_criteria"]) if isinstance(row.get("judging_criteria"), str) else row.get("judging_criteria"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "is_joined": participant is not None,
    }
    if row.get("community_name"):
        c["community"] = {
            "id": str(row["community_id"]) if row.get("community_id") else None,
            "name": row["community_name"],
        }
    if submission:
        c["my_submission"] = {
            "title": submission.get("title"),
            "description": submission.get("description"),
            "submitted_at": submission["submitted_at"].isoformat() if submission.get("submitted_at") else None,
            "score": float(submission["final_score"]) if submission.get("final_score") is not None else None,
            "scores": submission.get("scores"),
            "feedback": submission.get("judge_feedback"),
            "status": submission["status"],
        }
    return c

@router.get("")
async def list_challenges(
    status: Optional[str] = Query(None),
    joined: Optional[bool] = Query(None),
    community_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ChallengeRepository(db)

        from datetime import datetime
        expired = await db.fetch(
            "SELECT id FROM challenges WHERE status = 'active' AND ends_at < $1",
            datetime.utcnow(),
        )
        for row in expired:
            await _auto_finalize_expired(db, str(row["id"]))

        rows = await repo.list_challenges(
            community_id=community_id,
            status=status,
            user_id=current_user["id"],
            joined_only=bool(joined),
            page=page,
            page_size=page_size,
        )
        total = await repo.count_challenges(
            community_id=community_id,
            status=status,
            user_id=current_user["id"],
            joined_only=bool(joined),
        )

        challenges = []
        for row in rows:
            participant = await repo.get_participant(row["id"], current_user["id"])
            submission = await repo.get_user_submission(row["id"], current_user["id"]) if participant else None
            challenges.append(_format_challenge(row, current_user["id"], participant, submission))

        return {"challenges": challenges, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{challenge_id}")
async def get_challenge(
    challenge_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ChallengeRepository(db)
        challenge = await repo.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

        participant = await repo.get_participant(challenge_id, current_user["id"])
        submission = await repo.get_user_submission(challenge_id, current_user["id"]) if participant else None
        return {"challenge": _format_challenge(challenge, current_user["id"], participant, submission)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_challenge(
    data: CreateChallengeRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ChallengeRepository(db)
        rewards_json = None
        if data.winner_points or data.participant_points:
            rewards_json = json.dumps({"winner_points": data.winner_points or 0, "participant_points": data.participant_points or 0})

        criteria_json = None
        if data.judging_criteria:
            criteria_json = json.dumps([c.model_dump() for c in data.judging_criteria])

        def parse_iso_naive(s: str) -> datetime:
            s = s.replace("Z", "").replace("+00:00", "")
            return datetime.fromisoformat(s)

        starts_at_dt = parse_iso_naive(data.starts_at)
        ends_at_dt = parse_iso_naive(data.ends_at)

        now = datetime.utcnow()
        if ends_at_dt <= now:
            initial_status = "completed"
        elif starts_at_dt <= now:
            initial_status = "active"
        else:
            initial_status = "upcoming"

        challenge = await repo.create_challenge(
            community_id=data.community_id,
            created_by=current_user["id"],
            title=data.title,
            challenge_type=data.challenge_type,
            starts_at=starts_at_dt,
            ends_at=ends_at_dt,
            status=initial_status,
            description=data.description,
            instructions=data.instructions,
            max_participants=data.max_participants,
            rewards=rewards_json,
            judging_criteria=criteria_json,
        )
        return {"challenge": _format_challenge(challenge, current_user["id"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{challenge_id}/join")
async def join_challenge(
    challenge_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ChallengeRepository(db)
        challenge = await repo.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        if challenge["status"] not in ("upcoming", "active"):
            raise HTTPException(status_code=400, detail="Challenge is not open for joining")

        await repo.join_challenge(challenge_id, current_user["id"])
        return {"message": "Joined challenge"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{challenge_id}/submissions")
async def submit_to_challenge(
    challenge_id: str,
    title: str = Query(...),
    description: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ChallengeRepository(db)
        challenge = await repo.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        if challenge["status"] != "active":
            raise HTTPException(status_code=400, detail="Challenge is not active")

        participant = await repo.get_participant(challenge_id, current_user["id"])
        if not participant:
            raise HTTPException(status_code=400, detail="You must join the challenge first")

        submission = await repo.create_submission(
            challenge_id=challenge_id,
            user_id=current_user["id"],
            title=title,
            description=description,
        )

        try:
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("challenge_complete")
            if rule and not await gam.check_daily_limit(current_user["id"], "challenge_complete"):
                await gam.award_points(
                    user_id=current_user["id"],
                    action_type="challenge_complete",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    rule_id=str(rule["id"]),
                    action_id=str(submission["id"]),
                    community_id=str(challenge["community_id"]) if challenge.get("community_id") else None,
                    description=f"Submitted to challenge: {challenge['title']}",
                )
        except Exception:
            logger.debug("Failed to award points for challenge_complete", exc_info=True)

        try:
            criteria = challenge.get("judging_criteria")
            if isinstance(criteria, str):
                criteria = json.loads(criteria)

            task_queue_manager.submit_task(
                QueueType.AI_GENERATION,
                _score_in_background,
                submission_id=str(submission["id"]),
                challenge_title=challenge["title"],
                challenge_description=challenge.get("description"),
                challenge_instructions=challenge.get("instructions"),
                challenge_type=challenge["challenge_type"],
                judging_criteria=criteria,
                submission_title=title,
                submission_description=description,
            )
        except Exception:
            logger.warning("Failed to enqueue AI scoring for submission %s", submission["id"], exc_info=True)

        return {
            "submission": {
                "id": str(submission["id"]),
                "title": submission["title"],
                "status": submission["status"],
                "submitted_at": submission["submitted_at"].isoformat() if submission.get("submitted_at") else None,
                "score": None,
                "scores": None,
                "feedback": None,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{challenge_id}/submissions")
async def list_submissions(
    challenge_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ChallengeRepository(db)
        challenge = await repo.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

        rows = await repo.list_submissions(challenge_id)
        submissions = []
        for row in rows:
            submissions.append({
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "username": row.get("username"),
                "display_name": row.get("display_name"),
                "title": row["title"],
                "description": row.get("description"),
                "score": float(row["final_score"]) if row.get("final_score") else None,
                "scores": row.get("scores"),
                "feedback": row.get("judge_feedback"),
                "status": row["status"],
                "submitted_at": row["submitted_at"].isoformat() if row.get("submitted_at") else None,
            })
        return {"submissions": submissions, "total": len(submissions)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{challenge_id}/finalize")
async def finalize_challenge(
    challenge_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    if current_user.get("role") not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Only admins can finalize challenges")
    try:
        repo = ChallengeRepository(db)
        challenge = await repo.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

        result = await repo.finalize_challenge(challenge_id)

        if result["rankings"]:
            winner = result["rankings"][0]
            try:
                gam = GamificationRepository(db)
                rule = await gam.get_point_rule("challenge_win")
                if rule:
                    await gam.award_points(
                        user_id=winner["user_id"],
                        action_type="challenge_win",
                        points=rule["points_awarded"],
                        point_type_id=str(rule["point_type_id"]),
                        community_id=str(challenge["community_id"]) if challenge.get("community_id") else None,
                        description=f"Won challenge: {challenge['title']}",
                    )
            except Exception:
                pass

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _auto_finalize_expired(db, challenge_id: str):

    try:
        repo = ChallengeRepository(db)
        result = await repo.finalize_challenge(challenge_id)
        if result["rankings"]:
            winner = result["rankings"][0]
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("challenge_win")
            if rule:
                challenge = result["challenge"]
                await gam.award_points(
                    user_id=winner["user_id"],
                    action_type="challenge_win",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    community_id=str(challenge["community_id"]) if challenge.get("community_id") else None,
                    description=f"Won challenge: {challenge['title']}",
                )
    except Exception:
        pass
