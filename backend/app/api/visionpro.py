import json
import re
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.services.ai.provider import ai_provider
from app.models.visionpro import (
    VisionProBackground,
    VisionProBackgroundListResponse,
    VisionProModel,
    VisionProModelListResponse,
    VisionProPreset,
    VisionProSceneAssetsResponse,
)

router = APIRouter(prefix="/visionpro", tags=["Vision Pro"])

SKYBOX_PRESETS: list[VisionProPreset] = [
    VisionProPreset(name="library",     display_name="Library",     description="Dark warm brown indoor setting with amber tones"),
    VisionProPreset(name="classroom",   display_name="Classroom",   description="Bright light-blue daytime room with pale walls"),
    VisionProPreset(name="museum",      display_name="Museum",      description="Dark slate interior with cool gray marble tones"),
    VisionProPreset(name="garden",      display_name="Garden",      description="Warm sky-blue outdoor with golden horizon and green grass"),
    VisionProPreset(name="temple",      display_name="Temple",      description="Deep purple night sky with gold horizon and dark stone ground"),
    VisionProPreset(name="observatory", display_name="Observatory", description="Near-black starry sky with deep indigo horizon"),
]

def _parse_json(raw: Any) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {}
    return raw

def _extract_background(row: asyncpg.Record) -> VisionProBackground:

    raw = _parse_json(row.get("raw_api_data"))
    files = raw.get("files", {})
    hdri_section = files.get("hdri", {})

    thumbnail_url: str | None = None
    tonemapped = files.get("tonemapped")
    if isinstance(tonemapped, dict):
        thumbnail_url = tonemapped.get("url")

    available_resolutions: list[str] = []
    hdr_url: str | None = None
    exr_url: str | None = None
    for res in ["1k", "2k", "4k", "8k", "16k"]:
        if res in hdri_section:
            available_resolutions.append(res)

    # Prefer highest resolution for immersive scenes
    for res in ["16k", "8k", "4k", "2k", "1k"]:
        if res in hdri_section:
            res_data = hdri_section[res]
            if hdr_url is None and isinstance(res_data.get("hdr"), dict):
                hdr_url = res_data["hdr"].get("url")
            if exr_url is None and isinstance(res_data.get("exr"), dict):
                exr_url = res_data["exr"].get("url")
            if hdr_url or exr_url:
                break

    categories: list[str] = raw.get("categories") or []

    return VisionProBackground(
        id=row["id"],
        name=row["name"],
        external_id=row.get("external_id"),
        thumbnail_url=thumbnail_url,
        hdr_url=hdr_url,
        exr_url=exr_url,
        available_resolutions=available_resolutions,
        categories=categories,
    )

def _extract_model(row: asyncpg.Record) -> VisionProModel:

    raw = _parse_json(row.get("raw_api_data"))
    files = raw.get("files", {})

    thumbnail_url: str | None = None
    for tex_key in ["Diffuse", "diff", "diffuse"]:
        tex = files.get(tex_key, {})
        for res in ["1k", "2k"]:
            fmt = tex.get(res, {})
            if isinstance(fmt.get("jpg"), dict):
                thumbnail_url = fmt["jpg"].get("url")
                break
        if thumbnail_url:
            break

    available_resolutions: list[str] = []
    usd_section = files.get("usd", {})
    for res in ["1k", "2k", "4k"]:
        if res in usd_section:
            available_resolutions.append(res)

    if not available_resolutions:
        gltf_section = files.get("gltf", {})
        for res in ["1k", "2k", "4k"]:
            if res in gltf_section:
                available_resolutions.append(res)

    categories: list[str] = raw.get("categories") or []

    return VisionProModel(
        id=row["id"],
        name=row["name"],
        external_id=row.get("external_id"),
        thumbnail_url=thumbnail_url,
        usdz_download_url=f"/api/models/{row['id']}/download/usdz",
        available_resolutions=available_resolutions,
        categories=categories,
    )

@router.get("/scene/presets", response_model=list[VisionProPreset], summary="List built-in skybox presets")
async def list_presets():
    return SKYBOX_PRESETS


