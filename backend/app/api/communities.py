from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.community_repository import CommunityRepository
from app.repositories.activity_feed_repository import ActivityFeedRepository
from app.repositories.gamification_repository import GamificationRepository

router = APIRouter(prefix="/communities", tags=["Communities"])

def _format_community(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "url_id": row["url_id"],
        "description": row.get("description"),
        "community_type": row["community_type"],
        "max_members": row.get("max_members"),
        "avatar_url": row.get("avatar_url"),
        "banner_url": row.get("banner_url"),
        "color_theme": row.get("color_theme"),
        "features_enabled": row.get("features_enabled"),
        "member_count": row.get("member_count", 0),
        "resource_count": row.get("resource_count", 0),
        "activity_score": row.get("activity_score", 0),
        "created_by": str(row["created_by"]) if row.get("created_by") else None,
        "creator_username": row.get("creator_username"),
        "creator_display_name": row.get("creator_display_name"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }

@router.get("")
async def list_communities(
    filter: str = Query("discover", regex="^(my|discover)$"),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        offset = (page - 1) * page_size
        communities = await repo.list_communities(
            user_id=current_user["id"],
            filter_mode=filter,
            search=search,
            limit=page_size,
            offset=offset,
        )
        total = await repo.count_communities(
            user_id=current_user["id"],
            filter_mode=filter,
            search=search,
        )

        result = []
        for c in communities:
            formatted = _format_community(c)
            member = await repo.get_member(c["id"], current_user["id"])
            is_active = bool(member and member["status"] == "active" and member["role"] != "pending")
            formatted["is_member"] = is_active
            formatted["my_role"] = member["role"] if is_active else None
            formatted["is_pending"] = bool(member and member["status"] == "active" and member["role"] == "pending")
            invitation = await repo.get_user_invitation(c["id"], current_user["id"])
            formatted["is_invited"] = bool(invitation)
            formatted["invitation_id"] = str(invitation["id"]) if invitation else None
            result.append(formatted)

        return {"communities": result, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def create_community(
    name: str,
    description: Optional[str] = None,
    community_type: str = "public",
    max_members: Optional[int] = None,
    color_theme: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.create_community(
            name=name,
            description=description,
            community_type=community_type,
            created_by=current_user["id"],
            max_members=max_members,
            color_theme=color_theme,
        )
        return {"community": _format_community(community)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me/invitations")
async def get_my_invitations(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        invitations = await repo.get_user_invitations(current_user["id"])
        return {
            "invitations": [
                {
                    "id": str(inv["id"]),
                    "community_id": str(inv["community_id"]),
                    "community_name": inv["community_name"],
                    "community_url_id": inv["community_url_id"],
                    "community_description": inv.get("community_description"),
                    "community_type": inv.get("community_type"),
                    "member_count": inv.get("member_count", 0),
                    "color_theme": inv.get("color_theme"),
                    "invited_by": {
                        "username": inv["invited_by_username"],
                        "display_name": inv.get("invited_by_display_name"),
                    },
                    "message": inv.get("message"),
                    "created_at": inv["created_at"].isoformat() if inv.get("created_at") else None,
                }
                for inv in invitations
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/me/invitations/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        inv = await db.fetchrow(
            "SELECT * FROM community_invitations WHERE id = $1 AND invited_user_id = $2 AND status = 'pending'",
            invitation_id, current_user["id"],
        )
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found")
        await repo.accept_invitation(invitation_id)
        await repo.join_community(str(inv["community_id"]), current_user["id"])

        try:
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("successful_invite")
            if rule and not await gam.check_daily_limit(str(inv["invited_by"]), "successful_invite"):
                await gam.award_points(
                    user_id=str(inv["invited_by"]),
                    action_type="successful_invite",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    rule_id=str(rule["id"]),
                    community_id=str(inv["community_id"]),
                    description=f"Invited user joined the community",
                )
        except Exception:
            pass

        try:
            comm = await db.fetchrow("SELECT name FROM communities WHERE id = $1", inv["community_id"])
            af = ActivityFeedRepository(db)
            await af.create_activity(
                actor_id=current_user["id"],
                activity_type="joined_community",
                entity_type="community",
                entity_id=str(inv["community_id"]),
                entity_preview={"description": f"Joined {comm['name']}" if comm else None},
                community_id=str(inv["community_id"]),
            )
        except Exception:
            pass

        return {"message": "Invitation accepted. You are now a member!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/me/invitations/{invitation_id}/decline")
async def decline_invitation(
    invitation_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        inv = await db.fetchrow(
            "SELECT * FROM community_invitations WHERE id = $1 AND invited_user_id = $2 AND status = 'pending'",
            invitation_id, current_user["id"],
        )
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found")
        await repo.decline_invitation(invitation_id)
        return {"message": "Invitation declined"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{url_id}")
async def get_community(
    url_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        formatted = _format_community(community)
        member = await repo.get_member(community["id"], current_user["id"])
        is_active = bool(member and member["status"] == "active" and member["role"] != "pending")
        formatted["is_member"] = is_active
        formatted["my_role"] = member["role"] if is_active else None
        formatted["is_pending"] = bool(member and member["status"] == "active" and member["role"] == "pending")

        invitation = await repo.get_user_invitation(community["id"], current_user["id"])
        formatted["is_invited"] = bool(invitation)
        formatted["invitation_id"] = str(invitation["id"]) if invitation else None

        if is_active and member["role"] in ("owner", "admin", "moderator"):
            formatted["pending_count"] = await repo.count_pending_members(community["id"])
        else:
            formatted["pending_count"] = 0
        return {"community": formatted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{url_id}")
async def update_community(
    url_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    community_type: Optional[str] = None,
    max_members: Optional[int] = None,
    color_theme: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        role = await repo.get_member_role(community["id"], current_user["id"])
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Only owners and admins can update the community")

        updated = await repo.update_community(url_id, {
            "name": name,
            "description": description,
            "community_type": community_type,
            "max_members": max_members,
            "color_theme": color_theme,
        })
        return {"community": _format_community(updated)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{url_id}/join")
async def join_community(
    url_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        ctype = community.get("community_type", "public")

        existing = await repo.get_member(community["id"], current_user["id"])
        if existing and existing["status"] == "active" and existing["role"] != "pending":
            raise HTTPException(status_code=400, detail="Already a member")

        if community.get("max_members") and community["member_count"] >= community["max_members"]:
            raise HTTPException(status_code=400, detail="Community is full")

        if ctype == "invite_only":

            invitation = await repo.get_user_invitation(community["id"], current_user["id"])
            if not invitation:
                raise HTTPException(status_code=403, detail="This community is invite-only. You need an invitation to join.")

            await repo.accept_invitation(str(invitation["id"]))
            if existing and existing["role"] == "pending":
                await repo.approve_member(community["id"], current_user["id"])
            else:
                await repo.join_community(community["id"], current_user["id"])

            try:
                gam = GamificationRepository(db)
                rule = await gam.get_point_rule("successful_invite")
                if rule and not await gam.check_daily_limit(str(invitation["invited_by"]), "successful_invite"):
                    await gam.award_points(
                        user_id=str(invitation["invited_by"]),
                        action_type="successful_invite",
                        points=rule["points_awarded"],
                        point_type_id=str(rule["point_type_id"]),
                        rule_id=str(rule["id"]),
                        community_id=str(community["id"]),
                        description=f"Invited user joined the community",
                    )
            except Exception:
                pass

            try:
                af = ActivityFeedRepository(db)
                await af.create_activity(
                    actor_id=current_user["id"],
                    activity_type="joined_community",
                    entity_type="community",
                    entity_id=str(community["id"]),
                    entity_preview={"description": f"Joined {community.get('name', '')}"},
                    community_id=str(community["id"]),
                )
            except Exception:
                pass

            return {"message": "Invitation accepted. You are now a member!"}

        if ctype == "private":
            raise HTTPException(status_code=403, detail="This community requires approval. Use the apply endpoint instead.")

        await repo.join_community(community["id"], current_user["id"])

        try:
            af = ActivityFeedRepository(db)
            await af.create_activity(
                actor_id=current_user["id"],
                activity_type="joined_community",
                entity_type="community",
                entity_id=str(community["id"]),
                entity_preview={"description": f"Joined {community.get('name', '')}"},
                community_id=str(community["id"]),
            )
        except Exception:
            pass

        return {"message": "Joined community successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{url_id}/apply")
async def apply_to_community(
    url_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        existing = await repo.get_member(community["id"], current_user["id"])
        if existing and existing["status"] == "active" and existing["role"] != "pending":
            raise HTTPException(status_code=400, detail="Already a member")
        if existing and existing["role"] == "pending":
            raise HTTPException(status_code=400, detail="You already have a pending application")

        if community.get("max_members") and community["member_count"] >= community["max_members"]:
            raise HTTPException(status_code=400, detail="Community is full")

        await repo.add_pending_member(community["id"], current_user["id"])
        return {"message": "Application submitted. Waiting for admin approval."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{url_id}/leave")
async def leave_community(
    url_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        role = await repo.get_member_role(community["id"], current_user["id"])
        if not role:
            raise HTTPException(status_code=400, detail="Not a member")
        if role == "owner":
            raise HTTPException(status_code=400, detail="Owner cannot leave. Transfer ownership first.")

        await repo.leave_community(community["id"], current_user["id"])
        return {"message": "Left community successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{url_id}/members")
async def list_members(
    url_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        offset = (page - 1) * page_size
        members = await repo.get_members(community["id"], limit=page_size, offset=offset)
        total = await repo.count_members(community["id"])

        result = []
        for m in members:
            result.append({
                "user_id": str(m["user_id"]),
                "username": m["username"],
                "display_name": m.get("display_name"),
                "role": m["role"],
                "contribution_points": m.get("contribution_points", 0),
                "joined_at": m["joined_at"].isoformat() if m.get("joined_at") else None,
            })

        return {"members": result, "total": total}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{url_id}/pending")
async def list_pending_members(
    url_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        role = await repo.get_member_role(community["id"], current_user["id"])
        if role not in ("owner", "admin", "moderator"):
            raise HTTPException(status_code=403, detail="Only owners, admins and moderators can view pending members")

        offset = (page - 1) * page_size
        pending = await repo.get_pending_members(community["id"], limit=page_size, offset=offset)
        total = await repo.count_pending_members(community["id"])

        pending_invitations = await db.fetch(
            """
            SELECT ci.*, u.username, u.display_name,
                   inv.username as invited_by_username, inv.display_name as invited_by_display_name
            FROM community_invitations ci
            JOIN users u ON ci.invited_user_id = u.id
            JOIN users inv ON ci.invited_by = inv.id
            WHERE ci.community_id = $1 AND ci.status = 'pending'
            ORDER BY ci.created_at DESC
            """,
            community["id"],
        )

        result = []
        for m in pending:
            result.append({
                "user_id": str(m["user_id"]),
                "username": m["username"],
                "display_name": m.get("display_name"),
                "applied_at": m["joined_at"].isoformat() if m.get("joined_at") else None,
                "type": "application",
            })

        invited_user_ids = set()
        for inv in pending_invitations:
            uid = str(inv["invited_user_id"])
            if uid in {r["user_id"] for r in result}:
                continue
            invited_user_ids.add(uid)
            result.append({
                "user_id": uid,
                "username": inv["username"],
                "display_name": inv.get("display_name"),
                "applied_at": inv["created_at"].isoformat() if inv.get("created_at") else None,
                "type": "invitation",
                "invited_by": inv.get("invited_by_display_name") or inv.get("invited_by_username"),
            })

        return {"pending": result, "total": total + len(invited_user_ids)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{url_id}/members/{user_id}/approve")
async def approve_member(
    url_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        role = await repo.get_member_role(community["id"], current_user["id"])
        if role not in ("owner", "admin", "moderator"):
            raise HTTPException(status_code=403, detail="Only owners, admins and moderators can approve members")

        result = await repo.approve_member(community["id"], user_id)
        if not result:
            raise HTTPException(status_code=404, detail="No pending application found for this user")

        return {"message": "Member approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{url_id}/members/{user_id}/reject")
async def reject_member(
    url_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        role = await repo.get_member_role(community["id"], current_user["id"])
        if role not in ("owner", "admin", "moderator"):
            raise HTTPException(status_code=403, detail="Only owners, admins and moderators can reject members")

        result = await repo.reject_member(community["id"], user_id)
        if not result:
            raise HTTPException(status_code=404, detail="No pending application found for this user")

        return {"message": "Application rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{url_id}/invite")
async def invite_user(
    url_id: str,
    username: str = Query(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        role = await repo.get_member_role(community["id"], current_user["id"])
        if role not in ("owner", "admin", "moderator"):
            raise HTTPException(status_code=403, detail="Only owners, admins and moderators can invite others")

        target = await db.fetchrow(
            "SELECT id FROM users WHERE username = $1 AND is_active = TRUE",
            username,
        )
        if not target:
            raise HTTPException(status_code=404, detail=f"User '{username}' not found")

        target_id = str(target["id"])

        existing = await repo.get_member(community["id"], target_id)
        if existing and existing["status"] == "active" and existing["role"] != "pending":
            raise HTTPException(status_code=400, detail=f"{username} is already a member")

        if community.get("max_members") and community["member_count"] >= community["max_members"]:
            raise HTTPException(status_code=400, detail="Community is full")

        existing_invite = await repo.get_user_invitation(community["id"], target_id)
        if existing_invite:
            raise HTTPException(status_code=400, detail=f"{username} already has a pending invitation")

        await repo.create_invitation(
            community_id=community["id"],
            invited_by=current_user["id"],
            invited_user_id=target_id,
        )
        return {"message": f"Invitation sent to {username}. They must accept to join."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{url_id}/members/{user_id}/role")
async def update_member_role(
    url_id: str,
    user_id: str,
    role: str = Query(..., regex="^(admin|moderator|member)$"),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        my_role = await repo.get_member_role(community["id"], current_user["id"])
        target_role = await repo.get_member_role(community["id"], user_id)

        if not target_role:
            raise HTTPException(status_code=404, detail="User is not a member")
        if target_role == "owner":
            raise HTTPException(status_code=400, detail="Cannot change the owner's role")
        if current_user["id"] == user_id:
            raise HTTPException(status_code=400, detail="Cannot change your own role")

        if my_role == "owner":
            pass
        elif my_role == "admin":
            if role == "admin":
                raise HTTPException(status_code=403, detail="Only the owner can promote to admin")
            if target_role == "admin":
                raise HTTPException(status_code=403, detail="Cannot change another admin's role")
        else:
            raise HTTPException(status_code=403, detail="Only owners and admins can manage roles")

        await repo.update_member_role(community["id"], user_id, role)
        return {"message": f"Role updated to {role}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{url_id}/transfer-ownership")
async def transfer_ownership(
    url_id: str,
    new_owner_id: str = Query(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        my_role = await repo.get_member_role(community["id"], current_user["id"])
        if my_role != "owner":
            raise HTTPException(status_code=403, detail="Only the owner can transfer ownership")

        target_role = await repo.get_member_role(community["id"], new_owner_id)
        if not target_role:
            raise HTTPException(status_code=404, detail="Target user is not a member")

        await repo.transfer_ownership(community["id"], current_user["id"], new_owner_id)
        return {"message": "Ownership transferred successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{url_id}/members/{user_id}")
async def remove_member(
    url_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        my_role = await repo.get_member_role(community["id"], current_user["id"])
        target_role = await repo.get_member_role(community["id"], user_id)

        if not target_role:
            raise HTTPException(status_code=404, detail="User is not a member")
        if target_role == "owner":
            raise HTTPException(status_code=400, detail="Cannot remove the owner")
        if current_user["id"] == user_id:
            raise HTTPException(status_code=400, detail="Cannot remove yourself")

        if my_role == "owner":
            pass
        elif my_role == "admin":
            if target_role == "admin":
                raise HTTPException(status_code=403, detail="Cannot remove another admin")
        else:
            raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

        await repo.remove_member(community["id"], user_id)
        return {"message": "Member removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{url_id}/leaderboard")
async def get_leaderboard(
    url_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = CommunityRepository(db)
        community = await repo.get_community_by_url_id(url_id)
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        leaders = await repo.get_leaderboard(community["id"], limit=limit)
        result = []
        for i, l in enumerate(leaders):
            result.append({
                "rank": i + 1,
                "user_id": str(l["user_id"]),
                "username": l["username"],
                "display_name": l.get("display_name"),
                "contribution_points": l["contribution_points"],
            })

        return {"leaderboard": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
