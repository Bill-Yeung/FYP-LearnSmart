from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime, date, timedelta

from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_teacher
from app.core.database import get_postgres
from app.core.activity import log_activity
from app.repositories.classroom_repository import ClassroomRepository

router = APIRouter(prefix="/classroom", tags=["Classroom"])

def _format_class(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "description": row.get("description"),
        "course_code": row.get("course_code"),
        "course_name": row.get("course_name"),
        "student_count": row.get("student_count", 0),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "teacher": {
            "username": row.get("teacher_username"),
            "display_name": row.get("teacher_display_name"),
            "avatar_url": row.get("teacher_avatar_url"),
        },
    }

def _format_classmate(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "email": row.get("email"),
        "display_name": row.get("display_name"),
        "avatar_url": row.get("avatar_url"),
        "joined_at": row["joined_at"].isoformat() if row.get("joined_at") else None,
    }

def _format_assignment(row: dict) -> dict:
    result = {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "assignment_type": row["assignment_type"],
        "due_at": row["due_at"].isoformat() if row.get("due_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }
    if row.get("submission_id"):
        result["submission"] = {
            "id": str(row["submission_id"]),
            "status": row["submission_status"],
            "submitted_at": row["submitted_at"].isoformat() if row.get("submitted_at") else None,
            "answer_text": row.get("answer_text"),
            "grade": float(row["grade"]) if row.get("grade") is not None else None,
            "teacher_feedback": row.get("teacher_feedback"),
        }
    if row.get("template_id"):
        result["template_id"] = str(row["template_id"])
    if row.get("script_id"):
        result["script_id"] = str(row["script_id"])
    return result

@router.get("/my-classes")
async def list_my_classes(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ClassroomRepository(db)
        rows = await repo.get_student_classes(current_user["id"])
        return {"classes": [_format_class(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateClassRequest(BaseModel):
    name: str
    description: str = ""
    class_code: str = ""

@router.get("/teacher/classes")
async def list_teacher_classes(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    rows = await repo.get_teacher_classes(current_user["id"])
    classes = []
    for r in rows:
        classes.append({
            "id": str(r["id"]),
            "name": r["name"],
            "description": r.get("description"),
            "class_code": r.get("course_code") or "",
            "course_name": r.get("course_name"),
            "student_count": r.get("student_count", 0),
            "pending_count": r.get("pending_count", 0),
            "status": r.get("status", "active"),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        })
    return {"classes": classes}

@router.get("/teacher/students")
async def list_teacher_students(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    rows = await repo.get_teacher_students(current_user["id"])
    students = []
    for r in rows:
        students.append({
            "id": str(r["id"]),
            "username": r["username"],
            "email": r.get("email"),
            "display_name": r.get("display_name"),
            "avatar_url": r.get("avatar_url"),
            "enrolled_at": r["enrolled_at"].isoformat() if r.get("enrolled_at") else None,
            "progress": {
                "completed_challenges": r.get("completed_challenges", 0),
                "total_points": r.get("total_points", 0),
            },
        })
    return {"students": students}

@router.post("/teacher/classes")
async def create_class_teacher(
    data: CreateClassRequest,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    try:
        row = await repo.create_class(
            current_user["id"], data.name, data.description,
            course_code=data.class_code.strip() if data.class_code.strip() else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {
        "message": "Class created successfully",
        "class": {
            "id": str(row["id"]),
            "name": row["name"],
            "description": row.get("description"),
            "class_code": row.get("course_code", ""),
            "student_count": 0,
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        },
    }

@router.get("/{class_id}")
async def get_class_detail(
    class_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ClassroomRepository(db)
        cls = await repo.get_class_detail(class_id)
        if not cls:
            raise HTTPException(status_code=404, detail="Class not found")

        classmates = await repo.get_classmates(class_id, exclude_user_id=current_user["id"])
        assignments = await repo.get_class_assignments(class_id, student_id=current_user["id"])

        return {
            "class": _format_class(cls),
            "classmates": [_format_classmate(c) for c in classmates],
            "assignments": [_format_assignment(a) for a in assignments],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/join")
async def join_class(
    class_code: str = Query(..., description="Course code to join"),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = ClassroomRepository(db)
        result = await repo.join_class_by_code(class_code, current_user["id"])
        if result is None:
            raise HTTPException(status_code=404, detail="No class found with that code")
        if result == "already_enrolled":
            return {"message": "You are already enrolled in this class", "status": "active"}
        if result == "pending":
            return {"message": "Join request sent! Waiting for teacher approval.", "status": "pending"}
        return {"message": "Join request sent!", "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/teacher/classes/{class_id}/pending")
async def list_pending_enrollments(
    class_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    owns = await db.fetchval(
        "SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2", class_id, current_user["id"]
    )
    if not owns:
        raise HTTPException(status_code=404, detail="Class not found")
    repo = ClassroomRepository(db)
    rows = await repo.get_pending_enrollments(class_id)
    return {
        "pending": [
            {
                "id": str(r["id"]),
                "student_id": str(r["student_id"]),
                "username": r.get("username"),
                "display_name": r.get("display_name"),
                "avatar_url": r.get("avatar_url"),
                "requested_at": r["joined_at"].isoformat() if r.get("joined_at") else None,
            }
            for r in rows
        ]
    }

@router.post("/teacher/enrollments/{enrollment_id}/approve")
async def approve_enrollment(
    enrollment_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    result = await repo.approve_enrollment(enrollment_id, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Enrollment not found or not authorized")
    return {"message": "Student approved"}

@router.post("/teacher/enrollments/{enrollment_id}/reject")
async def reject_enrollment(
    enrollment_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    result = await repo.reject_enrollment(enrollment_id, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Enrollment not found or not authorized")
    return {"message": "Student rejected"}

@router.patch("/teacher/classes/{class_id}/status")
async def update_class_status(
    class_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
    status: str = Query(..., description="New status: active or archived"),
):

    if status not in ("active", "archived"):
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'archived'")
    repo = ClassroomRepository(db)
    result = await repo.update_class_status(class_id, current_user["id"], status)
    if not result:
        raise HTTPException(status_code=404, detail="Class not found or not owned by you")
    return {"message": f"Class {status} successfully", "status": result["status"]}

@router.get("/teacher/students/{student_id}")
async def get_student_detail(
    student_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    student = await db.fetchrow(
        """
        SELECT u.id, u.username, u.email, u.display_name, up.avatar_url
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id = $1
        """,
        student_id,
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    classes = await repo.get_student_detail(student_id, current_user["id"])
    return {
        "student": {
            "id": str(student["id"]),
            "username": student["username"],
            "email": student.get("email"),
            "display_name": student.get("display_name"),
            "avatar_url": student.get("avatar_url"),
        },
        "classes": [
            {
                "class_id": str(c["class_id"]),
                "class_name": c["class_name"],
                "course_code": c.get("course_code"),
                "joined_at": c["joined_at"].isoformat() if c.get("joined_at") else None,
                "submissions_count": c.get("submissions_count", 0),
                "total_assignments": c.get("total_assignments", 0),
            }
            for c in classes
        ],
    }

@router.get("/teacher/students/{student_id}/activity")
async def get_student_activity(
    student_id: str,
    start: str = Query(None, description="Start date YYYY-MM-DD"),
    end: str = Query(None, description="End date YYYY-MM-DD"),
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    access = await db.fetchval(
        """
        SELECT 1 FROM class_enrollments ce
        JOIN classes c ON c.id = ce.class_id
        WHERE ce.student_id = $1 AND c.teacher_id = $2 AND ce.status = 'active'
        LIMIT 1
        """,
        student_id, current_user["id"],
    )
    if not access:
        raise HTTPException(status_code=403, detail="You don't teach this student")

    try:
        end_date = date.fromisoformat(end) if end else date.today()
        start_date = date.fromisoformat(start) if start else end_date - timedelta(days=30)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)

    student = await db.fetchrow(
        "SELECT id, username, display_name FROM users WHERE id = $1", student_id
    )

    rows = await db.fetch(
        """
        SELECT activity_type, sub_type, details, created_at
        FROM learning_activity_log
        WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
        ORDER BY created_at DESC
        LIMIT 200
        """,
        student_id, start_dt, end_dt,
    )

    activities = []
    for r in rows:
        activities.append({
            "activity_type": r["activity_type"],
            "sub_type": r.get("sub_type"),
            "details": r.get("details"),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        })

    day_rows = await db.fetch(
        """
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM learning_activity_log
        WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at)
        ORDER BY day
        """,
        student_id, start_dt, end_dt,
    )
    daily_summary = {r["day"].isoformat(): int(r["count"]) for r in day_rows}

    streak_rows = await db.fetch(
        """
        SELECT DISTINCT DATE(created_at) as day
        FROM learning_activity_log
        WHERE user_id = $1 AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
        ORDER BY day DESC
        """,
        student_id,
    )
    streak = 0
    today = date.today()
    for i, r in enumerate(streak_rows):
        if r["day"] == today - timedelta(days=i):
            streak += 1
        else:
            break

    return {
        "student": {
            "id": str(student["id"]),
            "username": student["username"],
            "display_name": student.get("display_name"),
        } if student else None,
        "activities": activities,
        "daily_summary": daily_summary,
        "streak": streak,
        "start": start_date.isoformat(),
        "end": end_date.isoformat(),
    }

class CreateAssignmentRequest(BaseModel):
    class_id: str
    title: str
    description: str = ""
    assignment_type: str = "text" 
    due_at: Optional[datetime] = None
    script_id: Optional[str] = None

class UpdateAssignmentRequest(BaseModel):
    title: str
    description: str = ""
    assignment_type: str = "text"
    due_at: Optional[datetime] = None
    script_id: Optional[str] = None

def _format_assignment_detail(row: dict) -> dict:
    result = {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "assignment_type": row["assignment_type"],
        "class_id": str(row["class_id"]),
        "script_id": str(row["script_id"]) if row.get("script_id") else None,
        "due_at": row["due_at"].isoformat() if row.get("due_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }
    return result

def _format_teacher_assignment(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "assignment_type": row["assignment_type"],
        "class_id": str(row["class_id"]),
        "class_name": row.get("class_name"),
        "course_code": row.get("course_code"),
        "due_at": row["due_at"].isoformat() if row.get("due_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "submission_count": row.get("submission_count", 0),
        "student_count": row.get("student_count", 0),
    }

@router.get("/teacher/assignments")
async def list_teacher_assignments(
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    rows = await repo.get_teacher_assignments(current_user["id"])
    return {"assignments": [_format_teacher_assignment(r) for r in rows]}

@router.post("/teacher/assignments")
async def create_assignment(
    data: CreateAssignmentRequest,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    due_at = data.due_at.replace(tzinfo=None) if data.due_at else None
    row = await repo.create_assignment(
        current_user["id"], data.class_id, data.title,
        data.description, data.assignment_type, due_at,
        script_id=data.script_id,
    )
    return {
        "message": "Assignment created successfully",
        "assignment": _format_assignment_detail(row),
    }

@router.put("/teacher/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    data: UpdateAssignmentRequest,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    due_at = data.due_at.replace(tzinfo=None) if data.due_at else None
    row = await repo.update_assignment(
        assignment_id, current_user["id"], data.title,
        data.description, data.assignment_type, due_at,
        script_id=data.script_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found or not owned by you")
    return {
        "message": "Assignment updated successfully",
        "assignment": _format_assignment_detail(row),
    }

@router.delete("/teacher/assignments/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    await repo.delete_assignment(assignment_id, current_user["id"])
    return {"message": "Assignment deleted successfully"}

@router.get("/teacher/assignments/{assignment_id}/submissions")
async def list_submissions(
    assignment_id: str,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    rows = await repo.get_assignment_submissions(assignment_id)
    return {
        "submissions": [
            {
                "id": str(r["id"]),
                "student_id": str(r["student_id"]),
                "username": r.get("username"),
                "display_name": r.get("display_name"),
                "avatar_url": r.get("avatar_url"),
                "answer_text": r.get("answer_text"),
                "status": r["status"],
                "grade": float(r["grade"]) if r.get("grade") is not None else None,
                "teacher_feedback": r.get("teacher_feedback"),
                "submitted_at": r["submitted_at"].isoformat() if r.get("submitted_at") else None,
                "graded_at": r["graded_at"].isoformat() if r.get("graded_at") else None,
            }
            for r in rows
        ]
    }

class GradeSubmissionRequest(BaseModel):
    grade: float
    feedback: str = ""

@router.post("/teacher/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: str,
    data: GradeSubmissionRequest,
    current_user=Depends(require_teacher),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    result = await repo.grade_submission(submission_id, current_user["id"], data.grade, data.feedback or None)
    if not result:
        raise HTTPException(status_code=404, detail="Submission not found or not authorized")
    return {"message": "Submission graded", "grade": float(result["grade"])}

@router.post("/assignments/{assignment_id}/start")
async def start_assignment(
    assignment_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    assignment = await repo.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not await repo.is_enrolled(str(assignment["class_id"]), current_user["id"]):
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    submission = await repo.start_assignment(assignment_id, current_user["id"])
    await log_activity(db, current_user["id"], "assignment", sub_type="start", resource_id=assignment_id)

    return {
        "message": "Assignment started",
        "submission": {
            "id": str(submission["id"]),
            "status": submission["status"],
        },
        "template_id": str(assignment["template_id"]) if assignment.get("template_id") else None,
    }

class TextSubmitRequest(BaseModel):
    answer_text: str

@router.post("/assignments/{assignment_id}/submit-text")
async def submit_text_answer(
    assignment_id: str,
    data: TextSubmitRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    assignment = await repo.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if not await repo.is_enrolled(str(assignment["class_id"]), current_user["id"]):
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    submission = await repo.submit_text_answer(assignment_id, current_user["id"], data.answer_text)
    await log_activity(db, current_user["id"], "assignment", sub_type="submit", resource_id=assignment_id)

    return {
        "message": "Answer submitted",
        "submission": {
            "id": str(submission["id"]),
            "status": submission["status"],
            "submitted_at": submission["submitted_at"].isoformat() if submission.get("submitted_at") else None,
        },
    }

@router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    repo = ClassroomRepository(db)
    assignment = await repo.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if not await repo.is_enrolled(str(assignment["class_id"]), current_user["id"]):
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    submission = await repo.submit_assignment(assignment_id, current_user["id"])
    if not submission:
        raise HTTPException(status_code=400, detail="No in-progress submission found to submit")

    await log_activity(db, current_user["id"], "assignment", sub_type="submit", resource_id=assignment_id)

    return {
        "message": "Assignment submitted",
        "submission": {
            "id": str(submission["id"]),
            "status": submission["status"],
            "submitted_at": submission["submitted_at"].isoformat() if submission.get("submitted_at") else None,
        },
    }
