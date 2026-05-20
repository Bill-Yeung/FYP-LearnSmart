from fastapi import APIRouter, Depends, HTTPException, Body
from datetime import datetime, timedelta
import logging
from app.core.database import get_postgres
from app.core.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)

async def _audit(db, actor, action_type: str, module: str, resource_type: str = None,
                 resource_id: str = None, before=None, after=None):
    await db.execute(
        """
        INSERT INTO admin_audit_log
          (actor_id, actor_email, action_type, module, resource_type, resource_id, before_state, after_state)
        VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::jsonb, $8::jsonb)
        """,
        actor["id"], actor.get("email"), action_type, module,
        resource_type,
        resource_id,
        str(before) if before else None,
        str(after) if after else None,
    )

@router.get("/content")
async def list_content(
    content_type: str = "all",
    status: str = "all",
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    items = []

    if content_type in ("all", "document"):
        rows = await db.fetch(
            """
            SELECT s.id, s.document_name AS title, s.uploaded_at AS created_at,
                   s.is_public, s.deleted_at,
                   u.display_name AS author_name, u.email AS author_email
            FROM sources s
            LEFT JOIN users u ON s.uploaded_by = u.id
            ORDER BY s.uploaded_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
        for r in rows:
            st = "rejected" if r["deleted_at"] else ("approved" if r["is_public"] else "pending")
            if status != "all" and st != status:
                continue
            items.append({
                "id": str(r["id"]), "type": "document", "title": r["title"],
                "author_name": r["author_name"] or "Unknown",
                "author_email": r["author_email"] or "",
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "status": st, "flag_reason": None, "flag_count": 0, "community_name": None,
            })

    if content_type in ("all", "post"):
        rows = await db.fetch(
            """
            SELECT dt.id, dt.title, dt.created_at, dt.status AS thread_status,
                   u.display_name AS author_name, u.email AS author_email,
                   c.name AS community_name
            FROM discussion_threads dt
            LEFT JOIN users u ON dt.user_id = u.id
            LEFT JOIN communities c ON dt.community_id = c.id
            ORDER BY dt.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
        for r in rows:
            ts = r["thread_status"]
            st = "rejected" if ts == "removed" else ("approved" if ts in ("open", "pinned") else "pending")
            if status != "all" and st != status:
                continue
            items.append({
                "id": str(r["id"]), "type": "post", "title": r["title"],
                "author_name": r["author_name"] or "Unknown",
                "author_email": r["author_email"] or "",
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "status": st, "flag_reason": None, "flag_count": 0,
                "community_name": r["community_name"],
            })

    if content_type in ("all", "comment"):
        rows = await db.fetch(
            """
            SELECT dr.id, dt.title AS thread_title, dr.created_at,
                   u.display_name AS author_name, u.email AS author_email,
                   c.name AS community_name
            FROM discussion_replies dr
            LEFT JOIN discussion_threads dt ON dr.thread_id = dt.id
            LEFT JOIN users u ON dr.user_id = u.id
            LEFT JOIN communities c ON dt.community_id = c.id
            ORDER BY dr.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
        for r in rows:
            items.append({
                "id": str(r["id"]), "type": "comment",
                "title": f"Comment on: {r['thread_title'] or 'Unknown'}",
                "author_name": r["author_name"] or "Unknown",
                "author_email": r["author_email"] or "",
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "status": "approved", "flag_reason": None, "flag_count": 0,
                "community_name": r["community_name"],
            })

    if content_type in ("all", "shared"):
        rows = await db.fetch(
            """
            SELECT sc.id, sc.title, sc.created_at, sc.visibility, sc.entity_type,
                   u.display_name AS author_name, u.email AS author_email
            FROM shared_content sc
            LEFT JOIN users u ON sc.user_id = u.id
            WHERE sc.status != 'removed'
            ORDER BY sc.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
        for r in rows:
            if status != "all" and status != "approved":
                continue
            items.append({
                "id": str(r["id"]), "type": "shared",
                "title": r["title"],
                "author_name": r["author_name"] or "Unknown",
                "author_email": r["author_email"] or "",
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "status": "approved", "flag_reason": None, "flag_count": 0,
                "community_name": None,
            })

    if content_type in ("all", "submission"):
        rows = await db.fetch(
            """
            SELECT cs.id, cs.title, cs.submitted_at, cs.status AS sub_status,
                   cs.final_score, c.title AS challenge_title,
                   u.display_name AS author_name, u.email AS author_email
            FROM challenge_submissions cs
            JOIN challenges c ON c.id = cs.challenge_id
            LEFT JOIN users u ON cs.user_id = u.id
            ORDER BY cs.submitted_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
        for r in rows:
            items.append({
                "id": str(r["id"]), "type": "submission",
                "title": r["title"] or f"Submission for: {r['challenge_title']}",
                "author_name": r["author_name"] or "Unknown",
                "author_email": r["author_email"] or "",
                "created_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
                "status": "approved", "flag_reason": None, "flag_count": 0,
                "community_name": r["challenge_title"],
            })


    items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    items = items[:limit]
    return {"items": items}


@router.post("/content/{content_type}/{content_id}/approve")
async def approve_content(
    content_type: str, content_id: str,
    current_user=Depends(require_admin), db=Depends(get_postgres),
):
    if content_type == "document":
        await db.execute("UPDATE sources SET is_public = TRUE, deleted_at = NULL WHERE id = $1", content_id)
    elif content_type == "post":
        await db.execute("UPDATE discussion_threads SET status = 'open' WHERE id = $1", content_id)
    else:
        raise HTTPException(status_code=400, detail="Cannot approve this content type")
    await _audit(db, current_user, "approve", "content_moderation", content_type, content_id)
    return {"message": "Content approved"}


@router.post("/content/{content_type}/{content_id}/reject")
async def reject_content(
    content_type: str, content_id: str,
    current_user=Depends(require_admin), db=Depends(get_postgres),
):
    if content_type == "document":
        await db.execute("UPDATE sources SET is_public = FALSE WHERE id = $1", content_id)
    elif content_type == "post":
        await db.execute("UPDATE discussion_threads SET status = 'removed' WHERE id = $1", content_id)
    else:
        raise HTTPException(status_code=400, detail="Cannot reject this content type")
    await _audit(db, current_user, "reject", "content_moderation", content_type, content_id)
    return {"message": "Content rejected"}


@router.delete("/content/{content_type}/{content_id}")
async def delete_content(
    content_type: str, content_id: str,
    current_user=Depends(require_admin), db=Depends(get_postgres),
):
    if content_type == "document":
        await db.execute("UPDATE sources SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1", content_id)
    elif content_type == "post":
        await db.execute("UPDATE discussion_threads SET status = 'removed' WHERE id = $1", content_id)
    elif content_type == "comment":
        await db.execute("DELETE FROM discussion_replies WHERE id = $1", content_id)
    elif content_type == "shared":
        await db.execute("UPDATE shared_content SET status = 'removed' WHERE id = $1", content_id)
    elif content_type == "submission":
        await db.execute("DELETE FROM challenge_submissions WHERE id = $1", content_id)
    else:
        raise HTTPException(status_code=400, detail="Unknown content type")
    await _audit(db, current_user, "delete", "content_moderation", content_type, content_id)
    return {"message": "Content deleted"}


@router.get("/content/{content_type}/{content_id}")
async def get_content_detail(
    content_type: str, content_id: str,
    current_user=Depends(require_admin), db=Depends(get_postgres),
):

    if content_type == "document":
        row = await db.fetchrow(
            """
            SELECT s.id, s.document_name AS title, s.uploaded_at AS created_at,
                   s.document_path, s.document_type, s.full_text, s.ai_summary,
                   u.display_name AS author_name, u.email AS author_email
            FROM sources s
            LEFT JOIN users u ON s.uploaded_by = u.id
            WHERE s.id = $1
            """,
            content_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        content_parts = [f"Type: {row['document_type'] or 'unknown'}"]
        if row["full_text"]:
            preview = row["full_text"][:2000]
            if len(row["full_text"]) > 2000:
                preview += "..."
            content_parts.append(f"\n--- Content ---\n{preview}")
        elif row["ai_summary"]:
            content_parts.append(f"\n--- AI Summary ---\n{row['ai_summary']}")
        else:
            content_parts.append("\n(No content available)")
        return {
            "id": str(row["id"]), "type": "document", "title": row["title"],
            "author_name": row["author_name"] or "Unknown",
            "author_email": row["author_email"] or "",
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "content": "\n".join(content_parts),
        }

    elif content_type == "post":
        row = await db.fetchrow(
            """
            SELECT dt.id, dt.title, dt.content, dt.created_at,
                   u.display_name AS author_name, u.email AS author_email,
                   c.name AS community_name
            FROM discussion_threads dt
            LEFT JOIN users u ON dt.user_id = u.id
            LEFT JOIN communities c ON dt.community_id = c.id
            WHERE dt.id = $1
            """,
            content_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Post not found")
        return {
            "id": str(row["id"]), "type": "post", "title": row["title"],
            "author_name": row["author_name"] or "Unknown",
            "author_email": row["author_email"] or "",
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "content": row["content"] or "",
            "community_name": row["community_name"],
        }

    elif content_type == "comment":
        row = await db.fetchrow(
            """
            SELECT dr.id, dr.content, dr.created_at,
                   dt.title AS thread_title,
                   u.display_name AS author_name, u.email AS author_email
            FROM discussion_replies dr
            LEFT JOIN discussion_threads dt ON dr.thread_id = dt.id
            LEFT JOIN users u ON dr.user_id = u.id
            WHERE dr.id = $1
            """,
            content_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Comment not found")
        return {
            "id": str(row["id"]), "type": "comment",
            "title": f"Comment on: {row['thread_title'] or 'Unknown'}",
            "author_name": row["author_name"] or "Unknown",
            "author_email": row["author_email"] or "",
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "content": row["content"] or "",
        }

    elif content_type == "shared":
        row = await db.fetchrow(
            """
            SELECT sc.id, sc.title, sc.description, sc.created_at, sc.visibility, sc.entity_type,
                   u.display_name AS author_name, u.email AS author_email
            FROM shared_content sc
            LEFT JOIN users u ON sc.user_id = u.id
            WHERE sc.id = $1
            """,
            content_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Shared content not found")
        return {
            "id": str(row["id"]), "type": "shared", "title": row["title"],
            "author_name": row["author_name"] or "Unknown",
            "author_email": row["author_email"] or "",
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "content": f"Type: {row['entity_type'] or 'N/A'}\nVisibility: {row['visibility'] or 'N/A'}\n\n{row['description'] or ''}",
        }

    elif content_type == "submission":
        row = await db.fetchrow(
            """
            SELECT cs.id, cs.title, cs.description, cs.submitted_at, cs.status, cs.final_score,
                   c.title AS challenge_title,
                   u.display_name AS author_name, u.email AS author_email
            FROM challenge_submissions cs
            JOIN challenges c ON c.id = cs.challenge_id
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE cs.id = $1
            """,
            content_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Submission not found")
        return {
            "id": str(row["id"]), "type": "submission",
            "title": row["title"] or f"Submission for: {row['challenge_title']}",
            "author_name": row["author_name"] or "Unknown",
            "author_email": row["author_email"] or "",
            "created_at": row["submitted_at"].isoformat() if row["submitted_at"] else None,
            "content": f"Challenge: {row['challenge_title']}\nStatus: {row['status'] or 'N/A'}\nScore: {row['final_score'] or 'N/A'}\n\n{row['description'] or ''}",
        }

    else:
        raise HTTPException(status_code=400, detail="Content type not supported for preview")

@router.get("/global-tags")
async def list_global_tags(
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    rows = await db.fetch("SELECT * FROM global_tags ORDER BY category, name")
    return {"tags": [dict(r) for r in rows]}

@router.post("/global-tags")
async def create_global_tag(
    name: str = Body(..., embed=True),
    slug: str = Body(..., embed=True),
    category: str = Body(None, embed=True),
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    row = await db.fetchrow(
        """
        INSERT INTO global_tags (name, slug, category, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        name, slug, category, current_user["id"],
    )
    await _audit(db, current_user, "create_global_tag", "import_export", "global_tags", str(row["id"]))
    return {"id": str(row["id"]), "message": "Tag created"}


@router.delete("/global-tags/{tag_id}")
async def delete_global_tag(
    tag_id: str,
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    row = await db.fetchrow("SELECT is_system FROM global_tags WHERE id = $1", tag_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tag not found")
    if row["is_system"]:
        raise HTTPException(status_code=400, detail="Cannot delete system tags")
    await db.execute("DELETE FROM global_tags WHERE id = $1", tag_id)
    await _audit(db, current_user, "delete_global_tag", "import_export", "global_tags", tag_id)
    return {"message": "Tag deleted"}

@router.get("/audit-log")
async def get_audit_log(
    actor_id: str = None,
    action_type: str = None,
    module: str = None,
    date_from: str = None,
    date_to: str = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    conditions = ["1=1"]
    params = []

    if actor_id:
        params.append(actor_id)
        conditions.append(f"al.actor_id = ${len(params)}::uuid")
    if action_type:
        params.append(action_type)
        conditions.append(f"al.action_type = ${len(params)}")
    if module:
        params.append(module)
        conditions.append(f"al.module = ${len(params)}")
    if date_from:
        params.append(datetime.strptime(date_from, "%Y-%m-%d"))
        conditions.append(f"al.created_at >= ${len(params)}")
    if date_to:
        params.append(datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))
        conditions.append(f"al.created_at < ${len(params)}")

    where = " AND ".join(conditions)
    params += [limit, offset]

    rows = await db.fetch(
        f"""
        SELECT al.*, u.display_name AS actor_name
        FROM admin_audit_log al
        LEFT JOIN users u ON al.actor_id = u.id
        WHERE {where}
        ORDER BY al.created_at DESC
        LIMIT ${len(params)-1} OFFSET ${len(params)}
        """,
        *params,
    )
    return {"logs": [dict(r) for r in rows]}

@router.get("/data-retention")
async def get_data_retention(
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    rows = await db.fetch("SELECT key, retain_days, description, updated_at FROM data_retention_policy ORDER BY key")
    return {"policies": [dict(r) for r in rows]}

@router.put("/data-retention/{key}")
async def update_data_retention(
    key: str,
    retain_days: int = Body(..., embed=True),
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    await db.execute(
        """
        UPDATE data_retention_policy
        SET retain_days = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2
        WHERE key = $3
        """,
        retain_days, current_user["id"], key,
    )
    await _audit(db, current_user, "update_data_retention", "compliance", "data_retention_policy")
    return {"message": "Retention policy updated"}

@router.get("/settings")
async def get_settings(
    current_user=Depends(require_admin),
    db=Depends(get_postgres),
):
    user_count = await db.fetchval("SELECT COUNT(*) FROM users WHERE is_active = TRUE")
    doc_count = await db.fetchval("SELECT COUNT(*) FROM sources WHERE deleted_at IS NULL")
    thread_count = await db.fetchval("SELECT COUNT(*) FROM discussion_threads WHERE status != 'removed'")
    community_count = await db.fetchval("SELECT COUNT(*) FROM communities")
    flashcard_count = await db.fetchval("SELECT COUNT(*) FROM flashcards")
    question_count = await db.fetchval("SELECT COUNT(*) FROM question_bank")
    tokens_used_this_month = await db.fetchval(
        """
        SELECT COALESCE(SUM(tokens_used), 0)
        FROM ai_token_usage
        WHERE DATE_TRUNC('month', usage_month::timestamp)::date = DATE_TRUNC('month', CURRENT_DATE)::date
        """
    ) or 0
    token_usage_rows_this_month = await db.fetchval(
        """
        SELECT COUNT(*)
        FROM ai_token_usage
        WHERE DATE_TRUNC('month', usage_month::timestamp)::date = DATE_TRUNC('month', CURRENT_DATE)::date
        """
    ) or 0
    logger.info(
        "Admin system AI token usage: tokens_this_month=%s, rows_this_month=%s",
        tokens_used_this_month,
        token_usage_rows_this_month)

    return {
        "stats": {
            "total_users": user_count,
            "total_documents": doc_count,
            "total_discussions": thread_count,
            "total_communities": community_count,
            "total_flashcards": flashcard_count,
            "total_questions": question_count,
            "ai_tokens_used_this_month": tokens_used_this_month,
            "ai_token_usage_records_this_month": token_usage_rows_this_month,
        },
        "services": {
            "database": "operational",
            "storage": "operational",
            "ai_service": "operational",
        },
    }
