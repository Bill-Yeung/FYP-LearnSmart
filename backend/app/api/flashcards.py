from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import json
import asyncpg
import logging

import csv
from typing import Optional
from fastapi import UploadFile, File, Form
import datetime
from pathlib import Path

from app.core.database import get_postgres
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.services.ai.provider import ai_provider, AIProvider, AIProviderError
from app.services.ai.prompts import get_prompt
from app.services.infrastructure.task_queue_manager import task_queue_manager, QueueType
from app.core.enums import UserPriority

from app.repositories.source_repository import SourceRepository
from app.repositories.concept_repository import ConceptRepository
from app.services.knowledge.knowledge_retrieval_service import knowledge_service
from app.services.infrastructure.file_storage_service import file_storage_service
from app.services.infrastructure.document_conversion_service import document_conversion_service
from uuid import UUID
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flashcards", tags=["Flashcards"])

class ImageGenRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    width: int = Field(default=512, ge=256, le=1024)
    height: int = Field(default=512, ge=256, le=1024)
    num_inference_steps: int = Field(default=4, ge=1, le=50)
    guidance_scale: float = Field(default=7.5, ge=0.0, le=20.0)
    seed: int | None = Field(default=None)

@router.post("/generate-image")
async def generate_image_proxy(
    payload: ImageGenRequest,
    current_user=Depends(get_current_user)
):
    try:
        result = await ai_provider.generate_image(
            prompt=payload.prompt,
            width=payload.width,
            height=payload.height,
            num_inference_steps=payload.num_inference_steps,
            guidance_scale=payload.guidance_scale,
            seed=payload.seed,
        )
        return result
    except AIProviderError as exc:
        error_msg = str(exc)
        logger.error(f"Image generation failed: {error_msg}")
        
        if "not configured" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                detail="Image generation service is not configured. Please set up FLUX_MODEL environment variable."
            )

        if "mac mini" in error_msg.lower() or "not responding" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=error_msg
            )
        
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_msg)

class MnemonicRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Concept or text to create mnemonic for")
    style: str = Field(default="acronym", description="Style: acronym, story, rhyme, visual, or chunking")
    language: str = Field(default="en", description="Language code")

class MnemonicResponse(BaseModel):
    mnemonic: str
    explanation: str
    style: str
    tips: Optional[str] = None

MNEMONIC_SYSTEM_PROMPT = """You are a memory expert. Create memorable mnemonics in English.

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "mnemonic": "Your mnemonic here",
  "explanation": "How to use it",
  "tips": "Tips: One or two key tips for remembering this"
}

STYLE GUIDE:
- acronym: Make a sentence where each word starts with the first letter of what to remember.
  Example for planets (MVEMJSUN): "My Very Eager Mother Just Served Us Nachos"
- story: Create a short funny story connecting the items.
- rhyme: Make a catchy rhyme or song.
- visual: Describe a vivid mental picture.
- chunking: Group items into memorable patterns.

RULES:
1. Use simple, common English words
2. Make it funny or unusual (easier to remember)
3. Keep it short (1-2 sentences max)
4. ONLY output JSON, nothing else"""

