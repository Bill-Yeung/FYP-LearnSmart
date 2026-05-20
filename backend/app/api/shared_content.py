from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional, List
from pathlib import Path
import logging
import uuid

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.core.config import settings
from app.repositories.shared_content_repository import SharedContentRepository
from app.repositories.gamification_repository import GamificationRepository
from app.repositories.activity_feed_repository import ActivityFeedRepository
from app.services.infrastructure import file_storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shared-content", tags=["Shared Content"])

def _format_content(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "entity_type": row["entity_type"],
        "entity_id": str(row["entity_id"]),
        "title": row["title"],
        "description": row.get("description"),
        "visibility": row.get("visibility", "public"),
        "view_count": row.get("view_count", 0),
        "download_count": row.get("download_count", 0),
        "like_count": row.get("like_count", 0),
        "average_rating": float(row["average_rating"]) if row.get("average_rating") else None,
        "rating_count": row.get("rating_count", 0),
        "tags": row.get("tags") or [],
        "status": row.get("status", "published"),
        "file_url": row.get("file_url"),
        "file_size": row.get("file_size"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "author": {
            "username": row.get("username"),
            "display_name": row.get("display_name"),
        },
    }

@router.get("")
async def list_shared_content(
    community_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = SharedContentRepository(db)
        offset = (page - 1) * page_size
        items = await repo.list_shared_content(
            community_id=community_id,
            entity_type=entity_type,
            limit=page_size,
            offset=offset,
        )
        total = await repo.count_shared_content(community_id=community_id, entity_type=entity_type)

        formatted = []
        for i in items:
            fc = _format_content(i)
            fc["has_liked"] = await repo.has_liked(current_user["id"], str(i["id"]))
            fc["has_saved"] = await repo.has_saved(current_user["id"], str(i["id"]))
            formatted.append(fc)

        return {
            "items": formatted,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def share_content(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    title: str = Query(...),
    description: Optional[str] = Query(None),
    visibility: str = Query("public"),
    community_ids: Optional[List[str]] = Query(None),
    tags: Optional[List[str]] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = SharedContentRepository(db)
        item = await repo.create_shared_content(
            user_id=current_user["id"],
            entity_type=entity_type,
            entity_id=entity_id,
            title=title,
            description=description,
            visibility=visibility,
            community_ids=community_ids,
            tags=tags,
        )

        try:
            gam = GamificationRepository(db)
            rule = await gam.get_point_rule("share_content")
            if rule and not await gam.check_daily_limit(current_user["id"], "share_content"):
                cid = community_ids[0] if community_ids else None
                await gam.award_points(
                    user_id=current_user["id"],
                    action_type="share_content",
                    points=rule["points_awarded"],
                    point_type_id=str(rule["point_type_id"]),
                    rule_id=str(rule["id"]),
                    action_id=str(item["id"]),
                    community_id=cid,
                    description=f"Shared content: {title}",
                )
        except Exception:
            logger.debug("Failed to award points for share_content", exc_info=True)

        try:
            gam2 = GamificationRepository(db)
            await gam2.update_streak(current_user["id"], "weekly_share")
        except Exception:
            logger.debug("Failed to update weekly_share streak", exc_info=True)

        try:
            af = ActivityFeedRepository(db)
            cid = community_ids[0] if community_ids else None
            await af.create_activity(
                actor_id=current_user["id"],
                activity_type="shared",
                entity_type=entity_type,
                entity_id=str(item["id"]),
                entity_preview={"title": title, "description": description or ""},
                community_id=cid,
            )
        except Exception:
            logger.debug("Failed to log share activity", exc_info=True)

        return {"item": _format_content({**item, "username": None, "display_name": None})}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{content_id}")
async def get_shared_content(
    content_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = SharedContentRepository(db)
        item = await repo.get_shared_content(content_id)
        if not item:
            raise HTTPException(status_code=404, detail="Content not found")
        return {"item": _format_content(item)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{content_id}/like")
async def toggle_like(
    content_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = SharedContentRepository(db)
        item = await repo.get_shared_content(content_id)
        if not item:
            raise HTTPException(status_code=404, detail="Content not found")
        liked = await repo.toggle_like(content_id, current_user["id"])

        if liked and str(item["user_id"]) != str(current_user["id"]):
            try:
                gam = GamificationRepository(db)
                rule = await gam.get_point_rule("content_liked")
                if rule and not await gam.check_daily_limit(str(item["user_id"]), "content_liked"):
                    await gam.award_points(
                        user_id=str(item["user_id"]),
                        action_type="content_liked",
                        points=rule["points_awarded"],
                        point_type_id=str(rule["point_type_id"]),
                        rule_id=str(rule["id"]),
                        action_id=content_id,
                        description="Your shared content received a like",
                    )
            except Exception:
                logger.debug("Failed to award points for content_liked", exc_info=True)

        updated = await repo.get_shared_content(content_id)
        return {"liked": liked, "like_count": updated["like_count"] if updated else 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{content_id}/save")
async def save_content(
    content_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = SharedContentRepository(db)
        item = await repo.get_shared_content(content_id)
        if not item:
            raise HTTPException(status_code=404, detail="Content not found")

        already_saved = await repo.has_saved(current_user["id"], content_id)
        if already_saved:
            return {"message": "Already saved", "saved": True}

        user_id = current_user["id"]
        entity_type = item["entity_type"]
        entity_id = str(item["entity_id"])
        forked_id = None

        if entity_type == "concept":
            src = await db.fetchrow("SELECT * FROM concepts WHERE id = $1", entity_id)
            if src:
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

        elif entity_type == "diagram":
            src = await db.fetchrow("SELECT * FROM diagrams WHERE id = $1", entity_id)
            if src:
                import secrets
                slug = f"fork-{secrets.token_hex(6)}"
                new_row = await db.fetchrow(
                    """INSERT INTO diagrams
                       (user_id, url_slug, title, description, diagram_type,
                        diagram_data, view_state, layout_type, node_count, link_count)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id""",
                    user_id, slug,
                    src["title"], src.get("description"), src["diagram_type"],
                    src["diagram_data"], src.get("view_state"), src.get("layout_type"),
                    src.get("node_count", 0), src.get("link_count", 0),
                )
                forked_id = str(new_row["id"])

        elif entity_type == "flashcard":
            src = await db.fetchrow("SELECT * FROM flashcards WHERE id = $1", entity_id)
            if src:
                new_row = await db.fetchrow(
                    """INSERT INTO flashcards
                       (user_id, front_content, back_content, card_type, tips,
                        content_metadata, choices, due_label, source_type)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual') RETURNING id""",
                    user_id, src["front_content"], src["back_content"],
                    src.get("card_type", "standard"), src.get("tips"),
                    src.get("content_metadata"), src.get("choices"), src.get("due_label"),
                )
                forked_id = str(new_row["id"])

        elif entity_type == "source":
            src = await db.fetchrow("SELECT * FROM sources WHERE id = $1 AND deleted_at IS NULL", entity_id)
            if src:
                new_row = await db.fetchrow(
                    """INSERT INTO sources
                       (document_name, document_path, document_type, language, author,
                        publication_year, uploaded_by, is_public, processing_status,
                        concepts_extracted, relationships_extracted, ai_summary,
                        ai_summary_generated_at, full_text)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, $10, $11, $12, $13)
                       RETURNING id""",
                    src["document_name"], src.get("document_path"), src.get("document_type"),
                    src.get("language"), src.get("author"), src.get("publication_year"),
                    user_id, src.get("processing_status", "completed"),
                    src.get("concepts_extracted", 0), src.get("relationships_extracted", 0),
                    src.get("ai_summary"), src.get("ai_summary_generated_at"),
                    src.get("full_text"),
                )
                forked_id = str(new_row["id"])
                subjects = await db.fetch(
                    "SELECT subject_id FROM source_subjects WHERE source_id = $1", entity_id
                )
                for s in subjects:
                    await db.execute(
                        """INSERT INTO source_subjects (source_id, subject_id)
                           VALUES ($1, $2) ON CONFLICT DO NOTHING""",
                        forked_id, s["subject_id"],
                    )

        elif entity_type == "learning_path":
            src = await db.fetchrow("SELECT * FROM learning_paths WHERE id = $1", entity_id)
            if src:
                new_row = await db.fetchrow(
                    """INSERT INTO learning_paths (target_concept_id, created_by)
                       VALUES ($1, $2) RETURNING id""",
                    src.get("target_concept_id"), user_id,
                )
                forked_id = str(new_row["id"])
                steps = await db.fetch(
                    "SELECT * FROM learning_path_steps WHERE path_id = $1 ORDER BY step_order",
                    entity_id,
                )
                for s in steps:
                    await db.execute(
                        """INSERT INTO learning_path_steps
                           (path_id, concept_id, step_order, is_required,
                            estimated_time_minutes, target_difficulty, rationale)
                           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                        str(new_row["id"]), s.get("concept_id"), s["step_order"],
                        s.get("is_required", True), s.get("estimated_time_minutes"),
                        s.get("target_difficulty"), s.get("rationale"),
                    )

        await db.execute(
            """INSERT INTO content_downloads (shared_content_id, user_id, action_type, forked_entity_id)
               VALUES ($1, $2, 'save', $3)
               ON CONFLICT (shared_content_id, user_id, action_type) DO NOTHING""",
            content_id, user_id, forked_id,
        )
        await db.execute(
            "UPDATE shared_content SET download_count = download_count + 1 WHERE id = $1",
            content_id,
        )

        return {
            "message": f"Content saved to your {entity_type.replace('_', ' ')}s",
            "saved": True,
            "forked_entity_id": forked_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save content failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{content_id}/rate")
async def rate_content(
    content_id: str,
    rating: int = Query(..., ge=1, le=5),
    review_text: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = SharedContentRepository(db)
        result = await repo.rate_content(content_id, current_user["id"], rating, review_text)
        return {"rating": result["rating"], "message": "Rating submitted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{content_id}")
async def delete_shared_content(
    content_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        row = await db.fetchrow(
            "SELECT id, user_id, entity_type, file_url FROM shared_content WHERE id = $1::uuid",
            content_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Shared content not found")
        if str(row["user_id"]) != str(current_user["id"]):
            raise HTTPException(status_code=403, detail="You can only delete your own shared content")

        if row["entity_type"] == "file" and row.get("file_url"):
            try:
                fp = Path(row["file_url"])
                if not fp.is_absolute():
                    fp = Path(settings.upload_dir) / "shared" / row["file_url"].rsplit("/", 1)[-1]
                await file_storage_service.delete_file(str(fp))
            except Exception:
                pass

        await db.execute("DELETE FROM shared_content WHERE id = $1::uuid", content_id)
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{content_id}/download")
async def record_download(
    content_id: str,
    action_type: str = "view",
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    
    try:
        repo = SharedContentRepository(db)
        await repo.record_download(content_id, current_user["id"], action_type)
        return {"message": "Action recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_shared_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    community_id: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        content = await file.read()
        max_size = 50 * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")

        file_id = uuid.uuid4().hex
        result = await file_storage_service.save_file(
            content, file.filename or "upload.bin",
            subdirectory="shared", file_id=file_id,
        )
        file_path = result["file_path"]
        file_title = title or file.filename or "Uploaded file"
        entity_id = str(uuid.uuid4())

        community_ids = [community_id] if community_id else []
        row = await db.fetchrow("""
            INSERT INTO shared_content
                (user_id, entity_type, entity_id, title, description,
                 visibility, community_ids, file_url, file_size, published_at)
            VALUES ($1, 'file', $2::uuid, $3, $4, 'public', $5, $6, $7, NOW())
            RETURNING *
        """, current_user["id"], entity_id, file_title, description,
            community_ids, file_path, len(content))

        try:
            af = ActivityFeedRepository(db)
            await af.create_activity(
                actor_id=current_user["id"],
                activity_type="shared",
                entity_type="file",
                entity_id=str(row["id"]),
                entity_preview={"title": file_title, "description": description or ""},
                community_id=community_id,
            )
        except Exception:
            logger.debug("Failed to log upload share activity", exc_info=True)

        return {
            "item": {
                "id": str(row["id"]),
                "entity_type": "file",
                "title": file_title,
                "description": description,
                "file_url": file_path,
                "file_size": len(content),
                "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload shared file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{content_id}/file")
async def download_shared_file(
    content_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    row = await db.fetchrow(
        "SELECT * FROM shared_content WHERE id = $1::uuid", content_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Content not found")
    if row["entity_type"] != "file" or not row.get("file_url"):
        raise HTTPException(status_code=400, detail="Content is not a downloadable file")

    file_path = Path(row["file_url"])
    if not file_path.is_absolute():
        stored_name = row["file_url"].rsplit("/", 1)[-1]
        file_path = Path(settings.upload_dir) / "shared" / stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    download_name = row.get("title") or file_path.name
    return FileResponse(
        file_path,
        filename=download_name,
        media_type="application/octet-stream",
    )
