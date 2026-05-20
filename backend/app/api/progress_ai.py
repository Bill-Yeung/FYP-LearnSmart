import json
import logging
import re

from fastapi import APIRouter, HTTPException, status

from app.models.progress_ai import (
    GroupAnalyticsRequest,
    GroupAnalyticsResponse,
    LearningPathwayRequest,
    LearningPathwayResponse,
)
from app.services.ai.provider import AIProvider, AIProviderError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress-ai", tags=["Progress AI"])

_json_object = re.compile(r"\{[\s\S]*\}")


def _parse_llm_json(raw_text: str) -> dict:
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        match = _json_object.search(raw_text)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}

async def _generate_json(prompt: str, *, temperature: float, max_tokens: int) -> dict:
    ai = AIProvider()
    try:
        async with ai.session(system_prompt=None) as session:
            raw = await ai.generate(
                prompt=prompt,
                session=session,
                temperature=temperature,
                max_tokens=max_tokens,
            )
    except AIProviderError as exc:
        logger.error("Progress AI provider error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    data = _parse_llm_json(raw)
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an unexpected response format",
        )
    return data

@router.post("/group-summary", response_model=GroupAnalyticsResponse)
async def generate_group_summary(payload: GroupAnalyticsRequest):
    prompt = "\n".join(
        [
            "You are an analytics assistant creating an anonymized cohort summary.",
            "Return JSON with `summary`, `privacy_check`, `signals`, and `recommended_actions`.",
            "Do not include markdown fences.",
            "",
            f"Cohort: {payload.cohort}",
            f"Requested range: {payload.range}",
            f"Classmate count: {payload.classmateCount}",
            f"Assignment count: {payload.assignmentCount}",
            f"Assignments due within 7 days: {payload.dueSoonCount}",
            f"Assignments due by weekday (Mon-Sun): {json.dumps(payload.dueByWeekday)}",
        ]
    )

    data = await _generate_json(prompt, temperature=0.25, max_tokens=900)
    summary = str(data.get("summary") or "").strip()
    privacy_check = str(data.get("privacy_check") or "").strip()
    signals = (
        [str(item).strip() for item in data.get("signals", []) if str(item).strip()]
        if isinstance(data.get("signals"), list)
        else []
    )
    recommended_actions = (
        [str(item).strip() for item in data.get("recommended_actions", []) if str(item).strip()]
        if isinstance(data.get("recommended_actions"), list)
        else []
    )

    if not summary and not privacy_check and not signals and not recommended_actions:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI did not return a cohort summary",
        )

    return GroupAnalyticsResponse(
        summary=summary or "No summary returned.",
        privacy_check=privacy_check or "No privacy note returned.",
        signals=signals,
        recommended_actions=recommended_actions,
    )


@router.post("/learning-pathway", response_model=LearningPathwayResponse)
async def generate_learning_pathway(payload: LearningPathwayRequest):
    prompt = "\n".join(
        [
            "You are an expert learning planner.",
            "Return JSON with `session_plan`, `rationale`, `recommended_order`, and `watchouts`.",
            "`session_plan`, `recommended_order`, and `watchouts` must be arrays of concise strings.",
            "Use the supplied progress signals to build a realistic next session.",
            "Do not include markdown fences.",
            "",
            f"Goal: {payload.goal}",
            f"Time budget (minutes): {payload.timeBudget}",
            f"Difficulty preference: {payload.targetDifficulty}",
            f"Due error count: {payload.dueErrors}",
            f"Scheduled flashcard count: {payload.scheduledFlashcards}",
            f"Question bank count: {payload.questionCount}",
            f"Saved learning paths: {', '.join(payload.savedLearningPaths) or 'None'}",
            "Weak topics:",
            json.dumps([item.model_dump() for item in payload.weakTopics], indent=2),
        ]
    )

    data = await _generate_json(prompt, temperature=0.35, max_tokens=1200)
    session_plan = (
        [str(item).strip() for item in data.get("session_plan", []) if str(item).strip()]
        if isinstance(data.get("session_plan"), list)
        else []
    )
    rationale = str(data.get("rationale") or "").strip()
    recommended_order = (
        [str(item).strip() for item in data.get("recommended_order", []) if str(item).strip()]
        if isinstance(data.get("recommended_order"), list)
        else []
    )
    watchouts = (
        [str(item).strip() for item in data.get("watchouts", []) if str(item).strip()]
        if isinstance(data.get("watchouts"), list)
        else []
    )

    if not rationale and not session_plan and not recommended_order and not watchouts:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI did not return a learning pathway",
        )

    return LearningPathwayResponse(
        session_plan=session_plan,
        rationale=rationale or "No rationale returned.",
        recommended_order=recommended_order,
        watchouts=watchouts,
    )
