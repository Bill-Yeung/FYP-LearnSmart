import json
import logging
from typing import Any, Dict
from app.services.ai.provider import AIProvider, SessionContext
from app.services.ai.prompts import get_prompt

logger = logging.getLogger(__name__)

class JudgeService:
    def __init__(self, ai_provider: AIProvider = None):
        self.ai_provider = ai_provider or AIProvider()

    def _select_provider_name(self) -> str:
        preferred_order = ["qwen", "macmini", "deepseek", "openrouter", "ollama"]
        available = {provider.provider_name for provider in self.ai_provider.providers}
        for candidate in preferred_order:
            if candidate in available:
                return candidate
        return next(iter(available), None) if available else None

    async def judge_subjective_answer(
        self,
        question_text: str,
        user_answer: str,
        correct_answers: list[str] = None,
        related_knowledge: str = None
    ) -> Dict[str, Any]:

        prompt_template = get_prompt("judge_subjective_answer")

        correct_ans_str = json.dumps(correct_answers, ensure_ascii=False) if correct_answers else "None provided"
        rel_knowledge_str = related_knowledge or "None provided"

        sys_prompt = prompt_template.system_prompt_template
        user_prompt = prompt_template.user_prompt_template.replace(
            "{question_text}", question_text
        ).replace(
            "{correct_answers}", correct_ans_str
        ).replace(
            "{related_knowledge}", rel_knowledge_str
        ).replace(
            "{user_answer}", user_answer
        )

        full_prompt = f"{sys_prompt}\n\n{user_prompt}"

        session = SessionContext()
        provider_name = self._select_provider_name()
        if provider_name:
            session.provider_name = provider_name

        reply_str = await self.ai_provider.generate(
            prompt=full_prompt,
            session=session,
            json_mode=True,
            temperature=0.1
        )

        if reply_str.startswith("```"):
            reply_str = reply_str.strip("`").replace("json\n", "", 1)

        try:
            result = json.loads(reply_str)
            is_correct = bool(result.get("isCorrect", False))
            feedback = str(result.get("feedback", "No feedback provided."))
            return {"isCorrect": is_correct, "feedback": feedback}
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode judge result: {reply_str}")
            return {
                "isCorrect": False,
                "feedback": "An error occurred while evaluating your answer. Please try again."
            }