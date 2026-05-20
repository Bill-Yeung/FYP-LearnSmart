from pydantic import BaseModel
from uuid import UUID
from typing import Any
from datetime import datetime


class AssetDownloadResponse(BaseModel):
    id: UUID
    component_type: str | None = None
    resolution: str | None = None
    file_format: str | None = None
    url: str
    file_size: int | None = None
    md5_hash: str | None = None
    include_map: dict | None = None
    created_at: datetime | None = None


class AssetResponse(BaseModel):
    id: UUID
    external_id: str | None = None
    name: str
    source: str | None = None
    asset_type: str | None = None
    raw_api_data: dict | None = None
    created_at: datetime | None = None
    has_usdz: bool = False


class AssetSlimResponse(BaseModel):
    id: UUID
    external_id: str | None = None
    name: str
    source: str | None = None
    asset_type: str | None = None
    created_at: datetime | None = None
    has_usdz: bool = False


class AssetListResponse(BaseModel):
    assets: list[AssetSlimResponse]
    total: int
    page: int
    page_size: int


class AssetCreate(BaseModel):
    external_id: str | None = None
    name: str
    source: str | None = None
    asset_type: str | None = None
    raw_api_data: dict | None = None


class AssetDownloadCreate(BaseModel):
    component_type: str | None = None
    resolution: str | None = None
    file_format: str | None = None
    url: str
    file_size: int | None = None
    md5_hash: str | None = None
    include_map: dict | None = None
