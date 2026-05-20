import uuid
import json
import random
import logging
from typing import Any
from datetime import datetime

from asyncpg import Connection

from app.models.quiz import QuizAttemptCreate, EvaluateAnswerRequest, EvaluateAnswerResponse, GenerateMcqChoicesRequest, GenerateMcqChoicesResponse
from app.services.ai.provider import ai_provider
from app.core.enums import UserPriority
from app.services.infrastructure.task_queue_manager import task_queue_manager, QueueType

logger = logging.getLogger(__name__)


class QuizService:
    def __init__(self, conn: Connection):
        self.conn = conn

    async def create_attempt(self, payload: QuizAttemptCreate) -> dict[str, Any]:
        attempt_id = str(uuid.uuid4())
        attempt_time = payload.attempt_time or datetime.utcnow()

        await self.conn.execute(
            """
            INSERT INTO quiz_attempts (
                id, activity_id, user_id, exam_question_id,
                chosen_option, is_correct, time_spent_seconds, attempt_time
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            """,
            attempt_id,
            payload.activity_id,
            payload.user_id,
            payload.exam_question_id,
            payload.chosen_option,
            payload.is_correct,
            payload.time_spent_seconds,
            attempt_time,
        )

        return {
            "id": attempt_id,
            "activity_id": payload.activity_id,
            "user_id": payload.user_id,
            "exam_question_id": payload.exam_question_id,
            "chosen_option": payload.chosen_option,
            "is_correct": payload.is_correct,
            "time_spent_seconds": payload.time_spent_seconds,
            "attempt_time": attempt_time,
        }

    async def list_attempts(self, limit: int = 100, user_id: str | None = None) -> list[dict[str, Any]]:
        if user_id:
            rows = await self.conn.fetch(
                "SELECT id::text, activity_id, user_id, exam_question_id, chosen_option, is_correct, time_spent_seconds, attempt_time FROM quiz_attempts WHERE user_id = $1 ORDER BY attempt_time DESC LIMIT $2",
                user_id,
                limit,
            )
        else:
            rows = await self.conn.fetch(
                "SELECT id::text, activity_id, user_id, exam_question_id, chosen_option, is_correct, time_spent_seconds, attempt_time FROM quiz_attempts ORDER BY attempt_time DESC LIMIT $1",
                limit,
            )

        return [dict(r) for r in rows]

    async def list_questions(self, limit: int = 10, source_exam: str | None = None, difficulty: int | None = None, topic: str | None = None) -> list[dict[str, Any]]:
        params: list[Any] = [limit]
        where_clauses = []
        sql = "SELECT id::text, source_exam, year, paper, question_no, topic, question_stem, question_type, options, correct_answer, answer_explanation, related_concept_ids, difficulty_level FROM exam_questions"

        if source_exam is not None:
            params.append(source_exam)
            where_clauses.append(f"source_exam = ${len(params)}")

        if difficulty is not None:
            params.append(difficulty)
            where_clauses.append(f"difficulty_level = ${len(params)}")

        if topic is not None:
            params.append(f"%{topic}%")
            where_clauses.append(f"topic ILIKE ${len(params)}")

        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)

        sql += " ORDER BY difficulty_level DESC NULLS LAST, created_at DESC LIMIT $1"

        rows = await self.conn.fetch(sql, *params)
        return [dict(r) for r in rows]

    async def ai_generate_questions(
        self,
        topic: str,
        source_exam: str,
        year: int,
        count: int,
        difficulty_level: int,
    ) -> dict[str, Any]:
        prompt = f"""You are an expert exam question writer. Generate exactly {count} exam questions about the topic: "{topic}".

Source exam type: {source_exam}
Year: {year}
Difficulty level: {difficulty_level} (scale 1-5, where 1=easy, 5=very hard)

Generate a mix of MCQ (multiple choice) and open-ended questions.

Respond ONLY with a valid JSON array. Each element must be:
{{
  "question_type": "mcq" or "longq",
  "question_stem": "the question text",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."] (only for mcq type, null for longq),
  "correct_answer": "letter key like 'A' for mcq, or full answer text for longq",
  "answer_explanation": "step-by-step explanation"
}}

For mcq (multiple choice): provide 4 options A-D and correct_answer as the letter (A/B/C/D).
For longq (open-ended): set options to null and correct_answer is the full answer text.
"""
        async def _ai_call():
            async with ai_provider.session(system_prompt="You are an expert exam question writer. Always respond with valid JSON only.") as session:
                return await ai_provider.generate(
                    prompt=prompt,
                    session=session,
                    temperature=0.7,
                    user_priority=UserPriority.REGULAR
                )

        response_text = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_call, UserPriority.REGULAR
        )

        json_str = response_text.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()

        try:
            questions = json.loads(json_str)
            if not isinstance(questions, list):
                raise ValueError("Expected a JSON array")
        except Exception as e:
            raise ValueError(f"AI returned invalid JSON: {e}")

        inserted_ids = []
        for i, q in enumerate(questions[:count], start=1):
            q_id = str(uuid.uuid4())
            q_type = q.get("question_type", "longq")
            options = q.get("options")
            options_json = json.dumps(options) if options else None
            await self.conn.execute(
                """
                INSERT INTO exam_questions
                  (id, source_exam, year, topic, question_stem, question_type,
                   options, correct_answer, answer_explanation, difficulty_level)
                VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
                """,
                q_id,
                source_exam,
                year,
                topic,
                q.get("question_stem", ""),
                q_type,
                options_json,
                q.get("correct_answer", ""),
                q.get("answer_explanation", ""),
                difficulty_level,
            )
            inserted_ids.append(q_id)

        return {"generated": len(inserted_ids), "ids": inserted_ids, "topic": topic}

    async def evaluate_answer_with_ai(self, payload: EvaluateAnswerRequest) -> EvaluateAnswerResponse:

        evaluation_prompt = self._build_evaluation_prompt(payload)

        async def _ai_call():
            async with ai_provider.session(system_prompt="You are an expert educational evaluator.") as session:
                return await ai_provider.generate(
                    prompt=evaluation_prompt,
                    session=session,
                    temperature=0.2,
                    user_priority=UserPriority.REGULAR
                )

        response_text = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_call, UserPriority.REGULAR
        )

        return self._parse_ai_evaluation(response_text, payload)

    def _build_evaluation_prompt(self, payload: EvaluateAnswerRequest) -> str:
        prompt = f"""You are an expert educational evaluator. Evaluate the student's answer strictly and fairly.

QUESTION:
{payload.question_stem}

STUDENT'S ANSWER:
{payload.user_answer}

"""
        if payload.correct_answer:
            prompt += f"CORRECT ANSWER: {payload.correct_answer}\n\n"

        if payload.answer_explanation:
            prompt += f"ANSWER EXPLANATION:\n{payload.answer_explanation}\n\n"

        prompt += """SCORING RULES:
- score 100: answer is fully correct and covers all key points
- score 60-99: answer is mostly correct but missing some details or uses imprecise wording
- score 1-59: answer has some relevant ideas but is largely incomplete or partially wrong
- score 0: answer is wrong, irrelevant, off-topic, random characters, gibberish, keyboard mashing, or a non-answer

IMPORTANT:
- If the student's answer is gibberish, random characters, or clearly not a real attempt (e.g. "asdfadf", "aaa", "123"), score MUST be 0 and is_correct MUST be false.
- Accept correct answers even if worded differently from the model answer, as long as the key meaning is captured.
- is_correct is true only if score >= 60.

Respond in JSON format ONLY (no markdown, no extra text):
{
    "score": 0-100,
    "is_correct": true/false,
    "reasoning": "brief explanation of why this score was given",
    "feedback": "constructive feedback to help the student improve"
}
"""
        return prompt

    async def generate_mcq_choices(self, payload: GenerateMcqChoicesRequest) -> GenerateMcqChoicesResponse:
        prompt = f"""You are an expert exam question writer. Given a question and its correct answer, generate exactly 3 plausible but INCORRECT distractor answers.

QUESTION: {payload.question_stem}

CORRECT ANSWER: {payload.correct_answer}

Generate 3 distractors that:
- Are plausible and related to the topic
- Are clearly wrong compared to the correct answer
- Are concise (similar length to the correct answer)
- Do NOT include the correct answer

Respond in JSON format ONLY:
{{
    "distractors": ["distractor1", "distractor2", "distractor3"]
}}"""

        async def _ai_call():
            async with ai_provider.session(system_prompt="You are an expert exam question writer.") as session:
                return await ai_provider.generate(
                    prompt=prompt,
                    session=session,
                    temperature=0.7,
                    user_priority=UserPriority.REGULAR
                )

        response_text = await task_queue_manager.submit_and_wait(
            QueueType.AI_GENERATION, _ai_call, UserPriority.REGULAR
        )

        try:
            json_str = response_text.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            result = json.loads(json_str)
            distractors = result.get("distractors", [])[:3]
        except Exception:
            distractors = ["None of the above", "Cannot be determined", "Insufficient information"]

        while len(distractors) < 3:
            distractors.append("None of the above")

        all_choices = [payload.correct_answer] + distractors[:3]
        random.shuffle(all_choices)
        correct_index = all_choices.index(payload.correct_answer)

        return GenerateMcqChoicesResponse(choices=all_choices, correct_answer_index=correct_index)

    def _parse_ai_evaluation(self, response_text: str, payload: EvaluateAnswerRequest) -> EvaluateAnswerResponse:
        try:
            json_str = response_text.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            result = json.loads(json_str)

            # parse score (0-100); fall back to deriving from confidence if missing
            raw_score = result.get("score")
            if raw_score is not None:
                try:
                    score = int(round(float(str(raw_score).strip().rstrip('%'))))
                except Exception:
                    score = 0
            else:
                # legacy fallback: derive score from is_correct + confidence
                raw_conf = result.get("confidence", 0.0)
                try:
                    conf = float(str(raw_conf).strip().rstrip('%'))
                    if conf > 1.0:
                        conf /= 100.0
                except Exception:
                    conf = 0.0
                score = int(round(conf * 100))

            score = max(0, min(100, score))

            # is_correct: trust the model but enforce score < 60 → false
            is_correct_raw = result.get("is_correct", False)
            if isinstance(is_correct_raw, str):
                is_correct = is_correct_raw.strip().lower() in ("true", "yes", "1", "correct")
            else:
                is_correct = bool(is_correct_raw)

            if score < 60:
                is_correct = False
            elif score >= 60:
                is_correct = True

            confidence = score / 100.0

            return EvaluateAnswerResponse(
                is_correct=is_correct,
                score=score,
                confidence=confidence,
                reasoning=result.get("reasoning", "Evaluation completed"),
                feedback=result.get("feedback", "No additional feedback")
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning("AI evaluation parse failed: %s | raw: %.200s", e, response_text)
            raise ValueError("AI_PARSE_FAILED")
