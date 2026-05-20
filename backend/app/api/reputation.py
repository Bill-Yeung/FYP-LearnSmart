from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.reputation_repository import ReputationRepository

router = APIRouter(prefix="/reputation", tags=["Reputation"])

@router.get("/me")
async def get_my_reputation(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ReputationRepository(db)
        rep = await repo.get_user_reputation(current_user["id"])
        total_score = rep["total_score"] if rep else 0

        current_level = await repo.get_reputation_level(total_score)
        next_level = await repo.get_next_level(total_score)
        rank_percentile = await repo.get_rank_percentile(current_user["id"])

        level_info = {
            "level": 1,
            "level_name": "Newcomer",
        }
        if current_level:
            level_info["level"] = current_level.get("id", 1)
            level_info["level_name"] = current_level["name"]

        points_to_next = 0
        next_level_name = None
        if next_level:
            points_to_next = max(0, next_level["min_score"] - total_score)
            next_level_name = next_level["name"]

        return {
            "total_score": total_score,
            **level_info,
            "next_level_name": next_level_name,
            "points_to_next": points_to_next,
            "rank_percentile": rank_percentile,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me/breakdown")
async def get_reputation_breakdown(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ReputationRepository(db)
        breakdown = await repo.get_breakdown(current_user["id"])
        return {"breakdown": breakdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me/events")
async def get_reputation_events(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ReputationRepository(db)
        events = await repo.list_events(current_user["id"], limit=limit, offset=offset)
        formatted = []
        for e in events:
            formatted.append({
                "id": str(e["id"]),
                "event_type": e["event_type"],
                "dimension": e["dimension"],
                "points_change": e["points_change"],
                "created_at": e["created_at"].isoformat() if e.get("created_at") else None,
            })
        return {"events": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/levels")
async def get_reputation_levels(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ReputationRepository(db)
        levels = await repo.get_all_levels()
        formatted = []
        for lv in levels:
            formatted.append({
                "id": lv.get("id"),
                "name": lv["name"],
                "url_id": lv["url_id"],
                "min_score": lv["min_score"],
                "max_score": lv.get("max_score"),
                "icon": lv.get("icon"),
                "color": lv.get("color"),
                "privileges": lv.get("privileges"),
            })
        return {"levels": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
