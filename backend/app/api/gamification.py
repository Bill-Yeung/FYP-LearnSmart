from fastapi import APIRouter, Body, Depends, HTTPException, Query
from typing import Optional

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.gamification_repository import GamificationRepository

router = APIRouter(prefix="/gamification", tags=["Gamification"])

@router.get("/points/summary")
async def get_points_summary(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)
        summary = await repo.get_points_summary(current_user["id"])
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/points/history")
async def get_points_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)
        offset = (page - 1) * page_size
        transactions = await repo.get_points_history(current_user["id"], limit=page_size, offset=offset)
        total = await repo.count_points_history(current_user["id"])

        result = []
        for t in transactions:
            result.append({
                "id": str(t["id"]),
                "points": t["points"],
                "action_type": t["action_type"],
                "description": t.get("description"),
                "point_type_name": t.get("point_type_name"),
                "icon": t.get("icon"),
                "color": t.get("color"),
                "created_at": t["created_at"].isoformat() if t.get("created_at") else None,
            })

        return {"transactions": result, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/streak")
async def record_daily_activity(
    streak_type: str = Query("daily_study", regex="^(daily_study|weekly_share)$"),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)
        result = await repo.update_streak(current_user["id"], streak_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/badges")
async def get_badges(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)
        try:
            await repo.check_and_award_badges(current_user["id"])
        except Exception:
            pass
        badges = await repo.get_all_badges(current_user["id"])

        result = []
        for b in badges:
            result.append({
                "id": str(b["id"]),
                "name": b["name"],
                "url_id": b["url_id"],
                "description": b.get("description"),
                "icon_url": b.get("icon_url"),
                "color": b.get("color"),
                "rarity": b.get("rarity"),
                "badge_type": b["badge_type"],
                "criteria": b.get("criteria"),
                "points_awarded": b.get("points_awarded", 0),
                "is_secret": b.get("is_secret", False),
                "earned": b.get("earned", False),
                "earned_at": b["earned_at"].isoformat() if b.get("earned_at") else None,
            })

        return {"badges": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/leaderboard")
async def get_leaderboard(
    community_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)

        if community_id:
            leaders = await repo.get_community_leaderboard(community_id, limit=limit)
            entries = [
                {
                    "rank": i + 1,
                    "user_id": str(l["user_id"]),
                    "username": l["username"],
                    "display_name": l.get("display_name"),
                    "points": l["contribution_points"],
                    "name_color": l.get("name_color"),
                    "profile_border": l.get("profile_border"),
                }
                for i, l in enumerate(leaders)
            ]
        else:
            leaders = await repo.get_global_leaderboard(limit=limit)
            entries = [
                {
                    "rank": i + 1,
                    "user_id": str(l["user_id"]),
                    "username": l["username"],
                    "display_name": l.get("display_name"),
                    "points": l["total_earned"],
                    "name_color": l.get("name_color"),
                    "profile_border": l.get("profile_border"),
                }
                for i, l in enumerate(leaders)
            ]

        return {"leaderboard": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shop")
async def get_shop_items(
    category: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)
        items = await repo.get_shop_items(category=category, user_id=current_user["id"])

        ONE_TIME_TYPES = {"profile_border", "name_color", "avatar", "emoji_pack"}

        result = []
        for item in items:
            owned_qty = item.get("owned_quantity", 0)
            result.append({
                "id": str(item["id"]),
                "name": item["name"],
                "url_id": item["url_id"],
                "description": item.get("description"),
                "price": item["price"],
                "category": item["category"],
                "item_type": item["item_type"],
                "icon": item.get("icon"),
                "preview_url": item.get("preview_url"),
                "is_giftable": item.get("is_giftable", False),
                "is_limited": item.get("is_limited", False),
                "stock_count": item.get("stock_count"),
                "owned": owned_qty > 0,
                "is_one_time": item["item_type"] in ONE_TIME_TYPES,
                "item_value": item.get("item_value"),
            })

        return {"items": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/shop/{item_id}/purchase")
async def purchase_item(
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)
        purchase = await repo.purchase_item(current_user["id"], item_id)
        return {
            "purchase": {
                "id": str(purchase["id"]),
                "price_paid": purchase["price_paid"],
                "status": purchase["status"],
            },
            "message": "Purchase successful",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/shop/{item_id}/gift")
async def gift_item(
    item_id: str,
    to_user_id: str = Query(...),
    message: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    if current_user["id"] == to_user_id:
        raise HTTPException(status_code=400, detail="Cannot gift to yourself")
    try:
        repo = GamificationRepository(db)
        purchase = await repo.gift_item(current_user["id"], to_user_id, item_id, message)
        return {
            "purchase": {"id": str(purchase["id"]), "price_paid": purchase["price_paid"]},
            "message": "Gift sent successfully",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/appreciate")
async def send_appreciation(
    to_user_id: str = Query(...),
    coins: int = Query(..., ge=1, le=1000),
    appreciation_type: str = Query("general", regex="^(mentoring|feedback|content|answer|general)$"),
    message: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    if current_user["id"] == to_user_id:
        raise HTTPException(status_code=400, detail="Cannot appreciate yourself")
    try:
        repo = GamificationRepository(db)
        if not await repo.has_item(current_user["id"], "appreciation"):
            raise HTTPException(status_code=402, detail="You need the Send Appreciation item. Purchase one from the Rewards Shop.")
        result = await repo.send_appreciation(current_user["id"], to_user_id, coins, appreciation_type, message)
        return {
            "appreciation": {"id": str(result["id"]), "coins_given": result["coins_given"]},
            "message": f"Sent {coins} coins",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/boosts")
async def get_active_boosts(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        rows = await db.fetch(
            """
            SELECT ab.*, si.name AS item_name
            FROM active_boosts ab
            LEFT JOIN shop_items si ON si.id = ab.source_id
            WHERE (ab.user_id = $1 OR ab.community_id IN (
                SELECT community_id FROM community_members WHERE user_id = $1 AND status = 'active'
            ))
            AND ab.is_active = TRUE AND ab.expires_at > NOW()
            ORDER BY ab.expires_at ASC
            """,
            current_user["id"],
        )
        return {
            "boosts": [
                {
                    "id": str(r["id"]),
                    "scope": r["scope"],
                    "boost_type": r["boost_type"],
                    "boost_value": r["boost_value"],
                    "item_name": r.get("item_name"),
                    "expires_at": r["expires_at"].isoformat() if r.get("expires_at") else None,
                }
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/inventory")
async def get_inventory(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        rows = await db.fetch(
            """
            SELECT si.name, si.url_id, si.item_type, si.icon, si.category,
                   ui.quantity
            FROM user_inventory ui
            JOIN shop_items si ON si.id = ui.shop_item_id
            WHERE ui.user_id = $1 AND ui.quantity > 0
            ORDER BY si.category, si.name
            """,
            current_user["id"],
        )
        return {
            "items": [
                {
                    "name": r["name"],
                    "url_id": r["url_id"],
                    "item_type": r["item_type"],
                    "icon": r.get("icon"),
                    "category": r["category"],
                    "quantity": r["quantity"],
                }
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cosmetics/equip")
async def equip_cosmetic(
    cosmetic_type: str = Query(..., regex="^(profile_border|name_color)$"),
    value: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = GamificationRepository(db)
        result = await repo.equip_cosmetic(current_user["id"], cosmetic_type, value)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
