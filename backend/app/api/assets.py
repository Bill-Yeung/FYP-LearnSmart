from fastapi import APIRouter, Depends, HTTPException, Query, Path, UploadFile, File, Form
import asyncpg
from uuid import UUID
import json
from functools import lru_cache

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.repositories.asset_repository import AssetRepository
from app.models import AssetResponse, AssetSlimResponse, AssetListResponse, AssetDownloadResponse, AssetCreate, AssetDownloadCreate
from fastapi import Body

router = APIRouter(prefix="/models", tags=["Models"])

@lru_cache(maxsize=64)
def _cached_convert(usdc_url: str, include_map_json: str | None, asset_name: str) -> bytes:
    from app.services.usd_material_converter import convert_polyhaven_to_usdz
    include_map = json.loads(include_map_json) if include_map_json else None
    return convert_polyhaven_to_usdz(usdc_url, include_map, asset_name)

@router.get("", response_model=AssetListResponse)
async def list_models(
    asset_type: str | None = Query(None, description="Filter by asset_type (model|hdri|texture)"),
    search: str | None = Query(None, description="Search by name (case-insensitive)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: asyncpg.Connection = Depends(get_postgres)):

    repo = AssetRepository(db)
    offset = (page - 1) * page_size
    rows = await repo.list_assets(asset_type=asset_type, search=search, limit=page_size, offset=offset)

    def parse_raw_data(raw):
        if raw is None:
            return None
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except:
                return None
        return raw

    def has_usdz(raw_api_data) -> bool:
        if not raw_api_data:
            return False
        parsed = parse_raw_data(raw_api_data)
        if not parsed:
            return False
        files = parsed.get("files", {})
        return "usd" in files

    assets = [AssetSlimResponse(
        id=row["id"],
        external_id=row.get("external_id"),
        name=row.get("name") or "",
        source=row.get("source"),
        asset_type=row.get("asset_type"),
        created_at=row.get("created_at"),
        has_usdz=has_usdz(row.get("raw_api_data"))) for row in rows]

    total_row = await db.fetchrow(
        "SELECT COUNT(1) AS cnt FROM asset_library WHERE ($1::text IS NULL OR asset_type = $1) AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')",
        asset_type, search)
    total = total_row["cnt"] if total_row else 0

    return AssetListResponse(assets=assets, total=total, page=page, page_size=page_size)

@router.get("/{asset_id}", response_model=AssetResponse)
async def get_model(asset_id: UUID = Path(...), db: asyncpg.Connection = Depends(get_postgres)):
    repo = AssetRepository(db)
    row = await repo.get_by_id(asset_id)
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")

    def parse_raw_data(raw):
        if raw is None:
            return None
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except:
                return None
        return raw

    return AssetResponse(
        id=row["id"],
        external_id=row.get("external_id"),
        name=row.get("name"),
        source=row.get("source"),
        asset_type=row.get("asset_type"),
        raw_api_data=parse_raw_data(row.get("raw_api_data")),
        created_at=row.get("created_at"))

@router.post("", response_model=AssetResponse)
async def create_model(payload: AssetCreate = Body(...), db: asyncpg.Connection = Depends(get_postgres)):
    repo = AssetRepository(db)
    row = await repo.create_asset(payload.external_id, payload.name, payload.source, payload.asset_type, payload.raw_api_data)
    
    def parse_raw_data(raw):
        if raw is None:
            return None
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except:
                return None
        return raw
    
    return AssetResponse(
        id=row["id"],
        external_id=row.get("external_id"),
        name=row.get("name"),
        source=row.get("source"),
        asset_type=row.get("asset_type"),
        raw_api_data=parse_raw_data(row.get("raw_api_data")),
        created_at=row.get("created_at"))

@router.post("/{asset_id}/downloads", response_model=AssetDownloadResponse)
async def add_asset_download(asset_id: UUID = Path(...), payload: AssetDownloadCreate = Body(...), db: asyncpg.Connection = Depends(get_postgres)):
    repo = AssetRepository(db)
    row = await repo.create_download(asset_id, payload.component_type, payload.resolution, payload.file_format, payload.url, payload.file_size, payload.md5_hash, payload.include_map)
    return AssetDownloadResponse(
        id=row["id"],
        component_type=row.get("component_type"),
        resolution=row.get("resolution"),
        file_format=row.get("file_format"),
        url=row.get("url"),
        file_size=row.get("file_size"),
        md5_hash=row.get("md5_hash"),
        include_map=row.get("include_map"),
        created_at=row.get("created_at"))

@router.get("/{asset_id}/downloads", response_model=list[AssetDownloadResponse])
async def get_asset_downloads(asset_id: UUID = Path(...), db: asyncpg.Connection = Depends(get_postgres)):
    repo = AssetRepository(db)
    
    downloads = await repo.get_downloads(asset_id)
    if downloads:
        import json
        result = []
        for d in downloads:
            include_map = d.get("include_map")
            if include_map and isinstance(include_map, str):
                try:
                    include_map = json.loads(include_map)
                except:
                    include_map = None
            
            result.append(AssetDownloadResponse(
                id=d["id"],
                component_type=d.get("component_type"),
                resolution=d.get("resolution"),
                file_format=d.get("file_format"),
                url=d.get("url"),
                file_size=d.get("file_size"),
                md5_hash=d.get("md5_hash"),
                include_map=include_map,
                created_at=d.get("created_at")))
        return result
    
    asset_row = await repo.get_by_id(asset_id)
    if not asset_row or not asset_row.get("raw_api_data"):
        return []
    
    import json
    from uuid import uuid5, NAMESPACE_DNS
    raw_data = asset_row.get("raw_api_data")
    if isinstance(raw_data, str):
        try:
            raw_data = json.loads(raw_data)
        except:
            return []
    
    extracted_downloads = []
    files = raw_data.get("files", {})
    
    if "usd" in files:
        for resolution, formats in files["usd"].items():
            if "usd" in formats:
                usd_data = formats["usd"]

                download_id = uuid5(NAMESPACE_DNS, f"{asset_id}_{resolution}_usd")
                include_map = usd_data.get("include")
                if include_map and isinstance(include_map, str):
                    try:
                        include_map = json.loads(include_map)
                    except:
                        include_map = None

                extracted_downloads.append(AssetDownloadResponse(
                    id=download_id,
                    component_type="usd",
                    resolution=resolution,
                    file_format="usdz",
                    url=usd_data.get("url", ""),
                    file_size=usd_data.get("size"),
                    md5_hash=usd_data.get("md5"),
                    include_map=include_map,
                    created_at=asset_row.get("created_at")
                ))
    
    if "gltf" in files:
        for resolution, formats in files["gltf"].items():
            if "gltf" in formats:
                gltf_data = formats["gltf"]
                download_id = uuid5(NAMESPACE_DNS, f"{asset_id}_{resolution}_gltf")
                include_map = gltf_data.get("include")
                if include_map and isinstance(include_map, str):
                    try:
                        include_map = json.loads(include_map)
                    except:
                        include_map = None
                
                extracted_downloads.append(AssetDownloadResponse(
                    id=download_id,
                    component_type="model",
                    resolution=resolution,
                    file_format="gltf",
                    url=gltf_data.get("url", ""),
                    file_size=gltf_data.get("size"),
                    md5_hash=gltf_data.get("md5"),
                    include_map=include_map,
                    created_at=asset_row.get("created_at")
                ))

    if not extracted_downloads and "fbx" in files:
        for resolution, formats in files["fbx"].items():
            if "fbx" in formats:
                fbx_data = formats["fbx"]
                download_id = uuid5(NAMESPACE_DNS, f"{asset_id}_{resolution}_fbx")
                extracted_downloads.append(AssetDownloadResponse(
                    id=download_id,
                    component_type="model",
                    resolution=resolution,
                    file_format="fbx",
                    url=fbx_data.get("url", ""),
                    file_size=fbx_data.get("size"),
                    md5_hash=fbx_data.get("md5"),
                    include_map=fbx_data.get("include"),
                    created_at=asset_row.get("created_at")
                ))
    
    return extracted_downloads


@router.get("/{asset_id}/thumbnail")
async def get_asset_thumbnail(asset_id: UUID = Path(...), db: asyncpg.Connection = Depends(get_postgres)):
    from fastapi.responses import RedirectResponse
    
    repo = AssetRepository(db)
    asset_row = await repo.get_by_id(asset_id)
    
    if not asset_row:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    raw_data = asset_row.get("raw_api_data")
    if not raw_data:
        raise HTTPException(status_code=404, detail="No preview image available")
    
    import json
    if isinstance(raw_data, str):
        try:
            raw_data = json.loads(raw_data)
        except:
            raise HTTPException(status_code=404, detail="Invalid raw_api_data")
    
    files = raw_data.get("files", {})
    
    for tex_type in ["Diffuse", "diff", "diffuse"]:
        if tex_type in files:
            for resolution in ["1k", "2k"]:
                if resolution in files[tex_type]:
                    formats = files[tex_type][resolution]
                    for fmt in ["jpg", "png", "exr"]:
                        if fmt in formats:
                            url = formats[fmt].get("url")
                            if url:
                                return RedirectResponse(url=url)
    
    for component, resolutions in files.items():
        if isinstance(resolutions, dict):
            for resolution, formats in resolutions.items():
                if isinstance(formats, dict):
                    for fmt in ["jpg", "png"]:
                        if fmt in formats and isinstance(formats[fmt], dict):
                            url = formats[fmt].get("url")
                            if url:
                                return RedirectResponse(url=url)
    
    raise HTTPException(status_code=404, detail="No suitable preview image found")


@router.get("/{asset_id}/download/usdz")
async def download_asset_as_usdz(
    asset_id: UUID = Path(...),
    resolution: str = Query("1k", description="Resolution: 1k, 2k, 4k, 8k"),
    db: asyncpg.Connection = Depends(get_postgres)
):

    import asyncio
    from fastapi.responses import Response

    repo = AssetRepository(db)
    asset_row = await repo.get_by_id(asset_id)

    if not asset_row:
        raise HTTPException(status_code=404, detail="Asset not found")

    raw_data = asset_row.get("raw_api_data")
    if not raw_data:
        raise HTTPException(status_code=404, detail="No download data available")

    if isinstance(raw_data, str):
        try:
            raw_data = json.loads(raw_data)
        except Exception:
            raise HTTPException(status_code=404, detail="Invalid raw_api_data")

    files = raw_data.get("files", {})
    asset_name = asset_row.get("name") or str(asset_id)

    usdc_url: str | None = None
    include_map: dict | None = None

    if "usd" in files:
        usd_resolutions = files["usd"]
        for res in [resolution, "1k", "2k"]:
            if res in usd_resolutions and "usd" in usd_resolutions[res]:
                entry = usd_resolutions[res]["usd"]
                usdc_url = entry.get("url")
                include_map = entry.get("include")
                if isinstance(include_map, str):
                    try:
                        include_map = json.loads(include_map)
                    except Exception:
                        include_map = None
                if usdc_url:
                    break

    if not usdc_url:
        raise HTTPException(status_code=404, detail=f"No USD file available at resolution {resolution}")

    try:
        import pxr
        pxr_available = True
    except ImportError:
        pxr_available = False

    if not pxr_available:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=usdc_url)

    include_map_json = json.dumps(include_map, sort_keys=True) if include_map else None
    try:
        usdz_bytes = await asyncio.get_event_loop().run_in_executor(
            None,
            _cached_convert,
            usdc_url,
            include_map_json,
            asset_name,
        )
    except Exception as e:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=usdc_url)

    safe_name = asset_name.replace(" ", "_") + ".usdz"
    return Response(
        content=usdz_bytes,
        media_type="model/vnd.usdz+zip",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Cache-Control": "public, max-age=86400",
        },
    )

