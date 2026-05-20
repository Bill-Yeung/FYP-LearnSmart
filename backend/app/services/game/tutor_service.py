import json
from app.models.tutor_schema import TutorChatRequest, TutorChatResponse
from app.services.ai.provider import ai_provider

class TutorService:
    @staticmethod
    async def generate_tutor_response(req: TutorChatRequest) -> TutorChatResponse:
        
        # 1. Combine RAG context
        rag_context = "\n".join(req.context_chunks)
        
        # 2. Build the System Prompt
        sys_instructions = f"""
        You are a friendly, expert learning assistant. Your goal is to tutor the user on the topic [{req.knowledge_name}].
        
        === REFERENCE MATERIAL ===
        {rag_context}
        ==========================
        
        PEDAGOGICAL RULES (Follow strictly):
        1. FACTUAL ACCURACY: You must draw core facts, definitions, and claims ONLY from the REFERENCE MATERIAL above.
        2. EXTENSION FOR LEARNING: Use analogies, easier explanations (like ELI5), and real-world examples to help the user deeply understand the material.
        3. HONESTY BOUNDARY: If the user asks a factual question not covered in the REFERENCE material, start with: "This isn't explicitly covered in the course material, but generally speaking..."
        4. ENGAGEMENT & SOCRATIC GUIDANCE: If the user explores tangentially related topics, briefly acknowledge their curiosity, then ask a thought-provoking question to connect back to [{req.knowledge_name}].
        5. SCAFFOLDING & ESCAPE HATCH: When the user is solving a problem or learning a complex concept, use guiding questions and hints instead of giving direct answers. HOWEVER, if the user explicitly asks for the direct answer, asks a simple factual query, or expresses frustration, you MUST provide the direct answer immediately and concisely.
        6. MICRO-LEARNING (CONCISENESS): Keep your responses short, punchy, and easy to read. Use bullet points or bold text for key terms to reduce cognitive load. Don't dump a wall of text.
        """
        
        if req.is_quiz_mode:
            sys_instructions += f"""
        5. QUIZ MODE ACTIVATED: The user requested a quick quiz. You must generate a single, challenging multiple-choice question specifically about [{req.knowledge_name}] testing the user's understanding of the REFERENCE MATERIAL.
        You MUST return ONLY a valid JSON object in the following format (no markdown code blocks, no extra text):
        {{
           "question": "The question text",
           "options": {{"A": "Option 1", "B": "Option 2", "C": "Option 3", "D": "Option 4"}},
           "correctOption": "B",
           "explanation": "Detailed explanation of why B is correct, and why others are wrong, based on the reference material."
        }}
        """
        
        try:

            conversation = ""
            for msg in req.messages:
                role_label = "User" if msg.role == "user" else "Assistant"
                conversation += f"{role_label}: {msg.content}\n\n"
                
            prompt = f"{conversation}\nProvide your response now."
            
            async with ai_provider.session(system_prompt=sys_instructions) as session:
                raw_response = await ai_provider.generate(
                    prompt=prompt,
                    session=session,
                    temperature=0.7 if not req.is_quiz_mode else 0.2,
                    json_mode=req.is_quiz_mode
                )
            
            if req.is_quiz_mode:
                try:

                    clean_json = raw_response.strip('` \n').removeprefix('json')
                    quiz_json = json.loads(clean_json)
                    return TutorChatResponse(content="Here is your quiz:", quiz_data=quiz_json)
                except json.JSONDecodeError:
                    return TutorChatResponse(content="Sorry, I couldn't generate a proper quiz at the moment.")
            else:
                return TutorChatResponse(content=raw_response)
                
        except Exception as e:
            print(f"AI Tutor generation error: {e}")
            return TutorChatResponse(content="Sorry, the AI tutor is currently unavailable. Please try again later.")
