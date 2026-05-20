import asyncpg
from uuid import UUID


class AssetRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def list_assets(self, asset_type: str | None = None, search: str | None = None, limit: int = 50, offset: int = 0) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT id, external_id, name, source, asset_type, raw_api_data, created_at
            FROM asset_library
            WHERE ($1::text IS NULL OR asset_type = $1)
              AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
            """,
            asset_type, search, limit, offset)

    async def get_by_id(self, asset_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            """
            SELECT id, external_id, name, source, asset_type, raw_api_data, created_at
            FROM asset_library
            WHERE id = $1
            LIMIT 1
            """,
            asset_id)

    async def get_downloads(self, asset_id: UUID) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT id, component_type, resolution, file_format, url, file_size, md5_hash, include_map, created_at
            FROM asset_downloads
            WHERE asset_id = $1
            ORDER BY created_at DESC
            """,
            asset_id)

    async def create_asset(self, external_id: str | None, name: str, source: str | None, asset_type: str | None, raw_api_data: dict | None) -> asyncpg.Record:
        row = await self.db.fetchrow(
            """
            INSERT INTO asset_library (external_id, name, source, asset_type, raw_api_data)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            external_id, name, source, asset_type, raw_api_data)
        return row

    async def create_download(self, asset_id: UUID, component_type: str | None, resolution: str | None, file_format: str | None, url: str, file_size: int | None, md5_hash: str | None, include_map: dict | None) -> asyncpg.Record:
        row = await self.db.fetchrow(
            """
            INSERT INTO asset_downloads (asset_id, component_type, resolution, file_format, url, file_size, md5_hash, include_map)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            asset_id, component_type, resolution, file_format, url, file_size, md5_hash, include_map)
        return row
