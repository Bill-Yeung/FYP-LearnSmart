from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from uuid import UUID
import json
import logging

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.repositories.tag_repository import TagRepository
from app.repositories.concept_repository import ConceptRepository
from app.repositories.source_repository import SourceRepository
from app.services.ai.provider import AIProvider
from app.models.tag import (
    TagCreate, TagUpdate, TagApplyRequest, BulkTagApplyRequest,
    TagResponse, TagWithStatsResponse, TagListResponse,
    EntityTagsResponse, TaggedEntitiesResponse, TaggedEntityResponse,
    EntityType, generate_url_id
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tags", tags=["Tags"])

@router.get("", response_model=TagListResponse)
async def list_tags(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)
    offset = (page - 1) * page_size

    if search:
        rows = await tag_repo.search_by_name(current_user["id"], search, page_size)
        total = len(rows)
    else:
        rows, total = await tag_repo.get_tags_with_stats(
            current_user["id"], page_size, offset
        )

    tags = []
    for row in rows:
        if isinstance(row, dict):
            tags.append(TagWithStatsResponse(**row))
        else:
            row_dict = dict(row)
            tags.append(TagWithStatsResponse(
                id=row_dict["id"],
                name=row_dict["name"],
                url_id=row_dict["url_id"],
                description=row_dict.get("description"),
                color=row_dict.get("color"),
                icon=row_dict.get("icon"),
                is_system=row_dict.get("is_system", False),
                usage_count=row_dict.get("usage_count", 0),
                created_at=row_dict["created_at"],
                updated_at=row_dict["updated_at"],
                concept_count=row_dict.get("concept_count", 0),
                source_count=row_dict.get("source_count", 0),
                subject_count=row_dict.get("subject_count", 0),
                diagram_count=row_dict.get("diagram_count", 0),
                flashcard_count=row_dict.get("flashcard_count", 0),
                learning_path_count=row_dict.get("learning_path_count", 0),
                shared_content_count=row_dict.get("shared_content_count", 0),
                vr_scenario_count=row_dict.get("vr_scenario_count", 0),
                generated_script_count=row_dict.get("generated_script_count", 0)
            ))

    return TagListResponse(
        tags=tags,
        total=total,
        page=page,
        page_size=page_size
    )

@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)
    url_id = generate_url_id(payload.name)

    existing = await tag_repo.get_by_url_id(current_user["id"], url_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag with name '{payload.name}' already exists"
        )

    row = await tag_repo.create(
        user_id=current_user["id"],
        name=payload.name,
        url_id=url_id,
        description=payload.description,
        color=payload.color,
        icon=payload.icon
    )

    return TagResponse(
        id=row["id"],
        name=row["name"],
        url_id=row["url_id"],
        description=row["description"],
        color=row["color"],
        icon=row["icon"],
        is_system=row["is_system"],
        usage_count=row["usage_count"],
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

@router.get("/{tag_id}", response_model=TagWithStatsResponse)
async def get_tag(
    tag_id: UUID,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    row = await tag_repo.get_by_id_and_user(tag_id, current_user["id"])
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    stats = await tag_repo.get_tag_stats(tag_id)

    return TagWithStatsResponse(
        id=row["id"],
        name=row["name"],
        url_id=row["url_id"],
        description=row["description"],
        color=row["color"],
        icon=row["icon"],
        is_system=row["is_system"],
        usage_count=row["usage_count"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        concept_count=stats.get("concept", 0),
        source_count=stats.get("source", 0),
        subject_count=stats.get("subject", 0),
        diagram_count=stats.get("diagram", 0),
        flashcard_count=stats.get("flashcard", 0),
        learning_path_count=stats.get("learning_path", 0),
        shared_content_count=stats.get("shared_content", 0),
        vr_scenario_count=stats.get("vr_scenario", 0),
        generated_script_count=stats.get("generated_script", 0)
    )

@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    payload: TagUpdate,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    existing = await tag_repo.get_by_id_and_user(tag_id, current_user["id"])
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    if existing["is_system"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system tags"
        )

    row = await tag_repo.update(
        tag_id=tag_id,
        user_id=current_user["id"],
        name=payload.name,
        description=payload.description,
        color=payload.color,
        icon=payload.icon
    )

    return TagResponse(
        id=row["id"],
        name=row["name"],
        url_id=row["url_id"],
        description=row["description"],
        color=row["color"],
        icon=row["icon"],
        is_system=row["is_system"],
        usage_count=row["usage_count"],
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    existing = await tag_repo.get_by_id_and_user(tag_id, current_user["id"])
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    if existing["is_system"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system tags"
        )

    await tag_repo.delete(tag_id, current_user["id"])

@router.post("/{tag_id}/apply", status_code=status.HTTP_201_CREATED)
async def apply_tag(
    tag_id: UUID,
    payload: TagApplyRequest,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    tag = await tag_repo.get_by_id_and_user(tag_id, current_user["id"])
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    result = await tag_repo.apply_tag(
        tag_id=tag_id,
        entity_type=payload.entity_type.value,
        entity_id=payload.entity_id,
        applied_by=current_user["id"]
    )

    if not result:
        return {"message": "Tag already applied", "applied": False}

    return {"message": "Tag applied successfully", "applied": True}

@router.delete("/{tag_id}/remove")
async def remove_tag_from_entity(
    tag_id: UUID,
    entity_type: EntityType,
    entity_id: UUID,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    tag = await tag_repo.get_by_id_and_user(tag_id, current_user["id"])
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    removed = await tag_repo.remove_tag(tag_id, entity_type.value, entity_id)

    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag application not found"
        )

    return {"message": "Tag removed successfully"}

@router.get("/{tag_id}/entities", response_model=TaggedEntitiesResponse)
async def get_tagged_entities(
    tag_id: UUID,
    entity_type: EntityType | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    tag = await tag_repo.get_by_id_and_user(tag_id, current_user["id"])
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    offset = (page - 1) * page_size
    rows, total = await tag_repo.get_tagged_entities(
        tag_id,
        entity_type.value if entity_type else None,
        page_size,
        offset
    )

    entities = [
        TaggedEntityResponse(
            entity_type=EntityType(row["entity_type"]),
            entity_id=row["entity_id"],
            applied_at=row["applied_at"]
        )
        for row in rows
    ]

    return TaggedEntitiesResponse(
        tag_id=tag_id,
        entities=entities,
        total=total,
        page=page,
        page_size=page_size
    )

@router.get("/entity/{entity_type}/{entity_id}", response_model=EntityTagsResponse)
async def get_entity_tags(
    entity_type: EntityType,
    entity_id: UUID,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    rows = await tag_repo.get_entity_tags(entity_type.value, entity_id)

    tags = [
        TagResponse(
            id=row["id"],
            name=row["name"],
            url_id=row["url_id"],
            description=row["description"],
            color=row["color"],
            icon=row["icon"],
            is_system=row["is_system"],
            usage_count=row["usage_count"],
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
        for row in rows
    ]

    return EntityTagsResponse(
        entity_type=entity_type,
        entity_id=entity_id,
        tags=tags
    )

@router.post("/bulk-apply")
async def bulk_apply_tags(
    payload: BulkTagApplyRequest,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    tag_repo = TagRepository(db)

    for tag_id in payload.tag_ids:
        tag = await tag_repo.get_by_id_and_user(tag_id, current_user["id"])
        if not tag:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tag {tag_id} not found"
            )

    count = await tag_repo.bulk_apply_tags(
        tag_ids=payload.tag_ids,
        entity_type=payload.entity_type.value,
        entity_id=payload.entity_id,
        applied_by=current_user["id"]
    )

    return {"message": f"Applied {count} tags", "applied_count": count}

class TagSuggestRequest(BaseModel):
    entity_type: EntityType
    entity_id: UUID

@router.post("/suggest")
async def suggest_tags(
    payload: TagSuggestRequest,
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):
    
    try:

        content_text = ""

        if payload.entity_type == EntityType.concept:
            concept_repo = ConceptRepository(db)
            concept = await concept_repo.get_with_translation(payload.entity_id)
            if concept:
                title = concept.get("title") or ""
                desc = concept.get("description") or ""
                keywords = concept.get("keywords") or []
                ctype = concept.get("concept_type") or ""
                content_text = (
                    f"Concept: {title}\n"
                    f"Type: {ctype}\n"
                    f"Keywords: {', '.join(keywords)}\n"
                    f"Description: {desc[:500]}"
                )

        elif payload.entity_type == EntityType.source:
            source_repo = SourceRepository(db)
            source = await source_repo.get_by_id(payload.entity_id)
            if source:
                name = source.get("document_name") or ""
                summary = source.get("ai_summary") or ""
                doc_type = source.get("document_type") or ""
                content_text = (
                    f"Document: {name}\n"
                    f"Type: {doc_type}\n"
                    f"Summary: {summary[:800]}"
                )

        elif payload.entity_type == EntityType.subject:
            row = await db.fetchrow(
                "SELECT code, name, description FROM subjects WHERE id = $1",
                payload.entity_id
            )
            if row:
                content_text = (
                    f"Subject: {row.get('name', '')}\n"
                    f"Code: {row.get('code', '')}\n"
                    f"Description: {(row.get('description') or '')[:500]}"
                )

        elif payload.entity_type == EntityType.flashcard:
            row = await db.fetchrow(
                "SELECT front, back, card_type FROM flashcards WHERE id = $1",
                payload.entity_id
            )
            if row:
                content_text = (
                    f"Flashcard ({row.get('card_type', '')}):\n"
                    f"Front: {row.get('front', '')}\n"
                    f"Back: {row.get('back', '')}"
                )

        if not content_text:
            return {"suggestions": [], "message": "Could not retrieve entity content"}

        tag_repo = TagRepository(db)
        existing_tags, _ = await tag_repo.get_by_user(current_user["id"], limit=100)
        existing_names = [t["name"] for t in existing_tags]

        system_prompt = (
            "You are a knowledge organization assistant. "
            "Suggest tags for the given content. "
            "Return a JSON array of tag suggestion objects.\n"
            "Each suggestion: {\"name\": \"tag name\", \"reason\": \"brief reason\"}\n"
            "Rules:\n"
            "- Suggest 3-6 tags\n"
            "- Tags should be short (1-3 words)\n"
            "- Mix broad and specific tags\n"
            "- If existing tags fit, prefer reusing them\n"
            "- Return ONLY the JSON array, no other text"
        )

        user_prompt = (
            f"Content:\n{content_text}\n\n"
            f"User's existing tags: {', '.join(existing_names[:30]) if existing_names else 'None'}\n\n"
            f"Suggest tags for this content:"
        )

        ai = AIProvider()
        async with ai.session(system_prompt=system_prompt) as s:
            response = await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.5,
                json_mode=True,
            )

        suggestions = []
        try:
            parsed = json.loads(response)
            if isinstance(parsed, list):
                suggestions = parsed
            elif isinstance(parsed, dict) and "suggestions" in parsed:
                suggestions = parsed["suggestions"]
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse AI tag suggestions: {response[:200]}")

        existing_lower = {n.lower(): n for n in existing_names}
        for s in suggestions:
            name_lower = s.get("name", "").lower()
            s["exists"] = name_lower in existing_lower
            if s["exists"]:
                s["existing_name"] = existing_lower[name_lower]

        return {"suggestions": suggestions}

    except Exception as e:
        logger.error(f"Tag suggestion failed: {e}")
        return {"suggestions": [], "message": f"Suggestion failed: {str(e)}"}

@router.post("/suggest-missing")
async def suggest_missing_tags(
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    from app.services.ai.prompts import get_prompt

    try:
        user_id = current_user["id"]

        tag_repo = TagRepository(db)
        existing_tags, _ = await tag_repo.get_by_user(user_id, limit=100)
        existing_names = [t["name"] for t in existing_tags]

        content_samples = []
        content_lookup = {}

        concepts = await db.fetch(
            """
            SELECT c.id, ct.title, ct.description, c.concept_type
            FROM concepts c
            JOIN concept_translations ct ON ct.concept_id = c.id AND ct.is_primary = true
            WHERE c.created_by = $1
            ORDER BY c.created_at DESC
            LIMIT 10
            """,
            user_id
        )
        for c in concepts:
            cid = str(c['id'])
            content_samples.append(f"[{cid}] Concept ({c['concept_type']}): {c['title']}")
            content_lookup[cid] = {"type": "concept", "id": cid, "title": c['title']}

        docs = await db.fetch(
            """
            SELECT id, document_name, document_type, ai_summary
            FROM sources
            WHERE uploaded_by = $1
            ORDER BY processing_completed_at DESC NULLS LAST
            LIMIT 5
            """,
            user_id
        )
        for d in docs:
            did = str(d['id'])
            content_samples.append(f"[{did}] Document ({d['document_type']}): {d['document_name']}")
            content_lookup[did] = {"type": "source", "id": did, "title": d['document_name']}

        flashcards = await db.fetch(
            """
            SELECT id, front_content, card_type
            FROM flashcards
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 10
            """,
            user_id
        )
        for f in flashcards:
            fid = str(f['id'])
            front = f['front_content'][:60] + ('...' if len(f['front_content']) > 60 else '')
            content_samples.append(f"[{fid}] Flashcard ({f['card_type']}): {front}")
            content_lookup[fid] = {"type": "flashcard", "id": fid, "title": f['front_content'][:80]}

        if not content_samples:
            return {"suggestions": [], "message": "No content found to analyze"}

        prompt_template = get_prompt("tag_suggest_missing")
        user_prompt = prompt_template.format_user_prompt(
            existing_tags=', '.join(existing_names[:30]) if existing_names else 'None',
            content_samples='\n'.join(content_samples[:20])
        )

        ai = AIProvider()
        async with ai.session(system_prompt=prompt_template.system_prompt) as s:
            response = await ai.generate(
                prompt=user_prompt,
                session=s,
                temperature=0.6,
                json_mode=True,
            )

        raw_suggestions = []
        try:
            parsed = json.loads(response)
            if isinstance(parsed, list):
                raw_suggestions = parsed
            elif isinstance(parsed, dict) and "suggestions" in parsed:
                raw_suggestions = parsed["suggestions"]
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse AI tag suggestions: {response[:200]}")

        existing_lower = {n.lower() for n in existing_names}
        suggestions = []

        for s in raw_suggestions:
            tag_name = s.get("name", "")
            if tag_name.lower() in existing_lower:
                continue
            
            entities = []
            for content_id in s.get("content_ids", []):
                if content_id in content_lookup:
                    entities.append(content_lookup[content_id])

            suggestions.append({
                "name": tag_name,
                "reason": s.get("reason", ""),
                "entities": entities
            })

        return {"suggestions": suggestions}

    except Exception as e:
        logger.error(f"Missing tag suggestion failed: {e}")
        return {"suggestions": [], "message": f"Suggestion failed: {str(e)}"}
