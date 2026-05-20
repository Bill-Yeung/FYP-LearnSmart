from __future__ import annotations

import logging
import math
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.core.enums import UserPriority
from app.services.ai.provider import ai_provider
from app.services.messaging.notification_service import notification_service
from app.services.infrastructure.task_queue_manager import task_queue_manager, QueueType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/error-book", tags=["Error Book"])

SpacedRepAlgo = Literal["sm2", "fsrs", "simple", "leitner"]

class ManualSaveErrorRequest(BaseModel):
    question_text: str 
    wrong_answer: str
    correct_answer_snapshot: Optional[str] = None
    system_explanation: Optional[str] = None
    error_category: Optional[str] = None
    error_category_id: Optional[str] = None
    topic: Optional[str] = None

class SaveErrorRequest(BaseModel):
    question_id: str
    wrong_answer: str
    correct_answer_snapshot: Optional[str] = None
    system_explanation: Optional[str] = None
    error_category: Optional[str] = None
    error_category_id: Optional[str] = None
    question_text: Optional[str] = None

class UpdateErrorRequest(BaseModel):
    error_category_id: Optional[str] = None
    user_reflection_notes: Optional[str] = None
    is_mastered: Optional[bool] = None
    why_wrong: Optional[str] = None
    how_to_fix: Optional[str] = None

class ChatMessageRequest(BaseModel):
    message: str
    history: list[dict] = []

class ScheduleReviewRequest(BaseModel):
    error_id: str
    algorithm: SpacedRepAlgo = "sm2"
    rating: int = 3

class ReExplainRequest(BaseModel):
    error_id: str
    user_explanation: str

