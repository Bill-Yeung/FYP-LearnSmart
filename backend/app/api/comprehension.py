import json
import logging
import re

from fastapi import APIRouter, HTTPException, status

from app.models.comprehension import (
    AnalogyGenerateRequest,
    AnalogyGenerateResponse,
    AnalogyResult,
    BrainstormStructureRequest,
    BrainstormStructureResponse,
    ComprehensionContext,
    MappingPair,
    SimplifyRewriteRequest,
    SimplifyRewriteResponse,
    SocraticRespondRequest,
    SocraticRespondResponse,
    StructuredSection,
    WhyHowGenerateRequest,
    WhyHowGenerateResponse,
    WhyHowQuestion,
)
from app.services.ai.provider import AIProvider, AIProviderError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/comprehension", tags=["Comprehension"])

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

def _context_lines(context: ComprehensionContext | None) -> list[str]:
    return [
        f"Subject: {context.subjectName if context else 'None linked'}",
        f"Linked document id: {context.documentId if context else 'None'}",
        f"Linked document name: {context.documentName if context else 'None'}",
        f"Linked document concepts: {', '.join(context.documentConcepts) if context and context.documentConcepts else 'None'}",
    ]

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
        logger.error("Comprehension AI provider error: %s", exc)
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

@router.post("/why-how/generate", response_model=WhyHowGenerateResponse)
async def generate_why_how_questions(payload: WhyHowGenerateRequest):
    if not payload.includeWhy and not payload.includeHow:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one question type",
        )

    prompt = "\n".join(
        [
            "You are an expert comprehension coach.",
            "Generate a JSON object with a `questions` array.",
            "Each item must contain: `type`, `difficulty`, `question`, `rationale`, and optional `focus`.",
            "Use only `why` or `how` for `type`.",
            "Do not include markdown fences.",
            "",
            f"Difficulty: {payload.difficulty}",
            f"Question count: {payload.count}",
            f"Include why questions: {'yes' if payload.includeWhy else 'no'}",
            f"Include how questions: {'yes' if payload.includeHow else 'no'}",
            f"Focus concept: {payload.focusConcept.strip() if payload.focusConcept else 'Infer from the source'}",
            *_context_lines(payload.context),
            "",
            "Source text:",
            payload.sourceText.strip(),
        ]
    )

    data = await _generate_json(prompt, temperature=0.4, max_tokens=1200)
    raw_items = data.get("questions")
    if not isinstance(raw_items, list):
        raw_items = []

    allowed_types = {"why"} if not payload.includeHow else {"why", "how"} if payload.includeWhy else {"how"}
    normalized: list[WhyHowQuestion] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or "").strip()
        qtype = str(item.get("type") or "").strip().lower()
        if not question or qtype not in allowed_types:
            continue
        difficulty = str(item.get("difficulty") or payload.difficulty).strip().lower()
        if difficulty not in {"easy", "medium", "hard"}:
            difficulty = payload.difficulty
        normalized.append(
            WhyHowQuestion(
                type=qtype,
                difficulty=difficulty,
                question=question,
                rationale=str(item.get("rationale") or "").strip(),
                focus=str(item.get("focus") or "").strip() or None,
            )
        )
        if len(normalized) >= payload.count:
            break

    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI did not return any questions",
        )

    return WhyHowGenerateResponse(questions=normalized)

@router.post("/analogies/generate", response_model=AnalogyGenerateResponse)
async def generate_analogies(payload: AnalogyGenerateRequest):
    prompt = "\n".join(
        [
            "You are an expert teacher who explains hard ideas with analogies and metaphors.",
            "Return JSON with a `results` array.",
            "Each result must include: `kind`, `title`, `text`, `mapping`, `notes`, `language`, and `audience`.",
            "Do not include markdown fences.",
            "",
            f"Concept: {payload.concept.strip()}",
            f"Use case context: {payload.context.strip() or 'None provided'}",
            f"Domain to draw from: {payload.domain}",
            f"Audience level: {payload.audience}",
            f"Requested output style: {payload.style}",
            f"Output language: {payload.language}",
            *_context_lines(payload.source),
        ]
    )

    data = await _generate_json(prompt, temperature=0.6, max_tokens=1400)
    raw_items = data.get("results")
    if not isinstance(raw_items, list):
        raw_items = []

    normalized: list[AnalogyResult] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        text = str(item.get("text") or "").strip()
        if not title or not text:
            continue
        kind = "metaphor" if str(item.get("kind") or "").strip().lower() == "metaphor" else "analogy"
        mapping: list[MappingPair] = []
        if isinstance(item.get("mapping"), list):
            for pair in item["mapping"]:
                if not isinstance(pair, dict):
                    continue
                left = str(pair.get("left") or "").strip()
                right = str(pair.get("right") or "").strip()
                if left and right:
                    mapping.append(MappingPair(left=left, right=right))
        notes = [
            str(note).strip()
            for note in item.get("notes", [])
            if str(note).strip()
        ] if isinstance(item.get("notes"), list) else []
        language = "chinese" if str(item.get("language") or "").strip().lower() == "chinese" else payload.language
        audience = str(item.get("audience") or payload.audience).strip().lower()
        if audience not in {"beginner", "intermediate", "advanced"}:
            audience = payload.audience
        normalized.append(
            AnalogyResult(
                kind=kind,
                title=title,
                text=text,
                mapping=mapping,
                notes=notes,
                language=language,
                audience=audience,
            )
        )

    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI did not return any analogies or metaphors",
        )

    return AnalogyGenerateResponse(results=normalized)

