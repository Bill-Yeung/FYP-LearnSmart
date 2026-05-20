import logging
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.core.activity import log_activity, is_meaningful, MEANINGFUL_SUB_TYPES, VALID_SUB_TYPES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["Calendar"])

@router.get("/events")
async def get_calendar_events(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = current_user["id"]

    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        return {"events": [], "error": "Invalid date format. Use YYYY-MM-DD."}

    start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)

    events = []

    try:
        rows = await db.fetch("""
            SELECT DATE(fs.due_date) as review_date, COUNT(*) as card_count
            FROM flashcard_schedules fs
            WHERE fs.user_id = $1
              AND fs.due_date BETWEEN $2 AND $3
            GROUP BY DATE(fs.due_date)
            ORDER BY review_date
        """, user_id, start_dt, end_dt)
        for r in rows:
            d = r["review_date"]
            count = r["card_count"]
            events.append({
                "id": f"fc-{d.isoformat()}",
                "type": "flashcard",
                "title": f"{count} flashcard{'s' if count != 1 else ''} due",
                "date": d.isoformat(),
                "time": None,
                "color": "blue",
                "status": None,
                "link": "/flashcards/schedule",
                "meta": {"count": count},
            })
    except Exception as e:
        logger.warning(f"Calendar: flashcard query failed: {e}")

    try:
        rows = await db.fetch("""
            SELECT ms.id, ms.title, ms.scheduled_at, ms.duration_minutes,
                   ms.session_type, ms.status, m.id as mentorship_id
            FROM mentorship_sessions ms
            JOIN mentorships m ON ms.mentorship_id = m.id
            WHERE (m.mentor_id = $1 OR m.mentee_id = $1)
              AND ms.scheduled_at BETWEEN $2 AND $3
              AND ms.status != 'cancelled'
            ORDER BY ms.scheduled_at
        """, user_id, start_dt, end_dt)
        for r in rows:
            scheduled = r["scheduled_at"]
            events.append({
                "id": f"ms-{r['id']}",
                "type": "mentorship",
                "title": r["title"],
                "date": scheduled.date().isoformat(),
                "time": scheduled.strftime("%H:%M"),
                "color": "purple",
                "status": r["status"],
                "link": f"/community/mentorship/{r['mentorship_id']}",
                "meta": {
                    "duration_minutes": r["duration_minutes"],
                    "session_type": r["session_type"],
                },
            })
    except Exception as e:
        logger.warning(f"Calendar: mentorship query failed: {e}")

    try:
        rows = await db.fetch("""
            SELECT DISTINCT a.id, a.title, a.due_at, a.assignment_type, a.class_id,
                   COALESCE(asub.status, 'not_started') as submission_status
            FROM assignments a
            LEFT JOIN class_enrollments ce ON ce.class_id = a.class_id AND ce.student_id = $1
            LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = $1
            WHERE a.due_at BETWEEN $2 AND $3
              AND (ce.student_id = $1 OR a.teacher_id = $1)
            ORDER BY a.due_at
        """, user_id, start_dt, end_dt)
        for r in rows:
            due = r["due_at"]
            events.append({
                "id": f"as-{r['id']}",
                "type": "assignment",
                "title": r["title"],
                "date": due.date().isoformat() if due else None,
                "time": None,
                "color": "red",
                "status": r["submission_status"],
                "link": f"/plan-workflow/assign-plan",
                "meta": {"assignment_type": r["assignment_type"]},
            })
    except Exception as e:
        logger.warning(f"Calendar: assignment query failed: {e}")

    try:
        rows = await db.fetch("""
            SELECT DATE(eb.next_review_time) as review_date, COUNT(*) as err_count
            FROM error_book eb
            WHERE eb.user_id = $1
              AND eb.next_review_time BETWEEN $2 AND $3
            GROUP BY DATE(eb.next_review_time)
            ORDER BY review_date
        """, user_id, start_dt, end_dt)
        for r in rows:
            d = r["review_date"]
            count = r["err_count"]
            events.append({
                "id": f"er-{d.isoformat()}",
                "type": "error_review",
                "title": f"{count} error{'s' if count != 1 else ''} to review",
                "date": d.isoformat(),
                "time": None,
                "color": "orange",
                "status": None,
                "link": "/application/schedule-review",
                "meta": {"count": count},
            })
    except Exception as e:
        logger.warning(f"Calendar: error book query failed: {e}")

    try:
        rows = await db.fetch("""
            SELECT c.id, c.title, c.starts_at, c.ends_at, c.status
            FROM challenges c
            JOIN challenge_participants cp ON cp.challenge_id = c.id
            WHERE cp.user_id = $1
              AND c.status IN ('active', 'upcoming')
              AND (c.starts_at BETWEEN $2 AND $3 OR c.ends_at BETWEEN $2 AND $3)
            ORDER BY c.starts_at
        """, user_id, start_dt, end_dt)
        for r in rows:
            sa = r["starts_at"]
            events.append({
                "id": f"ch-{r['id']}",
                "type": "challenge",
                "title": r["title"],
                "date": sa.date().isoformat() if sa else None,
                "time": sa.strftime("%H:%M") if sa else None,
                "color": "amber",
                "status": r["status"],
                "link": "/community/challenges",
                "meta": {
                    "ends_at": r["ends_at"].isoformat() if r["ends_at"] else None,
                },
            })
    except Exception as e:
        logger.warning(f"Calendar: challenges query failed: {e}")

    events.sort(key=lambda e: (e["date"] or "", e["time"] or ""))

    return {"events": events}


