from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime



class PalaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    mode: str = Field(default="vr", pattern="^(ar|vr)$")
    skybox_type: str = Field(default="preset", pattern="^(preset|uploaded|ai_generated)$")
    skybox_preset: str | None = None
    skybox_image_url: str | None = None


class PalaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    mode: str | None = Field(default=None, pattern="^(ar|vr)$")
    skybox_type: str | None = Field(default=None, pattern="^(preset|uploaded|ai_generated)$")
    skybox_preset: str | None = None
    skybox_image_path: str | None = None


class PalaceResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: str | None = None
    mode: str
    skybox_type: str
    skybox_preset: str | None = None
    skybox_image_path: str | None = None
    is_active: bool
    last_opened_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class PalaceListResponse(BaseModel):
    palaces: list[PalaceResponse]
    total: int



class PalaceItemCreate(BaseModel):
    position_x: float = 0.0
    position_y: float = 1.0
    position_z: float = -1.5
    rotation_y: float = 0.0
    scale: float = 1.0
    flashcard_id: UUID | None = None
    concept_id: UUID | None = None
    asset_id: UUID | None = None
    custom_text: str | None = None
    custom_image_url: str | None = None
    label: str | None = None
    display_type: str = Field(default="card", pattern="^(card|3d_model|text_panel)$")


class PalaceItemUpdate(BaseModel):
    position_x: float | None = None
    position_y: float | None = None
    position_z: float | None = None
    rotation_y: float | None = None
    scale: float | None = None
    flashcard_id: UUID | None = None
    concept_id: UUID | None = None
    label: str | None = None
    custom_text: str | None = None
    display_type: str | None = Field(default=None, pattern="^(card|3d_model|text_panel)$")


class PalaceItemResponse(BaseModel):
    id: UUID
    palace_id: UUID
    user_id: UUID
    memory_item_id: UUID | None = None
    position_x: float
    position_y: float
    position_z: float
    rotation_y: float
    scale: float
    flashcard_id: UUID | None = None
    concept_id: UUID | None = None
    asset_id: UUID | None = None
    custom_text: str | None = None
    custom_image_url: str | None = None
    label: str | None = None
    display_type: str
    next_review_at: datetime | None = None
    review_count: int = 0
    ease_factor: float = 2.5
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True



class ReviewSubmission(BaseModel):
    quality: int = Field(..., ge=0, le=5)
