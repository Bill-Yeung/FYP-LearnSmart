import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.core.config import settings
from app.repositories.palace_repository import PalaceRepository
from app.models.palace import (
    PalaceCreate,
    PalaceUpdate,
    PalaceResponse,
    PalaceListResponse,
    PalaceItemCreate,
    PalaceItemUpdate,
    PalaceItemResponse,
    ReviewSubmission,
)

router = APIRouter(prefix="/palaces", tags=["Memory Palace"])

@router.post("", response_model=PalaceResponse)
async def create_palace(
    payload: PalaceCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        palace = await repo.create_palace(str(current_user["id"]), payload.model_dump())
        return palace
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=PalaceListResponse)
async def list_palaces(
    mode: str | None = Query(default=None, pattern="^(ar|vr)$"),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        palaces = await repo.list_palaces(str(current_user["id"]), mode=mode)
        return {"palaces": palaces, "total": len(palaces)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed-demo", response_model=PalaceListResponse)
async def seed_demo_palaces(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = PalaceRepository(db)
        palaces = await repo.seed_demo_palaces(str(current_user["id"]))
        return {"palaces": palaces, "total": len(palaces)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{palace_id}", response_model=PalaceResponse)
async def get_palace(
    palace_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        palace = await repo.get_palace(palace_id, str(current_user["id"]))
        if not palace:
            raise HTTPException(status_code=404, detail="Palace not found")
        return palace
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{palace_id}", response_model=PalaceResponse)
async def update_palace(
    palace_id: str,
    payload: PalaceUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        palace = await repo.update_palace(
            palace_id, str(current_user["id"]), payload.model_dump(exclude_unset=True),
        )
        if not palace:
            raise HTTPException(status_code=404, detail="Palace not found")
        return palace
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{palace_id}")
async def delete_palace(
    palace_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        deleted = await repo.delete_palace(palace_id, str(current_user["id"]))
        if not deleted:
            raise HTTPException(status_code=404, detail="Palace not found")
        return {"detail": "Palace deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{palace_id}/open", response_model=PalaceResponse)
async def open_palace(
    palace_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):

    try:
        repo = PalaceRepository(db)
        palace = await repo.touch_palace(palace_id, str(current_user["id"]))
        if not palace:
            raise HTTPException(status_code=404, detail="Palace not found")
        return palace
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{palace_id}/skybox", response_model=PalaceResponse)
async def upload_skybox(
    palace_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    allowed = {".jpg", ".jpeg", ".png", ".hdr", ".exr", ".webp"}
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    try:
        repo = PalaceRepository(db)
        palace = await repo.get_palace(palace_id, str(current_user["id"]))
        if not palace:
            raise HTTPException(status_code=404, detail="Palace not found")

        upload_dir = Path(settings.upload_dir) / "skyboxes" / str(current_user["id"])
        upload_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{palace_id}_{uuid.uuid4().hex[:8]}{ext}"
        file_path = upload_dir / filename

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        relative_path = f"skyboxes/{current_user['id']}/{filename}"
        updated = await repo.update_skybox_path(palace_id, str(current_user["id"]), relative_path)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{palace_id}/items", response_model=PalaceItemResponse)
async def create_item(
    palace_id: str,
    payload: PalaceItemCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        palace = await repo.get_palace(palace_id, str(current_user["id"]))
        if not palace:
            raise HTTPException(status_code=404, detail="Palace not found")

        item = await repo.create_item(palace_id, str(current_user["id"]), payload.model_dump())
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{palace_id}/items", response_model=list[PalaceItemResponse])
async def list_items(
    palace_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        items = await repo.list_items(palace_id)
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{palace_id}/items/{item_id}", response_model=PalaceItemResponse)
async def update_item(
    palace_id: str,
    item_id: str,
    payload: PalaceItemUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        item = await repo.update_item(item_id, str(current_user["id"]), payload.model_dump(exclude_unset=True))
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{palace_id}/items/{item_id}")
async def delete_item(
    palace_id: str,
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        deleted = await repo.delete_item(item_id, str(current_user["id"]))
        if not deleted:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"detail": "Item removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{palace_id}/review", response_model=list[PalaceItemResponse])
async def get_review_items(
    palace_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        items = await repo.get_review_items(palace_id, str(current_user["id"]))
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{palace_id}/review/{item_id}")
async def submit_review(
    palace_id: str,
    item_id: str,
    payload: ReviewSubmission,
    current_user=Depends(get_current_user),
    db=Depends(get_postgres),
):
    try:
        repo = PalaceRepository(db)
        result = await repo.submit_review(item_id, str(current_user["id"]), payload.quality)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
