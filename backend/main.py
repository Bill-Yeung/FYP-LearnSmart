import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.gateway_diagnostics import log_gateway_diagnostics

logging.basicConfig(
    level = logging.INFO,
    format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers = [logging.StreamHandler(sys.stdout)])
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logging.getLogger("app").setLevel(logging.INFO)
logging.getLogger("app.services.game").setLevel(logging.INFO)
logging.getLogger("app.services.document").setLevel(logging.INFO)
logging.getLogger(__name__).info(
    "Backend model gateway config v2: MACMINI_BASE_URL=%s, MACMINI_BASE_URLS=%s, resolved_gateway_urls=%s, OLLAMA_URL=%s",
    settings.macmini_base_url or "<unset>",
    settings.macmini_base_urls,
    settings.model_gateway_urls,
    settings.ollama_url)
log_gateway_diagnostics("backend startup", level=logging.INFO)
from app.core.database import lifespan

from app.api import users_router
from app.api import auth_router
from app.api import notifications_router
from app.api import ai_router
from app.api import comprehension_router
from app.api import progress_ai_router
from app.api import documents_router
from app.api import tags_router
from app.api import learning_paths_router
from app.api import diagrams_router
from app.api import feynman_router
from app.api import explanations_router
from app.api import subjects_router
from app.api import flashcards_router
from app.api import speech_router
from app.api import assets_router
from app.api import game_router
from app.api import tutor_router
from app.api import gameplay_router
from app.api import quiz_router
from app.api import chat_router
from app.api import friendships_router
from app.api import communities_router
from app.api import discussions_router
from app.api import gamification_router
from app.api import shared_content_router
from app.api import feedback_router
from app.api import challenges_router
from app.api import mentorships_router
from app.api import reputation_router
from app.api import content_requests_router
from app.api import activity_feed_router
from app.api import follows_router
from app.api import classroom_router
from app.api import palace_router
from app.api import admin_router
from app.api import error_book_router
from app.api import calendar_router
from app.api import teacher_memo_assessment_router
from app.api import visionpro_router
from app.api import plan_workflow_router
from app.api import timer_router
from app.api import latex_router

app = FastAPI(
    title = settings.app_name,
    version = settings.app_version,
    lifespan = lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins = settings.cors_origins,
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"])

# Include routers
app.include_router(users_router, prefix = "/api")
app.include_router(auth_router, prefix = "/api")
app.include_router(notifications_router, prefix = "/api")
app.include_router(documents_router, prefix = "/api")
app.include_router(tags_router, prefix = "/api")
app.include_router(learning_paths_router, prefix = "/api")
app.include_router(diagrams_router, prefix = "/api")
app.include_router(feynman_router, prefix = "/api")
app.include_router(explanations_router, prefix = "/api")
app.include_router(subjects_router, prefix = "/api")
app.include_router(flashcards_router, prefix = "/api")
app.include_router(speech_router, prefix = "/api")
app.include_router(assets_router, prefix = "/api")
app.include_router(ai_router, prefix = "/api")
app.include_router(comprehension_router, prefix = "/api")
app.include_router(progress_ai_router, prefix = "/api")
app.include_router(game_router, prefix = "/api")
app.include_router(tutor_router, prefix = "/api")
app.include_router(gameplay_router, prefix = "/api")
app.include_router(quiz_router, prefix = "/api")
app.include_router(chat_router, prefix = "/api")
app.include_router(friendships_router, prefix = "/api")
app.include_router(communities_router, prefix = "/api")
app.include_router(discussions_router, prefix = "/api")
app.include_router(gamification_router, prefix = "/api")
app.include_router(shared_content_router, prefix = "/api")
app.include_router(feedback_router, prefix = "/api")
app.include_router(challenges_router, prefix = "/api")
app.include_router(mentorships_router, prefix = "/api")
app.include_router(reputation_router, prefix = "/api")
app.include_router(content_requests_router, prefix = "/api")
app.include_router(activity_feed_router, prefix = "/api")
app.include_router(follows_router, prefix = "/api")
app.include_router(classroom_router, prefix = "/api")
app.include_router(palace_router, prefix = "/api")
app.include_router(admin_router, prefix = "/api")
app.include_router(error_book_router, prefix = "/api")
app.include_router(calendar_router, prefix = "/api")
app.include_router(teacher_memo_assessment_router, prefix = "/api")
app.include_router(visionpro_router, prefix = "/api")
app.include_router(plan_workflow_router, prefix="/api")
app.include_router(timer_router)
app.include_router(latex_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.app_version}

from fastapi.responses import FileResponse
from pathlib import Path
from app.core.config import settings
import os

@app.get("/media/{file_path:path}")
async def serve_media(file_path: str):

    full_path = Path(settings.upload_dir) / file_path
    
    try:
        full_path = full_path.resolve()
        upload_dir = Path(settings.upload_dir).resolve()
        if not str(full_path).startswith(str(upload_dir)):
            return {"error": "Access denied"}, 403
    except:
        return {"error": "Invalid path"}, 400
    
    if not full_path.exists():
        return {"error": "File not found"}, 404
    
    mime_type = "application/octet-stream"
    suffix = full_path.suffix.lower()
    
    mime_types = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.mp4': 'video/mp4',
        '.txt': 'text/plain',
    }
    
    mime_type = mime_types.get(suffix, mime_type)
    
    headers = {
        "Content-Disposition": f'inline; filename="{full_path.name}"',
        "Cache-Control": "public, max-age=31536000, immutable",
    }
    return FileResponse(full_path, media_type=mime_type, headers=headers)
