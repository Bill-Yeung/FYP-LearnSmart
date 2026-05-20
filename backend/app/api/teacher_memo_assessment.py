import io
import json
import uuid as _uuid
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from app.core.database import get_postgres
from app.core.dependencies import require_teacher
from app.services.ai.provider import ai_provider

router = APIRouter(prefix="/teacher", tags=["Teacher"])

@router.get("/decks")
async def list_my_decks(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch(
        """
        SELECT d.id, d.title AS name, d.description, d.subject, d.tags,
               d.visibility, d.is_template, d.created_at,
               COUNT(fdc.flashcard_id) AS card_count
        FROM flashcard_decks d
        LEFT JOIN flashcard_deck_cards fdc ON fdc.deck_id = d.id
        WHERE d.teacher_id = $1
        GROUP BY d.id
        ORDER BY d.created_at DESC
        """,
        current_user["id"],
    )
    return {"decks": [dict(r) for r in rows]}

@router.post("/decks")
async def create_deck(
    payload: dict = Body(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    import json as _json
    row = await db.fetchrow(
        """
        INSERT INTO flashcard_decks
          (teacher_id, title, description, subject, tags, visibility)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """,
        current_user["id"],
        payload.get("title", "Untitled Deck"),
        payload.get("description", ""),
        payload.get("subject", ""),
        payload.get("tags", []),
        payload.get("visibility", "class_only"),
    )
    return {"id": str(row["id"]), "message": "Deck created"}

@router.put("/decks/{deck_id}")
async def update_deck(
    deck_id: UUID,
    payload: dict = Body(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    await db.execute(
        """
        UPDATE flashcard_decks SET
          title       = COALESCE($1, title),
          description = COALESCE($2, description),
          subject     = COALESCE($3, subject),
          visibility  = COALESCE($4, visibility),
          updated_at  = CURRENT_TIMESTAMP
        WHERE id = $5 AND teacher_id = $6
        """,
        payload.get("title"), payload.get("description"),
        payload.get("subject"), payload.get("visibility"),
        deck_id, current_user["id"],
    )
    return {"message": "Deck updated"}

@router.delete("/decks/{deck_id}")
async def delete_deck(
    deck_id: UUID,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    await db.execute(
        "DELETE FROM flashcard_decks WHERE id = $1 AND teacher_id = $2",
        deck_id, current_user["id"],
    )
    return {"message": "Deck deleted"}

@router.get("/decks/quality-report")
async def card_quality_report(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    """Cards sorted by student failure rate (highest Again rate first)."""
    rows = await db.fetch(
        """
        SELECT f.id, f.front_content, f.back_content,
               COUNT(frh.id) AS total_reviews,
               COUNT(frh.id) FILTER (WHERE frh.rating = 1) AS again_count,
               ROUND(
                 100.0 * COUNT(frh.id) FILTER (WHERE frh.rating = 1)
                 / NULLIF(COUNT(frh.id), 0), 2
               ) AS again_rate_pct,
               ROUND(AVG(frh.duration_ms) / 1000.0, 1) AS avg_time_seconds
        FROM flashcard_decks d
        JOIN flashcard_deck_cards fdc ON fdc.deck_id = d.id
        JOIN flashcards f ON f.id = fdc.flashcard_id
        LEFT JOIN flashcard_review_history frh ON frh.flashcard_id = f.id
        WHERE d.teacher_id = $1 AND f.is_archived = FALSE
        GROUP BY f.id
        HAVING COUNT(frh.id) > 0
        ORDER BY again_rate_pct DESC NULLS LAST
        LIMIT 50
        """,
        current_user["id"],
    )
    return {"problem_cards": [dict(r) for r in rows]}

@router.post("/decks/{deck_id}/assign")
async def assign_deck_to_class(
    deck_id: UUID,
    payload: dict = Body(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    class_id = payload.get("class_id")
    due_date = payload.get("due_date")

    deck = await db.fetchrow(
        "SELECT id FROM flashcard_decks WHERE id = $1 AND teacher_id = $2",
        deck_id, current_user["id"],
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    row = await db.fetchrow(
        """
        INSERT INTO deck_assignments
          (deck_id, teacher_id, class_id, due_date, status)
        VALUES ($1, $2, $3::uuid, $4::timestamp, 'active')
        ON CONFLICT DO NOTHING
        RETURNING id
        """,
        deck_id, current_user["id"], class_id, due_date,
    )
    return {"message": "Deck assigned to class", "assignment_id": str(row["id"]) if row else None}

@router.get("/assignments")
async def list_assignments(
    class_id: str = None,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    where = "WHERE da.teacher_id = $1"
    params = [current_user["id"]]
    if class_id:
        params.append(class_id)
        where += f" AND da.class_id = ${len(params)}::uuid"

    rows = await db.fetch(
        f"""
        SELECT da.id AS assignment_id, d.id AS deck_id, d.title AS deck_name,
               c.id AS class_id, c.name AS class_name,
               da.due_date, da.status,
               COUNT(DISTINCT ce.user_id) AS total_students,
               da.created_at
        FROM deck_assignments da
        JOIN flashcard_decks d ON d.id = da.deck_id
        JOIN classes c ON c.id = da.class_id
        LEFT JOIN class_enrollments ce ON ce.class_id = da.class_id AND ce.status = 'enrolled'
        {where}
        GROUP BY da.id, d.id, c.id
        ORDER BY da.created_at DESC
        """,
        *params,
    )
    return {"assignments": [dict(r) for r in rows]}

@router.get("/assignments/{assignment_id}/students")
async def assignment_student_breakdown(
    assignment_id: UUID,
    class_id: str = None,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch(
        """
        SELECT u.id AS student_id, u.display_name, u.username,
               ce.status AS enrollment_status,
               da.due_date,
               CASE WHEN da.status = 'completed' THEN 'completed'
                    ELSE 'assigned' END AS progress_status
        FROM deck_assignments da
        JOIN class_enrollments ce ON ce.class_id = da.class_id AND ce.status = 'enrolled'
        JOIN users u ON u.id = ce.user_id
        WHERE da.id = $1 AND da.teacher_id = $2
        ORDER BY u.display_name
        """,
        assignment_id, current_user["id"],
    )
    return {"students": [dict(r) for r in rows]}

@router.get("/question-bank")
async def list_questions(
    subject_id: str = None,
    difficulty: int = None,
    question_type: str = None,
    search: str = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    conditions = ["(q.created_by = $1 OR q.created_by IS NULL)"]
    params = [current_user["id"]]

    if subject_id:
        params.append(subject_id)
        conditions.append(f"q.subject_id = ${len(params)}::uuid")
    if difficulty:
        params.append(difficulty)
        conditions.append(f"q.difficulty = ${len(params)}")
    if question_type:
        params.append(question_type)
        conditions.append(f"q.question_type = ${len(params)}")
    if search:
        params.append(f"%{search}%")
        conditions.append(f"q.question_text ILIKE ${len(params)}")

    where = " AND ".join(conditions)
    params += [limit, offset]

    rows = await db.fetch(
        f"""
        SELECT q.id, q.question_text, q.question_type, q.difficulty,
               q.skill_dim, q.score_max, q.options, q.correct_answer,
               q.created_at, q.created_by,
               s.name AS subject_name,
               COUNT(taq.assessment_id) AS times_used,
               ROUND(AVG(taq.score_earned)::numeric, 2) AS avg_score
        FROM question_bank q
        LEFT JOIN subjects s ON s.id = q.subject_id
        LEFT JOIN teacher_assessment_questions taq ON taq.question_id = q.id
        WHERE {where}
        GROUP BY q.id, s.name
        ORDER BY q.created_at DESC
        LIMIT ${len(params)-1} OFFSET ${len(params)}
        """,
        *params,
    )
    return {"questions": [dict(r) for r in rows], "total": len(rows)}

@router.post("/question-bank")
async def create_question(
    payload: dict = Body(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    import json
    row = await db.fetchrow(
        """
        INSERT INTO question_bank
          (subject_id, question_type, question_text, options, correct_answer,
           skill_dim, difficulty, score_max, created_by)
        VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
        RETURNING id
        """,
        payload.get("subject_id"), payload["question_type"], payload["question_text"],
        json.dumps(payload.get("options")), json.dumps(payload["correct_answer"]),
        payload.get("skill_dim", "concept"), payload.get("difficulty", 1),
        payload.get("score_max", 1.0), current_user["id"],
    )
    return {"id": str(row["id"]), "message": "Question created"}

@router.put("/question-bank/{question_id}")
async def update_question(
    question_id: str,
    payload: dict = Body(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    import json
    await db.execute(
        """
        UPDATE question_bank SET
          question_text  = COALESCE($1, question_text),
          difficulty     = COALESCE($2, difficulty),
          skill_dim      = COALESCE($3, skill_dim),
          options        = COALESCE($4::jsonb, options),
          correct_answer = COALESCE($5::jsonb, correct_answer)
        WHERE id = $6 AND created_by = $7
        """,
        payload.get("question_text"), payload.get("difficulty"),
        payload.get("skill_dim"),
        json.dumps(payload["options"]) if payload.get("options") else None,
        json.dumps(payload["correct_answer"]) if payload.get("correct_answer") else None,
        question_id, current_user["id"],
    )
    return {"message": "Question updated"}


@router.delete("/question-bank/{question_id}")
async def delete_question(
    question_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    await db.execute(
        "DELETE FROM question_bank WHERE id = $1 AND created_by = $2",
        question_id, current_user["id"],
    )
    return {"message": "Question deleted"}

@router.get("/assessments")
async def list_assessments(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch(
        """
        SELECT a.id, a.title, a.assessment_type, a.time_limit_minutes,
               a.passing_score_percentage, a.created_at,
               COUNT(taq.question_id) AS question_count
        FROM teacher_assessments a
        LEFT JOIN teacher_assessment_questions taq ON taq.assessment_id = a.id
        WHERE a.teacher_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC
        """,
        current_user["id"],
    )
    return {"assessments": [dict(r) for r in rows]}

@router.post("/assessments")
async def create_assessment(
    payload: dict = Body(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    row = await db.fetchrow(
        """
        INSERT INTO teacher_assessments
          (teacher_id, title, description, assessment_type, time_limit_minutes,
           passing_score_percentage)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """,
        current_user["id"], payload["title"], payload.get("description", ""),
        payload.get("assessment_type", "Practice"), payload.get("time_limit_minutes"),
        payload.get("passing_score", 50),
    )
    return {"id": str(row["id"]), "message": "Assessment created"}

@router.post("/assessments/{assessment_id}/questions")
async def add_question_to_assessment(
    assessment_id: str,
    payload: dict = Body(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    await db.execute(
        """
        INSERT INTO teacher_assessment_questions
          (assessment_id, question_id, points, position)
        VALUES ($1::uuid, $2::uuid, $3, $4)
        ON CONFLICT (assessment_id, question_id) DO NOTHING
        """,
        assessment_id, payload["question_id"],
        payload.get("points", 1.0), payload.get("position", 0),
    )
    return {"message": "Question added to assessment"}

@router.put("/assessments/{assessment_id}/publish")
async def publish_assessment(
    assessment_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    await db.execute(
        "UPDATE teacher_assessments SET is_template = FALSE WHERE id = $1 AND teacher_id = $2",
        assessment_id, current_user["id"],
    )
    return {"message": "Assessment published"}

@router.get("/assessments/{assessment_id}/questions")
async def get_assessment_questions(
    assessment_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch(
        """
        SELECT qb.id, qb.question_text, qb.question_type,
               qb.options, qb.correct_answer, qb.score_max,
               taq.points, taq.position
        FROM teacher_assessment_questions taq
        JOIN question_bank qb ON qb.id = taq.question_id
        JOIN teacher_assessments a ON a.id = taq.assessment_id
        WHERE taq.assessment_id = $1::uuid AND a.teacher_id = $2
        ORDER BY taq.position
        """,
        assessment_id, current_user["id"],
    )
    return {"questions": [dict(r) for r in rows]}

@router.get("/grading/pending")
async def pending_grading_queue(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch(
        """
        SELECT a.id AS assessment_id, a.title,
               COUNT(DISTINCT aa.id) AS total_attempts,
               COUNT(DISTINCT aa.id) FILTER (WHERE aa.score IS NULL) AS ungraded
        FROM teacher_assessments a
        JOIN assessment_assignments asgn ON asgn.assessment_id = a.id
        JOIN assessment_activities aa ON aa.user_id = asgn.student_id
        WHERE a.teacher_id = $1
        GROUP BY a.id
        HAVING COUNT(DISTINCT aa.id) FILTER (WHERE aa.score IS NULL) > 0
        ORDER BY a.created_at DESC
        """,
        current_user["id"],
    )
    return {"queue": [dict(r) for r in rows]}

@router.get("/grading/{assessment_id}/submissions")
async def get_submissions(
    assessment_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch(
        """
        SELECT aa.id, aa.user_id, u.display_name, u.username,
               aa.score, aa.correctness AS is_correct, aa.created_at
        FROM assessment_activities aa
        JOIN users u ON u.id = aa.user_id
        JOIN assessment_assignments asgn ON asgn.student_id = aa.user_id
        JOIN teacher_assessments a ON a.id = asgn.assessment_id
        WHERE asgn.assessment_id = $1::uuid AND a.teacher_id = $2
        ORDER BY aa.created_at DESC
        """,
        assessment_id, current_user["id"],
    )
    return {"submissions": [dict(r) for r in rows]}

@router.put("/grading/{attempt_id}/score")
async def override_score(
    attempt_id: str,
    score: float = Body(..., embed=True),
    feedback: str = Body(None, embed=True),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    await db.execute(
        "UPDATE assessment_activities SET score = $1 WHERE id = $2::uuid",
        score, attempt_id,
    )
    return {"message": "Score updated"}

@router.get("/errors/class/{class_id}")
async def class_error_patterns(
    class_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    top_categories = await db.fetch(
        """
        SELECT ec.label AS category, COUNT(eb.id) AS count
        FROM error_book eb
        JOIN class_enrollments ce ON ce.user_id = eb.user_id AND ce.status = 'enrolled'
        JOIN error_categories ec ON ec.id = eb.error_category_id
        WHERE ce.class_id = $1
        GROUP BY ec.label
        ORDER BY count DESC
        LIMIT 10
        """,
        class_id,
    )

    top_topics = await db.fetch(
        """
        SELECT eb.topic, COUNT(*) AS count
        FROM error_book eb
        JOIN class_enrollments ce ON ce.user_id = eb.user_id AND ce.status = 'enrolled'
        WHERE ce.class_id = $1 AND eb.topic IS NOT NULL
        GROUP BY eb.topic
        ORDER BY count DESC
        LIMIT 10
        """,
        class_id,
    )

    mastery_rate = await db.fetchval(
        """
        SELECT ROUND(
          100.0 * COUNT(*) FILTER (WHERE eb.is_mastered = TRUE) / NULLIF(COUNT(*), 0), 2
        )
        FROM error_book eb
        JOIN class_enrollments ce ON ce.user_id = eb.user_id AND ce.status = 'enrolled'
        WHERE ce.class_id = $1
        """,
        class_id,
    ) or 0

    return {
        "top_categories": [dict(r) for r in top_categories],
        "top_topics": [dict(r) for r in top_topics],
        "mastery_rate_pct": float(mastery_rate),
    }

@router.get("/errors/class/{class_id}/topic/{topic}")
async def error_topic_drilldown(
    class_id: str,
    topic: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch(
        """
        SELECT u.display_name, u.username,
               eb.wrong_answer, eb.correct_answer_snapshot,
               eb.review_count, eb.is_mastered, eb.first_wrong_time
        FROM error_book eb
        JOIN users u ON u.id = eb.user_id
        JOIN class_enrollments ce ON ce.user_id = eb.user_id AND ce.status = 'enrolled'
        WHERE ce.class_id = $1 AND eb.topic = $2
        ORDER BY eb.first_wrong_time DESC
        """,
        class_id, topic,
    )
    return {"errors": [dict(r) for r in rows]}

@router.get("/errors/misconceptions/{class_id}")
async def misconception_alerts(
    class_id: str,
    threshold_pct: float = 30.0,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    total_students = await db.fetchval(
        "SELECT COUNT(*) FROM class_enrollments WHERE class_id = $1 AND status = 'enrolled'",
        class_id,
    ) or 1

    rows = await db.fetch(
        """
        SELECT eb.topic, eb.wrong_answer,
               COUNT(DISTINCT eb.user_id) AS affected_students,
               ROUND(100.0 * COUNT(DISTINCT eb.user_id) / $2, 2) AS pct
        FROM error_book eb
        JOIN class_enrollments ce ON ce.user_id = eb.user_id AND ce.status = 'enrolled'
        WHERE ce.class_id = $1 AND eb.topic IS NOT NULL
        GROUP BY eb.topic, eb.wrong_answer
        HAVING ROUND(100.0 * COUNT(DISTINCT eb.user_id) / $2, 2) >= $3
        ORDER BY pct DESC
        """,
        class_id, total_students, threshold_pct,
    )
    return {"alerts": [dict(r) for r in rows]}

@router.get("/analytics/flashcards/{class_id}")
async def class_flashcard_analytics(
    class_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    student_stats = await db.fetch(
        """
        SELECT u.id AS student_id, u.display_name, u.username,
               COUNT(fs.flashcard_id) AS total_assigned,
               COUNT(fs.flashcard_id) FILTER (WHERE fs.state = 'review') AS mastered,
               COUNT(fs.flashcard_id) FILTER (WHERE fs.due_date <= NOW() AND fs.state != 'review') AS overdue,
               MAX(fs.last_review_date) AS last_review,
               fs.algorithm
        FROM class_enrollments ce
        JOIN users u ON u.id = ce.user_id
        LEFT JOIN flashcard_schedules fs ON fs.user_id = ce.user_id
        WHERE ce.class_id = $1 AND ce.status = 'enrolled'
        GROUP BY u.id, fs.algorithm
        ORDER BY u.display_name
        """,
        class_id,
    )

    algo_dist = await db.fetch(
        """
        SELECT fs.algorithm, COUNT(DISTINCT fs.user_id) AS user_count
        FROM flashcard_schedules fs
        JOIN class_enrollments ce ON ce.user_id = fs.user_id AND ce.status = 'enrolled'
        WHERE ce.class_id = $1
        GROUP BY fs.algorithm
        """,
        class_id,
    )

    return {
        "students": [dict(r) for r in student_stats],
        "algorithm_distribution": [dict(r) for r in algo_dist],
    }

@router.get("/analytics/assessments/{class_id}")
async def class_assessment_analytics(
    class_id: str,
    assessment_id: str = None,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    extra = f"AND asgn.assessment_id = '{assessment_id}'" if assessment_id else ""

    stats = await db.fetch(
        f"""
        SELECT a.id AS assessment_id, a.title,
               COUNT(aa.id) AS total_attempts,
               ROUND(AVG(aa.score)::numeric, 2) AS avg_score,
               MAX(aa.score) AS highest_score,
               MIN(aa.score) AS lowest_score,
               ROUND(
                 100.0 * COUNT(aa.id) FILTER (WHERE aa.correctness = TRUE)
                 / NULLIF(COUNT(aa.id), 0), 2
               ) AS pass_rate_pct
        FROM teacher_assessments a
        JOIN assessment_assignments asgn ON asgn.assessment_id = a.id
        JOIN class_enrollments ce ON ce.class_id = asgn.class_id AND ce.status = 'enrolled'
        JOIN assessment_activities aa ON aa.user_id = ce.user_id
        WHERE asgn.class_id = $1::uuid AND a.teacher_id = $2 {extra}
        GROUP BY a.id
        ORDER BY a.created_at DESC
        """,
        class_id, current_user["id"],
    )

    per_question = await db.fetch(
        f"""
        SELECT qb.id, qb.question_text, qb.question_type,
               COUNT(aa.id) AS attempts,
               ROUND(
                 100.0 * COUNT(aa.id) FILTER (WHERE aa.correctness = TRUE)
                 / NULLIF(COUNT(aa.id), 0), 2
               ) AS correct_pct
        FROM teacher_assessment_questions taq
        JOIN question_bank qb ON qb.id = taq.question_id
        JOIN teacher_assessments a ON a.id = taq.assessment_id
        JOIN assessment_assignments asgn ON asgn.assessment_id = a.id
        JOIN class_enrollments ce ON ce.class_id = asgn.class_id AND ce.status = 'enrolled'
        JOIN assessment_activities aa ON aa.user_id = ce.user_id AND aa.question_id = qb.id
        WHERE asgn.class_id = $1::uuid AND a.teacher_id = $2 {extra}
        GROUP BY qb.id
        ORDER BY correct_pct ASC
        """,
        class_id, current_user["id"],
    )

    return {
        "assessment_stats": [dict(r) for r in stats],
        "per_question": [dict(r) for r in per_question],
    }

@router.get("/analytics/student/{student_id}")
async def student_progress_report(
    student_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    student = await db.fetchrow(
        "SELECT id, display_name, username, email FROM users WHERE id = $1",
        student_id,
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    flashcard_summary = await db.fetchrow(
        """
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE state = 'review') AS mastered,
               COUNT(*) FILTER (WHERE due_date <= NOW() AND state != 'review') AS overdue,
               MAX(last_review_date) AS last_review
        FROM flashcard_schedules
        WHERE user_id = $1
        """,
        student_id,
    )

    assessment_summary = await db.fetchrow(
        """
        SELECT COUNT(*) AS total_attempts,
               ROUND(AVG(score_earned)::numeric, 2) AS avg_score,
               COUNT(*) FILTER (WHERE is_correct = TRUE) AS correct
        FROM quiz_attempts
        WHERE user_id = $1
        """,
        student_id,
    )

    error_summary = await db.fetchrow(
        """
        SELECT COUNT(*) AS total_errors,
               COUNT(*) FILTER (WHERE is_mastered = TRUE) AS mastered_errors,
               COUNT(*) FILTER (WHERE is_mastered = FALSE) AS outstanding_errors
        FROM error_book
        WHERE user_id = $1
        """,
        student_id,
    )

    return {
        "student": dict(student),
        "flashcards": dict(flashcard_summary) if flashcard_summary else {},
        "assessments": dict(assessment_summary) if assessment_summary else {},
        "errors": dict(error_summary) if error_summary else {},
    }


@router.get("/subjects")
async def list_subjects(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    rows = await db.fetch("SELECT id, code, name FROM subjects ORDER BY name")
    return {"subjects": [dict(r) for r in rows]}

from fastapi import UploadFile, File, Form
import json
import csv

@router.post("/decks/{deck_id}/import")
async def import_cards(
    deck_id: UUID,
    file: UploadFile = File(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    deck = await db.fetchrow("SELECT id FROM flashcard_decks WHERE id = $1 AND teacher_id = $2", deck_id, current_user["id"])
    if not deck:
        raise HTTPException(404, "Deck not found")
        
    content = await file.read()
    added_count = 0
    
    if file.filename.endswith(".csv"):
        text = content.decode("utf-8").splitlines()
        reader = csv.DictReader(text)
        for row in reader:
            front = row.get("Front") or row.get("Question")
            back = row.get("Back") or row.get("Answer")
            if front and back:
                card_id = await db.fetchval(
                    "INSERT INTO flashcards (user_id, front_content, back_content) VALUES ($1, $2, $3) RETURNING id",
                    current_user["id"], front, back
                )
                await db.execute(
                    "INSERT INTO flashcard_deck_cards (deck_id, flashcard_id) VALUES ($1, $2)",
                    deck_id, card_id
                )
                added_count += 1
    elif file.filename.endswith(".json"):
        data = json.loads(content)
        for item in data:
            front = item.get("front") or item.get("question")
            back = item.get("back") or item.get("answer")
            if front and back:
                card_id = await db.fetchval(
                    "INSERT INTO flashcards (user_id, front_content, back_content) VALUES ($1, $2, $3) RETURNING id",
                    current_user["id"], front, back
                )
                await db.execute(
                    "INSERT INTO flashcard_deck_cards (deck_id, flashcard_id) VALUES ($1, $2)",
                    deck_id, card_id
                )
                added_count += 1
    else:
        raise HTTPException(400, "Unsupported file format. Use .csv or .json")
        
    return {"message": "Import successful", "added_count": added_count}

@router.post("/assessments/{assessment_id}/assign")
async def assign_assessment(
    assessment_id: UUID,
    assignment: dict,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    assessment = await db.fetchrow("SELECT id FROM teacher_assessments WHERE id = $1 AND teacher_id = $2", assessment_id, current_user["id"])
    if not assessment:
        raise HTTPException(404, "Assessment not found")
        
    class_id = assignment.get("class_id")
    student_id = assignment.get("student_id")
    start_time = assignment.get("start_time")
    end_time = assignment.get("end_time")
    
    if not class_id and not student_id:
        raise HTTPException(400, "Must provide class_id or student_id")
        
    assignment_id = await db.fetchval(
        """
        INSERT INTO assessment_assignments (assessment_id, teacher_id, class_id, student_id, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """,
        assessment_id, current_user["id"],
        UUID(class_id) if class_id else None,
        UUID(student_id) if student_id else None,
        start_time, end_time
    )
    return {"message": "Assignment successful", "id": str(assignment_id)}

@router.post("/papers/extract")
async def extract_past_paper(
    file: UploadFile = File(...),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):
    name = (file.filename or "").lower()
    data = await file.read()

    try:
        if name.endswith(".pdf"):
            import fitz
            pdf = fitz.open(stream=data, filetype="pdf")
            raw_text = "\n".join(page.get_text() for page in pdf)
            pdf.close()
        elif name.endswith(".docx"):
            from docx import Document as DocxDocument
            doc = DocxDocument(io.BytesIO(data))
            raw_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif name.endswith(".doc"):
            raw_text = data.decode("utf-8", errors="replace")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use .pdf, .doc, or .docx")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read file: {e}")

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="No readable text found in the file")

    prompt = f"""You are an exam question extractor. Given the text of a past paper below, extract every question and return a JSON array.

Each element must have:
- "question_text": the full question text (string)
- "question_type": one of "mcq", "tf", "short", "essay"
- "difficulty": one of "Easy", "Medium", "Hard"
- "options": array of strings for MCQ choices, or null
- "suggested_answer": the correct answer or model answer if present, or null

Return ONLY a valid JSON array, no extra text.

DOCUMENT:
{raw_text[:8000]}
"""

    try:
        ai_response = await ai_provider.generate(prompt=prompt, temperature=0.2, max_tokens=4000)
        text = ai_response.strip()
        # strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        extracted = json.loads(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {e}")

    questions = [
        {
            "id": str(_uuid.uuid4()),
            "question_text": q.get("question_text", ""),
            "question_type": q.get("question_type", "short"),
            "difficulty": q.get("difficulty", "Medium"),
            "options": q.get("options") or [],
            "suggested_answer": q.get("suggested_answer"),
        }
        for q in extracted
        if q.get("question_text")
    ]

    return {"message": f"Extracted {len(questions)} questions", "questions": questions}