class CreateCategoryRequest(BaseModel):
    label: str
    description: Optional[str] = None
    color_hex: str = "#6B7280"
    icon: str = "tag"

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _sm2_next(review_count: int, ease: float, rating: int) -> tuple[int, float, datetime]:

    if rating < 1:
        rating = 1
    if rating > 4:
        rating = 4

    q = (rating - 1) * (5 / 3)   # map 1-4 → 0-5 quality

    if q < 3 or review_count == 0:
        interval = 1
        new_count = 0
    elif review_count == 1:
        interval = 6
        new_count = 1
    else:
        interval = round(review_count * ease)
        new_count = review_count

    new_ease = max(1.3, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    return (max(1, interval), new_ease, _now() + timedelta(days=max(1, interval)))


_FSRS_W = [0.4072,1.1829,3.1262,15.4722,7.2102,0.5316,1.0651,0.0589,1.5330,0.1544,1.0071,1.9395,0.1100,0.2900,2.2700,0.2500,2.9898,0.5100,0.4340]
_FSRS_DECAY = -0.5
_FSRS_FACTOR = 0.9 ** (1 / _FSRS_DECAY) - 1

def _fsrs_next(review_count: int, stability: float, rating: int) -> tuple[int, float, datetime]:
    W = _FSRS_W
    s = max(0.1, stability)
    r = (1 + _FSRS_FACTOR / s) ** _FSRS_DECAY
    if rating < 3:
        new_stability = max(0.1, W[11] * (5 ** -W[12]) * ((s + 1) ** W[13] - 1) * math.exp(W[14] * (1 - r)))
        interval = 1
    else:
        hard_penalty = W[15] if rating == 3 else 1.0
        easy_bonus = W[16] if rating == 5 else 1.0
        new_stability = s * (math.exp(W[8]) * (11 - 5) * (s ** -W[9]) * (math.exp(W[10] * (1 - r)) - 1) * hard_penalty * easy_bonus + 1)
        interval = max(1, round(new_stability))
    return (interval, round(new_stability, 4), _now() + timedelta(days=interval))


def _simple_next(review_count: int, rating: int) -> tuple[int, datetime]:

    if rating < 2:
        interval = 1
    else:
        interval = max(1, 2 ** review_count)
    return (interval, _now() + timedelta(days=interval))


LEITNER_INTERVALS = [1, 3, 7, 14, 30]   # boxes 0-4

def _leitner_next(review_count: int, rating: int) -> tuple[int, datetime]:

    if rating >= 3:
        box = min(review_count + 1, len(LEITNER_INTERVALS) - 1)
    else:
        box = 0
    interval = LEITNER_INTERVALS[box]
    return (interval, _now() + timedelta(days=interval))

def _compute_next_review(
    algorithm: SpacedRepAlgo,
    review_count: int,
    rating: int,
    ease: float = 2.5,
    stability: float = 2.0,
) -> dict[str, Any]:
    
    if algorithm == "sm2":
        interval, new_ease, next_dt = _sm2_next(review_count, ease, rating)
        return {"interval": interval, "ease": new_ease, "next_review_time": next_dt, "stability": stability}
    if algorithm == "fsrs":
        interval, new_stability, next_dt = _fsrs_next(review_count, stability, rating)
        return {"interval": interval, "ease": ease, "next_review_time": next_dt, "stability": new_stability}
    if algorithm == "simple":
        interval, next_dt = _simple_next(review_count, rating)
        return {"interval": interval, "ease": ease, "next_review_time": next_dt, "stability": stability}

    interval, next_dt = _leitner_next(review_count, rating)
    return {"interval": interval, "ease": ease, "next_review_time": next_dt, "stability": stability}

async def _resolve_category_id(db, error_category: Optional[str], error_category_id: Optional[str]) -> Optional[str]:

    if error_category_id:
        return error_category_id
    slug = (error_category or "unknown").strip().lower()
    row = await db.fetchrow("SELECT id FROM error_categories WHERE slug=$1", slug)
    if row:
        return str(row["id"])

    # Unknown slug — fall back to the 'unknown' category
    row = await db.fetchrow("SELECT id FROM error_categories WHERE slug='unknown'")
    if row:
        return str(row["id"])

    # No 'unknown' category exists — reject the request so bad slugs don't produce NULL-category entries
    if error_category and error_category != "unknown":
        raise HTTPException(status_code=400, detail=f"Unknown error category slug: '{slug}'")
    return None

async def _ai_categorise(question_text: str, wrong_answer: str, correct_answer: str) -> str:
    prompt = (
        f"Question: {question_text}\n"
        f"Student answer: {wrong_answer}\n"
        f"Correct answer: {correct_answer}\n\n"
        "Reply with ONLY the category slug, nothing else."
    )
    try:
        async def _ai_call():
            async with ai_provider.session(
                system_prompt=(
                    "You are a tutor. Classify the student's mistake into EXACTLY ONE of these categories: "
                    "conceptual_misunderstanding, calculation_error, memory_slip, misinterpretation, procedural_error, unknown. "
                    "Reply with ONLY the category slug."
                )
            ) as session:
                return await ai_provider.generate(
                    prompt=prompt,
                    session=session,
                    temperature=0.0,
                    user_priority=UserPriority.REGULAR,
                )

        raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_call, UserPriority.REGULAR
        )
        text = raw.strip().lower().replace(" ", "_")
        valid = {"conceptual_misunderstanding", "calculation_error", "memory_slip",
                 "misinterpretation", "procedural_error", "unknown"}
        return text if text in valid else "unknown"
    except Exception:
        return "unknown"

@router.get("/categories")
async def list_error_categories(db=Depends(get_postgres)):
    rows = await db.fetch("SELECT id::text, slug, label, description, color_hex, icon, is_system, sort_order FROM error_categories ORDER BY sort_order")
    return {"categories": [dict(r) for r in rows]}