@router.get("/scene/backgrounds", response_model=VisionProBackgroundListResponse, summary="List HDRI backgrounds for VR scenes")
async def list_backgrounds(
    search: str | None = Query(None, description="Search by name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: asyncpg.Connection = Depends(get_postgres),
):
    
    offset = (page - 1) * page_size

    rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'hdri'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        ORDER BY name
        LIMIT $2 OFFSET $3
        """,
        search, page_size, offset,
    )

    total_row = await db.fetchrow(
        """
        SELECT COUNT(1) AS cnt FROM asset_library
        WHERE asset_type = 'hdri'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        """,
        search,
    )
    total = total_row["cnt"] if total_row else 0

    items = [_extract_background(row) for row in rows]
    return VisionProBackgroundListResponse(items=items, total=total, page=page, page_size=page_size)

@router.get("/scene/models", response_model=VisionProModelListResponse, summary="List 3D models for VR scenes")
async def list_models(
    search: str | None = Query(None, description="Search by name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: asyncpg.Connection = Depends(get_postgres),
):

    offset = (page - 1) * page_size

    rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'model'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        ORDER BY name
        LIMIT $2 OFFSET $3
        """,
        search, page_size, offset,
    )

    total_row = await db.fetchrow(
        """
        SELECT COUNT(1) AS cnt FROM asset_library
        WHERE asset_type = 'model'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        """,
        search,
    )
    total = total_row["cnt"] if total_row else 0

    items = [_extract_model(row) for row in rows]
    return VisionProModelListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/scene", response_model=VisionProSceneAssetsResponse, summary="Get all assets for building a VR scene")
async def get_scene_assets(
    db: asyncpg.Connection = Depends(get_postgres),
):

    bg_rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'hdri'
        ORDER BY name
        LIMIT 20
        """
    )

    model_rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'model'
        ORDER BY name
        LIMIT 20
        """
    )

    return VisionProSceneAssetsResponse(
        presets=SKYBOX_PRESETS,
        backgrounds=[_extract_background(r) for r in bg_rows],
        models=[_extract_model(r) for r in model_rows],
    )

class AIAskRequest(BaseModel):
    model_name: str
    question: str
    context: str | None = None

class AIAskResponse(BaseModel):
    answer: str


class PalaceSuggestMemoryItem(BaseModel):
    id: str
    type: str = Field(pattern="^(flashcard|concept)$")
    title: str
    content: str


class PalaceSuggestRequest(BaseModel):
    theme: str | None = None
    memory_items: list[PalaceSuggestMemoryItem]


class PalaceObjectSuggestion(BaseModel):
    memory_item_id: str
    memory_item_type: str = Field(pattern="^(flashcard|concept)$")
    asset_id: UUID
    object_label: str
    memory_text: str
    reason: str | None = None


class PalaceSuggestResponse(BaseModel):
    suggestions: list[PalaceObjectSuggestion]


def _json_from_ai_response(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(1))


def _fallback_suggestions(
    req: PalaceSuggestRequest,
    model_rows: list[asyncpg.Record],
) -> list[PalaceObjectSuggestion]:
    if not model_rows:
        return []

    suggestions: list[PalaceObjectSuggestion] = []
    for index, item in enumerate(req.memory_items):
        model = model_rows[index % len(model_rows)]
        content = item.content.strip() or item.title
        suggestions.append(
            PalaceObjectSuggestion(
                memory_item_id=item.id,
                memory_item_type=item.type,
                asset_id=model["id"],
                object_label=str(model["name"] or item.title)[:60],
                memory_text=f"{item.title}\n\n{content}",
                reason="Fallback match used because AI suggestion output was unavailable.",
            )
        )
    return suggestions

@router.post("/ai/ask", response_model=AIAskResponse, summary="Ask AI about a 3D model")
async def ask_ai_about_model(
    req: AIAskRequest,
    current_user=Depends(get_current_user),
):

    system_prompt = (
        "You are an educational AI assistant inside a Vision Pro memory palace app. "
        "The user has placed a 3D model in their VR scene as a memory anchor. "
        "Answer clearly and concisely — responses will be read in a VR headset so keep them under 150 words. "
        "Focus on what the object is, what it represents educationally, and any interesting facts."
    )
    prompt_parts = [f'The 3D model in the scene is called "{req.model_name}".']
    if req.context:
        prompt_parts.append(f"Memory palace context:\n{req.context}")
    prompt_parts.append(f"The user asks: {req.question}")
    prompt = "\n\n".join(prompt_parts)

    try:
        async with ai_provider.session(system_prompt=system_prompt) as session:
            answer = await ai_provider.generate(
                prompt=prompt,
                session=session,
                temperature=0.7,
                max_tokens=200,
            )
    except Exception as e:
        answer = f"Sorry, I couldn't answer right now: {str(e)}"

    return AIAskResponse(answer=answer)


