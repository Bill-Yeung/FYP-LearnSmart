from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.content_request_repository import ContentRequestRepository
from app.repositories.source_repository import SourceRepository

router = APIRouter(prefix="/content-requests", tags=["Content Requests"])

def _format_request(row: dict, is_voted: bool = False, contribution_count: int = 0) -> dict:
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "request_type": row["request_type"],
        "status": row["status"],
        "total_votes": row.get("total_votes", 0),
        "admin_response": row.get("admin_response"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "is_voted": is_voted,
        "contribution_count": contribution_count,
        "created_by": {
            "id": str(row["created_by"]),
            "name": row.get("creator_display_name") or row.get("creator_username") or "Unknown",
            "avatar_url": row.get("creator_avatar_url"),
        },
    }

def _format_contribution(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "content": row["content"],
        "resource_id": str(row["resource_id"]) if row.get("resource_id") else None,
        "resource_type": row.get("resource_type"),
        "user": {
            "id": str(row["user_id"]),
            "username": row.get("username"),
            "display_name": row.get("display_name"),
            "avatar_url": row.get("avatar_url"),
        },
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }

@router.get("")
async def list_content_requests(
    tab: str = Query("all", regex="^(all|my)$"),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ContentRequestRepository(db)
        rows = await repo.list_requests(
            tab=tab, user_id=current_user["id"],
            category=category, page=page, page_size=page_size,
        )
        total = await repo.count_requests(
            tab=tab, user_id=current_user["id"], category=category,
        )
        requests = []
        for r in rows:
            voted = await repo.has_voted(r["id"], current_user["id"])
            contrib_count = await repo.count_contributions(r["id"])
            requests.append(_format_request(r, is_voted=voted, contribution_count=contrib_count))

        return {"requests": requests, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{request_id}")
async def get_content_request(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ContentRequestRepository(db)
        row = await repo.get_request(request_id)
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")
        voted = await repo.has_voted(request_id, current_user["id"])
        contrib_count = await repo.count_contributions(request_id)
        return {"request": _format_request(row, is_voted=voted, contribution_count=contrib_count)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def create_content_request(
    title: str = Query(...),
    request_type: str = Query("content"),
    description: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ContentRequestRepository(db)
        row = await repo.create_request(
            created_by=current_user["id"],
            title=title,
            request_type=request_type,
            description=description,
        )
        return {"request": _format_request(row, is_voted=False)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{request_id}/vote")
async def toggle_vote(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ContentRequestRepository(db)
        row = await repo.get_request(request_id)
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")
        result = await repo.toggle_vote(request_id, current_user["id"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/resources")
async def search_resources(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(10, ge=1, le=30),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        results = []
        seen_ids: set = set()
        query = q.strip()
        pattern = f"%{query}%"
        user_id = current_user["id"]

        concept_rows = await db.fetch(
            """
            SELECT c.id, ct.title, ct.description, c.concept_type
            FROM concepts c
            JOIN concept_translations ct ON ct.concept_id = c.id AND ct.is_primary = true
            WHERE ct.title ILIKE $1 AND c.created_by = $2
            ORDER BY c.updated_at DESC
            LIMIT $3
            """,
            pattern, user_id, limit,
        )
        for r in concept_rows:
            cid = str(r["id"])
            if cid not in seen_ids:
                seen_ids.add(cid)
                results.append({
                    "id": cid,
                    "title": r["title"],
                    "description": r.get("description") or "",
                    "resource_type": r.get("concept_type") or "concept",
                    "source": "concept",
                    "author": None,
                })

        shared_rows = await db.fetch(
            """
            SELECT sc.id, sc.title, sc.description, sc.entity_type
            FROM shared_content sc
            WHERE sc.title ILIKE $1 AND sc.user_id = $2 AND sc.status = 'published'
            ORDER BY sc.created_at DESC
            LIMIT $3
            """,
            pattern, user_id, limit,
        )
        for r in shared_rows:
            sid = str(r["id"])
            if sid not in seen_ids:
                seen_ids.add(sid)
                results.append({
                    "id": sid,
                    "title": r["title"],
                    "description": r.get("description") or "",
                    "resource_type": r["entity_type"],
                    "source": "shared_content",
                    "author": None,
                })

        source_repo = SourceRepository(db)
        doc_rows, _ = await source_repo.search_keyword(
            user_id=user_id,
            query=query,
            title_only=True,
            document_type=None,
            status=None,
            subject_id=None,
            limit=limit,
            offset=0,
        )
        for r in doc_rows:
            did = str(r["id"])
            if did not in seen_ids:
                seen_ids.add(did)
                results.append({
                    "id": did,
                    "title": r.get("title") or r.get("document_name") or "Untitled",
                    "description": "",
                    "resource_type": "document",
                    "source": "document",
                    "author": None,
                })

        return {"results": results[:limit]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{request_id}/contributions")
async def list_contributions(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ContentRequestRepository(db)
        rows = await repo.list_contributions(request_id)
        return {"contributions": [_format_contribution(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{request_id}/contributions")
async def add_contribution(
    request_id: str,
    content: str = Query(...),
    resource_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ContentRequestRepository(db)
        row = await repo.get_request(request_id)
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")
        if row["status"] in ("completed", "declined"):
            raise HTTPException(status_code=400, detail="Request is already closed")
        contribution = await repo.add_contribution(
            request_id=request_id,
            user_id=current_user["id"],
            content=content,
            resource_id=resource_id,
            resource_type=resource_type,
        )
        return {"contribution": _format_contribution(contribution)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{request_id}/complete")
async def mark_complete(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ContentRequestRepository(db)
        result = await repo.mark_complete(request_id, current_user["id"])
        if not result:
            raise HTTPException(status_code=403, detail="Only the request creator can mark it complete")
        return {"message": "Request marked as completed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/contributions/save-resource")
async def save_contribution_resource(
    resource_id: str = Query(...),
    resource_type: str = Query(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        user_id = current_user["id"]

        if resource_type == "document":
            return {"message": "Use /api/documents/{id}/download to get the file"}

        shared = await db.fetchrow(
            "SELECT * FROM shared_content WHERE id = $1", resource_id
        )
        if shared:
            from app.repositories.shared_content_repository import SharedContentRepository
            repo = SharedContentRepository(db)
            already = await repo.has_saved(user_id, resource_id)
            if already:
                return {"message": "Already saved", "saved": True}
            entity_type = shared["entity_type"]
            entity_id = str(shared["entity_id"])
        else:
            entity_type = "concept"
            entity_id = resource_id

        forked_id = None

        if entity_type == "concept":
            src = await db.fetchrow("SELECT * FROM concepts WHERE id = $1", entity_id)
            if not src:
                raise HTTPException(status_code=404, detail="Concept not found")
            new_row = await db.fetchrow(
                """INSERT INTO concepts (concept_type, created_by, difficulty_level,
                   estimated_study_time_minutes, formula_latex, base_form, is_public)
                   VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING id""",
                src["concept_type"], user_id, src.get("difficulty_level"),
                src.get("estimated_study_time_minutes"), src.get("formula_latex"),
                src.get("base_form"),
            )
            forked_id = str(new_row["id"])
            translations = await db.fetch(
                "SELECT * FROM concept_translations WHERE concept_id = $1", entity_id
            )
            for t in translations:
                await db.execute(
                    """INSERT INTO concept_translations
                       (concept_id, language, title, description, keywords,
                        formula_plain_text, created_by, is_primary, translation_quality)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                       ON CONFLICT DO NOTHING""",
                    forked_id, t["language"], t["title"], t["description"],
                    t.get("keywords"), t.get("formula_plain_text"),
                    user_id, t.get("is_primary", False),
                    t.get("translation_quality", "source"),
                )

        if shared:
            await db.execute(
                """INSERT INTO content_downloads (user_id, content_id, action_type, forked_entity_id)
                   VALUES ($1, $2, 'save', $3) ON CONFLICT DO NOTHING""",
                user_id, resource_id, forked_id,
            )
            await db.execute(
                "UPDATE shared_content SET download_count = download_count + 1 WHERE id = $1",
                resource_id,
            )

        return {"message": "Saved to library", "saved": True, "forked_id": forked_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
