from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_postgres
from app.services.ai.provider import ai_provider
from app.repositories.ai_repository import AIRepository

router = APIRouter()

@router.get("/ai/health")
async def ai_health():
    try:
        async with ai_provider.session(system_prompt=None) as session:
            response = await ai_provider.generate(
                prompt="Say hi in 5 words or less",
                session=session,
                max_tokens=20
            )
        return {"status": "ok", "response": response}
    except Exception as e:
        return {"status": "down", "error": str(e)}

class CallRequest(BaseModel):
    prompt: str
    provider: Optional[str] = None
    model_key: Optional[str] = None
    temperature: float = 0.1
    max_tokens: Optional[int] = None

@router.post("/ai/call")
async def call_model(req: CallRequest, db=Depends(get_postgres)):

    repo = AIRepository(db)

    try:
        async with ai_provider.session(system_prompt=None, provider_name=req.provider) as session:
            response = await ai_provider.generate(
                prompt=req.prompt,
                session=session,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                model_key=req.model_key)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    record = await repo.create_call(
        prompt=req.prompt,
        provider=req.provider or ai_provider.get_current_provider(),
        model=req.model_key or None,
        response=response,
        metadata={"via": "api"})

    return {"id": str(record.get("id")), "response": response}
