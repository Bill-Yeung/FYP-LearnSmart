import json
import re
import logging
from fastapi import APIRouter, HTTPException, status

from app.models.explanation import (
    SimplifyExplanationRequest,
    SimplifyExplanationResponse,
    ReflectionTeachingRequest,
    ReflectionTeachingResponse,
    ReflectionTeachingAnalysis,
    CheckUnderstandingRequest,
    CheckUnderstandingResponse,
    FlaggedSegment,
    StyleSuggestion,
)
from app.services.ai.provider import AIProvider, AIProviderError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explanations", tags=["Explanations"])

GRADE_LEVEL_DESCRIPTIONS = {
    "6": "6th grade (age 11-12) - Simple vocabulary, basic concepts, concrete examples",
    "9": "9th grade (age 14-15) - Moderate complexity, some technical terms, relatable examples",
    "12": "12th grade (age 17-18) - Higher complexity, technical vocabulary, abstract concepts",
    "University": "University level - Advanced concepts, technical terminology, analytical depth",
}

_json_block = re.compile(r"\{[\s\S]*\}")


def _parse_llm_json(raw_text: str) -> dict:

    logger.info(f"LLM raw response (first 500 chars): {raw_text[:500]}")
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        match = _json_block.search(raw_text)
        if match:
            json_str = match.group(0)
            try:
                parsed = json.loads(json_str)
                logger.info("Successfully parsed JSON from LLM response")
                return parsed
            except json.JSONDecodeError:
                logger.warning("Failed to parse extracted JSON block")
                pass
    
    logger.warning("Using fallback response due to JSON parsing failure")
    return {}

@router.post("/simplify", response_model=SimplifyExplanationResponse)
async def simplify_explanation(payload: SimplifyExplanationRequest):

    if payload.targetGradeLevel not in GRADE_LEVEL_DESCRIPTIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid grade level. Must be one of: {', '.join(GRADE_LEVEL_DESCRIPTIONS.keys())}"
        )
    
    if not payload.explanation.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explanation cannot be empty"
        )

    ai = AIProvider()
    grade_description = GRADE_LEVEL_DESCRIPTIONS[payload.targetGradeLevel]
    
    system_prompt = (
        "You are an expert educator who simplifies complex explanations for different grade levels.\n"
        "Your task is to rewrite the given explanation to match the target grade level.\n"
        "Preserve the core meaning while adjusting vocabulary and complexity.\n"
        "Return ONLY the simplified explanation text, nothing else."
    )
    
    user_prompt = (
        f"Target Grade Level: {payload.targetGradeLevel}\n"
        f"Description: {grade_description}\n\n"
        f"Original explanation:\n{payload.explanation}\n\n"
        f"Please simplify this explanation for the target grade level."
    )

    try:
        async with ai.session(system_prompt=system_prompt) as s:
            simplified = await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.3,
                max_tokens=512
            )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to simplify explanation"
        )

    simplified = simplified.strip()
    if simplified.startswith("```"):
        simplified = "\n".join(simplified.split("\n")[1:-1])
    
    simplified = simplified.strip()
    
    if not simplified:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate simplified explanation"
        )

    return SimplifyExplanationResponse(simplified=simplified)