@router.post("/categories", status_code=201)
async def create_error_category(
    payload: CreateCategoryRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    slug = re.sub(r'[^a-z0-9]+', '_', payload.label.strip().lower()).strip('_')[:60]
    row = await db.fetchrow(
        """INSERT INTO error_categories (slug, label, description, color_hex, icon, is_system)
           VALUES ($1, $2, $3, $4, $5, FALSE)
           ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label
           RETURNING id::text, slug, label, description, color_hex, icon, is_system, sort_order""",
        slug, payload.label.strip(), payload.description, payload.color_hex, payload.icon
    )
    return dict(row)

@router.post("/save", status_code=status.HTTP_201_CREATED)
async def save_error(
    payload: SaveErrorRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    slug = payload.error_category or "unknown"
    if slug == "unknown" and not payload.error_category_id and payload.question_text and payload.correct_answer_snapshot:
        slug = await _ai_categorise(
            payload.question_text,
            payload.wrong_answer,
            payload.correct_answer_snapshot,
        )

    category_id = await _resolve_category_id(db, slug, payload.error_category_id)

    next_review = _now() + timedelta(days=1)

    error_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO error_book (
            id, user_id, question_id, wrong_answer,
            correct_answer_snapshot, system_explanation,
            error_category_id, next_review_time
        ) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7::uuid,$8)
        """,
        error_id,
        user_id,
        payload.question_id,
        payload.wrong_answer,
        payload.correct_answer_snapshot,
        payload.system_explanation,
        category_id,
        next_review,
    )

    cat_row = await db.fetchrow("SELECT label FROM error_categories WHERE id=$1::uuid", category_id) if category_id else None
    label = cat_row["label"] if cat_row else "Mistake"
    try:
        await notification_service.notify(
            user_id=user_id,
            event_type="error.logged",
            data={
                "title": f"Error Recorded: {label}",
                "message": "A wrong answer was saved to your Error Log. Review it to improve!",
                "error_id": error_id,
                "category": slug,
                "action_url": "/application/error-log",
            },
            persist=True,
            db=db,
        )
    except Exception:
        pass

    return {
        "id": error_id,
        "user_id": user_id,
        "question_id": payload.question_id,
        "error_category_id": category_id,
        "error_category": slug,
        "next_review_time": next_review.isoformat(),
    }


@router.post("/save-manual", status_code=status.HTTP_201_CREATED)
async def save_error_manual(
    payload: ManualSaveErrorRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    slug = payload.error_category or "unknown"
    if slug == "unknown" and not payload.error_category_id and payload.question_text and payload.correct_answer_snapshot:
        slug = await _ai_categorise(
            payload.question_text,
            payload.wrong_answer,
            payload.correct_answer_snapshot,
        )

    category_id = await _resolve_category_id(db, slug, payload.error_category_id)

    stub_q_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO exam_questions
          (id, source_exam, year, question_stem, question_type, correct_answer, topic)
        VALUES ($1, 'Manual', $2, $3, 'longq', $4, $5)
        """,
        stub_q_id,
        datetime.now(timezone.utc).year,
        payload.question_text,
        payload.correct_answer_snapshot or "",
        payload.topic or "Manual",
    )

    next_review = _now() + timedelta(days=1)
    error_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO error_book (
            id, user_id, question_id, wrong_answer,
            correct_answer_snapshot, system_explanation,
            error_category_id, next_review_time
        ) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7::uuid,$8)
        """,
        error_id, user_id, stub_q_id,
        payload.wrong_answer,
        payload.correct_answer_snapshot,
        payload.system_explanation,
        category_id, next_review,
    )

    return {
        "id": error_id,
        "error_category_id": category_id,
        "error_category": slug,
        "next_review_time": next_review.isoformat(),
    }

@router.get("")
async def list_errors(
    filter: str = "all",
    limit: int = 100,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])
    where = "WHERE eb.user_id = $1"
    params: list[Any] = [user_id]

    if filter == "open":
        where += " AND eb.is_mastered = FALSE"
    elif filter == "mastered":
        where += " AND eb.is_mastered = TRUE"
    elif filter == "due":
        where += " AND eb.is_mastered = FALSE AND (eb.next_review_time IS NULL OR eb.next_review_time <= NOW())"

    rows = await db.fetch(
        f"""
        SELECT
            eb.id::text,
            eb.question_id::text,
            eb.wrong_answer,
            eb.correct_answer_snapshot,
            eb.system_explanation,
            eb.error_category_id::text,
            ec.id::text AS category_id,
            ec.slug AS error_category,
            ec.label AS category_label,
            ec.color_hex AS category_color,
            eb.user_reflection_notes,
            eb.first_wrong_time,
            eb.last_review_time,
            eb.next_review_time,
            eb.review_count,
            eb.is_mastered,
            eb.error_pattern_tags,
            eq.question_stem,
            eq.topic,
            eq.source_exam,
            eq.year,
            eq.question_type
        FROM error_book eb
        LEFT JOIN error_categories ec ON eb.error_category_id = ec.id
        LEFT JOIN exam_questions eq ON eb.question_id = eq.id
        {where}
        ORDER BY eb.first_wrong_time DESC
        LIMIT $2
        """,
        user_id, limit,
    )

    return {"errors": [dict(r) for r in rows]}

@router.post("/{error_id}/analyse")
async def analyse_mistake(
    error_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    row = await db.fetchrow(
        """
        SELECT eb.wrong_answer, eb.correct_answer_snapshot, eb.system_explanation,
               eb.error_category_id,
               ec.slug AS error_category,
               eq.question_stem, eq.topic
        FROM error_book eb
        LEFT JOIN error_categories ec ON eb.error_category_id = ec.id
        LEFT JOIN exam_questions eq ON eb.question_id = eq.id
        WHERE eb.id=$1::uuid AND eb.user_id=$2
        """,
        error_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Error not found")

    prompt = (
        f"Topic: {row['topic'] or 'unknown'}\n"
        f"Question: {row['question_stem'] or ''}\n"
        f"Student's wrong answer: {row['wrong_answer']}\n"
        f"Correct answer: {row['correct_answer_snapshot'] or ''}\n"
        f"Explanation: {row['system_explanation'] or ''}\n\n"
        "Analyse this mistake and respond in JSON:\n"
        '{{\n'
        '  "category": "<one of: conceptual_misunderstanding|calculation_error|memory_slip|misinterpretation|procedural_error|unknown>",\n'
        '  "why_wrong": "<concise explanation of why the student got it wrong>",\n'
        '  "how_to_fix": "<concrete steps or tips to avoid this mistake>",\n'
        '  "related_concepts": ["<concept1>", "<concept2>"],\n'
        '  "confidence": <0.0-1.0>\n'
        '}}'
    )

    try:
        import json, re as _re

        async def _ai_analyse():
            async with ai_provider.session(
                system_prompt=(
                    "You are an expert tutor analysing a student's mistake. "
                    "Be specific, constructive, and respond with valid JSON only."
                )
            ) as session:
                return await ai_provider.generate(
                    prompt=prompt,
                    session=session,
                    temperature=0.3,
                    user_priority=UserPriority.REGULAR,
                )

        raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_analyse, UserPriority.REGULAR
        )

        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0]
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0]

        m = _re.search(r"\{.*\}", raw.strip(), _re.DOTALL)
        result: dict = json.loads(m.group()) if m else {}
    except Exception as exc:
        logger.warning("analyse AI error: %s", exc)
        result = {}

    detected_slug: str = result.get("category", "unknown")
    valid_cats = {"conceptual_misunderstanding", "calculation_error", "memory_slip",
                  "misinterpretation", "procedural_error", "unknown"}
    if detected_slug not in valid_cats:
        detected_slug = "unknown"

    current_slug = row["error_category"] or "unknown"

    if current_slug == "unknown" or detected_slug != "unknown":
        cat_row = await db.fetchrow("SELECT id FROM error_categories WHERE slug=$1", detected_slug)
        if cat_row:
            await db.execute(
                "UPDATE error_book SET error_category_id=$3::uuid WHERE id=$1::uuid AND user_id=$2",
                error_id, user_id, str(cat_row["id"]),
            )

    return {
        "category": detected_slug,
        "why_wrong": result.get("why_wrong", ""),
        "how_to_fix": result.get("how_to_fix", ""),
        "related_concepts": result.get("related_concepts", []),
        "confidence": result.get("confidence", 0.0),
    }

@router.patch("/{error_id}")
async def update_error(
    error_id: str,
    payload: UpdateErrorRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    sets, params = [], [user_id, error_id]
    i = 3
    if payload.error_category_id is not None:
        sets.append(f"error_category_id = ${i}::uuid")
        params.append(payload.error_category_id)
        i += 1
    if payload.user_reflection_notes is not None:
        sets.append(f"user_reflection_notes = ${i}")
        params.append(payload.user_reflection_notes)
        i += 1
    if payload.is_mastered is not None:
        sets.append(f"is_mastered = ${i}")
        params.append(payload.is_mastered)
        i += 1

    if not sets:
        raise HTTPException(status_code=400, detail="Nothing to update")

    await db.execute(
        f"UPDATE error_book SET {', '.join(sets)} WHERE user_id=$1 AND id=$2::uuid",
        *params,
    )
    return {"ok": True}

@router.post("/{error_id}/chat")
async def chat_about_mistake(
    error_id: str,
    payload: ChatMessageRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    row = await db.fetchrow(
        """
        SELECT eb.wrong_answer, eb.correct_answer_snapshot, eb.system_explanation,
               eq.question_stem, eq.topic
        FROM error_book eb
        LEFT JOIN exam_questions eq ON eb.question_id = eq.id
        WHERE eb.id=$1::uuid AND eb.user_id=$2
        """,
        error_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Error not found")

    system_prompt = (
        "You are a helpful tutor. The student got a question wrong and wants to understand why. "
        "Be concise, friendly, and educational. Use the context below to answer their questions.\n\n"
        f"Topic: {row['topic'] or 'unknown'}\n"
        f"Question: {row['question_stem'] or ''}\n"
        f"Student's wrong answer: {row['wrong_answer']}\n"
        f"Correct answer: {row['correct_answer_snapshot'] or ''}\n"
        f"Explanation: {row['system_explanation'] or ''}"
    )

    history_text = ""
    for msg in payload.history[-6:]:   # last 3 turns
        role = "Student" if msg.get("role") == "user" else "Tutor"
        history_text += f"{role}: {msg.get('content', '')}\n"

    prompt = f"{history_text}Student: {payload.message}\nTutor:"

    try:
        async def _ai_chat():
            async with ai_provider.session(system_prompt=system_prompt) as session:
                return await ai_provider.generate(
                    prompt=prompt,
                    session=session,
                    temperature=0.4,
                    user_priority=UserPriority.REGULAR,
                )

        reply = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_chat, UserPriority.REGULAR
        )
        return {"reply": reply.strip()}
    except Exception as exc:
        logger.warning("chat AI error: %s", exc)
        raise HTTPException(status_code=500, detail="AI unavailable")

@router.post("/schedule-review")
async def schedule_review(
    payload: ScheduleReviewRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    row = await db.fetchrow(
        "SELECT review_count, ease_factor, stability FROM error_book WHERE id=$1::uuid AND user_id=$2",
        payload.error_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Error not found")

    result = _compute_next_review(
        algorithm=payload.algorithm,
        review_count=row["review_count"],
        rating=payload.rating,
        ease=float(row["ease_factor"] or 2.5),
        stability=float(row["stability"] or 2.0),
    )

    await db.execute(
        """
        UPDATE error_book
        SET review_count = review_count + 1,
            last_review_time = NOW(),
            next_review_time = $3,
            ease_factor = $4,
            stability = $5
        WHERE id=$1::uuid AND user_id=$2
        """,
        payload.error_id,
        user_id,
        result["next_review_time"],
        result["ease"],
        result["stability"],
    )

    return {
        "error_id": payload.error_id,
        "algorithm": payload.algorithm,
        "next_review_time": result["next_review_time"].isoformat(),
        "interval_days": result["interval"],
    }

@router.post("/re-explain")
async def re_explain(
    payload: ReExplainRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    row = await db.fetchrow(
        """
        SELECT eb.wrong_answer, eb.correct_answer_snapshot, eb.system_explanation,
               eq.question_stem, eq.topic
        FROM error_book eb
        LEFT JOIN exam_questions eq ON eb.question_id = eq.id
        WHERE eb.id=$1::uuid AND eb.user_id=$2
        """,
        payload.error_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Error not found")

    prompt = (
        f"Topic: {row['topic'] or 'unknown'}\n"
        f"Original question: {row['question_stem'] or ''}\n"
        f"Previous wrong answer: {row['wrong_answer']}\n"
        f"Correct answer: {row['correct_answer_snapshot'] or ''}\n"
        f"System explanation: {row['system_explanation'] or ''}\n\n"
        f"Student's new explanation: {payload.user_explanation}\n\n"
        'Respond in JSON: {{"understood": true/false, "confidence": 0.0-1.0, "feedback": "...", "gaps": [...]}}'
    )

    try:
        import json, re as _re

        async def _ai_verify():
            async with ai_provider.session(
                system_prompt=(
                    "You are a tutor checking if a student now understands a concept they previously got wrong. "
                    "Always respond with valid JSON only."
                )
            ) as session:
                return await ai_provider.generate(
                    prompt=prompt,
                    session=session,
                    temperature=0.3,
                    user_priority=UserPriority.REGULAR,
                )

        raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_verify, UserPriority.REGULAR
        )

        m = _re.search(r"\{.*\}", raw, _re.DOTALL)
        result = json.loads(m.group()) if m else {
            "understood": False, "confidence": 0.0,
            "feedback": raw.strip(), "gaps": []
        }
    except Exception as exc:
        logger.warning("re-explain AI error: %s", exc)
        result = {"understood": False, "confidence": 0.0,
                  "feedback": "AI evaluation unavailable.", "gaps": []}

    understood = bool(result.get("understood"))
    await db.execute(
        """
        UPDATE error_book
        SET user_reflection_notes = $3,
            is_mastered = $4
        WHERE id=$1::uuid AND user_id=$2
        """,
        payload.error_id,
        user_id,
        payload.user_explanation,
        understood,
    )

    return result

@router.get("/stats/patterns")
async def error_patterns(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    user_id = str(current_user["id"])

    cat_rows = await db.fetch(
        """
        SELECT ec.slug AS error_category, ec.label AS category_label, COUNT(*)::int AS count
        FROM error_book eb
        LEFT JOIN error_categories ec ON eb.error_category_id = ec.id
        WHERE eb.user_id=$1 AND eb.is_mastered=FALSE
        GROUP BY ec.slug, ec.label
        ORDER BY count DESC
        """,
        user_id,
    )

    topic_rows = await db.fetch(
        """
        SELECT eq.topic, COUNT(*)::int AS count
        FROM error_book eb
        LEFT JOIN exam_questions eq ON eb.question_id = eq.id
        WHERE eb.user_id=$1 AND eb.is_mastered=FALSE AND eq.topic IS NOT NULL
        GROUP BY eq.topic
        ORDER BY count DESC
        LIMIT 10
        """,
        user_id,
    )

    weekly_rows = await db.fetch(
        """
        SELECT DATE_TRUNC('day', first_wrong_time)::date AS day, COUNT(*)::int AS count
        FROM error_book
        WHERE user_id=$1 AND first_wrong_time >= NOW() - INTERVAL '28 days'
        GROUP BY day
        ORDER BY day
        """,
        user_id,
    )

    return {
        "by_category": [dict(r) for r in cat_rows],
        "by_topic": [dict(r) for r in topic_rows],
        "weekly": [{"day": str(r["day"]), "count": r["count"]} for r in weekly_rows],
    }