@router.post("/ai/suggest-palace", response_model=PalaceSuggestResponse, summary="Suggest 3D object anchors for memory palace items")
async def suggest_palace_objects(
    req: PalaceSuggestRequest,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_postgres),
):
    if not req.memory_items:
        return PalaceSuggestResponse(suggestions=[])

    model_rows = await db.fetch(
        """
        SELECT id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'model'
        ORDER BY name
        LIMIT 80
        """
    )
    if not model_rows:
        return PalaceSuggestResponse(suggestions=[])

    available_models = []
    for row in model_rows:
        raw = _parse_json(row.get("raw_api_data"))
        categories = raw.get("categories") or []
        available_models.append({
            "asset_id": str(row["id"]),
            "name": row["name"],
            "categories": categories[:5] if isinstance(categories, list) else [],
        })

    memory_items = [
        {
            "id": item.id,
            "type": item.type,
            "title": item.title[:120],
            "content": item.content[:700],
        }
        for item in req.memory_items
    ]

    system_prompt = (
        "You design memory palaces for Vision Pro. "
        "Choose concrete 3D objects from the provided object list as memorable anchors for concepts and flashcards. "
        "Return valid JSON only."
    )
    prompt = (
        f"Palace theme: {req.theme or 'Memory Palace'}\n\n"
        "Available 3D objects. You MUST choose asset_id values only from this list:\n"
        f"{json.dumps(available_models, ensure_ascii=False)}\n\n"
        "Memory items to memorize:\n"
        f"{json.dumps(memory_items, ensure_ascii=False)}\n\n"
        "Return JSON with this exact shape:\n"
        "{"
        "\"suggestions\":["
        "{"
        "\"memory_item_id\":\"same id from memory item\","
        "\"memory_item_type\":\"flashcard or concept\","
        "\"asset_id\":\"chosen asset_id from available objects\","
        "\"object_label\":\"short object name shown in VR\","
        "\"memory_text\":\"vivid 1-3 sentence mnemonic plus the key content to remember\","
        "\"reason\":\"short reason why this object matches\""
        "}"
        "]"
        "}\n"
        "Return one suggestion per memory item, in the same order."
    )

    try:
        async with ai_provider.session(system_prompt=system_prompt) as session:
            response = await ai_provider.generate(
                prompt=prompt,
                session=session,
                temperature=0.6,
                max_tokens=2500,
            )

        parsed = _json_from_ai_response(response)
        raw_suggestions = parsed.get("suggestions", parsed) if isinstance(parsed, dict) else parsed
        if not isinstance(raw_suggestions, list):
            raise ValueError("AI response did not contain a suggestions list")

        valid_asset_ids = {str(row["id"]): row for row in model_rows}
        by_item_id = {item.id: item for item in req.memory_items}
        ai_suggestions: list[PalaceObjectSuggestion] = []
        for raw in raw_suggestions:
            if not isinstance(raw, dict):
                continue
            item_id = str(raw.get("memory_item_id") or "")
            asset_id = str(raw.get("asset_id") or "")
            source_item = by_item_id.get(item_id)
            if not source_item or asset_id not in valid_asset_ids:
                continue

            model_name = valid_asset_ids[asset_id]["name"] or source_item.title
            ai_suggestions.append(
                PalaceObjectSuggestion(
                    memory_item_id=source_item.id,
                    memory_item_type=source_item.type,
                    asset_id=UUID(asset_id),
                    object_label=str(raw.get("object_label") or model_name)[:60],
                    memory_text=str(raw.get("memory_text") or source_item.content or source_item.title),
                    reason=str(raw.get("reason") or ""),
                )
            )

        ordered = {suggestion.memory_item_id: suggestion for suggestion in ai_suggestions}
        if not ordered:
            raise ValueError("AI did not return any valid object matches")

        fallback_by_id = {
            suggestion.memory_item_id: suggestion
            for suggestion in _fallback_suggestions(req, list(model_rows))
        }
        suggestions = [
            ordered.get(item.id) or fallback_by_id[item.id]
            for item in req.memory_items
            if item.id in ordered or item.id in fallback_by_id
        ]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI palace suggestion failed: {exc}") from exc

    return PalaceSuggestResponse(suggestions=suggestions)