@router.get("/activity")
async def get_activity_summary(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    """Return daily activity summary from learning_activity_log for streak / tracker."""
    user_id = current_user["id"]

    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        return {"days": [], "streak": 0}

    start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)

    rows = await db.fetch("""
        SELECT DATE(created_at) as day, activity_type, sub_type
        FROM learning_activity_log
        WHERE user_id = $1
          AND created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at), activity_type, sub_type
        ORDER BY day
    """, user_id, start_dt, end_dt)

    days: dict[str, list[str]] = {}
    for r in rows:
        d = r["day"].isoformat()
        if d not in days:
            days[d] = []
        if r["activity_type"] not in days[d]:
            days[d].append(r["activity_type"])

    meaningful_conditions = []
    for atype, sub_types in MEANINGFUL_SUB_TYPES.items():
        if sub_types is not None:
            for st in sub_types:
                meaningful_conditions.append(f"(activity_type = '{atype}' AND sub_type = '{st}')")

    meaningful_where = " OR ".join(meaningful_conditions)

    streak_rows = await db.fetch(f"""
        SELECT DISTINCT DATE(created_at) as day
        FROM learning_activity_log
        WHERE user_id = $1
          AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
          AND ({meaningful_where})
        ORDER BY day DESC
    """, user_id)

    streak = 0
    today = date.today()
    for i, r in enumerate(streak_rows):
        expected = today - timedelta(days=i)
        if r["day"] == expected:
            streak += 1
        else:
            break

    return {
        "days": days,
        "streak": streak,
    }

class LogActivityRequest(BaseModel):
    activity_type: str = Field(..., description="Type: flashcard, error_review, assignment, mentorship, study_plan, challenge, quiz, document, feynman")
    sub_type: Optional[str] = Field(None, description="Sub-type: review, create, submit, complete, attempt, upload, view, open, share, etc.")
    resource_id: Optional[str] = None
    details: Optional[dict] = None

@router.post("/activity")
async def post_activity(
    payload: LogActivityRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    if payload.activity_type not in VALID_SUB_TYPES:
        return {"ok": False, "error": f"Invalid activity_type. Must be one of: {', '.join(sorted(VALID_SUB_TYPES.keys()))}"}

    if payload.sub_type and payload.sub_type not in VALID_SUB_TYPES[payload.activity_type]:
        return {"ok": False, "error": f"Invalid sub_type '{payload.sub_type}' for {payload.activity_type}. Must be one of: {', '.join(sorted(VALID_SUB_TYPES[payload.activity_type]))}"}

    resource_uuid = None
    if payload.resource_id:
        try:
            from uuid import UUID
            resource_uuid = UUID(payload.resource_id)
        except ValueError:
            pass

    await log_activity(
        db,
        current_user["id"],
        payload.activity_type,
        sub_type=payload.sub_type,
        resource_id=resource_uuid,
        details=payload.details,
    )

    meaningful = is_meaningful(payload.activity_type, payload.sub_type)
    return {"ok": True, "meaningful": meaningful}