@router.post("/generate-mnemonic", response_model=MnemonicResponse)
async def generate_mnemonic(
    payload: MnemonicRequest,
    current_user=Depends(get_current_user)
):
    ai = AIProvider()
    
    user_prompt = (
        f"Create a {payload.style} mnemonic for:\n\n"
        f"{payload.text}\n\n"
        f"Language: {payload.language}"
    )
    
    async def _ai_mnemonic():
        async with ai.session(system_prompt=MNEMONIC_SYSTEM_PROMPT) as s:
            return await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.7,
                max_tokens=400
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_mnemonic, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc)
        )
    
    try:
        result = json.loads(llm_raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{[\s\S]*\}', llm_raw)
        if match:
            try:
                result = json.loads(match.group(0))
            except json.JSONDecodeError:
                result = None
        else:
            result = None
    
    if not result or "mnemonic" not in result:
        logger.warning(f"Failed to parse mnemonic response: {llm_raw[:200]}")
        result = {
            "mnemonic": llm_raw.strip() if llm_raw else "Unable to generate mnemonic",
            "explanation": "Generated mnemonic device",
            "tips": "Tips: Repeat it several times and associate with a visual image"
        }
    
    return MnemonicResponse(
        mnemonic=result.get("mnemonic", ""),
        explanation=result.get("explanation", ""),
        style=payload.style,
        tips=result.get("tips", None)
    )

class FlashcardGenRequest(BaseModel):
    topic: str = Field(..., min_length=1, description="Topic or concept to generate flashcards for")
    content: str | None = Field(None, description="Optional longer content/context to generate from")
    target_count: int = Field(default=3, ge=1, le=50, description="Exact number of flashcards to generate")
    tags: list[str] | None = Field(default=[], description="User selected tags to attach to generated flashcards")
    custom_prompt: str | None = Field(None, max_length=500, description="Optional extra instructions for the AI when generating flashcards")

class FlashcardItem(BaseModel):
    front: str
    back: str
    card_type: str | None = None
    difficulty: str | None = None
    tags: list[str] | None = None
    tips: str | None = None
    mnemonic: str | None = None
    source_quote: str | None = None
    mcq_options: list[str] | None = None
    correct_option: str | None = None

@router.post("/generate", response_model=list[FlashcardItem])
async def generate_flashcards(
    payload: FlashcardGenRequest,
    current_user=Depends(get_current_user)
):
    ai: AIProvider = ai_provider

    prompt_template = get_prompt("flashcard")
    hints = ""
    if payload.tags:
        hints = f"Focus on these tags: {', '.join(payload.tags)}"
    if payload.custom_prompt:
        hints = (hints + " " if hints else "") + payload.custom_prompt.strip()

    user_prompt = prompt_template.format_user_prompt(
        topic=payload.topic,
        target_count=payload.target_count,
        hints_section=hints,
        content=(payload.content or payload.topic),
    )

    async def _ai_gen():
        async with ai.session(system_prompt=prompt_template.system_prompt) as s:
            return await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.5,
                max_tokens=800
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_gen, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    try:
        data = json.loads(llm_raw)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", llm_raw)
        if m:
            try:
                data = json.loads(m.group(0))
            except Exception:
                logger.warning(f"Failed to parse JSON from AI output: {llm_raw[:200]}")
                raise HTTPException(status_code=502, detail="AI returned non-JSON output")
        else:
            logger.warning(f"No JSON found in AI output: {llm_raw[:200]}")
            raise HTTPException(status_code=502, detail="AI returned non-JSON output")
    cards = []
    if isinstance(data, dict) and "flashcards" in data and isinstance(data["flashcards"], list):
        cards = data["flashcards"]
    elif isinstance(data, list):
        cards = data
    else:
        logger.warning("AI output JSON did not contain flashcards array")
        raise HTTPException(status_code=502, detail="AI output invalid format")

    result: list[FlashcardItem] = []
    for item in cards:
        if not isinstance(item, dict):
            continue
        front = str(item.get("front") or item.get("question") or item.get("q") or "").strip()
        back = str(item.get("back") or item.get("answer") or item.get("a") or "").strip()
        if not front or not back:
            continue

        ai_tags = item.get("tags") or []
        user_tags = payload.tags or []
        merged = []
        for t in (ai_tags + user_tags):
            if not isinstance(t, str):
                continue
            tt = t.strip()
            if tt and tt not in merged:
                merged.append(tt)

        result.append(FlashcardItem(front=front, back=back, card_type=item.get("card_type"), difficulty=item.get("difficulty"), tags=merged, tips=item.get("tips"), mnemonic=item.get("mnemonic")))

    if not result:
        raise HTTPException(status_code=502, detail="AI returned no valid flashcards")

    return result

class SuggestRequest(BaseModel):
    front: str
    back: str | None = None
    topic: str | None = None

class SuggestResponse(BaseModel):
    definition: str | None = None
    causes: str | None = None
    process: str | None = None
    example: str | None = None
    how_to_use: str | None = None

@router.post("/suggest_explanation", response_model=SuggestResponse)
async def suggest_explanation(
    payload: SuggestRequest,
    current_user=Depends(get_current_user)
):
    
    ai: AIProvider = ai_provider

    system_prompt = (
        "You are an expert teacher. Given a flashcard front (concept/question) and optionally back/content, "
        "produce a JSON object with keys: definition, causes, process, example, how_to_use. "
        "Each field should be a short paragraph. Output ONLY valid JSON with these keys."
    )

    user_obj = {
        "front": payload.front,
        "back": payload.back or "",
        "topic": payload.topic or "",
        "instructions": "Follow the 4-step structure: 1) Define the concept. 2) Explain causes/inputs. 3) Describe the process. 4) Give an example. Then add a short 'How to use' section for learners."
    }

    async def _ai_suggest():
        async with ai.session(system_prompt=system_prompt) as s:
            return await ai.generate(
                prompt=json.dumps(user_obj),
                session=s,
                temperature=0.2,
                max_tokens=600
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_suggest, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    try:
        data = json.loads(llm_raw)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", llm_raw)
        if m:
            try:
                data = json.loads(m.group(0))
            except Exception:
                logger.warning(f"Failed to parse JSON from AI output: {llm_raw[:200]}")
                raise HTTPException(status_code=502, detail="AI returned non-JSON output")
        else:
            logger.warning(f"No JSON found in AI output: {llm_raw[:200]}")
            raise HTTPException(status_code=502, detail="AI returned non-JSON output")

    out = {
        "definition": data.get("definition") if isinstance(data, dict) else None,
        "causes": data.get("causes") if isinstance(data, dict) else None,
        "process": data.get("process") if isinstance(data, dict) else None,
        "example": data.get("example") if isinstance(data, dict) else None,
        "how_to_use": data.get("how_to_use") if isinstance(data, dict) else None,
    }

    return SuggestResponse(**out)

class EnrichRequest(BaseModel):
    items: list[FlashcardItem]
    topic: str | None = None

@router.post("/enrich", response_model=list[FlashcardItem])
async def enrich_flashcards(
    payload: EnrichRequest,
    current_user=Depends(get_current_user)
):
    ai: AIProvider = ai_provider

    examples = []
    for it in payload.items:
        examples.append({
            "front": it.front,
            "back": (it.back or "") if hasattr(it, "back") else "",
            "card_type": it.card_type,
            "tags": it.tags,
        })

    system_prompt = (
        "You are a helpful flashcard assistant. Given a list of flashcard fronts (questions), "
        "return a JSON array of objects with keys: front, back, card_type (standard|mcq), choices (if mcq), "
        "correct_answer (if mcq), and tags (optional). Only output valid JSON. Do not include any extra text."
    )

    user_payload = {
        "items": examples,
        "topic": payload.topic or "",
        "instruction": "Fill missing back text and, when appropriate, convert to MCQ with choices and correct_answer."
    }

    async def _ai_enrich():
        async with ai.session(system_prompt=system_prompt) as s:
            return await ai.generate(
                prompt=json.dumps(user_payload),
                session=s,
                temperature=0.2,
                max_tokens=800
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_enrich, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    try:
        data = json.loads(llm_raw)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", llm_raw)
        if m:
            try:
                data = json.loads(m.group(0))
            except Exception:
                logger.warning(f"Failed to parse JSON from AI output: {llm_raw[:200]}")
                raise HTTPException(status_code=502, detail="AI returned non-JSON output")
        else:
            logger.warning(f"No JSON found in AI output: {llm_raw[:200]}")
            raise HTTPException(status_code=502, detail="AI returned non-JSON output")

    cards = []
    if isinstance(data, list):
        cards = data
    elif isinstance(data, dict) and isinstance(data.get("flashcards"), list):
        cards = data.get("flashcards")
    else:
        raise HTTPException(status_code=502, detail="AI output invalid format")

    result: list[FlashcardItem] = []
    for item in cards:
        if not isinstance(item, dict):
            continue
        front = str(item.get("front") or "").strip()
        back = str(item.get("back") or "").strip()
        if not front or not back:
            continue
        result.append(FlashcardItem(front=front, back=back, card_type=item.get("card_type"), difficulty=item.get("difficulty"), tags=item.get("tags")))

    if not result:
        raise HTTPException(status_code=502, detail="AI returned no valid enriched flashcards")

    return result

class GenerateFromConceptsRequest(BaseModel):
    concept_ids: list[str] = Field(..., min_items=1, max_items=50, description="List of concept UUIDs")
    target_count: int = Field(default=5, ge=1, le=50, description="Exact number of flashcards to generate")
    language: str = Field(default="en", description="Language code for concept translations")
    save: bool = Field(default=False, description="If true, auto-save generated flashcards to database")
    tags: list[str] | None = Field(default=[], description="User selected tags to attach to generated flashcards")

class GenerateFromConceptsResponse(BaseModel):
    flashcards: list[FlashcardItem]
    saved_ids: list[str] | None = None
    concepts_used: int
    message: str

@router.post("/generate-from-concepts", response_model=GenerateFromConceptsResponse)
async def generate_flashcards_from_concepts(
    payload: GenerateFromConceptsRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):
    
    concept_repo = ConceptRepository(db)

    content_parts: list[str] = []
    concept_uuid_map: dict[str, UUID] = {}

    for cid_str in payload.concept_ids:
        try:
            cid = UUID(cid_str)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid concept UUID: {cid_str}")

        concept = await concept_repo.get_with_translation(cid, payload.language)
        if concept is None:
            logger.warning(f"Concept {cid_str} not found, skipping")
            continue

        title = concept.get("title") or "Untitled"
        description = concept.get("description") or ""
        difficulty = concept.get("difficulty_level") or ""
        keywords = concept.get("keywords") or []

        section = f"## {title}\n"
        if difficulty:
            section += f"Difficulty: {difficulty}\n"
        if keywords:
            kw_str = ", ".join(keywords) if isinstance(keywords, list) else str(keywords)
            section += f"Keywords: {kw_str}\n"
        if description:
            section += f"\n{description}\n"

        content_parts.append(section)
        concept_uuid_map[title.lower()] = cid

    if not content_parts:
        raise HTTPException(status_code=404, detail="None of the provided concept IDs were found")

    combined_content = "\n---\n".join(content_parts)
    topic = "Multiple Concepts" if len(content_parts) > 1 else content_parts[0].split("\n")[0].replace("## ", "")

    ai: AIProvider = ai_provider
    prompt_template = get_prompt("flashcard")
    
    target_count = payload.target_count
    hints = "Generate flashcards covering all the concepts provided below."
    if payload.tags:
        hints = hints + " Focus on these tags: " + ", ".join(payload.tags)

    user_prompt = prompt_template.format_user_prompt(
        topic=topic,
        target_count=target_count,
        hints_section=hints,
        content=combined_content,
    )

    async def _ai_gen_concepts():
        async with ai.session(system_prompt=prompt_template.system_prompt) as s:
            return await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.5,
                max_tokens=4000
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_gen_concepts, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    cards = _parse_flashcard_ai_response(llm_raw)
    logger.info(f"AI generated {len(cards)} flashcards from concepts")

    result_cards: list[FlashcardItem] = []
    for item in cards:
        front = str(item.get("front") or item.get("question") or "").strip()
        back = str(item.get("back") or item.get("answer") or "").strip()
        if not front or not back:
            continue
        ai_tags = item.get("tags") or []
        user_tags = payload.tags or []
        merged = []
        for t in (ai_tags + user_tags):
            if not isinstance(t, str):
                continue
            tt = t.strip()
            if tt and tt not in merged:
                merged.append(tt)

        result_cards.append(FlashcardItem(
            front=front, back=back,
            card_type=item.get("card_type"),
            difficulty=item.get("difficulty"),
            tags=merged,
            tips=item.get("tips"),
            mnemonic=item.get("mnemonic"),
            source_quote=item.get("source_quote"),
            mcq_options=item.get("mcq_options"),
            correct_option=item.get("correct_option"),
        ))

    if not result_cards:
        raise HTTPException(status_code=502, detail="AI returned no valid flashcards from the concepts")

    saved_ids: list[str] | None = None
    if payload.save:
        saved_ids = []
        first_concept_title = next(iter(concept_uuid_map), None)
        for card in result_cards:
            content_metadata = {}
            if card.tags:
                content_metadata["tags"] = card.tags
            if first_concept_title:
                content_metadata["topic"] = first_concept_title

            linked_concept_id = None
            if card.tags:
                for tag in card.tags:
                    if tag.lower() in concept_uuid_map:
                        linked_concept_id = concept_uuid_map[tag.lower()]
                        break

            try:
                row = await db.fetchrow(
                    """
                    INSERT INTO flashcards (user_id, concept_id, front_content, back_content, card_type,
                                            choices, content_metadata, source_type)
                    VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, $6::jsonb, 'note_generated')
                    RETURNING id::text AS id
                    """,
                    current_user["id"],
                    linked_concept_id,
                    card.front,
                    card.back,
                    card.card_type or "standard",
                    json.dumps(content_metadata) if content_metadata else "{}",
                )
                saved_ids.append(row["id"])
            except Exception as e:
                logger.error(f"Failed to save flashcard: {e}")

    return GenerateFromConceptsResponse(
        flashcards=result_cards,
        saved_ids=saved_ids,
        concepts_used=len(content_parts),
        message=f"Generated {len(result_cards)} flashcards from {len(content_parts)} concepts"
    )

class GenerateFromSourceRequest(BaseModel):
    source_id: str = Field(..., description="Source UUID from the sources table")
    target_count: int = Field(default=5, ge=1, le=50, description="Exact number of flashcards to generate")
    save: bool = Field(default=False, description="If true, auto-save generated flashcards")
    tags: list[str] | None = Field(default=[], description="User selected tags to attach to generated flashcards")

class GenerateFromSourceResponse(BaseModel):
    flashcards: list[FlashcardItem]
    saved_ids: list[str] | None = None
    source_name: str
    message: str

@router.post("/generate-from-source", response_model=GenerateFromSourceResponse)
async def generate_flashcards_from_source(
    payload: GenerateFromSourceRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):
    
    source_repo = SourceRepository(db)

    try:
        source_uuid = UUID(payload.source_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid source UUID")

    source = await source_repo.get_by_id(source_uuid)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")

    if source.get("uploaded_by") and source["uploaded_by"] != current_user["id"] and not source.get("is_public"):
        raise HTTPException(status_code=403, detail="You do not have access to this source")

    content = source.get("full_text") or source.get("ai_summary")
    if not content:
        raise HTTPException(
            status_code=400,
            detail="Source has no extracted text. Please wait for processing to complete or upload a text-based document."
        )

    source_name = source.get("document_name") or "Untitled Document"
    topic = source_name

    max_content_chars = 12000
    if len(content) > max_content_chars:
        content = content[:max_content_chars] + "\n\n[Content truncated for flashcard generation]"

    ai: AIProvider = ai_provider
    prompt_template = get_prompt("flashcard")
    
    target_count = payload.target_count
    hints = f"Generate flashcards from this document: {source_name}"
    if payload.tags:
        hints = hints + " Focus on these tags: " + ", ".join(payload.tags)

    user_prompt = prompt_template.format_user_prompt(
        topic=topic,
        target_count=target_count,
        hints_section=hints,
        content=content,
    )

    async def _ai_gen_source():
        async with ai.session(system_prompt=prompt_template.system_prompt) as s:
            return await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.5,
                max_tokens=4000
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_gen_source, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    cards = _parse_flashcard_ai_response(llm_raw)
    logger.info(f"AI generated {len(cards)} flashcards from document")

    result_cards: list[FlashcardItem] = []
    for item in cards:
        front = str(item.get("front") or item.get("question") or "").strip()
        back = str(item.get("back") or item.get("answer") or "").strip()
        if not front or not back:
            continue

        ai_tags = item.get("tags") or []
        user_tags = payload.tags or []
        merged = []
        for t in (ai_tags + user_tags):
            if not isinstance(t, str):
                continue
            tt = t.strip()
            if tt and tt not in merged:
                merged.append(tt)

        result_cards.append(FlashcardItem(
            front=front, back=back,
            card_type=item.get("card_type"),
            difficulty=item.get("difficulty"),
            tags=merged,
            tips=item.get("tips"),
            mnemonic=item.get("mnemonic"),
            source_quote=item.get("source_quote"),
            mcq_options=item.get("mcq_options"),
            correct_option=item.get("correct_option"),
        ))

    if not result_cards:
        raise HTTPException(status_code=502, detail="AI returned no valid flashcards from the document")

    saved_ids: list[str] | None = None
    if payload.save:
        saved_ids = []
        for card in result_cards:
            content_metadata = {"source_id": str(source_uuid), "source_name": source_name, "topic": source_name}
            if card.tags:
                content_metadata["tags"] = card.tags
            try:
                row = await db.fetchrow(
                    """
                    INSERT INTO flashcards (user_id, front_content, back_content, card_type,
                                            choices, content_metadata, source_type)
                    VALUES ($1, $2, $3, $4, '[]'::jsonb, $5::jsonb, 'note_generated')
                    RETURNING id::text AS id
                    """,
                    current_user["id"],
                    card.front,
                    card.back,
                    card.card_type or "standard",
                    json.dumps(content_metadata),
                )
                saved_ids.append(row["id"])
            except Exception as e:
                logger.error(f"Failed to save flashcard: {e}")

    return GenerateFromSourceResponse(
        flashcards=result_cards,
        saved_ids=saved_ids,
        source_name=source_name,
        message=f"Generated {len(result_cards)} flashcards from '{source_name}'"
    )


def _parse_flashcard_ai_response(llm_raw: str) -> list[dict]:

    import re

    logger.debug(f"Parsing AI flashcard response: {llm_raw[:300]}...")

    try:
        data = json.loads(llm_raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", llm_raw)
        if m:
            try:
                data = json.loads(m.group(0))
            except Exception:
                logger.error(f"Failed to parse JSON from AI output: {llm_raw[:200]}")
                raise HTTPException(status_code=502, detail="AI returned non-JSON output")
        else:
            logger.error(f"No JSON found in AI output: {llm_raw[:200]}")
            raise HTTPException(status_code=502, detail="AI returned non-JSON output")

    if isinstance(data, dict) and "flashcards" in data and isinstance(data["flashcards"], list):
        cards = data["flashcards"]
    elif isinstance(data, list):
        cards = data
    else:
        logger.error(f"AI output JSON did not contain flashcards array. Keys: {data.keys() if isinstance(data, dict) else 'not a dict'}")
        raise HTTPException(status_code=502, detail="AI output invalid format")

    total_cards = len(cards)
    logger.info(f"Parsed {total_cards} flashcards from AI response")
    
    for idx, card in enumerate(cards, 1):
        card_number = card.get("number", "")
        expected_number = f"{idx}/{total_cards}"
        
        if card_number:
            if card_number != expected_number:
                logger.warning(f"Card {idx}: Expected number '{expected_number}', got '{card_number}'")
        
        card.pop("number", None)
    
    logger.info(f"Verified {total_cards} flashcards with sequential numbering. Removed number field.")
    return cards

class GenerateFromKnowledgeBaseRequest(BaseModel):
    topic: str | None = Field(None, min_length=1, max_length=500, description="Topic to search for in knowledge base")
    concept_ids: list[str] | None = Field(None, description="Specific concept UUIDs to fetch")
    source_id: str | None = Field(None, description="Document/source UUID to fetch content from")
    target_count: int = Field(default=5, ge=1, le=50, description="Exact number of flashcards to generate")
    save: bool = Field(default=False, description="If true, auto-save generated flashcards to database")
    language: str = Field(default="en", description="Language for content retrieval")
    tags: list[str] | None = Field(default=[], description="User selected tags to attach to generated flashcards")
    custom_prompt: str | None = Field(None, max_length=500, description="Optional extra instructions for the AI when generating flashcards")

@router.post("/extract-text")
async def extract_text_from_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):

    import tempfile, os
    name = (file.filename or "").lower()
    data = await file.read()

    try:
        if name.endswith(".txt"):
            text = data.decode("utf-8", errors="replace")

        elif name.endswith(".docx"):
            from docx import Document as DocxDocument
            import io
            doc = DocxDocument(io.BytesIO(data))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            text = "\n".join(paragraphs)

        elif name.endswith(".pdf"):
            import fitz
            import io
            pdf = fitz.open(stream=data, filetype="pdf")
            pages = [page.get_text() for page in pdf]
            text = "\n".join(pages)
            pdf.close()

        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use .txt, .docx, or .pdf")

        if not text.strip():
            raise HTTPException(status_code=422, detail="No readable text found in the file")

        return {"text": text, "filename": file.filename}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)}")

class GenerateFromKnowledgeBaseResponse(BaseModel):
    flashcards: list[FlashcardItem]
    saved_ids: list[str] | None = None
    content_source: str
    message: str

@router.post("/generate-from-knowledge-base", response_model=GenerateFromKnowledgeBaseResponse)
async def generate_flashcards_from_knowledge_base(
    payload: GenerateFromKnowledgeBaseRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    if not payload.topic and not payload.concept_ids and not payload.source_id:
        raise HTTPException(
            status_code=400,
            detail="Must provide one of: topic, concept_ids, or source_id"
        )

    kb_content = ""
    content_source = ""

    try:
        if payload.topic:
            kb_content = await knowledge_service.get_knowledge_for_topic(
                topic=payload.topic,
                db=db,
                user_id=current_user["id"],
                top_k=8,
                include_related=True,
                include_prerequisites=True,
                include_document_text=False,
                language=payload.language
            )
            content_source = f"Topic: {payload.topic}"

        elif payload.concept_ids:
            concept_uuids = []
            for cid_str in payload.concept_ids:
                try:
                    concept_uuids.append(UUID(cid_str))
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid concept UUID: {cid_str}")

            kb_content = await knowledge_service.get_knowledge_for_concepts(
                concept_ids=concept_uuids,
                db=db,
                include_relationships=True,
                include_source_text=False,
                language=payload.language
            )
            content_source = f"Concepts: {len(concept_uuids)} selected"

        elif payload.source_id:
            try:
                source_uuid = UUID(payload.source_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid source UUID")

            source_repo = SourceRepository(db)
            source = await source_repo.get_by_id(source_uuid)
            if not source:
                raise HTTPException(status_code=404, detail="Source not found")
            if source.get("uploaded_by") and source["uploaded_by"] != current_user["id"] and not source.get("is_public"):
                raise HTTPException(status_code=403, detail="You do not have access to this source")

            kb_content = await knowledge_service.get_knowledge_from_document(
                source_id=source_uuid,
                db=db,
                include_concepts=True,
                include_summary=True,
                include_full_text=False,
                include_relationships=True,
                language=payload.language
            )
            doc_name = source.get("document_name", "Untitled")
            content_source = f"Document: {doc_name}"

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch knowledge base content: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching knowledge base: {str(e)}")

    if not kb_content or not kb_content.strip():
        raise HTTPException(
            status_code=404,
            detail="No knowledge base content found. Try a different topic or document."
        )

    max_content_chars = 12000
    if len(kb_content) > max_content_chars:
        kb_content = kb_content[:max_content_chars] + "\n\n[Content truncated for flashcard generation]"

    ai: AIProvider = ai_provider
    prompt_template = get_prompt("flashcard")
    
    target_count = payload.target_count
    hints = "Generate comprehensive flashcards covering the key concepts and learning objectives."
    if payload.tags:
        hints = hints + " Focus on these tags: " + ", ".join(payload.tags)
    if payload.custom_prompt:
        hints = hints + " " + payload.custom_prompt.strip()

    user_prompt = prompt_template.format_user_prompt(
        topic=payload.topic or content_source,
        target_count=target_count,
        hints_section=hints,
        content=kb_content,
    )

    async def _ai_gen_kb():
        async with ai.session(system_prompt=prompt_template.system_prompt) as s:
            return await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.5,
                max_tokens=4000
            )

    try:
        llm_raw = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_gen_kb, UserPriority.REGULAR
        )
    except AIProviderError as exc:
        logger.error(f"AI provider error: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    cards = _parse_flashcard_ai_response(llm_raw)
    logger.info(f"AI generated {len(cards)} flashcards from knowledge base")

    result_cards: list[FlashcardItem] = []
    for item in cards:
        front = str(item.get("front") or item.get("question") or "").strip()
        back = str(item.get("back") or item.get("answer") or "").strip()
        if not front or not back:
            continue

        ai_tags = item.get("tags") or []
        user_tags = payload.tags or []
        merged = []
        for t in (ai_tags + user_tags):
            if not isinstance(t, str):
                continue
            tt = t.strip()
            if tt and tt not in merged:
                merged.append(tt)

        result_cards.append(FlashcardItem(
            front=front, back=back,
            card_type=item.get("card_type"),
            difficulty=item.get("difficulty"),
            tags=merged,
            tips=item.get("tips"),
            mnemonic=item.get("mnemonic"),
            source_quote=item.get("source_quote"),
            mcq_options=item.get("mcq_options"),
            correct_option=item.get("correct_option"),
        ))

    if not result_cards:
        raise HTTPException(status_code=502, detail="AI returned no valid flashcards from the knowledge base")

    saved_ids: list[str] | None = None
    if payload.save:
        saved_ids = []
        for card in result_cards:
            content_metadata = {"source": content_source, "kb_generated": True}
            if card.tags:
                content_metadata["tags"] = card.tags

            try:
                row = await db.fetchrow(
                    """
                    INSERT INTO flashcards (user_id, front_content, back_content, card_type,
                                            choices, content_metadata, source_type)
                    VALUES ($1, $2, $3, $4, '[]'::jsonb, $5::jsonb, 'note_generated')
                    RETURNING id::text AS id
                    """,
                    current_user["id"],
                    card.front,
                    card.back,
                    card.card_type or "standard",
                    json.dumps(content_metadata),
                )
                saved_ids.append(row["id"])
            except Exception as e:
                logger.error(f"Failed to save flashcard: {e}")

    return GenerateFromKnowledgeBaseResponse(
        flashcards=result_cards,
        saved_ids=saved_ids,
        content_source=content_source,
        message=f"Generated {len(result_cards)} flashcards from {content_source}"
    )

@router.post("/generate-mnemonic/stream")
async def generate_mnemonic_stream(
    payload: MnemonicRequest,
    current_user=Depends(get_current_user)
):

    ai = ai_provider

    user_prompt = (
        f"Create a {payload.style} mnemonic for:\n\n"
        f"{payload.text}\n\n"
        f"Language: {payload.language}"
    )

    async def event_stream():
        try:
            async with ai.session(system_prompt=MNEMONIC_SYSTEM_PROMPT) as s:
                async for chunk in ai.generate_stream(
                    prompt=user_prompt,
                    session=s,
                    temperature=0.7,
                    max_tokens=400
                ):

                    if chunk is None:
                        continue
                    text = str(chunk)
                    for line in text.splitlines():
                        yield f"data: {line}\n\n"

            yield "event: done\ndata: [DONE]\n\n"

        except AIProviderError as exc:
            yield f"event: error\ndata: {str(exc)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

class CreateFlashcardRequest(BaseModel):
    front: str = Field(..., min_length=1, max_length=5000, description="Front content (question)")
    back: str = Field(..., min_length=1, max_length=10000, description="Back content (answer)")
    card_type: str = Field(default="standard", description="Card type: 'standard' or 'mcq'")
    choices: list[str] | None = Field(default=None, description="MCQ choices (required if card_type is 'mcq')")
    correct_answer: str | None = Field(default=None, description="Correct answer for MCQ")
    tags: list[str] | None = Field(default=None, description="Optional tags")
    topic: str | None = Field(default=None, description="Subject/topic this flashcard belongs to (e.g. Physics, Chemistry)")
    concept_id: str | None = Field(default=None, description="Optional concept UUID to link")
    auto_generate_tags: bool = Field(default=True, description="If true, AI will auto-generate tags based on content")
    tips: str | None = Field(default=None, description="Optional tips/hints for the flashcard")
    mnemonic: str | None = Field(default=None, description="Optional mnemonic for the flashcard")

class CreateFlashcardResponse(BaseModel):
    id: str
    front: str
    back: str
    card_type: str
    choices: list[str] | None = None
    correct_answer: str | None = None
    message: str = "Flashcard created"

@router.post("/create", response_model=CreateFlashcardResponse, status_code=status.HTTP_201_CREATED)
async def create_flashcard(
    payload: CreateFlashcardRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    if payload.card_type == "mcq":
        if not payload.choices or len(payload.choices) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MCQ cards require at least 2 choices"
            )
        if not payload.correct_answer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MCQ cards require a correct_answer"
            )
        if payload.correct_answer not in payload.choices:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="correct_answer must be one of the choices"
            )
    elif payload.card_type not in ("standard", "mcq"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="card_type must be 'standard' or 'mcq'"
        )

    tags = payload.tags
    if payload.auto_generate_tags and not tags:
        try:
            ai: AIProvider = ai_provider
            tagging_prompt = f"""Analyze this flashcard and generate 2-4 meaningful tags to categorize and organize it.

FLASHCARD CONTENT:
Question: {payload.front}
Answer: {payload.back}

GENERATE TAGS:
Return a JSON object with a "tags" array containing 2-4 meaningful tags:
{{
  "tags": ["tag1", "tag2", "tag3"]
}}

Tags should:
- Be lowercase with hyphens for multi-word tags (e.g., "data-structures")
- Include main topic/subject area, specific concept, and learning type
- Be meaningful and searchable
- Examples: "vocabulary", "problem-solving", "terminology", "application", "definition"

Return ONLY the JSON object, no explanation."""
            
            async with ai.session(system_prompt="You are a tagging specialist. Generate meaningful tags for educational flashcards.") as s:
                tag_response = await ai.generate(
                    user_message=tagging_prompt,
                    max_tokens=200,
                    temperature=0.5,
                    session=s
                )
            
            import re
            tags_match = re.search(r'\{[\s\S]*\}', tag_response)
            if tags_match:
                tags_data = json.loads(tags_match.group(0))
                tags = tags_data.get("tags", None)
                if tags:
                    logger.info(f"Auto-generated tags for flashcard: {tags}")
        except Exception as e:
            logger.warning(f"Failed to auto-generate tags: {e}. Proceeding without tags.")
            tags = None

    content_metadata = {}
    if payload.correct_answer:
        content_metadata["correct_answer"] = payload.correct_answer
    if tags:
        content_metadata["tags"] = tags
    if payload.topic:
        content_metadata["topic"] = payload.topic.strip()

    try:
        row = await db.fetchrow(
            """
            INSERT INTO flashcards (user_id, front_content, back_content, card_type, choices, content_metadata, source_type, tips)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'manual', $7::jsonb)
            RETURNING id::text AS id
            """,
            current_user["id"],
            payload.front.strip(),
            payload.back.strip(),
            payload.card_type,
            json.dumps(payload.choices) if payload.choices else "[]",
            json.dumps(content_metadata) if content_metadata else "{}",
            json.dumps(payload.tips.strip()) if payload.tips and payload.tips.strip() else None
        )

        try:
            await db.execute(
                """
                INSERT INTO flashcard_schedules 
                (flashcard_id, user_id, algorithm, state, due_date, last_review_date, interval_days, reps, ease_factor, stability, difficulty, topic_cached)
                VALUES ($1::uuid, $2::uuid, $3, 'new', NOW(), NULL, 0, 0, 2.5, NULL, NULL, NULL)
                """,
                row["id"],
                current_user["id"],
                "sm2"
            )
        except Exception as schedule_error:
            logger.warning(f"Failed to create schedule for flashcard {row['id']}: {schedule_error}")

        if payload.mnemonic and payload.mnemonic.strip():
            try:
                await db.execute(
                    """
                    INSERT INTO flashcard_mnemonics (flashcard_id, mnemonic_type, content)
                    VALUES ($1::uuid, 'user', $2)
                    """,
                    row["id"],
                    payload.mnemonic.strip()
                )
            except Exception as mnemonic_error:
                logger.warning(f"Failed to save mnemonic for flashcard {row['id']}: {mnemonic_error}")

        return CreateFlashcardResponse(
            id=row["id"],
            front=payload.front.strip(),
            back=payload.back.strip(),
            card_type=payload.card_type,
            choices=payload.choices,
            correct_answer=payload.correct_answer,
            message="Flashcard created successfully"
        )

    except Exception as e:
        logger.error(f"Failed to create flashcard: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

class UpdateTopicRequest(BaseModel):
    topic: str | None = Field(default="")

@router.patch("/{flashcard_id}/topic", status_code=200)
async def update_flashcard_topic(
    flashcard_id: str,
    payload: UpdateTopicRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    topic = (payload.topic or "").strip()
    try:
        result = await db.execute(
            """
            UPDATE flashcards
            SET content_metadata = content_metadata || jsonb_build_object('topic', $1::text)
            WHERE id = $2::uuid AND user_id = $3
            """,
            topic,
            flashcard_id,
            current_user["id"]
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Flashcard not found")
        return {"id": flashcard_id, "topic": topic}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update topic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{flashcard_id}", status_code=status.HTTP_200_OK)
async def delete_flashcard(
    flashcard_id: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    try:
        result = await db.execute(
            """
            DELETE FROM flashcards
            WHERE id = $1::uuid AND user_id = $2
            """,
            flashcard_id,
            current_user["id"]
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Flashcard not found or not owned by user")
        return {"message": "Flashcard deleted", "id": flashcard_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{flashcard_id}", response_model=CreateFlashcardResponse)
async def update_flashcard(
    flashcard_id: str,
    payload: CreateFlashcardRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    if payload.card_type == "mcq":
        if not payload.choices or len(payload.choices) < 2:
            raise HTTPException(status_code=400, detail="MCQ cards require at least 2 choices")
        if not payload.correct_answer:
            raise HTTPException(status_code=400, detail="MCQ cards require a correct_answer")

    content_metadata = {}
    if payload.correct_answer:
        content_metadata["correct_answer"] = payload.correct_answer
    if payload.tags:
        content_metadata["tags"] = payload.tags
    if payload.topic:
        content_metadata["topic"] = payload.topic.strip()

    try:
        result = await db.execute(
            """
            UPDATE flashcards
            SET front_content = $1, back_content = $2, card_type = $3, choices = $4::jsonb, content_metadata = $5::jsonb
            WHERE id = $6::uuid AND user_id = $7
            """,
            payload.front.strip(),
            payload.back.strip(),
            payload.card_type,
            json.dumps(payload.choices) if payload.choices else "[]",
            json.dumps(content_metadata) if content_metadata else "{}",
            flashcard_id,
            current_user["id"]
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Flashcard not found or not owned by user")

        return CreateFlashcardResponse(
            id=flashcard_id,
            front=payload.front.strip(),
            back=payload.back.strip(),
            card_type=payload.card_type,
            choices=payload.choices,
            correct_answer=payload.correct_answer,
            message="Flashcard updated successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/review")
async def get_flashcards_review(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:
        offset = (page - 1) * page_size

        total: int = await db.fetchval(
            "SELECT COUNT(*) FROM flashcards WHERE user_id = $1 AND NOT is_archived",
            current_user["id"],
        ) or 0

        rows = await db.fetch(
            """
            SELECT f.id::text AS id,
                   f.front_content,
                   f.back_content,
                   f.card_type,
                   COALESCE(f.choices, f.content_metadata->'choices', f.content_metadata->'options') AS choices,
                   COALESCE(f.content_metadata->>'correct_answer', NULL) AS correct_answer,
                   COALESCE(f.due_label, f.content_metadata->>'due_label') AS due_label,
                   f.tips,
                   f.content_metadata->>'topic' AS topic,
                   COALESCE(s.interval_days, 0) AS interval_days,
                   COALESCE(s.reps, 0) AS reps,
                   COALESCE(s.ease_factor, 2.5) AS ease_factor,
                   s.stability,
                   s.difficulty,
                   s.algorithm AS schedule_algorithm
            FROM flashcards f
            LEFT JOIN flashcard_schedules s ON s.flashcard_id = f.id AND s.user_id = f.user_id
            WHERE f.user_id = $1 AND NOT f.is_archived
            ORDER BY f.created_at ASC
            LIMIT $2 OFFSET $3
            """,
            current_user["id"], page_size, offset,
        )

        result = []
        ids: list[str] = []
        for r in rows:

            choices_val = r.get("choices")
            if isinstance(choices_val, str):
                try:
                    choices_val = json.loads(choices_val)
                except Exception:
                    pass
            fid = r["id"]
            ids.append(fid)
            result.append({
                "id": fid,
                "front": r["front_content"],
                "back": r["back_content"],
                "card_type": r.get("card_type"),
                "choices": choices_val if choices_val is not None else None,
                "correct_answer": r.get("correct_answer"),
                "due_label": r.get("due_label"),
                "tips": (r.get("tips") if isinstance(r.get("tips"), str) else None),
                "topic": r.get("topic"),
                "interval_days": r.get("interval_days") or 0,
                "reps": r.get("reps") or 0,
                "ease_factor": r.get("ease_factor") or 2.5,
                "stability": r.get("stability"),
                "difficulty": r.get("difficulty"),
            })

        if ids:
            try:
                att_rows = await db.fetch(
                    """
                    SELECT fm.flashcard_id::text AS flashcard_id, em.media_type, em.file_url, fm.id as id, fm.media_position
                    FROM flashcard_media fm
                    JOIN extracted_media em ON em.id = fm.media_id
                    WHERE fm.flashcard_id = ANY($1::uuid[])
                    ORDER BY fm.display_order, fm.created_at
                    """,
                    ids,
                )

                att_map: dict[str, list[dict]] = {}
                for a in att_rows:
                    key = a["flashcard_id"]
                    att_map.setdefault(key, []).append({
                        "id": str(a["id"]),
                        "media_type": a.get("media_type"),
                        "file_url": a.get("file_url"),
                        "media_position": a.get("media_position"),
                    })

                mn_rows = await db.fetch(
                    """
                    SELECT id::text AS id, flashcard_id::text AS flashcard_id, content, mnemonic_type, created_at
                    FROM flashcard_mnemonics
                    WHERE flashcard_id = ANY($1::uuid[])
                    ORDER BY created_at ASC
                    """,
                    ids,
                )

                mn_map: dict[str, list[dict]] = {}
                for m in mn_rows:
                    key = m["flashcard_id"]
                    mn_map.setdefault(key, []).append({
                        "id": m["id"],
                        "content": m.get("content"),
                        "mnemonic_type": m.get("mnemonic_type"),
                        "created_at": str(m.get("created_at")) if m.get("created_at") else None,
                    })

                tag_rows = await db.fetch(
                    """
                    SELECT ta.entity_id::text AS flashcard_id, t.name
                    FROM tag_applications ta
                    JOIN tags t ON t.id = ta.tag_id
                    WHERE ta.entity_type = 'flashcard' AND ta.entity_id = ANY($1::uuid[])
                    ORDER BY t.name
                    """,
                    ids,
                )
                tag_map: dict[str, list[str]] = {}
                for tr in tag_rows:
                    tag_map.setdefault(tr["flashcard_id"], []).append(tr["name"])

                for obj in result:
                    fid = obj["id"]
                    if fid in att_map:
                        obj["attachments"] = [
                            {"id": it["id"], "media_type": it.get("media_type"), "file_url": it.get("file_url"), "media_position": it.get("media_position")} for it in att_map[fid]
                        ]
                    if fid in mn_map:
                        obj["mnemonics"] = mn_map[fid]
                    obj["tags"] = tag_map.get(fid, [])

            except Exception:
                logger.exception("failed to load attachments/mnemonics for review")

        return {"cards": result, "total": total, "page": page, "page_size": page_size}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/topics")
async def get_available_topics(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)
):

    try:
        rows = await db.fetch(
            """
            SELECT
                content_metadata->>'topic' AS topic,
                COUNT(*)::int AS flashcard_count
            FROM flashcards
            WHERE user_id = $1
              AND NOT is_archived
              AND content_metadata->>'topic' IS NOT NULL
              AND content_metadata->>'topic' != ''
            GROUP BY content_metadata->>'topic'
            ORDER BY flashcard_count DESC, topic ASC
            """,
            current_user["id"]
        )

        result = [
            {
                "name": str(r["topic"]),
                "count": int(r["flashcard_count"]),
                "color": None,
                "icon": None,
            }
            for r in rows
        ]
        return result
    except Exception as e:
        logger.exception("Failed to get available topics")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tags")
async def get_available_tags(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
    limit: int = 100,
):

    try:
        rows = await db.fetch(
            """
            SELECT tag, COUNT(*)::int AS count FROM (
                SELECT jsonb_array_elements_text(content_metadata->'tags') AS tag
                FROM flashcards
                WHERE user_id = $1 AND NOT is_archived AND content_metadata ? 'tags'
            ) t
            GROUP BY tag
            ORDER BY count DESC, tag ASC
            LIMIT $2
            """,
            current_user["id"],
            limit,
        )

        return [{"tag": r["tag"], "count": r["count"]} for r in rows]
    except Exception as e:
        logger.exception("Failed to get tags")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{flashcard_id}/detail")
async def get_flashcard_detail(
    flashcard_id: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user),
):

    try:
        row = await db.fetchrow("""
            SELECT id, front_content, back_content, card_type, tips, due_label, created_at
            FROM flashcards
            WHERE id = $1::uuid
        """, flashcard_id)
        if not row:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        return {
            "id": str(row["id"]),
            "front": row["front_content"],
            "back": row["back_content"],
            "card_type": row["card_type"],
            "tips": (row["tips"] if isinstance(row["tips"], str) else None),
            "due_label": row.get("due_label"),
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get flashcard detail failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class FlashcardTagRequest(BaseModel):
    tag_name: str = Field(..., description="Tag name to add/remove")
    color: str | None = Field(default=None, description="Optional hex color for the tag")

@router.get("/{flashcard_id}/tags")
async def get_flashcard_tags(
    flashcard_id: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:

        card = await db.fetchrow(
            "SELECT id FROM flashcards WHERE id = $1 AND user_id = $2",
            flashcard_id, current_user["id"]
        )
        if not card:
            raise HTTPException(status_code=404, detail="Flashcard not found")

        rows = await db.fetch(
            """
            SELECT t.id, t.name, t.color, t.icon, ta.applied_at
            FROM tag_applications ta
            JOIN tags t ON t.id = ta.tag_id
            WHERE ta.entity_type = 'flashcard' AND ta.entity_id = $1
            ORDER BY ta.applied_at ASC
            """,
            flashcard_id,
        )
        return [{"id": str(r["id"]), "name": r["name"], "color": r["color"], "icon": r["icon"], "applied_at": r["applied_at"].isoformat() if r["applied_at"] else None} for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get flashcard tags")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{flashcard_id}/tags")
async def add_tag_to_flashcard(
    flashcard_id: str,
    payload: FlashcardTagRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:
        card = await db.fetchrow(
            "SELECT id FROM flashcards WHERE id = $1 AND user_id = $2",
            flashcard_id, current_user["id"]
        )
        if not card:
            raise HTTPException(status_code=404, detail="Flashcard not found")

        tag_name = payload.tag_name.strip()
        if not tag_name:
            raise HTTPException(status_code=400, detail="Tag name cannot be empty")

        url_id = tag_name.lower().replace(" ", "-")

        tag = await db.fetchrow(
            """
            INSERT INTO tags (user_id, name, url_id, color)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, url_id) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name, color
            """,
            current_user["id"], tag_name, url_id, payload.color
        )

        await db.execute(
            """
            INSERT INTO tag_applications (tag_id, entity_type, entity_id, applied_by)
            VALUES ($1, 'flashcard', $2, $3)
            ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING
            """,
            tag["id"], flashcard_id, current_user["id"]
        )

        await db.execute(
            "UPDATE tags SET usage_count = (SELECT COUNT(*) FROM tag_applications WHERE tag_id = $1) WHERE id = $1",
            tag["id"]
        )

        return {"id": str(tag["id"]), "name": tag["name"], "color": tag["color"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to add tag to flashcard")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{flashcard_id}/tags/{tag_name}")
async def remove_tag_from_flashcard(
    flashcard_id: str,
    tag_name: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:
        card = await db.fetchrow(
            "SELECT id FROM flashcards WHERE id = $1 AND user_id = $2",
            flashcard_id, current_user["id"]
        )
        if not card:
            raise HTTPException(status_code=404, detail="Flashcard not found")

        url_id = tag_name.strip().lower().replace(" ", "-")

        tag = await db.fetchrow(
            "SELECT id FROM tags WHERE user_id = $1 AND url_id = $2",
            current_user["id"], url_id
        )
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")

        await db.execute(
            "DELETE FROM tag_applications WHERE tag_id = $1 AND entity_type = 'flashcard' AND entity_id = $2",
            tag["id"], flashcard_id
        )

        await db.execute(
            "UPDATE tags SET usage_count = (SELECT COUNT(*) FROM tag_applications WHERE tag_id = $1) WHERE id = $1",
            tag["id"]
        )

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to remove tag from flashcard")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-tag/{tag_name}")
async def get_flashcards_by_tag(
    tag_name: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:
        url_id = tag_name.strip().lower().replace(" ", "-")

        rows = await db.fetch(
            """
            SELECT f.id, f.front_content, f.back_content, f.card_type, f.created_at
            FROM flashcards f
            JOIN tag_applications ta ON ta.entity_id = f.id AND ta.entity_type = 'flashcard'
            JOIN tags t ON t.id = ta.tag_id
            WHERE f.user_id = $1 AND t.url_id = $2 AND NOT f.is_archived
            ORDER BY f.created_at DESC
            """,
            current_user["id"], url_id
        )
        return [{"id": str(r["id"]), "front_content": r["front_content"], "back_content": r["back_content"], "card_type": r["card_type"], "created_at": r["created_at"].isoformat()} for r in rows]
    except Exception as e:
        logger.exception("Failed to get flashcards by tag")
        raise HTTPException(status_code=500, detail=str(e))

class MixTopicsRequest(BaseModel):
    topics: list[str] = Field(..., min_items=2, description="List of topic names to mix (at least 2)")
    card_count: int = Field(default=5, ge=1, le=20, description="Total number of cross-topic cards to generate")

class MixTopicsSaveRequest(BaseModel):
    topics: list[str] = Field(..., min_items=2, description="List of topic names")
    cards: list[dict] = Field(..., description="Flashcards to save (with front, back, card_type, choices, correct_answer, tags)")

async def _generate_mixed_topics_cards(
    topics: list[str],
    card_count: int,
) -> list[dict]:

    import re as _re

    if len(topics) < 2:
        raise HTTPException(status_code=400, detail="Please select at least 2 topics to generate cross-topic flashcards")

    ai: AIProvider = ai_provider
    prompt_template = get_prompt("cross_topic_flashcard")

    user_prompt = prompt_template.format_user_prompt(
        topics=topics,
        target_count=card_count,
    )

    try:
        async with ai.session(system_prompt=prompt_template.system_prompt) as s:
            llm_raw = await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.7,
                max_tokens=2000,
            )
    except AIProviderError as exc:
        logger.warning(f"AI error generating cross-topic cards: {exc}")
        raise HTTPException(status_code=502, detail="AI generation failed. Please try again.")

    try:
        data = json.loads(llm_raw)
    except json.JSONDecodeError:
        m = _re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", llm_raw)
        if not m:
            logger.warning("No JSON found in cross-topic AI response")
            raise HTTPException(status_code=502, detail="AI returned invalid response. Please try again.")
        try:
            data = json.loads(m.group(0))
        except Exception:
            raise HTTPException(status_code=502, detail="AI returned invalid response. Please try again.")

    cards = data.get("flashcards", data) if isinstance(data, dict) else data
    if not isinstance(cards, list) or len(cards) == 0:
        raise HTTPException(status_code=502, detail="AI did not return any flashcards. Please try again.")

    all_results = []
    topics_label = " × ".join(topics)

    for item in cards:
        if not isinstance(item, dict):
            continue
        front = str(item.get("front") or "").strip()
        back = str(item.get("back") or "").strip()
        if not front or not back:
            continue

        card_type = item.get("card_type", "standard")
        choices = item.get("choices") if item.get("choices") and isinstance(item.get("choices"), list) else None
        correct_answer = item.get("correct_answer")

        ai_tags: list[str] = item.get("tags") or []
        merged_tags: list[str] = ["cross-topic"]
        for t in ai_tags:
            if isinstance(t, str) and t.strip() and t.strip() not in merged_tags:
                merged_tags.append(t.strip())

        tips = str(item.get("tips") or "").strip() or None
        mnemonic = str(item.get("mnemonic") or "").strip() or None

        all_results.append({
            "front": front,
            "back": back,
            "topic": topics_label,
            "cross_topics": topics,
            "card_type": card_type,
            "choices": choices,
            "correct_answer": correct_answer,
            "tags": merged_tags,
            "tips": tips,
            "mnemonic": mnemonic,
            "generated": True,
        })

    return all_results

@router.post("/mix-topics", response_model=list[dict])
async def preview_mixed_flashcards(
    payload: MixTopicsRequest,
    current_user=Depends(get_current_user),
):

    try:
        cards = await _generate_mixed_topics_cards(payload.topics, payload.card_count)
        return cards
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate cross-topic flashcards preview")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mix-topics/save", response_model=list[dict])
async def save_mixed_flashcards(
    payload: MixTopicsSaveRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)
):

    try:
        topics = payload.topics
        topics_label = " × ".join(topics)
        
        all_results = []

        for item in payload.cards:
            if not isinstance(item, dict):
                continue
            front = str(item.get("front") or "").strip()
            back = str(item.get("back") or "").strip()
            if not front or not back:
                continue

            card_type = item.get("card_type", "standard")
            choices = item.get("choices") if item.get("choices") and isinstance(item.get("choices"), list) else None
            correct_answer = item.get("correct_answer")
            tags = item.get("tags") or ["cross-topic"]
            tips = str(item.get("tips") or "").strip() or None
            mnemonic = str(item.get("mnemonic") or "").strip() or None

            content_meta: dict = {
                "topic": topics_label,
                "cross_topics": topics,
            }
            if correct_answer:
                content_meta["correct_answer"] = correct_answer
            if tags:
                content_meta["tags"] = tags

            new_id = await db.fetchval(
                """
                INSERT INTO flashcards (user_id, front_content, back_content, card_type, choices, content_metadata, source_type)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'note_generated')
                RETURNING id
                """,
                current_user["id"],
                front, back, card_type,
                json.dumps(choices) if choices else None,
                json.dumps(content_meta),
            )

            if tips:
                await db.execute(
                    "UPDATE flashcards SET tips = $1::jsonb WHERE id = $2",
                    json.dumps([tips]), new_id,
                )

            if mnemonic:
                await db.execute(
                    """
                    INSERT INTO flashcard_mnemonics (flashcard_id, mnemonic_type, content)
                    VALUES ($1, 'ai', $2)
                    ON CONFLICT DO NOTHING
                    """,
                    new_id, mnemonic,
                )

            for tag_name in tags:
                url_id = tag_name.lower().replace(" ", "-")
                tag_row = await db.fetchrow(
                    """
                    INSERT INTO tags (user_id, name, url_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, url_id) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                    """,
                    current_user["id"], tag_name, url_id,
                )
                await db.execute(
                    """
                    INSERT INTO tag_applications (tag_id, entity_type, entity_id, applied_by)
                    VALUES ($1, 'flashcard', $2, $3)
                    ON CONFLICT DO NOTHING
                    """,
                    tag_row["id"], new_id, current_user["id"],
                )

            all_results.append({
                "id": str(new_id),
                "front": front,
                "back": back,
                "topic": topics_label,
                "cross_topics": topics,
                "card_type": card_type,
                "choices": choices,
                "correct_answer": correct_answer,
                "tags": tags,
                "tips": tips,
                "mnemonic": mnemonic,
                "generated": True,
            })

        return all_results

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to save cross-topic flashcards")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/schedule")
async def get_flashcards_schedule(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)
):

    try:

        await db.execute(
            """
            INSERT INTO flashcard_schedules (flashcard_id, user_id, algorithm, state, due_date, last_review_date, interval_days, reps, ease_factor, stability, difficulty, topic_cached)
            SELECT f.id, $1::uuid, 'sm2', 'new',
                   COALESCE(f.created_at, NOW()),
                   NULL, 0, 0, 2.5, NULL, NULL, NULL
            FROM flashcards f
            WHERE f.user_id = $1::uuid
              AND NOT EXISTS (
                SELECT 1 FROM flashcard_schedules s WHERE s.flashcard_id = f.id AND s.user_id = $1::uuid
              )
            """,
            current_user["id"]
        )

        rows = await db.fetch(
            """
                 SELECT s.flashcard_id::text AS id,
                     f.front_content AS front,
                     s.due_date AS next_due,
                     s.last_review_date AS last_review_date,
                     f.created_at AS created_at,
                     s.state AS status
            FROM flashcard_schedules s
            JOIN flashcards f ON f.id = s.flashcard_id
            WHERE s.user_id = $1
            ORDER BY s.due_date ASC NULLS LAST, f.created_at ASC
            LIMIT 1000
            """,
            current_user["id"]
        )

        result = []
        for r in rows:
            nd = r.get("next_due")
            if nd is None:
                nd_iso = None
            else:
                try:
                    if isinstance(nd, str):
                        nd_iso = nd
                    else:
                        if nd.tzinfo is None:
                            nd_utc = nd.replace(tzinfo=datetime.timezone.utc)
                        else:
                            nd_utc = nd.astimezone(datetime.timezone.utc)
                        nd_iso = nd_utc.isoformat().replace("+00:00", "Z")
                except Exception:
                    nd_iso = str(nd)

            ld = r.get("last_review_date")
            if ld is None:
                ld_iso = None
            else:
                try:
                    if isinstance(ld, str):
                        ld_iso = ld
                    else:
                        if ld.tzinfo is None:
                            ld_utc = ld.replace(tzinfo=datetime.timezone.utc)
                        else:
                            ld_utc = ld.astimezone(datetime.timezone.utc)
                        ld_iso = ld_utc.isoformat().replace("+00:00", "Z")
                except Exception:
                    ld_iso = str(ld)

            ca = r.get("created_at")
            if ca is None:
                ca_iso = None
            else:
                try:
                    if isinstance(ca, str):
                        ca_iso = ca
                    else:
                        if ca.tzinfo is None:
                            ca_utc = ca.replace(tzinfo=datetime.timezone.utc)
                        else:
                            ca_utc = ca.astimezone(datetime.timezone.utc)
                        ca_iso = ca_utc.isoformat().replace("+00:00", "Z")
                except Exception:
                    ca_iso = str(ca)

            status = r.get("status") or "scheduled"
            if nd is not None:
                try:
                    if isinstance(nd, str):
                        due_date = datetime.datetime.fromisoformat(nd.replace('Z', '+00:00')).date()
                    else:
                        due_date = nd.date() if hasattr(nd, 'date') else nd
                    
                    today = datetime.datetime.now(datetime.timezone.utc).date()
                    if due_date < today:
                        status = "overdue"
                except Exception:
                    pass

            result.append({
                "id": r["id"],
                "front": r.get("front"),
                "next_due": nd_iso,
                "last_review_date": ld_iso,
                "created_at": ca_iso,
                "status": status,
            })

        try:
            today_date = datetime.datetime.now(datetime.timezone.utc).date()
            
            overdue_items = [item for item in result if item["status"] == "overdue"]
            today_items = [item for item in result if (
                item["next_due"] and
                datetime.datetime.fromisoformat(item["next_due"].replace('Z', '+00:00')).date() == today_date
            )]
            
            logger.info(f"[Flashcards Schedule] User {current_user['id']}: {len(result)} total items, {len(overdue_items)} overdue, {len(today_items)} today")
            
            from app.repositories.notification_repository import NotificationRepository
            notif_repo = NotificationRepository(db)
            
            if overdue_items:
                try:
                    existing_overdue = await db.fetchval(
                        """
                        SELECT id FROM notifications
                        WHERE user_id = $1 AND notification_type = 'system'
                        AND DATE(created_at) = CURRENT_DATE
                        AND title LIKE '%Overdue cards%'
                        LIMIT 1
                        """,
                        current_user["id"]
                    )
                    
                    if not existing_overdue:
                        logger.info(f"[Flashcards Schedule] Creating overdue notification for {current_user['id']}")
                        await notif_repo.create(
                            user_id=str(current_user["id"]),
                            notification_type="system",
                            title=f"⏰ {len(overdue_items)} overdue card(s) waiting",
                            body=f"You have {len(overdue_items)} flashcard(s) that are overdue for review. Catch up now to maintain your learning progress!",
                            entity_type="flashcard",
                            action_data={"overdue_count": len(overdue_items), "action_url": "/flashcards/schedule"}
                        )
                except Exception as e:
                    logger.warning(f"Failed to create overdue notification: {e}")
            
            if today_items and not overdue_items:
                try:
                    existing_today = await db.fetchval(
                        """
                        SELECT id FROM notifications
                        WHERE user_id = $1 AND notification_type = 'system'
                        AND DATE(created_at) = CURRENT_DATE
                        AND title LIKE '%due today%'
                        LIMIT 1
                        """,
                        current_user["id"]
                    )
                    
                    if not existing_today:
                        logger.info(f"[Flashcards Schedule] Creating today notification for {current_user['id']}")
                        await notif_repo.create(
                            user_id=str(current_user["id"]),
                            notification_type="system",
                            title=f"📚 {len(today_items)} card(s) due today",
                            body=f"You have {len(today_items)} flashcard(s) scheduled for review today. Take 5-10 minutes to keep your spaced repetition on track!",
                            entity_type="flashcard",
                            action_data={"today_count": len(today_items), "action_url": "/flashcards/schedule"}
                        )
                    else:
                        logger.info(f"[Flashcards Schedule] Today notification already exists for {current_user['id']}")
                except Exception as e:
                    logger.warning(f"Failed to create today notification: {e}")
                    
        except Exception as notif_error:
            logger.warning(f"Failed to create notifications: {notif_error}")

        return result

    except Exception as e:
        logger.exception("failed to fetch schedule")
        raise HTTPException(status_code=500, detail=str(e))

class ReviewSubmissionRequest(BaseModel):
    flashcard_id: str = Field(..., description="Flashcard ID to review")
    quality: int = Field(..., ge=0, le=5, description="Quality score (0-5): 0=Again, 1=Hard, 2=Good, 3=Easy, etc.")
    algorithm: str | None = Field(None, description="Algorithm override: sm2, leitner, simple, fsrs")

@router.post("/{flashcard_id}/review", status_code=status.HTTP_200_OK)
async def submit_review(
    flashcard_id: str,
    payload: ReviewSubmissionRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)
):

    try:

        schedule = await db.fetchrow(
            """
            SELECT s.flashcard_id, s.due_date, s.last_review_date, s.interval_days, s.reps, 
                   s.ease_factor, s.stability, s.difficulty, s.algorithm, s.state
            FROM flashcard_schedules s
            WHERE s.flashcard_id = $1::uuid AND s.user_id = $2::uuid
            """,
            flashcard_id,
            current_user["id"]
        )

        if not schedule:
            await db.execute(
                """
                INSERT INTO flashcard_schedules
                    (flashcard_id, user_id, algorithm, state, due_date, last_review_date,
                     interval_days, reps, ease_factor, stability, difficulty, topic_cached)
                SELECT $1::uuid, $2::uuid, 'sm2', 'new', NOW(), NULL, 0, 0, 2.5, NULL, NULL, NULL
                WHERE EXISTS (SELECT 1 FROM flashcards WHERE id = $1::uuid)
                ON CONFLICT DO NOTHING
                """,
                flashcard_id,
                current_user["id"]
            )
            schedule = await db.fetchrow(
                """
                SELECT s.flashcard_id, s.due_date, s.last_review_date, s.interval_days, s.reps,
                       s.ease_factor, s.stability, s.difficulty, s.algorithm, s.state
                FROM flashcard_schedules s
                WHERE s.flashcard_id = $1::uuid AND s.user_id = $2::uuid
                """,
                flashcard_id,
                current_user["id"]
            )
        if not schedule:
            raise HTTPException(status_code=404, detail="Flashcard not found")

        valid_algos = {"sm2", "leitner", "simple", "fsrs"}
        algorithm = (payload.algorithm if payload.algorithm in valid_algos else None) \
                    or schedule["algorithm"] or "sm2"

        if algorithm != (schedule["algorithm"] or "sm2"):
            await db.execute(
                "UPDATE flashcard_schedules SET algorithm = $1 WHERE flashcard_id = $2::uuid AND user_id = $3::uuid",
                algorithm, flashcard_id, current_user["id"]
            )
        now = datetime.datetime.now(datetime.timezone.utc)
        
        next_due_date = None
        new_interval_days = 1
        new_reps = schedule["reps"] or 0
        new_ease_factor = schedule["ease_factor"] or 2.5
        new_stability = schedule["stability"]
        new_difficulty = schedule["difficulty"]

        if algorithm == "simple":
            new_reps = (schedule["reps"] or 0) + 1
            if payload.quality == 0:
                next_due_date = now + datetime.timedelta(minutes=10)
                new_interval_days = 0
            else:
                next_due_date = now + datetime.timedelta(days=2)
                new_interval_days = 2

        elif algorithm == "leitner":
            current_box = max(1, min(5, schedule["reps"] or 1))
            if payload.quality == 0:
                current_box = 1
            elif payload.quality == 1:
                current_box = max(1, current_box - 1)
            elif payload.quality == 2:
                current_box = min(5, current_box + 1)
            else:
                current_box = min(5, current_box + 2)

            box_to_days = {1: 1, 2: 2, 3: 4, 4: 8, 5: 16}
            new_interval_days = box_to_days.get(current_box, 1)
            new_reps = current_box
            next_due_date = now + datetime.timedelta(days=new_interval_days)

        elif algorithm == "fsrs":
            import math
            W = [0.4072,1.1829,3.1262,15.4722,7.2102,0.5316,1.0651,0.0589,1.5330,0.1544,1.0071,1.9395,0.1100,0.2900,2.2700,0.2500,2.9898,0.5100,0.4340]
            DECAY = -0.5
            FACTOR = 0.9 ** (1 / DECAY) - 1

            rating = min(max(payload.quality, 0), 3)
            new_reps = (schedule["reps"] or 0) + 1

            is_new = not schedule["stability"]
            if is_new:
                new_stability = max(0.1, W[rating])
                new_difficulty = min(10.0, max(1.0, W[4] - math.exp(W[5] * rating) + 1))
                new_interval_days = max(1, round(new_stability))
            else:
                s = max(0.1, float(schedule["stability"] or 1.0))
                d = min(10.0, max(1.0, float(schedule["difficulty"] or 5.0)))
                last_interval = max(1, int(schedule["interval_days"] or 1))
                r = (1 + FACTOR * last_interval / s) ** DECAY

                if rating == 0:
                    new_stability = max(0.1, W[11] * (d ** -W[12]) * ((s + 1) ** W[13] - 1) * math.exp(W[14] * (1 - r)))
                    new_interval_days = 1
                else:
                    hard_penalty = W[15] if rating == 1 else 1.0
                    easy_bonus   = W[16] if rating == 3 else 1.0
                    new_stability = s * (math.exp(W[8]) * (11 - d) * (s ** -W[9]) * (math.exp(W[10] * (1 - r)) - 1) * hard_penalty * easy_bonus + 1)
                    new_interval_days = max(1, round((new_stability / FACTOR) * (0.9 ** (1 / DECAY) - 1)))

                delta_d = -W[6] * (rating - 3)
                new_difficulty = min(10.0, max(1.0, d + delta_d * (10 - d) / 9))

            new_stability = round(new_stability, 4)
            new_difficulty = round(new_difficulty, 4)
            next_due_date = now + datetime.timedelta(days=new_interval_days)

        else:
            reps = schedule["reps"] or 0
            ef = schedule["ease_factor"] or 2.5
            interval = schedule["interval_days"] or 0

            if payload.quality < 2:
                reps = 0
                interval = 1
            else:
                if reps == 0:
                    interval = 1
                    reps = 1
                elif reps == 1:
                    interval = 6
                    reps = 2
                else:
                    interval = max(1, int(interval * ef))
                    reps = reps + 1
                q5 = [1, 3, 4, 5][min(payload.quality, 3)]
                ef = ef + (0.1 - (5 - q5) * (0.08 + (5 - q5) * 0.02))
                if ef < 1.3:
                    ef = 1.3

            new_ease_factor = ef
            new_reps = reps
            new_interval_days = interval
            next_due_date = now + datetime.timedelta(days=interval)

        await db.execute(
            """
            UPDATE flashcard_schedules
            SET due_date = $1,
                last_review_date = NOW(),
                interval_days = $2,
                reps = $3,
                ease_factor = $4,
                stability = $5,
                difficulty = $6,
                state = 'review'
            WHERE flashcard_id = $7::uuid AND user_id = $8::uuid
            """,
            next_due_date,
            new_interval_days,
            new_reps,
            new_ease_factor,
            new_stability,
            new_difficulty,
            flashcard_id,
            current_user["id"]
        )

        if payload.quality == 0:
            try:
                flashcard_row = await db.fetchrow(
                    """
                    SELECT f.front_text, f.back_text, f.hint
                    FROM flashcards f
                    WHERE f.id = $1::uuid
                    """,
                    flashcard_id,
                )
                if flashcard_row:
                    import uuid as _uuid
                    error_id = str(_uuid.uuid4())
                    from datetime import timedelta as _td
                    next_review = now + _td(days=1)

                    error_category = "unknown"
                    try:
                        from app.services.ai.provider import ai_provider as _ai
                        from app.core.enums import UserPriority as _UP
                        cat_prompt = (
                            f"Question (flashcard front): {flashcard_row['front_text']}\n"
                            f"Student forgot / got wrong. Correct answer: {flashcard_row['back_text']}\n\n"
                            "Reply with ONLY one category name from: "
                            "conceptual_misunderstanding, calculation_error, memory_slip, "
                            "misinterpretation, procedural_error, unknown"
                        )
                        async with _ai.session(
                            system_prompt="Classify the student mistake. Reply with only the category name."
                        ) as _sess:
                            _raw = await _ai.generate(
                                prompt=cat_prompt,
                                session=_sess,
                                temperature=0.0,
                                user_priority=_UP.REGULAR,
                            )
                        _cat = _raw.strip().lower().replace(" ", "_")
                        _valid = {"conceptual_misunderstanding", "calculation_error", "memory_slip",
                                  "misinterpretation", "procedural_error", "unknown"}
                        if _cat in _valid:
                            error_category = _cat
                    except Exception:
                        pass

                    await db.execute(
                        """
                        INSERT INTO error_book (
                            id, user_id, wrong_answer,
                            correct_answer_snapshot, system_explanation,
                            error_category, next_review_time
                        ) VALUES ($1, $2, $3, $4, $5, $6::error_category_type, $7)
                        ON CONFLICT DO NOTHING
                        """,
                        error_id,
                        str(current_user["id"]),
                        f"[Flashcard — Again] {flashcard_row['front_text']}",
                        flashcard_row["back_text"] or "",
                        flashcard_row["hint"] or "",
                        error_category,
                        next_review,
                    )

                    try:
                        from app.services.messaging.notification_service import notification_service as _ns
                        await _ns.notify(
                            user_id=str(current_user["id"]),
                            event_type="error.logged",
                            data={
                                "title": "Flashcard logged to Error Log",
                                "message": "You clicked Again — this card has been saved to your Error Log for review.",
                                "error_id": error_id,
                                "action_url": "/application/error-log",
                            },
                            persist=True,
                            db=db,
                        )
                    except Exception:
                        pass
            except Exception as _err:
                logger.warning("Failed to auto-log flashcard error: %s", _err)

        return {
            "flashcard_id": flashcard_id,
            "quality": payload.quality,
            "algorithm": algorithm,
            "next_due": next_due_date.isoformat() if next_due_date else None,
            "interval_days": new_interval_days,
            "message": "Review submitted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to submit review: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AlgorithmRequest(BaseModel):
    algorithm: str = Field(..., description="Algorithm to use: e.g. 'sm2', 'leitner', 'simple' or 'fsrs'")

@router.get("/algorithm")
async def get_user_algorithm(
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)
):

    try:
        row = await db.fetchrow(
            """
            SELECT algorithm FROM flashcard_schedules
            WHERE user_id = $1
            LIMIT 1
            """,
            current_user["id"]
        )
        algorithm = (row["algorithm"] if row and row["algorithm"] else "sm2")
        return {"algorithm": algorithm}
    except Exception as e:
        logger.exception("Failed to get user algorithm")
        return {"algorithm": "sm2"}

@router.post("/algorithm")
async def set_user_algorithm(
    payload: AlgorithmRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user)
):

    try:

        await db.execute(
            """
            UPDATE flashcard_schedules
            SET algorithm = $1
            WHERE user_id = $2
            """,
            payload.algorithm,
            current_user["id"]
        )

        await db.execute(
            """
            INSERT INTO flashcard_schedules (flashcard_id, user_id, algorithm, state, due_date, last_review_date, interval_days, reps, ease_factor, stability, difficulty, topic_cached)
            SELECT f.id, $2::uuid, $1, 'new', NOW(), NULL, 0, 0, 2.5, NULL, NULL, NULL
            FROM flashcards f
            WHERE f.user_id = $2::uuid
              AND NOT EXISTS (
                SELECT 1 FROM flashcard_schedules s WHERE s.flashcard_id = f.id AND s.user_id = $2::uuid
              )
            """,
            payload.algorithm,
            current_user["id"]
        )

        return {"message": "Algorithm updated", "algorithm": payload.algorithm}

    except Exception as e:
        logger.exception("Failed to set user algorithm")
        raise HTTPException(status_code=500, detail=str(e))

class AttachmentCreate(BaseModel):
    type: str = Field(..., description="media type e.g. image, video, audio, link")
    url: str = Field(..., description="External URL or storage path for the media")
    position: str = Field(default="hint", description="media position: front, back, hint, mnemonic")
    caption: str | None = None

class AttachmentResponse(BaseModel):
    id: str
    media_id: str
    flashcard_id: str
    media_type: str
    file_url: str
    media_position: str
    caption: str | None = None
    created_at: str | None = None

@router.post("/{flashcard_id}/attachments", response_model=AttachmentResponse)
async def create_flashcard_attachment(
    flashcard_id: str,
    payload: AttachmentCreate,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:

        allowed_types = {'pdf', 'word', 'excel', 'powerpoint', 'image', 'video', 'audio', 'text', 'website_link'}
        normalized_media_type = (payload.type or '').lower()
        if normalized_media_type not in allowed_types:
            if normalized_media_type in ('link', 'document', 'file'):
                normalized_media_type = 'text'
            else:
                normalized_media_type = 'text'
                
        metadata_obj = {"source_url": payload.url}
        em = await db.fetchrow(
            """
            INSERT INTO extracted_media (media_type, storage_method, file_url, metadata)
            VALUES ($1, 'external_url', $2, $3::jsonb)
            RETURNING *
            """,
            normalized_media_type,
            payload.url,
            json.dumps(metadata_obj),
        )

        if not em:
            raise HTTPException(status_code=500, detail="Failed to create media record")

        fm = await db.fetchrow(
            """
            INSERT INTO flashcard_media (flashcard_id, media_id, media_position, display_order, caption, display_settings)
            VALUES ($1, $2, $3, 1, $4, '{}'::jsonb)
            RETURNING *
            """,
            UUID(flashcard_id),
            em["id"],
            payload.position,
            payload.caption,
        )

        if not fm:
            raise HTTPException(status_code=500, detail="Failed to link media to flashcard")

        return AttachmentResponse(
            id=str(fm["id"]),
            media_id=str(em["id"]),
            flashcard_id=str(fm["flashcard_id"]),
            media_type=em["media_type"],
            file_url=em["file_url"],
            media_position=fm["media_position"],
            caption=fm.get("caption"),
            created_at=str(fm.get("created_at")) if fm.get("created_at") else None,
        )
    except Exception as e:
        logger.exception("create attachment failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{flashcard_id}/upload", response_model=AttachmentResponse)
async def upload_flashcard_media(
    flashcard_id: str,
    file: UploadFile = File(...),
    media_type: str = Form(...),
    position: str = Form('hint'),
    caption: str | None = Form(None),
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")

        save_res = await file_storage_service.save_file(content, file.filename, subdirectory="flashcards")
        abs_path = Path(save_res["file_path"]) 
        
        actual_path = abs_path
        converted_media_type = None
        if file.filename:
            ext = Path(file.filename).suffix.lower()
            if ext in {'.pptx', '.docx', '.xlsx', '.ppt', '.doc', '.xls', '.odp', '.odt', '.ods'}:
                logger.info(f"Attempting to convert office document: {file.filename}")
                pdf_path = await document_conversion_service.convert_to_pdf(abs_path)
                if pdf_path:
                    actual_path = Path(pdf_path)
                    converted_media_type = 'pdf'
                    logger.info(f"Successfully converted {file.filename} to {pdf_path}")
                else:
                    logger.warning(f"Failed to convert {file.filename}, will serve original")
        
        try:
            rel = actual_path.relative_to(Path(settings.upload_dir)).as_posix()
        except Exception:
            rel = actual_path.name
        file_url = f"/media/{rel}"
        metadata_obj = {"file_name": file.filename, "mime_type": file.content_type}

        allowed_types = {'pdf', 'word', 'excel', 'powerpoint', 'image', 'video', 'audio', 'text'}
        
        if converted_media_type:
            normalized_media_type = converted_media_type
        else:
            normalized_media_type = (media_type or '').lower()
            if normalized_media_type not in allowed_types:
                ct = (file.content_type or '').lower()
                if ct.startswith('image/'):
                    normalized_media_type = 'image'
                elif ct.startswith('video/'):
                    normalized_media_type = 'video'
                elif ct.startswith('audio/'):
                    normalized_media_type = 'audio'
                else:
                    if normalized_media_type in ('link', 'document', 'file'):
                        normalized_media_type = 'text'
                    else:
                        normalized_media_type = 'text'

        em = await db.fetchrow(
            """
            INSERT INTO extracted_media (media_type, storage_method, file_url, checksum, metadata)
            VALUES ($1, 'local_path', $2, $3, $4::jsonb)
            RETURNING *
            """,
            normalized_media_type,
            file_url,
            save_res.get("checksum"),
            json.dumps(metadata_obj),
        )

        if not em:
            raise HTTPException(status_code=500, detail="Failed to create media record")

        fm = await db.fetchrow(
            """
            INSERT INTO flashcard_media (flashcard_id, media_id, media_position, display_order, caption, display_settings)
            VALUES ($1, $2, $3, 1, $4, '{}'::jsonb)
            RETURNING *
            """,
            UUID(flashcard_id),
            em["id"],
            position,
            caption,
        )

        if not fm:
            raise HTTPException(status_code=500, detail="Failed to link media to flashcard")

        return AttachmentResponse(
            id=str(fm["id"]),
            media_id=str(em["id"]),
            flashcard_id=str(fm["flashcard_id"]),
            media_type=em["media_type"],
            file_url=em["file_url"],
            media_position=fm["media_position"],
            caption=fm.get("caption"),
            created_at=str(fm.get("created_at")) if fm.get("created_at") else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("upload attachment failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{flashcard_id}/attachments", response_model=list[AttachmentResponse])
async def list_flashcard_attachments(
    flashcard_id: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):
    try:
        rows = await db.fetch(
            """
            SELECT fm.id as id, em.id as media_id, fm.flashcard_id, em.media_type, em.file_url, fm.media_position, fm.caption, fm.created_at
            FROM flashcard_media fm
            JOIN extracted_media em ON em.id = fm.media_id
            WHERE fm.flashcard_id = $1
            ORDER BY fm.display_order, fm.created_at
            """,
            UUID(flashcard_id),
        )

        result = []
        for r in rows:
            result.append(AttachmentResponse(
                id=str(r["id"]),
                media_id=str(r["media_id"]),
                flashcard_id=str(r["flashcard_id"]),
                media_type=r["media_type"],
                file_url=r["file_url"],
                media_position=r["media_position"],
                caption=r.get("caption"),
                created_at=str(r.get("created_at")) if r.get("created_at") else None,
            ))

        return result
    except Exception as e:
        logger.exception("list attachments failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/attachments/{attachment_id}")
async def delete_flashcard_attachment(
    attachment_id: str,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):
    try:
        res = await db.execute("DELETE FROM flashcard_media WHERE id = $1", UUID(attachment_id))
        return {"deleted": True}
    except Exception as e:
        logger.exception("delete attachment failed")
        raise HTTPException(status_code=500, detail=str(e))

class TipsUpdateRequest(BaseModel):
    tips: str | None = Field(default=None, description="Tips/hints text to store for the flashcard")

@router.put("/{flashcard_id}/tips")
async def update_flashcard_tips(
    flashcard_id: str,
    payload: TipsUpdateRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):
    try:
        result = await db.execute(
            """
            UPDATE flashcards
            SET tips = $1::jsonb
            WHERE id = $2::uuid AND user_id = $3
            """,
            json.dumps(payload.tips) if payload.tips else None,
            flashcard_id,
            current_user["id"],
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Flashcard not found or not owned by user")
        return {"updated": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("update tips failed")
        raise HTTPException(status_code=500, detail=str(e))

class MnemonicCreateRequest(BaseModel):
    mnemonic_type: str | None = Field(default="user", description="Type of mnemonic, e.g., acronym, story, 'user' for user-entered, 'ai' for ai-generated")
    content: str = Field(..., description="The mnemonic content/text")
    ai_generated_reasoning: str | None = None

class FlashcardMnemonicResponse(BaseModel):
    id: str
    flashcard_id: str
    mnemonic_type: str | None
    content: str
    created_at: str | None = None

@router.post("/{flashcard_id}/mnemonics", response_model=FlashcardMnemonicResponse)
async def create_flashcard_mnemonic(
    flashcard_id: str,
    payload: MnemonicCreateRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user = Depends(get_current_user),
):

    try:
        allowed = {"abbreviation", "acrostic", "rhyme", "storytelling", "visual_association", "user", "ai"}
        mtype = payload.mnemonic_type or "user"
        if mtype not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid mnemonic_type. Allowed: {', '.join(sorted(allowed))}")
        mid = str(uuid.uuid4())
        row = await db.fetchrow(
            """
            INSERT INTO flashcard_mnemonics (id, flashcard_id, mnemonic_type, content, ai_generated_reasoning, is_user_selected)
            VALUES ($1, $2::uuid, $3, $4, $5, $6)
            RETURNING id::text AS id, flashcard_id::text AS flashcard_id, mnemonic_type, content, created_at
            """,
            mid,
            flashcard_id,
            mtype,
            payload.content,
            payload.ai_generated_reasoning,
            True if (mtype == 'user') else False,
        )
        if not row:
            raise HTTPException(status_code=500, detail="Failed to create mnemonic")
        return MnemonicResponse(
            id=row["id"],
            flashcard_id=row["flashcard_id"],
            mnemonic_type=row.get("mnemonic_type"),
            content=row.get("content"),
            created_at=str(row.get("created_at")) if row.get("created_at") else None,
        )
    except Exception as e:
        logger.exception("create mnemonic failed")
        raise HTTPException(status_code=500, detail=str(e))

class AutoTagRequest(BaseModel):
    limit: int = Field(default=50, ge=1, le=500, description="Max flashcards to process")
    overwrite: bool = Field(default=False, description="If true, regenerate tags even for flashcards that have tags")

class AutoTagResponse(BaseModel):
    tagged_count: int
    skipped_count: int
    message: str
    sample_tags: dict = {}

@router.post("/auto-tag", response_model=AutoTagResponse)
async def auto_tag_flashcards(
    payload: AutoTagRequest,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    ai: AIProvider = ai_provider
    prompt_template = get_prompt("flashcard")
    
    try:
        query = """
            SELECT id::text AS id, 
                   front_content, 
                   back_content,
                   content_metadata
            FROM flashcards
            WHERE user_id = $1 
            AND NOT is_archived
        """
        params = [current_user["id"]]
        
        if not payload.overwrite:
            query += " AND (content_metadata->'tags' IS NULL OR content_metadata->'tags' = '[]'::jsonb)"
        
        query += f" LIMIT {payload.limit}"
        
        flashcards = await db.fetch(query, *params)
        logger.info(f"Found {len(flashcards)} flashcards to tag for user {current_user['id']}")
        
        if not flashcards:
            return AutoTagResponse(
                tagged_count=0,
                skipped_count=0,
                message="No flashcards need tagging"
            )
        
        tagged_count = 0
        skipped_count = 0
        sample_tags = {}
        
        for card in flashcards:
            try:
                front = card["front_content"] or ""
                back = card["back_content"] or ""
                card_id = card["id"]
                
                if not front.strip():
                    skipped_count += 1
                    continue
                
                tagging_prompt = f"""Analyze this flashcard and generate 2-4 meaningful tags to categorize and organize it.

FLASHCARD CONTENT:
Question: {front}
Answer: {back}

GENERATE TAGS:
Return a JSON object with a "tags" array containing 2-4 meaningful tags:
{{
  "tags": ["tag1", "tag2", "tag3"]
}}

Tags should:
- Be lowercase with hyphens for multi-word tags (e.g., "data-structures")
- Include main topic/subject area, specific concept, and learning type
- Be meaningful and searchable
- Examples: "vocabulary", "problem-solving", "terminology", "application", "definition"

Return ONLY the JSON object, no explanation."""
                
                async with ai.session(system_prompt="You are a tagging specialist. Generate meaningful tags for educational flashcards.") as s:
                    tag_response = await ai.generate(
                        user_message=tagging_prompt,
                        max_tokens=200,
                        temperature=0.5,
                        session=s
                    )
                
                import re
                tags_match = re.search(r'\{[\s\S]*\}', tag_response)
                if tags_match:
                    tags_data = json.loads(tags_match.group(0))
                    tags = tags_data.get("tags", [])
                    
                    if tags:

                        metadata = card["content_metadata"] or {}
                        metadata["tags"] = tags

                        await db.execute(
                            """
                            UPDATE flashcards
                            SET content_metadata = $2::jsonb
                            WHERE id = $1 AND user_id = $3
                            """,
                            UUID(card_id),
                            json.dumps(metadata),
                            current_user["id"]
                        )

                        for tag_name in tags:
                            url_id = tag_name.lower().replace(" ", "-")
                            tag_row = await db.fetchrow(
                                """
                                INSERT INTO tags (user_id, name, url_id)
                                VALUES ($1, $2, $3)
                                ON CONFLICT (user_id, url_id) DO UPDATE SET name = EXCLUDED.name
                                RETURNING id
                                """,
                                current_user["id"], tag_name, url_id
                            )
                            await db.execute(
                                """
                                INSERT INTO tag_applications (tag_id, entity_type, entity_id, applied_by)
                                VALUES ($1, 'flashcard', $2, $3)
                                ON CONFLICT DO NOTHING
                                """,
                                tag_row["id"], UUID(card_id), current_user["id"]
                            )

                        tagged_count += 1
                        if len(sample_tags) < 3:
                            sample_tags[card_id] = tags

                        logger.info(f"Tagged flashcard {card_id} with tags: {tags}")
                    else:
                        skipped_count += 1
                else:
                    skipped_count += 1
                    
            except Exception as e:
                logger.error(f"Error tagging flashcard {card.get('id')}: {e}")
                skipped_count += 1
                continue
        
        return AutoTagResponse(
            tagged_count=tagged_count,
            skipped_count=skipped_count,
            message=f"Successfully auto-tagged {tagged_count} flashcards",
            sample_tags=sample_tags
        )

    except Exception as e:
        logger.exception("Auto-tagging failed")
        raise HTTPException(status_code=500, detail=f"Auto-tagging failed: {str(e)}")

@router.get("/review-history")
async def get_review_history(
    page: int = 1,
    page_size: int = 30,
    db: asyncpg.Connection = Depends(get_postgres),
    current_user=Depends(get_current_user),
):

    try:
        offset = (page - 1) * page_size
        rows = await db.fetch(
            """
            SELECT
                h.id::text AS id,
                h.flashcard_id::text AS flashcard_id,
                h.review_mode,
                h.rating,
                h.duration_ms,
                h.scheduled_interval,
                h.actual_interval,
                h.review_at,
                f.front_content AS front,
                f.back_content AS back,
                f.content_metadata AS metadata
            FROM flashcard_review_history h
            JOIN flashcards f ON f.id = h.flashcard_id
            WHERE h.user_id = $1
            ORDER BY h.review_at DESC
            LIMIT $2 OFFSET $3
            """,
            current_user["id"],
            page_size,
            offset,
        )

        total_row = await db.fetchrow(
            "SELECT COUNT(*) AS cnt FROM flashcard_review_history WHERE user_id = $1",
            current_user["id"],
        )
        total = total_row["cnt"] if total_row else 0

        items = []
        for r in rows:
            metadata = r["metadata"] or {}
            if isinstance(metadata, str):
                try:
                    import json as _json
                    metadata = _json.loads(metadata)
                except Exception:
                    metadata = {}

            topic = None
            if isinstance(metadata, dict):
                tags = metadata.get("tags") or []
                if tags:
                    topic = tags[0] if isinstance(tags[0], str) else None
                if not topic:
                    topic = metadata.get("topic") or metadata.get("subject")

            front_text = r["front"] or ""
            if isinstance(front_text, dict):
                front_text = front_text.get("text") or ""

            back_text = r["back"] or ""
            if isinstance(back_text, dict):
                back_text = back_text.get("text") or ""

            items.append({
                "id": r["id"],
                "flashcard_id": r["flashcard_id"],
                "review_mode": r["review_mode"],
                "rating": r["rating"],
                "duration_ms": r["duration_ms"],
                "scheduled_interval": r["scheduled_interval"],
                "actual_interval": r["actual_interval"],
                "review_at": r["review_at"].isoformat() if r["review_at"] else None,
                "front": front_text,
                "back": back_text,
                "topic": topic,
            })

        return {"history": items, "total": total, "page": page, "page_size": page_size}

    except Exception as e:
        logger.exception("Failed to fetch review history")
        raise HTTPException(status_code=500, detail=str(e))


import httpx
from fastapi import Query
from fastapi.responses import HTMLResponse
import re as _re

@router.get("/proxy/website", response_class=HTMLResponse)
async def proxy_website(
    url: str = Query(..., description="External URL to proxy"),
    current_user = Depends(get_current_user),
):

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url, headers=headers)

        content_type = resp.headers.get("content-type", "text/html")
        if "text/html" not in content_type:
            raise HTTPException(status_code=400, detail="URL does not return HTML content")

        html = resp.text

        base_tag = f'<base href="{url}" target="_blank">'
        if "<head>" in html.lower():
            html = _re.sub(r"(?i)<head>", f"<head>{base_tag}", html, count=1)
        else:
            html = base_tag + html

        html = _re.sub(r'(?i)<meta[^>]+http-equiv=["\']?x-frame-options["\']?[^>]*>', '', html)
        html = _re.sub(r'(?i)<meta[^>]+http-equiv=["\']?content-security-policy["\']?[^>]*>', '', html)

        return HTMLResponse(content=html, status_code=200)

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to external URL timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("proxy_website failed")
        raise HTTPException(status_code=500, detail=str(e))
