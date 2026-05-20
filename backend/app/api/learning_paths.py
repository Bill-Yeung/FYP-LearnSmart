from fastapi import APIRouter, Depends, Query
import asyncpg

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.repositories.learningpath_repository import LearningPathRepository

router = APIRouter(prefix="/learning-paths", tags=["Learning Paths"])

@router.get("")
async def list_learning_paths(
    language: str = Query("en", max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user),
):

    repo = LearningPathRepository(db)
    rows = await repo.get_user_learning_paths(
        user_id=current_user["id"],
        language=language,
        limit=page_size,
    )

    learning_paths = [
        {
            "id": str(r["id"]),
            "title": r.get("title") or r.get("target_concept_title") or "Untitled Path",
            "description": r.get("description"),
            "target_concept_title": r.get("target_concept_title"),
            "status": "active",
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        }
        for r in rows
    ]

    return {
        "learning_paths": learning_paths,
        "total": len(learning_paths),
        "page": page,
        "page_size": page_size,
    }
