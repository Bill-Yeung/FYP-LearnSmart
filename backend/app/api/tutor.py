from fastapi import APIRouter
from app.models.tutor_schema import TutorChatRequest, TutorChatResponse
from app.services.game.tutor_service import TutorService

router = APIRouter(tags=["AI Tutor"])

@router.post("/game/ai/tutor/chat", response_model=TutorChatResponse)
async def chat_with_tutor(req: TutorChatRequest):
    return await TutorService.generate_tutor_response(req)
