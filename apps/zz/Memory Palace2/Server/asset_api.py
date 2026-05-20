"""
Asset API Backend Server
Provides 3D models, HDRIs, and textures API for AR/VR iOS app
Connected to PostgreSQL database with 2000+ Polyhaven assets
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import logging
import os
import tempfile
from pathlib import Path
from fastapi.responses import FileResponse
from usd_converter import convert_usd_to_usdz
import requests
import hashlib
import subprocess
import shutil
import shlex
import uuid
from auth import hash_password, verify_password, create_access_token, verify_token

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Asset API", version="2.0.0")

# Enable CORS for iOS app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Database Configuration ====================

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'admin',
    'password': 'password',
    'database': 'learning_platform'
}

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        yield conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

# ==================== Data Models ====================

class AssetItem(BaseModel):
    id: str
    external_id: Optional[str] = None
    name: str
    source: Optional[str] = None
    asset_type: str
    created_at: Optional[str] = None
    raw_api_data: Optional[Dict[str, Any]] = None

class AssetListResponse(BaseModel):
    assets: List[AssetItem]
    total: int
    page: int
    page_size: int

class DownloadOption(BaseModel):
    id: str
    component_type: Optional[str] = None
    resolution: Optional[str] = None
    file_format: str
    url: str
    file_size: Optional[int] = None
    md5_hash: Optional[str] = None

# ==================== Authentication Models ====================

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    student_id: Optional[str] = None
    school: Optional[str] = None

class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str
    first_name: str
    last_name: str
    role: str

class UserProfile(BaseModel):
    user_id: str
    email: str
    first_name: str
    last_name: str
    role: str
    student_id: Optional[str] = None
    school: Optional[str] = None

# ====================Helper Functions ====================

def get_thumbnail_url(raw_api_data: dict) -> Optional[str]:
    """Extract thumbnail URL from raw API data - prefer diffuse/color preview images only"""
    try:
        # 1) Prefer explicit thumbnail or preview fields
        if raw_api_data.get('thumbnail'):
            logger.info("Using explicit thumbnail field")
            return raw_api_data.get('thumbnail')
        if raw_api_data.get('preview'):
            logger.info("Using explicit preview field")
            return raw_api_data.get('preview')

        files = raw_api_data.get('files', {})
        logger.info(f"Scanning files with top-level groups: {list(files.keys())}")

        # 2) Look for top-level Diffuse/Color texture groups (Polyhaven uses capital D "Diffuse")
        diffuse_groups = ['Diffuse', 'diffuse', 'Color', 'color', 'Albedo', 'albedo']
        for group_name in diffuse_groups:
            if group_name in files:
                group = files[group_name]
                for res in ['512', '1k', '2k', '4k', '8k']:
                    if res in group:
                        formats = group[res]
                        for fmt in ['jpg', 'jpeg', 'png', 'webp']:
                            info = formats.get(fmt)
                            if isinstance(info, dict) and info.get('url'):
                                logger.info(f"✓ Found diffuse texture in {group_name}/{res}/{fmt}")
                                return info.get('url')

        # 3) Look for preview/render groups
        for group_name in ['preview', 'thumbnail', 'thumb', 'renders', 'render']:
            if group_name in files:
                group = files[group_name]
                for res in ['512', '1k', '2k', '4k', '8k']:
                    if res in group:
                        formats = group[res]
                        for fmt in ['jpg', 'jpeg', 'png', 'webp']:
                            info = formats.get(fmt)
                            if isinstance(info, dict) and info.get('url'):
                                logger.info(f"Found preview in {group_name}/{res}/{fmt}")
                                return info.get('url')

        # 4) Scan format groups (usd, gltf, fbx, etc.) for diffuse textures in their 'include' sections
        diffuse_keywords = ['diff', 'diffuse', 'color', 'albedo', 'basecolor', 'base_color']
        skip_keywords = ['normal', 'nor_', 'metallic', 'metal', 'roughness', 'rough', 'ao', 'arm', 'height', 'displacement', 'opacity', 'alpha', 'emission']
        
        for format_key in ['gltf', 'usd', 'fbx', 'blend', 'obj']:
            if format_key not in files:
                continue
            format_group = files[format_key]
            for res in ['512', '1k', '2k', '4k', '8k']:
                if res not in format_group:
                    continue
                res_data = format_group[res]
                for ext_key, ext_data in res_data.items():
                    if not isinstance(ext_data, dict):
                        continue
                    includes = ext_data.get('include', {})
                    if not isinstance(includes, dict):
                        continue
                    for inc_path, inc_info in includes.items():
                        if not isinstance(inc_info, dict):
                            continue
                        fname = inc_path.lower()
                        if any(kw in fname for kw in diffuse_keywords):
                            if not any(skip in fname for skip in skip_keywords):
                                if fname.endswith(('.jpg', '.jpeg', '.png')):
                                    url = inc_info.get('url')
                                    if url:
                                        logger.info(f"✓ Selected diffuse from includes: {inc_path}")
                                        return url

        # 5) If no diffuse found, return default placeholder
        logger.warning("No diffuse texture found, using placeholder")
        return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop"
    except Exception as e:
        logger.error(f"Error extracting thumbnail: {e}")
        return None

def extract_download_options(raw_api_data: dict, asset_id: str) -> List[DownloadOption]:
    """Extract download options from Polyhaven raw API data"""
    options = []
    
    try:
        files = raw_api_data.get('files', {})
        
        # Define format priorities for visionOS (USDZ is preferred)  
        # USD can be converted to USDZ, GLB/glTF are also supported with conversion
        format_priority = {
            'usd': ('USD (Native)', 1),
            'gltf': ('glTF', 2),
            'blend': ('Blender', 3),
            'fbx': ('FBX', 4)
        }
        
        option_id = 1
        
        for format_key, format_info in format_priority.items():
            if format_key in files:
                format_nice_name, priority = format_info
                resolutions = files[format_key]
                
                # Process each resolution
                for resolution, formats in resolutions.items():
                    for file_ext, file_data in formats.items():
                        if file_ext == format_key or file_ext in ['usd', 'usda', 'usdc', 'usdz', 'glb', 'gltf', 'fbx', 'blend']:
                            if 'url' in file_data:
                                options.append(DownloadOption(
                                    id=f"{asset_id}_{option_id}",
                                    component_type=format_nice_name,
                                    resolution=resolution,
                                    file_format=file_ext.upper(),
                                    url=file_data['url'],
                                    file_size=file_data.get('size'),
                                    md5_hash=file_data.get('md5')
                                ))
                                option_id += 1
        
        # If no downloads found, log warning
        if not options:
            logger.warning(f"No download options found for asset {asset_id}")
            
    except Exception as e:
        logger.error(f"Error extracting download options: {e}")
    
    return options

# ==================== Endpoints ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Asset API", "version": "1.0.0"}

# ==================== Authentication Endpoints ====================

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register a new student account"""
    try:
        # Generate unique user_id
        user_id = str(uuid.uuid4())[:8]
        
        # Hash password
        password_hash = hash_password(request.password)
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if email already exists
            cursor.execute("SELECT user_id FROM users WHERE email = %s", (request.email,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")
            
            # Insert user
            cursor.execute("""
                INSERT INTO users (user_id, email, password_hash, first_name, last_name, role)
                VALUES (%s, %s, %s, %s, %s, 'student')
            """, (user_id, request.email, password_hash, request.first_name, request.last_name))
            
            # Insert student profile
            cursor.execute("""
                INSERT INTO students (user_id, student_id, school)
                VALUES (%s, %s, %s)
            """, (user_id, request.student_id, request.school))
            
            conn.commit()
        
        # Create token
        token = create_access_token(user_id, request.email)
        
        logger.info(f"✅ New student registered: {request.email}")
        return AuthResponse(
            token=token,
            user_id=user_id,
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            role="student"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login with email and password"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Get user
            cursor.execute("""
                SELECT user_id, email, password_hash, first_name, last_name, role
                FROM users WHERE email = %s
            """, (request.email,))
            
            user = cursor.fetchone()
            if not user:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            # Verify password
            if not verify_password(request.password, user['password_hash']):
                raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Create token
        token = create_access_token(user['user_id'], user['email'])
        
        logger.info(f"✅ Student logged in: {request.email}")
        return AuthResponse(
            token=token,
            user_id=user['user_id'],
            email=user['email'],
            first_name=user['first_name'],
            last_name=user['last_name'],
            role=user['role']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.get("/api/auth/profile", response_model=UserProfile)
async def get_profile(authorization: str = None):
    """Get current user profile (requires valid token)"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        user_id = payload['user_id']
        
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT u.user_id, u.email, u.first_name, u.last_name, u.role,
                       s.student_id, s.school
                FROM users u
                LEFT JOIN students s ON u.user_id = s.user_id
                WHERE u.user_id = %s
            """, (user_id,))
            
            user = cursor.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"✅ Profile retrieved: {user['email']}")
        return UserProfile(
            user_id=user['user_id'],
            email=user['email'],
            first_name=user['first_name'],
            last_name=user['last_name'],
            role=user['role'],
            student_id=user.get('student_id'),
            school=user.get('school')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Profile error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")


async def list_assets(
    asset_type: Optional[str] = Query("model", description="Filter by asset type"),
    search: Optional[str] = Query(None, description="Search by name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page")
):
    """
    List assets with optional filters - Connected to PostgreSQL
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build query
            base_query = """
                SELECT id, external_id, name, source, asset_type, created_at, raw_api_data
                FROM asset_library
                WHERE asset_type = %s
            """
            params = [asset_type]
            
            # Add search filter if provided
            if search:
                base_query += " AND (name ILIKE %s OR external_id ILIKE %s)"
                search_pattern = f"%{search}%"
                params.extend([search_pattern, search_pattern])
            
            # Get total count
            count_query = f"SELECT COUNT(*) as total FROM ({base_query}) as filtered"
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']
            
            # Add pagination
            offset = (page - 1) * page_size
            base_query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
            params.extend([page_size, offset])
            
            # Execute query
            cursor.execute(base_query, params)
            rows = cursor.fetchall()
            
            # Convert to AssetItem objects
            assets = []
            for row in rows:
                asset_dict = dict(row)
                # Convert datetime to string
                if asset_dict.get('created_at'):
                    asset_dict['created_at'] = asset_dict['created_at'].isoformat()
                
                # Add thumbnail URL to raw_api_data
                if asset_dict.get('raw_api_data'):
                    if 'thumbnail' not in asset_dict['raw_api_data']:
                        asset_dict['raw_api_data']['thumbnail'] = get_thumbnail_url(asset_dict['raw_api_data'])
                
                assets.append(AssetItem(**asset_dict))
            
            cursor.close()
            
            logger.info(f"Returned {len(assets)} assets (page {page}, search: '{search}')")
            
            return AssetListResponse(
                assets=assets,
                total=total,
                page=page,
                page_size=page_size
            )
            
    except Exception as e:
        logger.error(f"Error listing assets: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/models/{asset_id}", response_model=AssetItem)
async def get_asset(asset_id: str):
    """
    Get details of a specific asset from database
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, external_id, name, source, asset_type, created_at, raw_api_data
                FROM asset_library
                WHERE id = %s
            """, (asset_id,))
            
            row = cursor.fetchone()
            cursor.close()
            
            if not row:
                raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
            
            asset_dict = dict(row)
            if asset_dict.get('created_at'):
                asset_dict['created_at'] = asset_dict['created_at'].isoformat()
            
            # Add thumbnail
            if asset_dict.get('raw_api_data'):
                if 'thumbnail' not in asset_dict['raw_api_data']:
                    asset_dict['raw_api_data']['thumbnail'] = get_thumbnail_url(asset_dict['raw_api_data'])
            
            return AssetItem(**asset_dict)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/models/{asset_id}/downloads", response_model=List[DownloadOption])
async def get_downloads(asset_id: str):
    """
    Get download options for an asset - Extracts from Polyhaven raw data
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, external_id, name, raw_api_data
                FROM asset_library
                WHERE id = %s
            """, (asset_id,))
            
            row = cursor.fetchone()
            cursor.close()
            
            if not row:
                raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
            
            # Extract download options from raw_api_data
            raw_data = row['raw_api_data']
            downloads = extract_download_options(raw_data, asset_id)
            
            if not downloads:
                # Return empty list instead of error
                logger.warning(f"No downloads available for asset {asset_id}")
                return []
            
            logger.info(f"Found {len(downloads)} download options for {row['name']}")
            return downloads
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting downloads for {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/models/{asset_id}/download/usdz")
async def download_usdz(
    asset_id: str,
    resolution: str = Query("1k", description="Resolution (1k, 2k, 4k, 8k)")
):
    """
    Download model in USDZ format for visionOS
    Automatically converts USD files to USDZ
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, external_id, name, raw_api_data
                FROM asset_library
                WHERE id = %s
            """, (asset_id,))
            
            row = cursor.fetchone()
            cursor.close()
            
            if not row:
                raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
            
            # Find USD file in the requested resolution
            raw_data = row['raw_api_data']
            files = raw_data.get('files', {})

            # Helper: download remote URL to local path
            def download_to_path(url: str, dest_path: Path) -> bool:
                try:
                    resp = requests.get(url, stream=True, timeout=60)
                    resp.raise_for_status()
                    with open(dest_path, 'wb') as f:
                        for chunk in resp.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    return True
                except Exception as e:
                    logger.error(f"Failed to download {url}: {e}")
                    return False

            # Helper: package a local USD/USDC/USDA file into USDZ
            def package_local_usd_to_usdz(local_usd: Path, out_usdz: Path) -> bool:
                try:
                    import zipfile
                    # Ensure the USD is stored uncompressed inside the USDZ
                    with zipfile.ZipFile(out_usdz, 'w', compression=zipfile.ZIP_STORED) as zf:
                        # write the USD file uncompressed
                        data = local_usd.read_bytes()
                        zf.writestr(local_usd.name, data, compress_type=zipfile.ZIP_STORED)
                    return True
                except Exception as e:
                    logger.error(f"Error packaging local USD to USDZ: {e}")
                    return False
            
            # 1) If a USDZ file is already available for this asset/resolution, return it directly
            if 'usdz' in files and resolution in files['usdz']:
                usdz_entry = files['usdz'][resolution]
                if isinstance(usdz_entry, dict) and 'usdz' in usdz_entry and 'url' in usdz_entry['usdz']:
                    usdz_url = usdz_entry['usdz']['url']
                    cache_dir = Path(tempfile.gettempdir()) / "asset_api_cache"
                    cache_dir.mkdir(exist_ok=True)
                    safe_name = row.get('external_id', row['id']).replace(' ', '_').replace('/', '_')
                    usdz_filename = f"{safe_name}_{resolution}.usdz"
                    usdz_path = cache_dir / usdz_filename
                    if not usdz_path.exists():
                        logger.info(f"Downloading USDZ directly from {usdz_url}")
                        if not download_to_path(usdz_url, usdz_path):
                            raise HTTPException(status_code=502, detail="Failed to download USDZ")
                    return FileResponse(path=str(usdz_path), filename=usdz_filename, media_type="model/vnd.usdz+zip")

            # 2) If USD available, convert to USDZ (existing flow)
            if 'usd' in files and resolution in files['usd']:
                usd_data = files['usd'][resolution]
                # USD can have .usd, .usdc, or .usda extensions
                for ext in ['usd', 'usdc', 'usda']:
                    if ext in usd_data and 'url' in usd_data[ext]:
                        usd_url = usd_data[ext]['url']
                        # Create cache directory
                        cache_dir = Path(tempfile.gettempdir()) / "asset_api_cache"
                        cache_dir.mkdir(exist_ok=True)

                        # Generate USDZ filename
                        safe_name = row.get('external_id', row['id']).replace(' ', '_').replace('/', '_')
                        usdz_filename = f"{safe_name}_{resolution}.usdz"
                        usdz_path = cache_dir / usdz_filename

                        # Convert if not already cached
                        if not usdz_path.exists():
                            logger.info(f"Converting {usd_url} to USDZ including resources if available")

                            # Attempt to download USD and its include files (textures) and package into USDZ
                            try:
                                with tempfile.TemporaryDirectory() as tmpdir:
                                    tmpdir_path = Path(tmpdir)
                                    # Download main USD file
                                    usd_filename = f"model.{ext}"
                                    usd_local = tmpdir_path / usd_filename
                                    logger.info(f"Downloading USD to {usd_local}")
                                    resp = requests.get(usd_url, stream=True, timeout=60)
                                    resp.raise_for_status()
                                    with open(usd_local, 'wb') as f:
                                        for chunk in resp.iter_content(chunk_size=8192):
                                            if chunk:
                                                f.write(chunk)

                                    # Check for included assets listed in the raw_api_data (textures/includes)
                                    # Note: includes are nested under the specific ext entry (e.g. usd_data['usd']['include'])
                                    includes = {}
                                    try:
                                        includes = usd_data[ext].get('include', {}) or {}
                                    except Exception:
                                        includes = {}

                                    # Download included files preserving paths
                                    for relpath, info in includes.items():
                                        try:
                                            inc_url = info.get('url') if isinstance(info, dict) else None
                                            if not inc_url:
                                                continue
                                            dest_path = tmpdir_path / relpath
                                            dest_path.parent.mkdir(parents=True, exist_ok=True)
                                            logger.info(f"Downloading include {inc_url} -> {dest_path}")
                                            r = requests.get(inc_url, stream=True, timeout=60)
                                            r.raise_for_status()
                                            with open(dest_path, 'wb') as out_f:
                                                for chunk in r.iter_content(chunk_size=8192):
                                                    if chunk:
                                                        out_f.write(chunk)
                                        except Exception as e:
                                            logger.warning(f"Failed to download include {relpath}: {e}")

                                    # Create USDZ by zipping all files in tmpdir
                                    import zipfile
                                    logger.info(f"Creating USDZ at {usdz_path}")
                                    # Use compressed archive for non-USD files, but store USD uncompressed
                                    with zipfile.ZipFile(usdz_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                                        # add usd uncompressed and all other files (textures) compressed
                                        for root, dirs, files_in in os.walk(tmpdir_path):
                                            for fname in files_in:
                                                full = Path(root) / fname
                                                arcname = full.relative_to(tmpdir_path)
                                                arcname_str = str(arcname)
                                                if arcname_str.lower().endswith(('.usd', '.usdc', '.usda')):
                                                    # write USD file uncompressed
                                                    data = full.read_bytes()
                                                    zf.writestr(arcname_str, data, compress_type=zipfile.ZIP_STORED)
                                                else:
                                                    # write other files with default (DEFLATED) compression
                                                    zf.write(full, arcname=arcname_str)

                            except Exception as e:
                                logger.error(f"USD->USDZ packaging failed: {e}")
                                raise HTTPException(status_code=500, detail=f"USDZ conversion failed: {e}")
                        else:
                            logger.info(f"Using cached USDZ: {usdz_path}")

                        # Return the USDZ file
                        return FileResponse(
                            path=str(usdz_path),
                            filename=usdz_filename,
                            media_type="model/vnd.usdz+zip"
                        )

            # 3) Try other formats (glb, gltf, fbx, obj, blend) and attempt conversion via external tool if configured
            preferred_other = ['glb', 'gltf', 'fbx', 'obj', 'blend']
            found = None
            found_url = None
            found_ext = None
            for fmt in preferred_other:
                if fmt in files and resolution in files[fmt]:
                    # formats may have nested dicts
                    entries = files[fmt][resolution]
                    if isinstance(entries, dict):
                        # pick first file entry with url
                        for subext, info in entries.items():
                            if isinstance(info, dict) and info.get('url'):
                                found = fmt
                                found_url = info.get('url')
                                found_ext = subext
                                break
                    if found:
                        break

            if found and found_url:
                logger.info(f"Found {found} source: {found_url}. Attempting conversion to USDZ.")

                cache_dir = Path(tempfile.gettempdir()) / "asset_api_cache"
                cache_dir.mkdir(exist_ok=True)
                safe_name = row.get('external_id', row['id']).replace(' ', '_').replace('/', '_')
                usdz_filename = f"{safe_name}_{resolution}.usdz"
                usdz_path = cache_dir / usdz_filename

                if usdz_path.exists():
                    return FileResponse(path=str(usdz_path), filename=usdz_filename, media_type="model/vnd.usdz+zip")

                # Download source file
                with tempfile.TemporaryDirectory() as tmpdir:
                    tmpdir_path = Path(tmpdir)
                    src_name = f"source.{found_ext or found}"
                    src_path = tmpdir_path / src_name
                    if not download_to_path(found_url, src_path):
                        raise HTTPException(status_code=502, detail=f"Failed to download source file: {found_url}")

                    # Conversion command must be provided via environment variable CONVERSION_CMD
                    # Example: CONVERSION_CMD="gltf2usd {input} {output}"
                    conversion_cmd = os.environ.get('CONVERSION_CMD')
                    if conversion_cmd:
                        out_usd = tmpdir_path / f"{safe_name}.usd"
                        cmd = conversion_cmd.format(input=shlex.quote(str(src_path)), output=shlex.quote(str(out_usd)))
                        # Use shlex.split to run safely
                        try:
                            logger.info(f"Running conversion command: {cmd}")
                            completed = subprocess.run(shlex.split(cmd), cwd=str(tmpdir_path), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300)
                            if completed.returncode != 0:
                                logger.error(f"Conversion command failed: {completed.stderr.decode()}")
                                raise HTTPException(status_code=500, detail=f"Conversion failed: {completed.stderr.decode()}")
                        except subprocess.TimeoutExpired:
                            raise HTTPException(status_code=500, detail="Conversion timed out")

                        # If conversion produced USD, package into USDZ
                        if out_usd.exists():
                            if package_local_usd_to_usdz(out_usd, usdz_path):
                                return FileResponse(path=str(usdz_path), filename=usdz_filename, media_type="model/vnd.usdz+zip")
                            else:
                                raise HTTPException(status_code=500, detail="Failed to package converted USD into USDZ")
                        else:
                            raise HTTPException(status_code=500, detail="Conversion did not produce USD output")
                    else:
                        # No conversion command configured
                        raise HTTPException(status_code=501, detail=("Server cannot convert this format to USDZ because no conversion tool is configured. "
                                                                    "Set the CONVERSION_CMD environment variable to a conversion command, e.g. 'gltf2usd {in} {out}' or provide a USD file."))
            
            # If USD not found, return error
            available_formats = list(files.keys())
            raise HTTPException(
                status_code=404, 
                detail=f"USD format not available for resolution {resolution}. Available: {available_formats}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading USDZ for {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/models/{asset_id}/thumbnail")
async def download_thumbnail(asset_id: str):
    """
    Proxy and download a model's thumbnail, with server-side caching.
    Returns the image file if available.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT id, external_id, name, raw_api_data
                FROM asset_library
                WHERE id = %s
            """, (asset_id,))

            row = cursor.fetchone()
            cursor.close()

            if not row:
                raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")

            raw_data = row.get('raw_api_data') or {}
            # Use thumbnail field if set, otherwise try to extract
            thumb_url = raw_data.get('thumbnail') or get_thumbnail_url(raw_data)
            if not thumb_url:
                raise HTTPException(status_code=404, detail="Thumbnail not available")

            # Create cache dir
            cache_dir = Path(tempfile.gettempdir()) / "asset_api_thumbnails"
            cache_dir.mkdir(parents=True, exist_ok=True)

            # Use md5 of URL to create unique filename
            url_hash = hashlib.md5(thumb_url.encode('utf-8')).hexdigest()
            extension = os.path.splitext(thumb_url.split('?')[0])[1] or '.jpg'
            cached_name = f"{row['id']}_{url_hash}{extension}"
            cached_path = cache_dir / cached_name

            if not cached_path.exists():
                logger.info(f"Downloading thumbnail for {asset_id} from {thumb_url}")
                try:
                    resp = requests.get(thumb_url, timeout=15)
                    resp.raise_for_status()
                except Exception as e:
                    logger.error(f"Failed to download thumbnail: {e}")
                    raise HTTPException(status_code=502, detail=f"Failed to fetch thumbnail: {str(e)}")

                # Write to cache
                with open(cached_path, 'wb') as f:
                    f.write(resp.content)
            else:
                logger.info(f"Using cached thumbnail for {asset_id}: {cached_path}")

            return FileResponse(path=str(cached_path), filename=cached_path.name, media_type="image/*")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving thumbnail for {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ==================== Flashcards API ====================

@app.get("/api/flashcards/review")
async def get_flashcards():
    """Get flashcard review cards (mock data for testing)"""
    try:
        flashcards = [
            {
                "id": "fc1",
                "front": "What is the capital of France?",
                "back": "Paris",
                "card_type": "geography",
                "correct_answer": "Paris",
                "due_label": "Today",
                "tips": "Think of the Eiffel Tower - it's located in Paris",
                "choices": None,
                "attachments": [],
                "mnemonics": []
            },
            {
                "id": "fc2",
                "front": "What is 2² + 3²?",
                "back": "13",
                "card_type": "math",
                "correct_answer": "13",
                "due_label": "Today",
                "tips": "2² = 4, 3² = 9, so 4 + 9 = 13",
                "choices": ["10", "12", "13", "15"],
                "attachments": [],
                "mnemonics": []
            },
            {
                "id": "fc3",
                "front": "What is the largest planet in our solar system?",
                "back": "Jupiter",
                "card_type": "science",
                "correct_answer": "Jupiter",
                "due_label": "Tomorrow",
                "tips": "Jupiter is a gas giant - it's massive!",
                "choices": ["Saturn", "Neptune", "Jupiter", "Earth"],
                "attachments": [],
                "mnemonics": []
            },
            {
                "id": "fc4",
                "front": "Who painted the Mona Lisa?",
                "back": "Leonardo da Vinci",
                "card_type": "art",
                "correct_answer": "Leonardo da Vinci",
                "due_label": "Tomorrow",
                "tips": "Italian Renaissance master - lived 1452-1519",
                "choices": ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"],
                "attachments": [],
                "mnemonics": []
            },
            {
                "id": "fc5",
                "front": "What is the chemical symbol for Gold?",
                "back": "Au",
                "card_type": "chemistry",
                "correct_answer": "Au",
                "due_label": "Next Week",
                "tips": "From the Latin word 'aurum'",
                "choices": ["Gd", "Go", "Au", "Ag"],
                "attachments": [],
                "mnemonics": []
            }
        ]
        logger.info(f"Serving {len(flashcards)} flashcards")
        return flashcards
    except Exception as e:
        logger.error(f"Error fetching flashcards: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Asset API Server (v2.0) on http://localhost:8002")
    print("📚 API Documentation: http://localhost:8002/docs")
    print("🗄️  Connected to PostgreSQL database with 2000+ models")
    print("📋 Flashcards API: http://localhost:8002/api/flashcards/review")
    uvicorn.run(app, host="0.0.0.0", port=8002)