@router.post("/reflect", response_model=ReflectionTeachingResponse)
async def reflection_teaching(payload: ReflectionTeachingRequest):

    if not payload.explanation.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explanation cannot be empty"
        )

    ai = AIProvider()
    
    system_prompt = (
        "You are an expert educator using the Feynman Technique and reflective teaching methods.\n"
        "Analyze the student's explanation and provide feedback in valid JSON format.\n"
        "Focus on:\n"
        "1. Strengths in their understanding (at least 1 item)\n"
        "2. Areas needing improvement (at least 1 item)\n"
        "3. Reflective questions to deepen understanding (2-3 questions)\n"
        "4. Suggested resources (1-2 resources)\n"
        "5. Next steps for learning (clear actionable advice)\n"
        "6. Your confidence in their understanding (0-100 as a NUMBER)\n\n"
        "Example output:\n"
        "{\n"
        '  "strengths": ["Identified key concept", "Clear language"],\n'
        '  "areas_for_improvement": ["Missing context", "Could use examples"],\n'
        '  "reflection_questions": ["Why is this important?", "Can you give an example?"],\n'
        '  "suggested_resources": ["Chapter 3 of textbook", "Khan Academy video"],\n'
        '  "next_steps": "Practice with concrete examples",\n'
        '  "confidence_level": 75\n'
        "}\n\n"
        "CRITICAL: Return ONLY valid JSON. confidence_level MUST be a number between 0-100."
    )
    
    user_prompt = (
        f"Concept: {payload.concept}\n"
        f"Student Level: {payload.target_level}\n\n"
        f"Student's explanation:\n{payload.explanation}\n\n"
        f"Analyze this {payload.target_level}-level student's explanation and provide constructive feedback."
    )

    try:
        async with ai.session(system_prompt=system_prompt) as s:
            llm_raw = await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.3,
                max_tokens=512
            )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to analyze explanation"
        )

    analysis_dict = _parse_llm_json(llm_raw)
    
    logger.info(f"Parsed analysis dict: {analysis_dict}")
    
    try:

        confidence = analysis_dict.get("confidence_level", 65)
        if isinstance(confidence, str):
            confidence = float(confidence.replace("%", "").strip())
        else:
            confidence = float(confidence) if confidence else 65.0

        strengths = analysis_dict.get("strengths", [])
        if not strengths:
            strengths = ["Made an attempt to explain the concept"]
        
        areas = analysis_dict.get("areas_for_improvement", [])
        if not areas:
            areas = ["Could provide more detail"]
        
        questions = analysis_dict.get("reflection_questions", [])
        if not questions:
            questions = ["Can you explain this in simpler terms?", "What examples come to mind?"]
        
        resources = analysis_dict.get("suggested_resources", [])
        if not resources:
            resources = ["Review foundational materials on this topic"]
        
        next_steps = analysis_dict.get("next_steps", "")
        if not next_steps:
            next_steps = "Continue practicing and seek clarification on unclear concepts."
        
        analysis = ReflectionTeachingAnalysis(
            strengths=strengths,
            areas_for_improvement=areas,
            reflection_questions=questions,
            suggested_resources=resources,
            next_steps=next_steps,
            confidence_level=confidence
        )
    except (ValueError, TypeError) as exc:
        logger.error(f"Failed to parse analysis: {str(exc)}, dict: {analysis_dict}")

        analysis = ReflectionTeachingAnalysis(
            strengths=["Showed effort in attempting to explain"],
            areas_for_improvement=["More specific examples needed", "Clarify technical terminology"],
            reflection_questions=[
                "Can you provide a concrete example?",
                "Why is this concept important?",
                "How does this relate to previous learning?"
            ],
            suggested_resources=["Review course materials", "Watch educational videos on this topic"],
            next_steps="Practice explaining the concept in your own words with concrete examples.",
            confidence_level=55.0
        )

    return ReflectionTeachingResponse(
        analysis=analysis,
        original_explanation=payload.explanation
    )

@router.post("/check-understanding", response_model=CheckUnderstandingResponse)
async def check_understanding(payload: CheckUnderstandingRequest):

    if not payload.explanation or not payload.explanation.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explanation cannot be empty"
        )

    ai = AIProvider()

    system_prompt = (
        "You are an expert educator. Analyze the student's explanation and return a JSON object with the following fields: 'flagged' (array of {phrase, issue, severity (critical|major|minor), fix}), 'styleSuggestions' (array of {phrase?, suggestion}), 'verdict' (either 'clear' or 'needs_clarification'), and 'confidence' (number 0-100).\n"
        "DO NOT include follow-up questions or ask the user for more information. Return ONLY JSON."
    )

    user_prompt = (
        f"Concept: {payload.concept or 'Unspecified'}\n"
        f"Strictness: {payload.strictness or 'standard'}\n\n"
        f"Student explanation:\n{payload.explanation.strip()}\n"
    )

    if getattr(payload, "follow_up", None):
        fq = payload.follow_up
        try:
            q_text = fq.get("question")
            a_text = fq.get("answer")
            user_prompt += f"\nFollow-up question: {q_text}\nStudent answer: {a_text}\n"
        except Exception:
            logger.debug("Malformed follow_up payload")

    try:
        async with ai.session(system_prompt=system_prompt) as s:
            llm_raw = await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.2,
                max_tokens=512
            )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to check understanding"
        )

    parsed = _parse_llm_json(llm_raw)

    try:
        flagged_raw = parsed.get("flagged", []) if isinstance(parsed, dict) else []
        flagged = []
        for it in flagged_raw:
            if not isinstance(it, dict):
                continue
            flagged.append(FlaggedSegment(
                phrase=it.get("phrase") or "(no phrase provided)",
                issue=it.get("issue") or "Unspecified issue",
                severity=it.get("severity") or "minor",
                fix=it.get("fix")
            ))

        style_raw = parsed.get("styleSuggestions", []) if isinstance(parsed, dict) else []
        style_suggestions = []
        for it in style_raw:
            if not isinstance(it, dict):
                continue
            style_suggestions.append(StyleSuggestion(
                phrase=it.get("phrase") if isinstance(it.get("phrase"), str) else None,
                suggestion=it.get("suggestion") or it.get("message") or ""
            ))

        verdict = parsed.get("verdict") or ("needs_clarification" if flagged else "clear")
        confidence = parsed.get("confidence")
        try:
            confidence = float(confidence) if confidence is not None else (62.0 if flagged else 86.0)
        except Exception:
            confidence = 62.0 if flagged else 86.0

    except Exception as exc:
        logger.error(f"Failed to build check-understanding response: {exc}")
        flagged = []
        style_suggestions = []
        verdict = "needs_clarification"
        confidence = 60.0

    return CheckUnderstandingResponse(
        original=payload.explanation.strip(),
        concept=payload.concept,
        conceptDefinition=payload.conceptDefinition,
        flagged=flagged,
        styleSuggestions=style_suggestions,
        verdict=verdict,
        confidence=confidence,
        follow_up_questions=None
    )
