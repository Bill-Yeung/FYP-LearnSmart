from pydantic import BaseModel
from typing import List, Optional, Dict

class ChatMessage(BaseModel):
    role: str
    content: str
    
class TutorChatRequest(BaseModel):
    knowledge_id: str
    knowledge_name: str
    context_chunks: List[str]
    messages: List[ChatMessage]
    is_quiz_mode: bool = False

class TutorChatResponse(BaseModel):
    content: str
    quiz_data: Optional[Dict] = None
