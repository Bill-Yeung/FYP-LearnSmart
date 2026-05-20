import json
import re
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError, BaseModel

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.models.feynman import (
    TeachBackAnalysis,
    TeachBackHistoryItem,
    TeachBackHistoryResponse,
    TeachBackRequest,
    TeachBackResponse,
)
from app.repositories import ConceptRepository, TeachBackRepository
from app.services.infrastructure.task_queue_manager import task_queue_manager, QueueType
from app.core.enums import UserPriority

logger = logging.getLogger(__name__)
from app.services.ai.provider import AIProvider, AIProviderError

router = APIRouter(prefix="/feynman", tags=["Application & Assessment"])

SYSTEM_PROMPT_TEMPLATE = (
    "You are an interactive tutor and student-coach running a Feynman teach-back. When evaluating a learner's explanation, analyze it from the perspective of whether the learner is actually TEACHING the concept to another student. Respond with ONLY valid JSON using the fields described below.\n\n"
    "Required JSON fields: missing_terms (array of key terms the explanation omitted), logical_gaps (array of specific gaps in reasoning), unclear_reasoning (array of unclear sentences or claims), analogies (array of short suggested analogies), follow_up_questions (array of direct concept-probing questions the AI should ask the user to test deeper understanding), revised_explanation (a clarified/rewritten explanation in the requested language), summary (short evaluation sentence), score (numeric 0-100).\n\n"
    "SCORING GUIDE — apply based on the target level in the user prompt:\n"
    "- beginner: Be very generous and encouraging. The student only needs to show they grasp the core idea in their own words — technical vocabulary is NOT required. Score 85-100 if the main idea is correct, even if vague or imprecise. Score 70-84 if there is a partial understanding. Only score below 60 for completely wrong or empty explanations. Default to high scores for beginners — when in doubt, score higher.\n"
    "- intermediate: Expect correct terminology and a clear explanation with at least one example. Score 65-85 for solid explanations with minor gaps.\n"
    "- advanced: Expect precise terminology, edge cases, and deep reasoning. Score strictly.\n\n"
    "FOLLOW-UP QUESTIONS — REQUIRED. You MUST always populate 'follow_up_questions' with 3 to 5 substantive questions that probe the underlying CONCEPT, not the wording of the student's reply. These are extra teach-back questions the AI will ask the user next, designed to surface whether the student truly understands the idea. Each question must:\n"
    "  1. Target a different facet of the concept — e.g. its definition, mechanism/how-it-works, a concrete example or application, an edge case or limitation, contrasts with a related concept, or a 'why does this matter' / cause-and-effect angle.\n"
    "  2. Be open-ended (not yes/no) and answerable in 1-3 sentences.\n"
    "  3. Be self-contained and specific to the concept named in the user prompt — do NOT ask vague questions like 'Can you say more?' or 'What do you mean?'.\n"
    "  4. Be phrased as a direct question to the user (second person).\n"
    "Generate these follow-up questions even when the student's explanation already looks strong — they are used to extend learning, not only to fix mistakes.\n\n"
    "Language handling: respect the 'Language' field supplied in the user prompt - produce 'revised_explanation', 'summary', and 'follow_up_questions' in that language (for example, produce Chinese when Language is 'zh' or 'zh-CN').\n\n"
    "Example input: 'HTTP is for web pages'\n"
    "Example output:\n"
    "{\n"
    '  "missing_terms": ["protocol", "request/response"],\n'
    '  "logical_gaps": ["How does it work?"],\n'
    '  "unclear_reasoning": ["Too vague"],\n'
    '  "analogies": ["Like mail delivery"],\n'
    '  "follow_up_questions": ["What role does HTTP play between a browser and a server?", "Can you walk through what happens, step by step, when you type a URL and press enter?", "What is the difference between a GET and a POST request, and when would you use each?", "Why is HTTP described as stateless, and what problem does that create for things like login sessions?"],\n'
    '  "revised_explanation": "HTTP is a protocol...",\n'
    '  "summary": "Basic but incomplete",\n'
    '  "score": 45\n'
    "}\n\n"
    "CRITICAL: Return ONLY the JSON object. No explanatory text before or after."
)

_json_block = re.compile(r"\{[\s\S]*\}")
_code_fence = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)

def _normalize_list_fields(parsed: dict) -> dict:
    list_fields = ["missing_terms", "logical_gaps", "unclear_reasoning",
                   "analogies", "follow_up_questions"]
    for field in list_fields:
        if field in parsed and isinstance(parsed[field], str):
            parsed[field] = [parsed[field]] if parsed[field].strip() else []
    return parsed