@router.post("/upload-scene", tags=["Models"])
async def upload_scene(
    file: UploadFile = File(...),
    name: str = Form(default=""),
    current_user=Depends(get_current_user),
):

    import io, zipfile, struct, zlib as _zlib, tempfile, os, shutil

    filename = file.filename or "scene"
    ext = os.path.splitext(filename)[1].lower()

    content = await file.read()

    SUPPORTED = {".usdz", ".usdc", ".usda", ".usd"}
    if ext not in SUPPORTED:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported format '{ext}'. "
                "Please convert to USDZ using Reality Composer Pro, "
                "Blender (File > Export > USD), or the `usdconvert` CLI tool, "
                "then upload the resulting .usdz file."
            ),
        )

    if ext == ".usdz":
        from fastapi.responses import Response
        safe_name = (name.strip() or os.path.splitext(filename)[0]) + ".usdz"
        return Response(
            content=content,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
        )

    inner_name = os.path.splitext(filename)[0] + ext

    def _crc32(data: bytes) -> int:
        return _zlib.crc32(data) & 0xFFFFFFFF

    def _u16(v: int) -> bytes:
        return struct.pack("<H", v)

    def _u32(v: int) -> bytes:
        return struct.pack("<I", v)

    def build_usdz(entries: list[tuple[str, bytes]]) -> bytes:

        buf = bytearray()
        cd  = bytearray()
        for (entry_name, data) in entries:
            name_bytes = entry_name.encode("utf-8")
            crc        = _crc32(data)

            base = len(buf) + 30 + len(name_bytes)
            extra_len = (64 - base % 64) % 64
            local_offset = len(buf)

            buf += b"PK\x03\x04"
            buf += _u16(20) + _u16(0) + _u16(0)
            buf += _u16(0)  + _u16(0)
            buf += _u32(crc)
            buf += _u32(len(data)) + _u32(len(data))
            buf += _u16(len(name_bytes)) + _u16(extra_len)
            buf += name_bytes
            buf += b"\x00" * extra_len
            buf += data

            cd += b"PK\x01\x02"
            cd += _u16(20) + _u16(20) + _u16(0) + _u16(0)
            cd += _u16(0)  + _u16(0)
            cd += _u32(crc)
            cd += _u32(len(data)) + _u32(len(data))
            cd += _u16(len(name_bytes)) + _u16(0) + _u16(0)
            cd += _u16(0)  + _u16(0) + _u32(0)
            cd += _u32(local_offset)
            cd += name_bytes

        cd_offset = len(buf)
        buf += cd
        buf += b"PK\x05\x06"
        buf += _u16(0) + _u16(0)
        buf += _u16(len(entries)) + _u16(len(entries))
        buf += _u32(len(cd)) + _u32(cd_offset)
        buf += _u16(0)
        return bytes(buf)

    usdz_bytes = build_usdz([(inner_name, content)])
    safe_name = (name.strip() or os.path.splitext(filename)[0]) + ".usdz"

    from fastapi.responses import Response
    return Response(
        content=usdz_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )

