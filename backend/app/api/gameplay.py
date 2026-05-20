import json
import logging
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Body, status, Path, BackgroundTasks
from app.core.dependencies import get_current_user
from app.core.database import get_postgres
from app.repositories.game.game_repository import GameRepository
from app.repositories.game.gamePlay_repository import GamePlayRepository
from app.services.game.game_service import GameService
from app.services.game.gamePlay_service import GamePlayService
from app.models.gamePlay import (
    SceneDTO, UserProgressDTO, SubmitAnswerRequestDTO,
    AddToLearnLaterRequestDTO, MarkMasteredRequestDTO,
    SaveProgressRequestDTO, AskDetectiveRequestDTO, ReportIssueRequestDTO
)
from app.services.cognitive_service import evaluate_script_cognitive_profile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/game", tags=["Play Scripts"])

def _get_user_id(current_user: dict) -> str:
    return str(current_user["id"])

@router.get("/progress/{scriptId}")
async def get_user_progress(scriptId: str = Path(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        progress = await service.get_or_initialize_progress(user_id, scriptId)
        return progress
    except Exception as e:
        logger.exception("Failed to get user progress")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/learn-later")
async def get_learn_later(db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        # TODO: Implement learn later tracking
        # For now, return empty learn later list
        return {"userId": user_id, "learnLaterList": []}
    except Exception as e:
        logger.exception("Failed to get learn later list")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.get("/learn-later/list")
async def get_learn_later_list(scriptId: Optional[str] = Query(None), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        result = await service.get_learn_later_list(user_id, script_id=scriptId)
        return result
    except Exception as e:
        logger.exception("Failed to get learn later list")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/learn-later")
async def add_to_learn_later(data: AddToLearnLaterRequestDTO = Body(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        repository = GamePlayRepository(db)
        script_id = data.scriptId
        if not script_id:
            script_id = await repository.get_latest_active_script_id(user_id)

        if not script_id:
            return {"userId": user_id, "success": False, "message": "No active script found"}

        service = GamePlayService(db)
        success = await service.add_to_learn_later(user_id, script_id, data)
        return {"userId": user_id, "success": success}
    except Exception as e:
        logger.exception("Failed to add to learn later")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/knowledge/master")
async def mark_as_mastered(data: MarkMasteredRequestDTO = Body(...), scriptId: Optional[str] = Query(None), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        success = await service.mark_as_mastered(user_id, data, scriptId)
        return {"success": success}
    except Exception as e:
        logger.exception("Failed to mark as learned")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/learning-progress")
async def update_learning_progress(
    knowledgeId: str = Query(...),
    scriptId: Optional[str] = Query(None),
    timeSpentMinutes: int = Query(0),
    quizAttempts: int = Query(0),
    quizPassed: bool = Query(False),
    aiContentViewed: Optional[str] = Query(None),
    personalNotes: Optional[str] = Query(None),
    masteryLevel: Optional[str] = Query(None),
    db=Depends(get_postgres),
    current_user=Depends(get_current_user)
):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)

        ai_content = {}
        if aiContentViewed:
            try:
                ai_content = json.loads(aiContentViewed)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON for aiContentViewed: {aiContentViewed}")

        success = await service.update_learning_progress(
            user_id=user_id,
            knowledge_id=knowledgeId,
            time_spent_minutes=timeSpentMinutes,
            quiz_attempts=quizAttempts,
            quiz_passed=quizPassed,
            ai_content_viewed=ai_content,
            personal_notes=personalNotes,
            mastery_level=masteryLevel,
            script_id=scriptId
        )

        return {"success": success, "knowledgeId": knowledgeId}
    except Exception as e:
        logger.exception("Failed to update learning progress")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.get("/learning-progress/{knowledgeId}")
async def get_learning_progress(knowledgeId: str = Path(...), scriptId: Optional[str] = Query(None), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)

        progress = await service.get_learning_progress(user_id, knowledgeId, script_id=scriptId)

        if not progress:
            return {
                "knowledgeId": knowledgeId,
                "timeSpentMinutes": 0,
                "quizAttempts": 0,
                "quizPassedAt": None,
                "aiContentViewed": {},
                "personalNotes": None,
                "masteryLevel": "unfamiliar"
            }

        return progress
    except Exception as e:
        logger.exception("Failed to get learning progress")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/report-issue")
async def report_issue_and_skip(scriptId: str = Query(...), data: ReportIssueRequestDTO = Body(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        result = await service.report_issue_and_skip(user_id, scriptId, data)
        return result
    except Exception as e:
        logger.exception("Failed to report issue")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/submit-answer")
async def submit_answer(scriptId: str = Query(...), data: SubmitAnswerRequestDTO = Body(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        result = await service.submit_answer(user_id, scriptId, data)
        return result
    except Exception as e:
        logger.exception("Failed to submit answer")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/ask-detective")
async def ask_detective(data: AskDetectiveRequestDTO = Body(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        result = await service.ask_detective(user_id, data)
        return result
    except Exception as e:
        logger.exception("Failed to ask detective generating hint")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/update-progress")
async def update_progress(scriptId: str = Query(...), data: dict = Body(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        updated = await service.update_progress(user_id, scriptId, data)
        return updated
    except Exception as e:
        logger.exception("Failed to update progress")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.get("/chunks")
async def get_chunks(hash: str = Query(..., description="Document hash to retrieve chunks for"), db=Depends(get_postgres)):
    if not hash or not hash.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document hash is required")
    service = GamePlayService(db)
    chunks = await service.get_chunks_dto(hash)
    if not chunks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No document found with hash: {hash}")
    return chunks

@router.get("/parsed-document-chunks")
async def get_parsed_document_chunks(document_hash: str = Query(..., description="Document hash to retrieve chunks for"), db=Depends(get_postgres)):

    try:
        if not document_hash or not document_hash.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document hash is required")

        service = GamePlayService(db)
        chunks = await service.get_parsed_document_chunks(document_hash)

        if chunks is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No parsed document found with hash: {document_hash}")

        return {
            "documentHash": document_hash,
            "chunks": chunks,
            "totalChunks": len(chunks) if chunks else 0
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get parsed document chunks for hash {document_hash}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve chunks: {str(e)}")

@router.get("/scenes/{sceneId}")
async def get_scene(scriptId: str = Query(...), sceneId: str = Path(...), db=Depends(get_postgres)):

    try:
        service = GamePlayService(db)
        scene = await service.get_scene_by_script_and_id(scriptId, sceneId)

        if not scene:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scene not found: {sceneId}")

        return scene
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get scene {sceneId}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {str(e)}")

@router.get("/scene/{sceneId}/context")
async def get_scene_context(scriptId: str = Query(...), sceneId: str = Path(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)

        service = GamePlayService(db)
        context = await service.get_scene_context(scriptId, sceneId, user_id)

        return context
    except ValueError as e:
        logger.warning(f"Scene context not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to get scene context for {sceneId}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {str(e)}")

@router.post("/progress/{scriptId}/reset")
async def reset_progress(scriptId: str = Path(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        await service.reset_progress(user_id, scriptId)
        return {"message": "Progress reset successfully"}
    except Exception as e:
        logger.exception("Failed to reset progress")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/progress/{scriptId}/save")
async def save_progress(scriptId: str = Path(...), data: Optional[SaveProgressRequestDTO] = Body(None), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        result = await service.save_progress(user_id, scriptId, data)
        return result
    except Exception as e:
        logger.exception("Failed to save progress")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/answers/{scriptId}")
async def get_user_answers(scriptId: str = Path(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        repository = GamePlayRepository(db)
        answers = await repository.get_user_answers_by_script_id(user_id, scriptId)
        return {"userId": user_id, "scriptId": scriptId, "answers": answers}
    except Exception as e:
        logger.exception("Failed to get answers")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.get("/play/{scriptId}")
async def play_game(
    scriptId: str = Path(...), 
    db=Depends(get_postgres), 
    current_user=Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):

    try:
        service = GamePlayService(db)
        game_data = await service.get_script_dto(scriptId)
        
        try:
            
            background_tasks.add_task(evaluate_script_cognitive_profile, str(scriptId))
        except Exception as bg_e:
            logger.error(f"Failed to dispatch cognitive profile task: {bg_e}")
            
        return game_data
    except Exception as e:
        logger.exception("Failed to start game")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.post("/progress/{scriptId}/complete")
async def complete_game(scriptId: str = Path(...), data: dict = Body(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        ending_id = data.get("endingId", "unknown")
        result = await service.complete_game(user_id, scriptId, ending_id)
        return {"success": result}
    except Exception as e:
        logger.exception("Failed to complete game")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.get("/progress/{scriptId}/report")
async def get_script_report(scriptId: str = Path(...), db=Depends(get_postgres), current_user=Depends(get_current_user)):

    try:
        user_id = _get_user_id(current_user)
        service = GamePlayService(db)
        report = await service.get_script_report(user_id, scriptId)
        if not report:
            raise HTTPException(status_code=404, detail="Script or report not found")
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get script report")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")