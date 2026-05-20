import json
import os
from typing import Any, Optional
import logging
from fastapi import APIRouter, UploadFile, HTTPException, Depends, File, status, Form, Query, Body
from fastapi.responses import FileResponse, JSONResponse
from app.core.dependencies import get_current_user
import asyncpg
from app.core.database import get_postgres, session_factory
from app.models.game import GameTemplateResponse, TemplateCreate, AnalysisHelperResponse, ScriptRequest, JudgeAnswerRequest, JudgeAnswerResponse
from app.models.document import ParsedJsonResponse
from app.services.game.game_service import GameService
from app.services.game.analysis_service import DocumentAnalysisService
from app.services.knowledge.knowledge_retrieval_service import knowledge_service
from app.testGenerate.repo import TestGenerateRepository
from app.testGenerate.service import TestGenerateService
from app.repositories.game.game_repository import GameRepository
from app.utils.validateScript import get_validation_summary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/game", tags=["Script Kill Game"])

@router.post("/templates", response_model=GameTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(payload: TemplateCreate, db=Depends(get_postgres)) -> GameTemplateResponse:
    service = GameService(db)
    return await service.create_template(payload)

@router.get("/templates")
async def list_templates(db=Depends(get_postgres)) -> list[dict[str, Any]]:
    service = GameService(db)
    return await service.list_templates()

@router.post("/analyze-temp", response_model=AnalysisHelperResponse)
async def analyze_document_temp(file: UploadFile = File(...), hash: str = Form(...), filename: str = Form(...), db=Depends(get_postgres)):
    logger.info("API.analyze_document_temp invoked; filename=%s", getattr(file, "filename", None))
    try:
        content_bytes = await file.read()
        service = DocumentAnalysisService(db)
        result = await service.analyze_temp(content_bytes, hash, filename)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Temporary document analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: str, db=Depends(get_postgres)):
    service = GameService(db)
    return await service.delete_template(template_id)

@router.post("/templates/{template_id}/duplicate")
async def duplicate_template(template_id: str, db=Depends(get_postgres)):
    service = GameService(db)
    return await service.duplicate_template(template_id)

@router.get("/templates/{template_id}", response_model=GameTemplateResponse)
async def get_template(template_id: str, db=Depends(get_postgres)):
    service = GameService(db)
    return await service.get_template(template_id)

@router.patch("/templates/{template_id}", response_model=GameTemplateResponse)
async def update_template(template_id: str, payload: TemplateCreate, db=Depends(get_postgres)):
    service = GameService(db)
    return await service.update_template(template_id, payload)

@router.post("/analysis")
async def analyze_document(file: UploadFile = File(...), db=Depends(get_postgres)):
    if not file.filename:
        raise HTTPException(400, "File name is empty")

    repo = TestGenerateRepository(session_factory=session_factory)
    svc = TestGenerateService(repo=repo, upload_dir=os.getenv("UPLOAD_DIR", "uploads"))

    file_bytes = await file.read()
    try:
        result = await svc.upload_and_chunk(filename=file.filename, file_bytes=file_bytes)
        return {"success": True, **result}
    except Exception as e:
        logger.exception("Document analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

@router.get("/parsed-documents")
async def check_parsed_document(hash: str, db=Depends(get_postgres)):
    try:
        repository = GameRepository(db)
        document = await repository.get_parsed_document_by_hash(hash)
        if document:
            return document

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED, 
            content={"status": "pending", "detail": "Parsed document not found or still processing"}
        )
    except HTTPException:
        raise
    except asyncpg.exceptions.PostgresError as pg_error:
        logger.exception("Database error occurred while checking parsed document")
        raise HTTPException(status_code=500, detail="Database error occurred") from pg_error
    except Exception as e:
        logger.exception("Failed to check parsed document")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.get("/my-scripts")
