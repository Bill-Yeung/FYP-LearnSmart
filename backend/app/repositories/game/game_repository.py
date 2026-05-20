# backend/app/repositories/game/game_repository.py
import json
import logging
from typing import Any, Optional

import asyncpg

from app.models.game import GameTemplateResponse, TemplateCreate, QuizEnabled
from app.repositories.game.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class GameRepository(BaseRepository):
   
    def __init__(self, db: asyncpg.Connection):
        super().__init__(db=db, table_name="script_templates", deleted_at_column="deleted_at")

    async def create_template(
        self,
        payload: TemplateCreate,
    ) -> GameTemplateResponse:
 

        status_value = payload.status or "draft"

        name = payload.basic.name
        description = payload.basic.description
        target_level = payload.basic.target_level

        difficulty_rules = json.dumps({
            "puzzle_mcq": payload.difficulty.puzzle_mcq,
            "puzzle_sorting": payload.difficulty.puzzle_sorting,
            "puzzle_fill": payload.difficulty.puzzle_fill,
        })

        if isinstance(payload.quiz, QuizEnabled) and payload.quiz.enabled:
            has_quiz = True
            quiz_source = payload.quiz.source
            question_set_payload = {
                "mode": payload.quiz.mode,
                "count_range": payload.quiz.count_range,
                "pass_score": payload.quiz.pass_score,
                "manual_config": (
                    payload.quiz.manual_config.model_dump()
                    if payload.quiz.manual_config is not None
                    else None
                ),
            }
            question_set = json.dumps(question_set_payload)
        else:
            has_quiz = False
            quiz_source = "doc_only"
            question_set = None

        subject_code = getattr(payload.content, "subject_code", None)

        data = {
            "subject_code": subject_code,
            "name": name,
            "description": description,
            "template_version": 1,
            "status": status_value,
            "difficulty_rules": difficulty_rules,
            "hasquiz": has_quiz,
            "target_level": target_level,
            "quizsource": quiz_source,
            "questionset": question_set,
        }

        row = await self.create(
            data=data,
            returning=[
                "id",
                "template_version AS version",
                "status AS template_status",
                "created_at",
                "updated_at",
            ],
        )

        return GameTemplateResponse(
            id=str(row["id"]),
            version=row["version"],
            status=row["template_status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            basic=payload.basic,
            content=payload.content,
            difficulty=payload.difficulty,
            quiz=payload.quiz,
        )

    async def list_templates(self) -> list[dict[str, Any]]:
        query = "SELECT * FROM templates_with_subjects ORDER BY updated_at DESC, created_at DESC"

        rows = await self.db.fetch(query)
        return [dict(row) for row in rows]
    
    async def copyTemplate(self, data: dict) -> None:
        await self.create(data=data)
        return None
 
    async def update_template(self, template_id: str, data: dict) -> Optional[asyncpg.Record]:

        set_clauses = [f"{col} = ${i}" for i, col in enumerate(data.keys(), start=1)]
        set_clauses.append(f"template_version = template_version + 1")
        values = list(data.values())
        query = (
            f"UPDATE {self.table_names[0]} "
            f"SET {', '.join(set_clauses)} "
            f"WHERE id = ${len(values) + 1} "
            f"RETURNING id, template_version AS version, status AS template_status, created_at, updated_at"
        )
        return await self.db.fetchrow(query, *values, template_id)
    async def get_by_id(self, template_id: str) -> Optional[dict[str, Any]]:
        if not template_id:
            return None
            
        query = """
        SELECT t.*, s.name AS subject_name
        FROM script_templates t
        LEFT JOIN subjects s ON t.subject_code = s.code
        WHERE t.id = $1
        """
        row = await self.db.fetchrow(query, template_id)
        if not row:
            return None
        return dict(row)
    
    async def get_parsed_document_by_hash(self, hash: str) -> Optional[dict]:

        query = """
        SELECT *
        FROM parsed_documents
        WHERE document_hash = $1 AND deleted_at IS NULL
        """
        document = await self.db.fetchrow(query, hash)
        
        if not document:
            return None
        
        result = dict(document)

        for field in ["summary", "modules", "chunks", "concepts", "relationships"]:
            if field in result and result[field] is not None:
                if isinstance(result[field], str):
                    try:
                        result[field] = json.loads(result[field])
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning(f"Failed to parse {field} for hash {hash}: {e}")
                        result[field] = [] if field in ["chunks", "concepts", "relationships"] else {}
        
        return result

    
    async def insert_parsed_document(self, document_data: dict):
           query = """
            INSERT INTO parsed_documents (
                document_name, document_hash, modules, summary, source_id, raw_text
            ) VALUES (
                $1, $2::varchar, $3, $4, (SELECT id FROM sources WHERE checksum = $5::varchar LIMIT 1), $6
            )
            RETURNING id
            """
           return await self.db.fetchval(
                query,
                document_data["document_name"],
                document_data["document_hash"],
                document_data["modules"],
                document_data["summary"],
                document_data.get("checksum"),
                document_data["raw_text"]
           )
    async def save_generated_script(self, request, script_data: dict, user_id: Optional[str] = None) -> str:
        query = """
        update parsed_documents
        set chunks = $1::jsonb, concepts = $2::jsonb, relationships = $3::jsonb
        where document_hash = $4
        RETURNING id
        """
        await self.db.fetchval(
            query,
            json.dumps(request.chunks),
            json.dumps(request.concepts),
            json.dumps(request.relationships),
            request.document_hash,
        )

        script_title = script_data.get("title", "Untitled Script")

        target_lvl = 'standard'
        subject_code = None
        template_id_val = request.selectedTemplateId if request.selectedTemplateId else None
        
        if template_id_val:
            template_record = await self.db.fetchrow(
                "SELECT * FROM script_templates WHERE id = $1",
                template_id_val
            )
            if template_record and template_record['target_level']:
                target_lvl = template_record['target_level']
                subject_code = template_record['subject_code'] if 'subject_code' in template_record else None
                
        query = """
        insert into scripts (
            document_hash, outline_json, module_name, title,
            template_id, target_level, user_id, subject_code
        )
        values ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
        RETURNING id
        """
        module_name = request.selectedScope.strip() if request.selectedScope else 'All Concepts'
        if module_name.lower() == 'full':
            module_name = 'All Concepts'

        return await self.db.fetchval(
            query,
            request.document_hash,
            json.dumps(script_data),
            module_name,
            script_title,
            template_id_val,
            target_lvl,
            user_id,
            subject_code
        )
    async def get_by_moduleName(
        self, 
        module_name: str, 
        document_hash: str,
        template_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Optional[dict[str, Any]]:
        query = """
            SELECT *
            FROM scripts
            WHERE module_name = $1 AND document_hash = $2
        """
        params = [module_name, document_hash]
        
        if template_id:
            params.append(template_id)
            query += f" AND template_id = ${len(params)}"
        else:
            query += " AND template_id IS NULL"
            
        if user_id:
            params.append(user_id)
            query += f" AND user_id = ${len(params)}"
            
        query += " ORDER BY created_at DESC LIMIT 1"
        
        row = await self.db.fetchrow(query, *params)
        if not row:
            return None
        return dict(row)

    async def get_script_by_id(self, script_id: str) -> Optional[dict[str, Any]]:
        """Get a script by ID from the scripts table."""
        query = """
        SELECT id, title, status, outline_json, created_at
        FROM scripts
        WHERE id = $1
        """
        row = await self.db.fetchrow(query, script_id)
        if not row:
            return None
        return dict(row)

    async def list_my_scripts_rows(self, user_id: Optional[str] = None) -> list[asyncpg.Record]:

        query = """
            SELECT
                s.id AS script_id,
                s.document_hash,
                pd.document_name,
                s.created_at,
                s.completed_at,
                s.module_name,
                s.target_level,
                s.status AS script_status,
                s.outline_json AS script_json,
                s.subject_code,
                up.current_scene_id AS current_scene_id,
                up.completed_scenes AS completed_scenes,
                up.unlocked_clues AS unlocked_clues,
                up.collected_evidence AS collected_evidence,
                up.answered_questions AS answered_questions,
                up.correct_answers AS correct_answers,
                up.wrong_answers AS wrong_answers,
                up.updated_at AS progress_updated_at,
                COALESCE(last_answers.last_answer_at, up.updated_at) AS last_activity_at,
                COALESCE(
                    CASE
                        WHEN jsonb_typeof(s.outline_json->'scenes') = 'array' THEN jsonb_array_length(s.outline_json->'scenes')
                        WHEN jsonb_typeof(s.outline_json) = 'array' THEN jsonb_array_length(s.outline_json)
                        ELSE 0
                    END,
                    0
                ) AS total_scene_count,
                COALESCE(
                    CASE WHEN jsonb_typeof(up.completed_scenes) = 'array' THEN jsonb_array_length(up.completed_scenes) ELSE 0 END,
                    0
                ) AS completed_scene_count,
                COALESCE(
                    CASE WHEN jsonb_typeof(up.answered_questions) = 'array' THEN jsonb_array_length(up.answered_questions) ELSE 0 END,
                    0
                ) AS answered_question_count,
                COALESCE(
                    CASE WHEN jsonb_typeof(s.outline_json->'questions') = 'array' THEN jsonb_array_length(s.outline_json->'questions') ELSE 0 END,
                    0
                ) AS total_question_count,
                COALESCE(up.updated_at, s.created_at) AS updated_at
            FROM scripts s
            LEFT JOIN parsed_documents pd
              ON pd.document_hash = s.document_hash
             AND pd.deleted_at IS NULL
           
        """

        params = []
        if user_id:
            params.append(user_id)
            query += "LEFT JOIN user_progress up ON up.script_id = s.id AND up.user_id = $1\n"
            query += "LEFT JOIN LATERAL (SELECT MAX(created_at) AS last_answer_at FROM user_answers ua WHERE ua.user_id = $1 AND ua.script_id = s.id) last_answers ON TRUE\n"
            query += "WHERE s.user_id = $1\n"
            query += "ORDER BY s.created_at DESC NULLS LAST, s.id DESC"
            return await self.db.fetch(query, *params)

        query += "LEFT JOIN user_progress up ON FALSE\n"
        query += "LEFT JOIN LATERAL (SELECT NULL::timestamp AS last_answer_at) last_answers ON TRUE\n"
        query += "ORDER BY s.created_at DESC NULLS LAST, s.id DESC"
        return await self.db.fetch(query)

    async def delete_script_by_id(self, script_id: str, user_id: Optional[str] = None) -> bool:

        if user_id:
            query = "UPDATE scripts SET status = 'abandoned' WHERE id = $1 AND user_id = $2"
            result = await self.db.execute(query, script_id, user_id)
        else:
            query = "UPDATE scripts SET status = 'abandoned' WHERE id = $1"
            result = await self.db.execute(query, script_id)
        try:
            affected = int(str(result).split()[-1])
        except Exception:
            affected = 0
        return affected > 0
    
    async def delete_scripts_by_ids(self, script_ids: list[str], user_id: Optional[str] = None) -> int:
        if not script_ids:
            return 0
        if user_id:
            query = "UPDATE scripts SET status = 'abandoned' WHERE id = ANY($1::uuid[]) AND user_id = $2"
            result = await self.db.execute(query, script_ids, user_id)
        else:
            query = "UPDATE scripts SET status = 'abandoned' WHERE id = ANY($1::uuid[])"
            result = await self.db.execute(query, script_ids)
        try:
            affected = int(str(result).split()[-1])
        except Exception:
            affected = 0
        return affected
    
    async def update_parsed_json(self, document_hash: str, parsed_json_str: str) -> None:
        query = """
        UPDATE parsed_documents
        SET parsed_json = $1::jsonb
        WHERE document_hash = $2
        """
        await self.db.execute(query, parsed_json_str, document_hash)



