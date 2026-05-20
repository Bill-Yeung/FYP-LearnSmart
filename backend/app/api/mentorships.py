from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from pathlib import Path
import logging
import re
import uuid

from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.core.config import settings
from app.repositories.mentorship_repository import MentorshipRepository
from app.repositories.chat_repository import ChatRepository
from app.repositories.gamification_repository import GamificationRepository
from app.services.infrastructure import file_storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mentorships", tags=["Mentorships"])

class ScheduleSessionRequest(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int = 60
    session_type: str = "chat"

class RateSessionRequest(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None

def _format_mentorship(row: dict, user_id: str) -> dict:
    is_mentor = str(row["mentor_id"]) == str(user_id)
    m = {
        "id": str(row["id"]),
        "subject": row.get("subject"),
        "topic_focus": row.get("topic_focus"),
        "status": row["status"],
        "sessions_count": row.get("sessions_count", 0),
        "started_at": row["started_at"].isoformat() if row.get("started_at") else None,
        "chat_room_id": str(row["chat_room_id"]) if row.get("chat_room_id") else None,
        "is_mentor": is_mentor,
        "mentor": {
            "id": str(row["mentor_id"]),
            "name": row.get("mentor_display_name") or row.get("mentor_username") or "Unknown",
            "avatar_url": row.get("mentor_avatar_url"),
            "reputation_score": row.get("mentor_reputation_score", 0),
            "subjects": list(row.get("mentor_subjects") or []),
        },
        "mentee": {
            "id": str(row["mentee_id"]),
            "name": row.get("mentee_display_name") or row.get("mentee_username") or "Unknown",
            "avatar_url": row.get("mentee_avatar_url"),
        },
    }
    return m

def _format_mentor(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "name": row.get("display_name") or row.get("username") or "Unknown",
        "avatar_url": row.get("avatar_url"),
        "reputation_score": row.get("reputation_score", 0),
        "subjects": list(row.get("subjects") or []),
        "bio": row.get("bio"),
        "sessions_completed": row.get("sessions_completed", 0),
        "rating": float(row["rating"]) if row.get("rating") else 0,
        "is_available": row.get("is_available", False),
    }

@router.get("/my")
async def list_my_mentorships(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        rows = await repo.list_mentorships(current_user["id"])
        return {
            "mentorships": [_format_mentorship(r, current_user["id"]) for r in rows],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_mentorship_stats(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        stats = await repo.get_mentorship_stats(current_user["id"])
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mentors")
async def list_mentors(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        rows = await repo.list_available_mentors(search=search, page=page, page_size=page_size)
        return {"mentors": [_format_mentor(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mentors/register")
async def register_as_mentor(
    subjects: str = Query(..., description="Comma-separated subjects"),
    bio: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        subject_list = [s.strip() for s in subjects.split(",") if s.strip()]
        if not subject_list:
            raise HTTPException(status_code=400, detail="At least one subject is required")
        await repo.register_as_mentor(current_user["id"], subject_list, bio)
        return {"message": "Registered as mentor"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/mentors/availability")
async def set_availability(
    available: bool = Query(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        await repo.set_availability(current_user["id"], available)
        return {"message": "Availability updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def request_mentorship(
    mentor_id: str = Query(...),
    subject: str = Query(...),
    topic_focus: Optional[str] = Query(None),
    community_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        if str(mentor_id) == str(current_user["id"]):
            raise HTTPException(status_code=400, detail="Cannot mentor yourself")

        repo = MentorshipRepository(db)
        mentorship = await repo.create_mentorship(
            mentor_id=mentor_id,
            mentee_id=current_user["id"],
            subject=subject,
            topic_focus=topic_focus,
            community_id=community_id,
        )
        return {"mentorship": _format_mentorship(mentorship, current_user["id"])}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/accept")
async def accept_mentorship(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        result = await repo.update_mentorship_status(mentorship_id, "active", current_user["id"])
        if not result:
            raise HTTPException(status_code=404, detail="Mentorship not found or not authorized")

        try:
            mentorship = await repo.get_mentorship(mentorship_id)
            if mentorship and not mentorship.get("chat_room_id"):
                mentor_id = mentorship["mentor_id"]
                mentee_id = mentorship["mentee_id"]
                mentee_row = await db.fetchrow(
                    "SELECT COALESCE(display_name, username) AS name FROM users WHERE id = $1", mentee_id
                )
                mentor_row = await db.fetchrow(
                    "SELECT COALESCE(display_name, username) AS name FROM users WHERE id = $1", mentor_id
                )
                room_name = f"{mentor_row['name']} & {mentee_row['name']}" if mentor_row and mentee_row else "Mentorship"

                room = await db.fetchrow("""
                    INSERT INTO chat_rooms (room_type, name, is_private, created_by, max_participants)
                    VALUES ('mentorship', $1, TRUE, $2, 2)
                    RETURNING *
                """, room_name, mentor_id)

                if room:
                    await db.execute("""
                        INSERT INTO chat_room_members (room_id, user_id, role)
                        VALUES ($1, $2, 'owner'), ($1, $3, 'member')
                    """, room["id"], mentor_id, mentee_id)
                    await db.execute(
                        "UPDATE mentorships SET chat_room_id = $1 WHERE id = $2",
                        room["id"], mentorship["id"]
                    )
        except Exception:
            logger.debug("Failed to create mentorship chat room", exc_info=True)

        return {"message": "Mentorship accepted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/end")
async def end_mentorship(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        mentorship = await repo.get_mentorship(mentorship_id)
        result = await repo.update_mentorship_status(mentorship_id, "completed", current_user["id"])
        if not result:
            raise HTTPException(status_code=404, detail="Mentorship not found or not authorized")

        if mentorship:
            try:
                gam = GamificationRepository(db)
                rule = await gam.get_point_rule("mentor_session")
                mentor_id = str(mentorship["mentor_id"])
                if rule and not await gam.check_daily_limit(mentor_id, "mentor_session"):
                    await gam.award_points(
                        user_id=mentor_id,
                        action_type="mentor_session",
                        points=rule["points_awarded"],
                        point_type_id=str(rule["point_type_id"]),
                        rule_id=str(rule["id"]),
                        action_id=mentorship_id,
                        community_id=str(mentorship["community_id"]) if mentorship.get("community_id") else None,
                        description="Completed a mentorship session",
                    )
            except Exception:
                logger.debug("Failed to award points for mentor_session", exc_info=True)

        return {"message": "Mentorship ended"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/decline")
async def decline_mentorship(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        result = await repo.update_mentorship_status(mentorship_id, "declined", current_user["id"])
        if not result:
            raise HTTPException(status_code=404, detail="Mentorship not found or not authorized")
        return {"message": "Mentorship declined"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{mentorship_id}")
async def get_mentorship_detail(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = MentorshipRepository(db)
        rows = await repo.list_mentorships(current_user["id"])
        match = next((r for r in rows if str(r["id"]) == mentorship_id), None)
        if not match:
            raise HTTPException(status_code=404, detail="Mentorship not found")
        return {"mentorship": _format_mentorship(match, current_user["id"])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{mentorship_id}/sessions")
async def list_sessions(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND (mentor_id = $2 OR mentee_id = $2)",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Mentorship not found")

        rows = await db.fetch("""
            SELECT s.*, u.username AS scheduled_by_name,
                   COALESCE(u.display_name, u.username) AS scheduled_by_display_name
            FROM mentorship_sessions s
            JOIN users u ON u.id = s.scheduled_by
            WHERE s.mentorship_id = $1
            ORDER BY s.scheduled_at DESC
        """, mentorship_id)

        sessions = []
        for r in rows:
            sessions.append({
                "id": str(r["id"]),
                "mentorship_id": str(r["mentorship_id"]),
                "scheduled_by": str(r["scheduled_by"]),
                "scheduled_by_name": r["scheduled_by_display_name"],
                "title": r["title"],
                "description": r.get("description"),
                "scheduled_at": r["scheduled_at"].isoformat() + "Z",
                "duration_minutes": r["duration_minutes"],
                "session_type": r["session_type"],
                "status": r["status"],
                "jitsi_room_id": r.get("jitsi_room_id"),
                "rating": r.get("rating"),
                "rating_comment": r.get("rating_comment"),
                "rated_by": str(r["rated_by"]) if r.get("rated_by") else None,
                "created_at": r["created_at"].isoformat() + "Z",
            })
        return {"sessions": sessions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/sessions")
async def schedule_session(
    mentorship_id: str,
    body: ScheduleSessionRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND status = 'active' AND (mentor_id = $2 OR mentee_id = $2)",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Active mentorship not found")

        if body.session_type not in ("chat", "video"):
            raise HTTPException(status_code=400, detail="session_type must be 'chat' or 'video'")

        jitsi_room_id = None
        if body.session_type == "video":
            safe_title = re.sub(r'[^a-zA-Z0-9]', '', body.title.strip())
            jitsi_room_id = f"LearnSmart{safe_title}{uuid.uuid4().hex[:6]}"

        row = await db.fetchrow("""
            INSERT INTO mentorship_sessions
                (mentorship_id, scheduled_by, title, description, scheduled_at, duration_minutes, session_type, jitsi_room_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """, mentorship_id, current_user["id"], body.title, body.description,
            body.scheduled_at.replace(tzinfo=None), body.duration_minutes, body.session_type, jitsi_room_id)

        return {
            "session": {
                "id": str(row["id"]),
                "mentorship_id": str(row["mentorship_id"]),
                "title": row["title"],
                "scheduled_at": row["scheduled_at"].isoformat() + "Z",
                "duration_minutes": row["duration_minutes"],
                "session_type": row["session_type"],
                "status": row["status"],
                "jitsi_room_id": row.get("jitsi_room_id"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/sessions/{session_id}/confirm")
async def confirm_session(
    mentorship_id: str, session_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        row = await db.fetchrow("""
            UPDATE mentorship_sessions SET status = 'confirmed'
            WHERE id = $1 AND mentorship_id = $2 AND status = 'proposed'
                AND scheduled_by != $3
            RETURNING *
        """, session_id, mentorship_id, current_user["id"])
        if not row:
            raise HTTPException(status_code=404, detail="Session not found or you cannot confirm your own session")
        return {"message": "Session confirmed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/sessions/{session_id}/complete")
async def complete_session(
    mentorship_id: str, session_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND (mentor_id = $2 OR mentee_id = $2)",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Mentorship not found")

        row = await db.fetchrow("""
            UPDATE mentorship_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND mentorship_id = $2 AND status IN ('confirmed', 'in_progress')
            RETURNING *
        """, session_id, mentorship_id)
        if not row:
            raise HTTPException(status_code=404, detail="Session not found or not in valid state")
        await db.execute(
            "UPDATE mentorships SET sessions_count = sessions_count + 1 WHERE id = $1",
            mentorship_id,
        )

        return {"message": "Session completed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/sessions/{session_id}/cancel")
async def cancel_session(
    mentorship_id: str, session_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    
    try:
        row = await db.fetchrow("""
            UPDATE mentorship_sessions
            SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $3
            WHERE id = $1 AND mentorship_id = $2 AND status IN ('proposed', 'confirmed')
            RETURNING *
        """, session_id, mentorship_id, current_user["id"])
        if not row:
            raise HTTPException(status_code=404, detail="Session not found or already completed")
        return {"message": "Session cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/sessions/{session_id}/rate")
async def rate_session(
    mentorship_id: str, session_id: str,
    body: RateSessionRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        if body.rating < 1 or body.rating > 5:
            raise HTTPException(status_code=400, detail="Rating must be 1-5")

        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND mentee_id = $2",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=403, detail="Only the mentee can rate sessions")

        row = await db.fetchrow("""
            UPDATE mentorship_sessions
            SET rating = $3, rating_comment = $4, rated_by = $5, rated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND mentorship_id = $2 AND status = 'completed' AND rating IS NULL
            RETURNING *
        """, session_id, mentorship_id, body.rating, body.comment, current_user["id"])
        if not row:
            raise HTTPException(status_code=404, detail="Session not found, not completed, or already rated")

        await db.execute("""
            UPDATE mentor_profiles SET
                rating = (
                    SELECT COALESCE(AVG(ms.rating), 0)
                    FROM mentorship_sessions ms
                    JOIN mentorships m ON m.id = ms.mentorship_id
                    WHERE m.mentor_id = $1 AND ms.rating IS NOT NULL
                ),
                sessions_completed = (
                    SELECT COUNT(*)
                    FROM mentorship_sessions ms
                    JOIN mentorships m ON m.id = ms.mentorship_id
                    WHERE m.mentor_id = $1 AND ms.status = 'completed'
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
        """, m["mentor_id"])

        return {"message": "Session rated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{mentorship_id}/materials")
async def list_materials(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND (mentor_id = $2 OR mentee_id = $2)",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Mentorship not found")

        rows = await db.fetch("""
            SELECT mr.*, u.display_name as shared_by_name, u.username as shared_by_username
            FROM mentorship_resources mr
            LEFT JOIN users u ON u.id = mr.shared_by
            WHERE mr.mentorship_id = $1
            ORDER BY mr.shared_at DESC
        """, mentorship_id)

        return {"materials": [
            {
                "id": str(r["id"]),
                "entity_type": r["entity_type"],
                "entity_id": str(r["entity_id"]) if r.get("entity_id") else None,
                "title": r.get("title"),
                "note": r.get("note"),
                "file_url": r.get("file_url"),
                "file_size": r.get("file_size"),
                "shared_by": str(r["shared_by"]) if r.get("shared_by") else None,
                "shared_by_name": r.get("shared_by_name") or r.get("shared_by_username") or "Unknown",
                "is_required": r.get("is_required", False),
                "is_viewed": r.get("is_viewed", False),
                "is_completed": r.get("is_completed", False),
                "shared_at": r["shared_at"].isoformat(),
            } for r in rows
        ]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/materials/upload")
async def upload_material(
    mentorship_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND status = 'active' AND (mentor_id = $2 OR mentee_id = $2)",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Active mentorship not found")

        content = await file.read()
        max_size = 50 * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        
        file_id = uuid.uuid4().hex
        result = await file_storage_service.save_file(content, file.filename or "upload.bin", subdirectory="mentorships", file_id=file_id)
        file_url = result["file_path"]

        material_title = title or file.filename or "Uploaded file"

        row = await db.fetchrow("""
            INSERT INTO mentorship_resources
                (mentorship_id, shared_by, entity_type, title, note, file_url, file_size)
            VALUES ($1, $2, 'file', $3, $4, $5, $6)
            RETURNING *
        """, mentorship_id, current_user["id"], material_title, note, file_url, len(content))

        return {
            "material": {
                "id": str(row["id"]),
                "entity_type": "file",
                "title": material_title,
                "note": note,
                "file_url": file_url,
                "file_size": len(content),
                "shared_by": str(current_user["id"]),
                "shared_at": row["shared_at"].isoformat(),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload material: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{mentorship_id}/materials/{material_id}/download")
async def download_material(
    mentorship_id: str,
    material_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    logger.info(f"Download request: mentorship={mentorship_id}, material={material_id}, user={current_user['id']}")
    row = await db.fetchrow("""
        SELECT mr.* FROM mentorship_resources mr
        JOIN mentorships m ON m.id = mr.mentorship_id
        WHERE mr.id = $1 AND mr.mentorship_id = $2
          AND (m.mentor_id = $3 OR m.mentee_id = $3)
    """, material_id, mentorship_id, current_user["id"])
    if not row:
        logger.warning(f"Download: material not found in DB. material_id={material_id}, mentorship_id={mentorship_id}")
        raise HTTPException(status_code=404, detail="Material not found")
    if row["entity_type"] != "file" or not row.get("file_url"):
        raise HTTPException(status_code=400, detail="Material is not a downloadable file")

    file_path = Path(row["file_url"])
    if not file_path.is_absolute():
        stored_name = row["file_url"].rsplit("/", 1)[-1]
        file_path = Path(settings.upload_dir) / "mentorships" / stored_name
    logger.info(f"Download: file_url={row['file_url']}, resolved path={file_path}, exists={file_path.exists()}")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    download_name = row.get("title") or file_path.name
    return FileResponse(
        file_path,
        filename=download_name,
        media_type="application/octet-stream",
    )

@router.post("/{mentorship_id}/materials/link")
async def share_link(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
    body: dict = None,
):

    try:
        if not body or not body.get("url"):
            raise HTTPException(status_code=400, detail="URL is required")

        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND status = 'active' AND (mentor_id = $2 OR mentee_id = $2)",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Active mentorship not found")

        row = await db.fetchrow("""
            INSERT INTO mentorship_resources
                (mentorship_id, shared_by, entity_type, title, note, file_url)
            VALUES ($1, $2, 'link', $3, $4, $5)
            RETURNING *
        """, mentorship_id, current_user["id"],
            body.get("title", body["url"]), body.get("note"), body["url"])

        return {
            "material": {
                "id": str(row["id"]),
                "entity_type": "link",
                "title": body.get("title", body["url"]),
                "note": body.get("note"),
                "file_url": body["url"],
                "shared_by": str(current_user["id"]),
                "shared_at": row["shared_at"].isoformat(),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mentorship_id}/materials/resource")
async def share_resource(
    mentorship_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
    body: dict = None,
):
   
    try:
        if not body or not body.get("entity_type") or not body.get("entity_id"):
            raise HTTPException(status_code=400, detail="entity_type and entity_id are required")

        allowed_types = ("source", "diagram", "learning_path", "flashcard", "concept")
        if body["entity_type"] not in allowed_types:
            raise HTTPException(status_code=400, detail=f"entity_type must be one of: {', '.join(allowed_types)}")

        m = await db.fetchrow(
            "SELECT * FROM mentorships WHERE id = $1 AND status = 'active' AND (mentor_id = $2 OR mentee_id = $2)",
            mentorship_id, current_user["id"],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Active mentorship not found")

        title = body.get("title", "Shared Resource")
        note = body.get("note")

        row = await db.fetchrow("""
            INSERT INTO mentorship_resources
                (mentorship_id, shared_by, entity_type, entity_id, title, note)
            VALUES ($1, $2, $3, $4::uuid, $5, $6)
            RETURNING *
        """, mentorship_id, current_user["id"],
            body["entity_type"], body["entity_id"], title, note)

        return {
            "material": {
                "id": str(row["id"]),
                "entity_type": body["entity_type"],
                "entity_id": body["entity_id"],
                "title": title,
                "note": note,
                "shared_by": str(current_user["id"]),
                "shared_at": row["shared_at"].isoformat(),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to share resource: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{mentorship_id}/materials/{material_id}")
async def delete_material(
    mentorship_id: str,
    material_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        row = await db.fetchrow("""
            SELECT * FROM mentorship_resources
            WHERE id = $1 AND mentorship_id = $2 AND shared_by = $3
        """, material_id, mentorship_id, current_user["id"])
        if not row:
            raise HTTPException(status_code=404, detail="Material not found or not yours")

        if row["entity_type"] == "file" and row.get("file_url"):
            try:
                fp = Path(row["file_url"])
                if not fp.is_absolute():
                    fp = Path(settings.upload_dir) / "mentorships" / row["file_url"].rsplit("/", 1)[-1]
                await file_storage_service.delete_file(str(fp))
            except Exception:
                pass

        await db.execute("DELETE FROM mentorship_resources WHERE id = $1", material_id)
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