async def list_my_scripts(db=Depends(get_postgres), current_user=Depends(get_current_user)):
    try:
        service = GameService(db)
        user_id_str = str(current_user["id"]) if current_user and "id" in current_user else None
        return await service.list_my_scripts(user_id=user_id_str)
    except Exception as e:
        logger.exception("Failed to list scripts")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.delete("/scripts")
async def delete_scripts(ids: str = Query(..., description="Comma-separated script ids to remove"), db=Depends(get_postgres), current_user=Depends(get_current_user)):
    try:
        script_ids = [script_id.strip() for script_id in ids.split(",") if script_id.strip()]
        if not script_ids:
            raise HTTPException(status_code=400, detail="No script ids provided")

        service = GameService(db)
        user_id_str = str(current_user["id"]) if current_user and "id" in current_user else None
        deleted_count = await service.delete_scripts(script_ids, user_id=user_id_str)
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="No scripts deleted")
        return {"deleted": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete scripts")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.delete("/scripts/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script(script_id: str, db=Depends(get_postgres), current_user=Depends(get_current_user)):
    try:
        service = GameService(db)
        user_id_str = str(current_user["id"]) if current_user and "id" in current_user else None
        deleted = await service.delete_script(script_id, user_id=user_id_str)
        if not deleted:
            raise HTTPException(status_code=404, detail="Script not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete script")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/generate-script")
async def generate_script(request: ScriptRequest, db=Depends(get_postgres), current_user=Depends(get_current_user)):
    try:
        service = GameService(db)
        user_id_str = str(current_user["id"]) if current_user and "id" in current_user else None
        script = await service.generate_script_pipeline(request, user_id=user_id_str)
        return script
    except Exception as e:
        logger.exception(f"Error in generate_script: {e}")
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to generate script", "error": str(e)}
        )

@router.get("/scripts/{scriptId}")
async def get_script(scriptId: str, db=Depends(get_postgres)):
    try:
        repository = GameRepository(db)
        script_row = await repository.get_script_by_id(scriptId)
        if not script_row:
            raise HTTPException(status_code=404, detail="Script not found")

        outline_json_str = script_row.get("outline_json")
        if outline_json_str and isinstance(outline_json_str, str):
            outline_json_str = outline_json_str.replace('"fill_in_the_blank"', '"fill_in_blank"')
        if not outline_json_str:
            raise HTTPException(status_code=500, detail="Script data is corrupted")

        script_data = json.loads(outline_json_str)
        if "scriptId" not in script_data:
            script_data["scriptId"] = scriptId
        if "title" not in script_data:
            script_data["title"] = script_row.get("title")

        return {"scriptId": scriptId, "script": script_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get script {scriptId}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/validate-script")
async def validate_generated_script(script: dict = Body(...), current_user: int = Depends(get_current_user)):
    try:
        if not script:
            raise HTTPException(status_code=400, detail="No script provided")

        summary_data = get_validation_summary(script)
        return {"status": "success", "data": summary_data}
    except Exception as e:
        logger.error(f"Error validating script: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/parsed-json/{document_hash}", response_model=ParsedJsonResponse)
async def get_parsed_json(document_hash: str, db=Depends(get_postgres)):
    service = GameService(db)
    result = await service.getParsedJson(document_hash)
    if not result:
        raise HTTPException(status_code=404, detail="Parsed JSON not found")
    return result

from app.services.game.judge_service import JudgeService

@router.post("/judge-answer", response_model=JudgeAnswerResponse)
async def judge_user_answer(
    request: JudgeAnswerRequest,
    current_user=Depends(get_current_user)
) -> JudgeAnswerResponse:

    try:
        service = JudgeService()
        result = await service.judge_subjective_answer(
            question_text=request.questionText,
            user_answer=request.userAnswer,
            correct_answers=request.correctAnswers,
            related_knowledge=request.relatedKnowledge
        )
        
        return JudgeAnswerResponse(
            isCorrect=result.get("isCorrect", False),
            feedback=result.get("feedback", "No feedback available.")
        )
    except Exception as e:
        logger.exception("Failed to judge answer")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