@router.post("/brainstorm/structure", response_model=BrainstormStructureResponse)
async def structure_brainstorm(payload: BrainstormStructureRequest):
    prompt = "\n".join(
        [
            "You are an expert study coach.",
            "Turn the learner's brainstorm into polished structured notes.",
            "Return JSON with `title`, `summary`, `sections`, and `next_steps`.",
            "Each section should preserve the learner's own ideas and tighten them.",
            "Do not include markdown fences.",
            "",
            f"Topic: {payload.topic.strip() or 'Not provided'}",
            f"Learner context: {payload.context.strip() or 'None'}",
            f"Active section when request was prepared: {payload.active}",
            *_context_lines(payload.source),
            "",
            "Learner draft notes:",
            payload.markdown.strip(),
        ]
    )

    data = await _generate_json(prompt, temperature=0.35, max_tokens=1200)
    raw_sections = data.get("sections")
    sections: list[StructuredSection] = []
    if isinstance(raw_sections, list):
        for section in raw_sections:
            if not isinstance(section, dict):
                continue
            heading = str(section.get("heading") or "").strip()
            content = str(section.get("content") or "").strip()
            bullets = (
                [str(item).strip() for item in section.get("bullets", []) if str(item).strip()]
                if isinstance(section.get("bullets"), list)
                else []
            )
            if not heading and not content and not bullets:
                continue
            sections.append(
                StructuredSection(
                    heading=heading or "Notes",
                    content=content,
                    bullets=bullets,
                )
            )

    summary = str(data.get("summary") or "").strip() or None
    title = str(data.get("title") or "").strip() or None
    next_steps = (
        [str(item).strip() for item in data.get("next_steps", []) if str(item).strip()]
        if isinstance(data.get("next_steps"), list)
        else []
    )

    if not title and not summary and not sections and not next_steps:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI did not return structured notes",
        )

    return BrainstormStructureResponse(
        title=title,
        summary=summary,
        sections=sections,
        next_steps=next_steps,
    )

@router.post("/dialogue/respond", response_model=SocraticRespondResponse)
async def respond_socratically(payload: SocraticRespondRequest):
    prompt = "\n".join(
        [
            "You are an expert Socratic tutor.",
            f"Requested action: {payload.action}",
            "Return JSON only.",
            "Return an object with `assistant_message` and optional `observations`.",
            "The `assistant_message` should be the exact message shown to the learner.",
            "",
            f"Concept: {payload.concept.strip() or 'Not provided'}",
            f"Goal: {payload.goal.strip() or 'Not provided'}",
            f"Context: {payload.context.strip() or 'None'}",
            f"Difficulty: {payload.difficulty}",
            *_context_lines(payload.source),
            "",
            "Conversation so far:",
            json.dumps([message.model_dump() for message in payload.messages], indent=2),
        ]
    )

    ai = AIProvider()
    try:
        async with ai.session(system_prompt=None) as session:
            raw = await ai.generate(
                prompt=prompt,
                session=session,
                temperature=0.4 if payload.action == "follow-up" else 0.3,
                max_tokens=1200 if payload.action == "wrap-up" else 900,
            )
    except AIProviderError as exc:
        logger.error("Comprehension AI provider error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    data = _parse_llm_json(raw)
    assistant_message = str(data.get("assistant_message") or "").strip() if isinstance(data, dict) else ""
    if not assistant_message:
        assistant_message = raw.strip()
    if not assistant_message:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI did not return a tutoring response",
        )

    observations = (
        [str(item).strip() for item in data.get("observations", []) if str(item).strip()]
        if isinstance(data, dict) and isinstance(data.get("observations"), list)
        else []
    )

    return SocraticRespondResponse(
        assistant_message=assistant_message,
        observations=observations,
    )

@router.post("/simplify/rewrite", response_model=SimplifyRewriteResponse)
async def rewrite_passage(payload: SimplifyRewriteRequest):
    prompt = "\n".join(
        [
            "You are an expert editor who simplifies passages without losing meaning.",
            "Return JSON with: `original`, `simplified`, `language`, and `level`.",
            "Do not include markdown fences.",
            "",
            f"Target language: {payload.language}",
            f"Simplification level: {payload.level}",
            *_context_lines(payload.context),
            "",
            "Passage to simplify:",
            payload.original.strip(),
        ]
    )

    data = await _generate_json(prompt, temperature=0.2, max_tokens=900)
    simplified = str(data.get("simplified") or "").strip()
    if not simplified:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI did not return a simplified passage",
        )

    language = "chinese" if str(data.get("language") or "").strip().lower() == "chinese" else payload.language
    level = str(data.get("level") or payload.level).strip().lower()
    if level not in {"light", "standard", "strong"}:
        level = payload.level

    return SimplifyRewriteResponse(
        original=str(data.get("original") or payload.original).strip(),
        simplified=simplified,
        language=language,
        level=level,
    )
