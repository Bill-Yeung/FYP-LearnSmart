import logging
from uuid import UUID
from typing import Optional

logger = logging.getLogger(__name__)

VALID_SUB_TYPES: dict[str, set[str]] = {
    "flashcard":    {"review", "create", "modify", "share", "obtain", "delete", "view"},
    "error_review": {"review", "complete", "add", "view"},
    "assignment":   {"submit", "start", "view"},
    "quiz":         {"attempt", "complete", "view"},
    "document":     {"upload", "view", "delete"},
    "feynman":      {"create", "practice", "view"},
    "challenge":    {"attempt", "complete", "join", "view"},
    "mentorship":   {"session", "request"},
    "study_plan":   {"complete", "create", "view"},
}

MEANINGFUL_SUB_TYPES: dict[str, set[str]] = {
    "flashcard":    {"review", "create"},
    "error_review": {"review", "complete"},
    "assignment":   {"submit"},
    "quiz":         {"attempt", "complete"},
    "document":     {"upload"},
    "feynman":      {"create", "practice"},
    "challenge":    {"attempt", "complete"},
    "mentorship":   {"session"},
    "study_plan":   {"complete"},
}

def is_meaningful(activity_type: str, sub_type: Optional[str] = None) -> bool:

    allowed = MEANINGFUL_SUB_TYPES.get(activity_type)
    if allowed is None:
        return False
    if sub_type is None:
        return False
    return sub_type in allowed

async def log_activity(
    db,
    user_id: UUID,
    activity_type: str,
    sub_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    details: Optional[dict] = None,
) -> None:

    try:
        import json
        await db.execute(
            """
            INSERT INTO learning_activity_log (user_id, activity_type, sub_type, resource_id, details)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            """,
            user_id,
            activity_type,
            sub_type,
            resource_id,
            json.dumps(details) if details else None,
        )
    except Exception as e:
        logger.warning(f"Failed to log activity: {e}")
