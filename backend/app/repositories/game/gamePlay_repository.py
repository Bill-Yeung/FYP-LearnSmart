import json
import logging
from typing import Any, Dict, Optional, List

import asyncpg

from app.models.game import GameTemplateResponse, TemplateCreate, QuizEnabled
from app.repositories.game.base_repository import BaseRepository

logger = logging.getLogger(__name__)

class GamePlayRepository(BaseRepository):
   
    def __init__(self, db: asyncpg.Connection):
        super().__init__(db=db, table_name=["parsed_documents","scripts"], deleted_at_column=None)

    async def get_script_by_id(self, script_id: str) -> Optional[Dict[str, Any]]:

        query = """
            SELECT s.*, pd.parsed_json AS doc_parsed_json, pd.document_name AS document_name
            FROM scripts s
            LEFT JOIN parsed_documents pd ON s.document_hash = pd.document_hash
            WHERE s.id = $1
        """
        row = await self.db.fetchrow(query, script_id)
        if not row:
            return None
        return dict(row)

    
    def _parse_progress_row(self, row: dict) -> dict:
        import json
        if not row:
            return None
        res = dict(row)
        for col in ["completed_scenes", "unlocked_clues", "collected_evidence", "answered_questions", "correct_answers", "wrong_answers"]:
            if col in res and isinstance(res[col], str):
                try:
                    res[col] = json.loads(res[col])
                except Exception:
                    pass
        return res

    async def get_user_progress(self, user_id: str, script_id: str) -> Optional[Dict[str, Any]]:
       
        query = """
            SELECT * FROM user_progress 
            WHERE user_id = $1 AND script_id = $2
        """
        row = await self.db.fetchrow(query, user_id, script_id)
        return self._parse_progress_row(dict(row)) if row else None
    
    async def get_user_learn_later(self, user_id: str, script_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        query = """
            SELECT 
                ull.knowledge_id as "knowledgeId",
                ull.script_id as "scriptId",
                ull.source_scene_id as "sourceSceneId",
                ull.source_question_id as "sourceQuestionId",
                ull.added_at as "addedAt",
                ull.is_learned as "isLearned",
                ull.learned_at as "learnedAt",
                ull.personal_notes as "personalNotes",
                pd.parsed_json as "docParsedJson",
                s.outline_json as "scriptOutlineJson",
                s.title as "scriptTitle",
                s.module_name as "moduleName",
                s.subject_code as "subject_code",
                pd.document_name as "documentName"
            FROM user_learn_later ull
            JOIN scripts s ON ull.script_id = s.id
            LEFT JOIN parsed_documents pd ON s.document_hash = pd.document_hash
            WHERE ull.user_id = $1
        """
        params = [user_id]
        if script_id:
            query += " AND ull.script_id = $2"
            params.append(script_id)
            
        query += " ORDER BY ull.added_at DESC"
        
        rows = await self.db.fetch(query, *params)
        if not rows:
            return {"learn_later_items": []}
        return {"learn_later_items": [dict(r) for r in rows]}
    
    async def add_to_learn_later(
        self, user_id: str, script_id: str, knowledge_id: str, 
        source_scene_id: Optional[str] = None, source_question_id: Optional[str] = None
    ) -> bool:
        query = """
            INSERT INTO user_learn_later 
            (user_id, knowledge_id, script_id, source_scene_id, source_question_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, script_id, knowledge_id) 
            DO UPDATE SET 
                is_learned = FALSE,
                added_at = NOW(),
                updated_at = NOW(),
                source_scene_id = EXCLUDED.source_scene_id,
                source_question_id = EXCLUDED.source_question_id
            RETURNING id
        """
        result = await self.db.fetchval(query, user_id, knowledge_id, script_id, source_scene_id, source_question_id)
        return bool(result)

    async def mark_as_mastered(self, user_id: str, script_id: str, knowledge_id: str) -> bool:
        query = """
            UPDATE user_learn_later
            SET is_learned = TRUE, learned_at = NOW(), mastery_level = 'mastered', updated_at = NOW()
            WHERE user_id = $1 AND script_id = $2 AND knowledge_id = $3
            RETURNING id
        """
        result = await self.db.fetchval(query, user_id, script_id, knowledge_id)
        return bool(result)

    async def update_learning_progress(
        self, user_id: str, script_id: str, knowledge_id: str,
        time_spent_minutes: int = 0,
        quiz_attempts: int = 0,
        quiz_passed: bool = False,
        ai_content_viewed: Dict[str, bool] = None,
        personal_notes: str = None,
        mastery_level: str = None
    ) -> bool:

        if ai_content_viewed is None:
            ai_content_viewed = {}
            
        query = """
            INSERT INTO user_learn_later (
                user_id, script_id, knowledge_id,
                time_spent_minutes, quiz_attempts, quiz_passed_at,
                ai_content_viewed, personal_notes, mastery_level,
                updated_at
            )
            VALUES (
                $1, $2, $3,
                $4, $5, 
                CASE WHEN $6::boolean THEN NOW() ELSE NULL END,
                $7::jsonb, $8, COALESCE($9, 'unfamiliar'),
                NOW()
            )
            ON CONFLICT (user_id, script_id, knowledge_id)
            DO UPDATE SET
                time_spent_minutes = user_learn_later.time_spent_minutes + EXCLUDED.time_spent_minutes,
                quiz_attempts = user_learn_later.quiz_attempts + EXCLUDED.quiz_attempts,
                quiz_passed_at = COALESCE(EXCLUDED.quiz_passed_at, user_learn_later.quiz_passed_at),
                ai_content_viewed = user_learn_later.ai_content_viewed || EXCLUDED.ai_content_viewed,
                personal_notes = CASE WHEN $8 IS NOT NULL THEN EXCLUDED.personal_notes ELSE user_learn_later.personal_notes END,
                mastery_level = CASE WHEN $9 IS NOT NULL THEN EXCLUDED.mastery_level ELSE user_learn_later.mastery_level END,
                updated_at = NOW()
            RETURNING id
        """
        
        result = await self.db.fetchval(
            query,
            user_id,
            script_id,
            knowledge_id,
            time_spent_minutes,
            quiz_attempts,
            quiz_passed,
            json.dumps(ai_content_viewed),
            personal_notes,
            mastery_level
        )
        return bool(result)
    
    async def get_learning_progress(self, user_id: str, script_id: str, knowledge_id: str) -> Optional[Dict[str, Any]]:

        query = """
            SELECT 
                knowledge_id as "knowledgeId",
                time_spent_minutes as "timeSpentMinutes",
                quiz_attempts as "quizAttempts",
                quiz_passed_at as "quizPassedAt",
                ai_content_viewed as "aiContentViewed",
                personal_notes as "personalNotes",
                mastery_level as "masteryLevel",
                added_at as "addedAt",
                updated_at as "updatedAt"
            FROM user_learn_later
            WHERE user_id = $1 AND script_id = $2 AND knowledge_id = $3
        """
        row = await self.db.fetchrow(query, user_id, script_id, knowledge_id)
        return self._parse_progress_row(dict(row)) if row else None

    async def save_user_answer(self, user_id: str, script_id: str, answer_data: Dict[str, Any]) -> None:
        query = """
            INSERT INTO user_answers (
                user_id, script_id, question_id, scene_id, knowledge_id,
                selected_option, sequencing_order, is_correct, attempt_number,
                hints_used, mastery_earned, study_session_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        """
        await self.db.execute(
            query,
            user_id,
            script_id,
            answer_data.get("questionId", ""),
            answer_data.get("sceneId", ""),
            answer_data.get("knowledgeId", ""),
            answer_data.get("selectedOption"),
            json.dumps(answer_data.get("sequencingOrder")) if answer_data.get("sequencingOrder") else None,
            answer_data.get("isCorrect", False),
            answer_data.get("attemptNumber", 1),
            answer_data.get("hintsUsed", 0),
            answer_data.get("masteryEarned", 0),
            answer_data.get("studySessionId") or answer_data.get("study_session_id")
        )

    async def get_latest_active_script_id(self, user_id: str) -> str:
        query = """
            SELECT script_id FROM user_progress
            WHERE user_id = $1
            ORDER BY updated_at DESC LIMIT 1
        """
        return await self.db.fetchval(query, user_id)

    async def get_parsed_document_by_hash(self, document_hash: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT * FROM parsed_documents
            WHERE document_hash = $1
        """
        row = await self.db.fetchrow(query, document_hash)
        if not row:
            return None
        return dict(row)
    
    async def get_clue_ids_by_script(self, script_id: str) -> List[str]:
        script = await self.get_script_by_id(script_id)
        if not script:
            return []
        
        outline_json_str = script.get("outline_json")
        if not outline_json_str:
            return []
        
        try:
            script_data = json.loads(outline_json_str)
            clues = script_data.get("clues", [])
            return [clue.get("clueId", "") for clue in clues if clue.get("clueId")]
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse outline_json for script {script_id}")
            return []
    
    async def get_scenes_from_script_outline(self, script_id: str) -> List[Dict[str, Any]]:
        script = await self.get_script_by_id(script_id)
        if not script:
            return []
        
        outline_json_str = script.get("outline_json")
        if not outline_json_str:
            return []
        
        try:
            script_data = json.loads(outline_json_str)
            return script_data.get("scenes", [])
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse outline_json for script {script_id}")
            return []
    
    async def get_user_progress_by_script(self, user_id: str, script_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT * FROM user_progress
            WHERE user_id = $1 AND script_id = $2
        """
        row = await self.db.fetchrow(query, user_id, script_id)
        return self._parse_progress_row(dict(row)) if row else None
    
    async def get_user_answers_by_script_id(self, user_id: str, script_id: str) -> List[Dict[str, Any]]:
        query = """
            SELECT 
                id, user_id, script_id, question_id, scene_id, knowledge_id,
                selected_option, sequencing_order, is_correct, attempt_number,
                hints_used, mastery_earned, study_session_id, timestamp, created_at
            FROM user_answers
            WHERE user_id = $1 AND script_id = $2
            ORDER BY created_at DESC
        """
        rows = await self.db.fetch(query, user_id, script_id)
        logger.info(f"[get_user_answers_by_script_id] Found {len(rows)} answers for user {user_id}, script {script_id}")
        return [dict(row) for row in rows]
    
    async def create_or_update_user_progress(self, user_id: str, script_id: str, progress_data: Dict[str, Any]) -> Dict[str, Any]:
        query = """
            INSERT INTO user_progress (user_id, script_id, current_scene_id, completed_scenes, 
                unlocked_clues, collected_evidence, answered_questions, correct_answers, wrong_answers, study_session_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id, script_id) 
            DO UPDATE SET
                current_scene_id = $3,
                completed_scenes = $4,
                unlocked_clues = $5,
                collected_evidence = $6,
                answered_questions = $7,
                correct_answers = $8,
                wrong_answers = $9,
                study_session_id = $10,
                updated_at = NOW()
            RETURNING *
        """
        row = await self.db.fetchrow(
            query,
            user_id,
            script_id,
            progress_data.get("current_scene_id", ""),
            json.dumps(progress_data.get("completed_scenes", [])),
            json.dumps(progress_data.get("unlocked_clues", [])),
            json.dumps(progress_data.get("collected_evidence", [])),
            json.dumps(progress_data.get("answered_questions", [])),
            json.dumps(progress_data.get("correct_answers", [])),
            json.dumps(progress_data.get("wrong_answers", [])),
            progress_data.get("study_session_id") or progress_data.get("studySessionId")
        )
        return self._parse_progress_row(dict(row)) if row else {}
    
    async def get_scene_data_from_outline(self, script_id: str, scene_id: str) -> Optional[Dict[str, Any]]:

        script = await self.get_script_by_id(script_id)
        if not script:
            return None
        
        outline_json_str = script.get("outline_json")
        if not outline_json_str:
            return None
        
        try:
            script_data = json.loads(outline_json_str)
            scenes = script_data.get("scenes", [])
            for scene in scenes:
                if scene.get("sceneId") == scene_id:
                    return scene
            return None
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse outline_json for script {script_id}")
            return None
    
    async def reset_user_progress(self, user_id: str, script_id: str) -> None:
        async with self.db.transaction():

            await self.db.execute(
                "UPDATE user_study_sessions SET ended_at = NOW() WHERE user_id = $1 AND script_id = $2 AND ended_at IS NULL", 
                user_id, script_id
            )
            await self.db.execute("DELETE FROM user_progress WHERE user_id = $1 AND script_id = $2", user_id, script_id)

    async def get_active_study_session(self, user_id: str, script_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT * FROM user_study_sessions
            WHERE user_id = $1 AND script_id = $2 AND ended_at IS NULL
            ORDER BY started_at DESC LIMIT 1
        """
        row = await self.db.fetchrow(query, user_id, script_id)
        return self._parse_progress_row(dict(row)) if row else None

    async def get_study_session_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT * FROM user_study_sessions
            WHERE id = $1
        """
        row = await self.db.fetchrow(query, session_id)
        return self._parse_progress_row(dict(row)) if row else None

    async def create_study_session(self, user_id: str, script_id: str, session_type: str = "study") -> Optional[Dict[str, Any]]:
        query = """
            INSERT INTO user_study_sessions (user_id, script_id, session_type)
            VALUES ($1, $2, $3)
            RETURNING *
        """
        row = await self.db.fetchrow(query, user_id, script_id, session_type)
        return self._parse_progress_row(dict(row)) if row else None

    async def end_study_session(self, session_id: str) -> None:
        query = """
            UPDATE user_study_sessions
            SET ended_at = NOW(), updated_at = NOW()
            WHERE id = $1
        """
        await self.db.execute(query, session_id)

    async def get_user_activity_last_7_days(self, user_id: str) -> List[Dict[str, Any]]:
        query = """
            SELECT created_at, timestamp 
            FROM user_answers
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
        """
        rows = await self.db.fetch(query, user_id)
        return [dict(row) for row in rows]

    async def save_game_issue(self, user_id: str, script_id: str, question_id: str, issue_type: str, user_comment: str):
        query = """
            INSERT INTO game_issues (user_id, script_id, question_id, issue_type, user_comment)
            VALUES ($1, $2, $3, $4, $5)
        """
        await self.db.execute(query, user_id, script_id, question_id, issue_type, user_comment)