def _parse_llm_json(raw_text: str) -> dict:
    logger.info(f"LLM raw response (first 500 chars): {raw_text[:500]}")
    candidates: list[str] = [raw_text.strip()]

    fence = _code_fence.search(raw_text)
    if fence:
        candidates.append(fence.group(1).strip())

    block = _json_block.search(raw_text)
    if block:
        candidates.append(block.group(0))

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                logger.info("Successfully parsed JSON from LLM response")
                return _normalize_list_fields(parsed)
        except json.JSONDecodeError:
            continue

    logger.warning("Failed to parse JSON from LLM response, attempting truncation repair")
    if block:
        truncated = block.group(0).rstrip().rstrip(",")
        # Try closing the JSON: trim trailing junk, then append missing closers.
        for closer in ['"}', '"]}', '"]}"', ']}', '}', '"]}', '""}']:
            try:
                parsed = json.loads(truncated + closer)
                if isinstance(parsed, dict):
                    logger.info("Recovered JSON via truncation repair")
                    return _normalize_list_fields(parsed)
            except json.JSONDecodeError:
                continue
    
    logger.warning("Using fallback response due to JSON parsing failure")
    return {
        "missing_terms": ["More technical details needed"],
        "logical_gaps": ["Explanation could be more detailed"],
        "unclear_reasoning": [],
        "analogies": [],
        "follow_up_questions": [
            "In your own words, what is the core idea of this concept and why does it matter?",
            "Can you walk through how it works, step by step?",
            "Can you give a concrete real-world example where this concept applies?",
            "What is an edge case or limitation where this concept breaks down or behaves unexpectedly?",
            "How does this concept differ from a closely related one, and when would you choose one over the other?",
        ],
        "revised_explanation": "",
        "summary": "Basic understanding demonstrated. Could expand on the underlying mechanics and provide a concrete example.",
        "score": 65
    }

@router.post("/analyze", response_model=TeachBackResponse)
async def analyze_teachback(
    payload: TeachBackRequest,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):
    repo = TeachBackRepository(db)
    concept_title = payload.concept_title

    if payload.concept_id and concept_title is None:
        concept_repo = ConceptRepository(db)
        concept = await concept_repo.get_with_translation(payload.concept_id, payload.language)
        if concept:
            concept_title = concept.get("title")

    ai = AIProvider()
    user_prompt = (
        f"Concept: {concept_title or 'Unspecified'}\n"
        f"Target level: {payload.target_level}\n"
        f"Language: {payload.language}\n"
        "Evaluate the student's explanation, AND generate 3-5 extra follow-up questions that probe the underlying concept (definition, mechanism, example/application, edge case, or contrast with a related idea). These follow-up questions are required even if the explanation is already strong."
        "\n\nStudent explanation:\n"
        f"{payload.explanation.strip()}"
    )

    if getattr(payload, "follow_up", None):
        fq = payload.follow_up
        try:
            q_text = fq.get("question")
            a_text = fq.get("answer")
            user_prompt += (
                f"\n\nFollow-up question you previously asked: {q_text}"
                f"\nStudent's answer to the follow-up: {a_text}"
                "\n\nRe-evaluate the student's overall understanding using BOTH the original explanation and this follow-up answer."
                " The student's score should reflect the combined evidence — if the follow-up shows good understanding, raise the score."
                " You MUST still return 3-5 NEW concept-probing follow_up_questions that go DEEPER than the previous round (e.g. ask about a different facet, an edge case, or a related concept)."
                " Do NOT repeat the previous follow-up question."
                " If the student's understanding is now strong enough that no further probing is useful, return an empty follow_up_questions array."
            )
        except Exception:
            logger.debug("Malformed follow_up payload")

    async def _ai_analyze():
        async with ai.session(system_prompt=SYSTEM_PROMPT_TEMPLATE) as s:
            return await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.2,
                max_tokens=1200
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_analyze, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc)
        )

    analysis_dict = _parse_llm_json(llm_raw)

    if payload.target_level == "beginner" and payload.explanation.strip():
        raw_score = analysis_dict.get("score")
        if isinstance(raw_score, (int, float)) and raw_score < 65:
            analysis_dict["score"] = 65

    try:
        analysis = TeachBackAnalysis.model_validate(analysis_dict)
    except ValidationError as exc:
        logger.warning(f"TeachBackAnalysis validation failed: {exc}")
        list_fields = ["missing_terms", "logical_gaps", "unclear_reasoning", "analogies", "follow_up_questions"]
        for f in list_fields:
            if f not in analysis_dict or not isinstance(analysis_dict.get(f), list):
                analysis_dict[f] = analysis_dict.get(f) or []

        analysis_dict.setdefault("summary", analysis_dict.get("summary") or "Partial analysis generated")
        analysis_dict.setdefault("score", analysis_dict.get("score") or 0)

        if not analysis_dict.get("revised_explanation"):
            try:
                rewrite_prompt = (
                    f"You are a helpful tutor and student-coach. Produce a longer, thorough explanation that helps a learner understand the following concept, written in the requested language. If parts of the student's explanation are ambiguous or missing, include clear short follow-up questions (as separate lines) that the AI should ask the user before or while teaching.\n\n"
                    "Aim for 3–6 short paragraphs (roughly 250–500 words) that progressively build understanding: start with an intuitive overview, then explain core mechanics, and finish with a concrete example or analogy. "
                    "Prioritize clarity and teachability: you may use simple analogies or small simplifications even if technically imprecise, if that helps the learner. "
                    "If you omit advanced technical details, append a single short caveat sentence starting with 'Caveat:' noting what was simplified. "
                    "Return only the rewritten explanation text (and the optional caveat) with no extra commentary.\n\n"
                    f"Language: {payload.language}\n"
                    f"Concept: {concept_title or 'Unspecified'}\n"
                    f"Student explanation:\n{payload.explanation.strip()}"
                )

                async def _ai_rewrite():
                    async with ai.session(system_prompt="You are a helpful tutor focused on clarity and teaching. If follow-up questions are needed, produce them as separate short questions in the requested language.") as s:
                        return await ai.generate(
                            prompt=rewrite_prompt,
                            session=s,
                            temperature=0.2,
                            max_tokens=800
                        )

                rewrite_raw = await task_queue_manager.submit_and_wait(
                    QueueType.AI_GENERATION, _ai_rewrite, UserPriority.REGULAR
                )

                analysis_dict["revised_explanation"] = rewrite_raw.strip()
            except AIProviderError:
                analysis_dict["revised_explanation"] = analysis_dict.get("revised_explanation") or "(No revised explanation available)"

        try:
            analysis = TeachBackAnalysis.model_validate(analysis_dict)
        except ValidationError:
            logger.warning("Falling back to safe default TeachBackAnalysis")
            analysis = TeachBackAnalysis(
                missing_terms=analysis_dict.get("missing_terms", []),
                logical_gaps=analysis_dict.get("logical_gaps", []),
                unclear_reasoning=analysis_dict.get("unclear_reasoning", []),
                analogies=analysis_dict.get("analogies", []),
                follow_up_questions=analysis_dict.get("follow_up_questions", []),
                revised_explanation=analysis_dict.get("revised_explanation"),
                summary=analysis_dict.get("summary"),
                score=analysis_dict.get("score")
            )

    session = await repo.create_session(
        user_id=current_user["id"],
        concept_id=payload.concept_id,
        concept_title=concept_title,
        explanation=payload.explanation,
        target_level=payload.target_level,
        language=payload.language,
        analysis=analysis.model_dump()
    )

    return TeachBackResponse(
        session_id=session["id"],
        concept_title=session["concept_title"],
        analysis=analysis,
        created_at=session["created_at"],
    )

