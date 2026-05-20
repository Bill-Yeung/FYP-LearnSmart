from __future__ import annotations
import logging
import asyncpg
from typing import Optional

from app.models.gamePlay import QuestionDTO, ScriptDTO

logger = logging.getLogger(__name__)

class StudyDataService:
    def __init__(self, db: Optional[asyncpg.Connection] = None) -> None:
        self.db = db

    @staticmethod
    def calculate_mastery_earned(
        question: QuestionDTO,
        is_correct: bool,
        hints_used: int,
        attempt_number: int,
        script: ScriptDTO,
    ) -> int:
        
        if not is_correct:
            return 0

        show_answer_used = hints_used >= 999
        if show_answer_used:
            return 0

        base_reward = question.masteryReward or script.masteryRewardBase or 0
        hint_penalty = script.hintPenalty if script.hintPenalty is not None else 10
        attempt_penalty = script.masteryRewardBase if script.masteryRewardBase is not None else 2

        score = base_reward
        if hints_used > 0:
            score -= hint_penalty * hints_used
        if attempt_number > 1:
            score -= attempt_penalty * (attempt_number - 1)

        final_score = max(int(score), 0)
        logger.debug(
            "Calculated mastery score for question %s: base=%s hints=%s attempts=%s final=%s",
            question.questionId,
            base_reward,
            hints_used,
            attempt_number,
            final_score,
        )
        return final_score