class GenerateExplanationRequest(BaseModel):
    concept_title: str | None = None
    target_level: str = "beginner"
    language: str = "en"

class GenerateExplanationResponse(BaseModel):
    explanation: str

@router.post("/generate-explanation", response_model=GenerateExplanationResponse)
async def generate_explanation(payload: GenerateExplanationRequest):

    ai = AIProvider()
    concept_title = payload.concept_title or "Unspecified"
    prompt = (
        f"You are a helpful tutor and student-coach. Write a longer, detailed explanation to help a learner understand the concept '{concept_title}'. If you identify unclear areas or missing details, include short follow-up questions the AI can ask the user (format follow-up questions as separate short questions). "
        "Aim for 3–6 short paragraphs (about 250–500 words): begin with an intuitive overview, then expand on the key ideas, and finish with a concrete example or analogy. "
        "Prioritize clarity and teachability: you may use simple analogies or small simplifications even if technically imprecise, if that helps the learner. "
        "If you omit advanced technical details, append a single short caveat sentence starting with 'Caveat:' noting what was simplified. "
        f"Adjust language for the target level: {payload.target_level}."
        f"Language: {payload.language}. Return only the explanation text (and optional caveat and any short follow-up questions) in that language with no extra commentary."
    )

    async def _ai_explain():
        async with ai.session(system_prompt="You are a helpful tutor focused on clarity and teaching.") as s:
            return await ai.generate(
                prompt=prompt,
                session=s,
                temperature=0.2,
                max_tokens=800,
            )

    try:
        text = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_explain, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return GenerateExplanationResponse(explanation=text.strip())

@router.get("/history", response_model=TeachBackHistoryResponse)
async def list_history(
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):
    repo = TeachBackRepository(db)
    rows = await repo.list_recent_by_user(current_user["id"], limit=limit)
    items = [
        TeachBackHistoryItem(
            session_id=row["id"],
            concept_title=row["concept_title"],
            created_at=row["created_at"],
            score=row["score"],
        )
        for row in rows
    ]
    return TeachBackHistoryResponse(items=items)
