from __future__ import annotations
import json
import logging
from typing import Any, Optional
import asyncpg
from openai import OpenAI
from app.models.game import ScriptRequest, TemplateCreate, GameTemplateResponse
from app.models.document import ParsedJsonResponse
from app.repositories.game.game_repository import GameRepository
from app.repositories.game.subject_repository import SubjectRepository
from app.services.ai.prompts import get_prompt, format_hints_section
from app.services.game.script_pipeline import ScriptGenerationPipeline

logger = logging.getLogger(__name__)

class GameService:
    def __init__(self, db: asyncpg.Connection) -> None:
        self.db = db
        self.template_repo = GameRepository(db)
        self.subject_repo = SubjectRepository(db)

    async def _ensure_subject(self, payload: TemplateCreate) -> TemplateCreate:
        subject_name = payload.content.subject_name or payload.content.subject
        if not subject_name:
            return payload

        subject_code = payload.content.subject_code
        if not subject_code and not subject_name:
            return payload

        existing = await self.subject_repo.get_by_code(subject_code)
        if existing:
            payload.content.subject_code = existing["code"]
            if subject_name and existing.get("name") != subject_name:
                await self.subject_repo.update_by_id(
                    record_id=existing["id"],
                    data={"name": subject_name},
                )
            return payload

        created = await self.subject_repo.create_subject(
            code=subject_code,
            name=subject_name or subject_code,
        )
        payload.content.subject_code = created["code"]
        return payload

    async def create_template(self, payload: TemplateCreate) -> GameTemplateResponse:
        payload = await self._ensure_subject(payload)
        return await self.template_repo.create_template(payload=payload)

    async def list_templates(self) -> list[dict[str, object]]:
        return await self.template_repo.list_templates()

    def _calculate_progress_percent(
        self,
        answered_question_count: int,
        total_question_count: int,
        completed_scene_count: int,
        total_scenes: int,
    ) -> int:
        if total_question_count > 0:
            return min(100, int(round((answered_question_count / total_question_count) * 100)))
        if total_scenes > 0:
            return min(100, int(round((completed_scene_count / total_scenes) * 100)))
        return 0


    def _parse_json_array_len(self, data) -> int:
        if isinstance(data, list):
            return len(data)
        if not data:
            return 0
        import json
        if isinstance(data, str):
            try:
                parsed = json.loads(data)
                while isinstance(parsed, str):
                    try:
                        parsed = json.loads(parsed)
                    except json.JSONDecodeError:
                        break
                if isinstance(parsed, list):
                    return len(parsed)
            except Exception:
                pass
        return 0

    async def list_my_scripts(self, user_id: Optional[str] = None) -> dict[str, Any]:
        rows = await self.template_repo.list_my_scripts_rows(user_id)
        scripts: list[dict[str, Any]] = []

        for r in rows:
            script = r["script_json"]

            if isinstance(script, str):
                try:
                    script = json.loads(script)
                except Exception:
                    script = {"raw": script}

            title = None
            if isinstance(script, dict):
                title = script.get("title")
            elif isinstance(script, list) and script and isinstance(script[0], dict):
                title = script[0].get("title")

            completed_scenes = r.get("completed_scenes") or []
            total_scenes = r.get("total_scene_count") or 0
            
            completed_scene_count = self._parse_json_array_len(r.get("completed_scenes"))
            answered_question_count = self._parse_json_array_len(r.get("answered_questions"))
            total_question_count = r.get("total_question_count") or 0

            pass

            if isinstance(total_question_count, str):
                try:
                    total_question_count = int(total_question_count)
                except Exception:
                    total_question_count = 0
            if isinstance(answered_question_count, str):
                try:
                    answered_question_count = int(answered_question_count)
                except Exception:
                    answered_question_count = 0

            if total_scenes == 0 and isinstance(script, dict):
                scenes = script.get("scenes") or []
                if isinstance(scenes, list):
                    total_scenes = len(scenes)

            progress_percent = self._calculate_progress_percent(
                answered_question_count=answered_question_count,
                total_question_count=total_question_count,
                completed_scene_count=completed_scene_count,
                total_scenes=total_scenes,
            )

            status = str(r.get("script_status") or "active")
            if status == "completed" or (total_scenes > 0 and completed_scene_count >= total_scenes):
                display_status = "Completed"
            elif status == "abandoned":
                display_status = "Abandoned"
            elif status == "draft":
                display_status = "Draft"
            elif completed_scene_count > 0:
                display_status = "In Progress"
            else:
                display_status = "Not Started"

            last_reviewed_at = r.get("last_activity_at") or r.get("progress_updated_at") or r.get("updated_at") or r.get("created_at")
            if last_reviewed_at and not isinstance(last_reviewed_at, str):
                last_reviewed_at = last_reviewed_at.isoformat()

            scripts.append(
                {
                    "script_id": str(r.get("script_id")) if r.get("script_id") is not None else None,
                    "document_hash": r["document_hash"],
                    "document_name": r.get("document_name"),
                    "created_at": r.get("created_at"),
                    "updated_at": r.get("updated_at"),
                    "module_name": r.get("module_name"),
                    "target_level": r.get("target_level"),
                    "title": title,
                    "script": script,
                    "subject_code": r.get("subject_code"),
                    "status": display_status,
                    "rawStatus": status,
                    "progressPercent": progress_percent,
                    "completedSceneCount": completed_scene_count,
                    "totalSceneCount": total_scenes,
                    "lastReviewedAt": last_reviewed_at,
                }
            )

        return {"scripts": scripts, "total": len(scripts)}

    async def delete_template(self, template_id: str) -> None:
        return await self.template_repo.soft_delete_by_id(template_id)

    async def delete_script(self, script_id: str, user_id: Optional[str] = None) -> bool:
        return await self.template_repo.delete_script_by_id(script_id, user_id)
    
    async def delete_scripts(self, script_ids: list[str], user_id: Optional[str] = None) -> int:
        return await self.template_repo.delete_scripts_by_ids(script_ids, user_id)
    
    async def duplicate_template(self, template_id: str) -> GameTemplateResponse:
        original = await self.template_repo.get_by_id(template_id)
        if not original:
            raise ValueError("Template not found")

        new_data = {
            "name": f"{original['name']} (Copy)",
            "description": original["description"],
            "target_level": original["target_level"],
            "difficulty_rules": original["difficulty_rules"],
            "hasquiz": original["hasquiz"],
            "quizsource": original["quizsource"],
            "questionset": original["questionset"],
            "subject_code": original["subject_code"],
        }

        return await self.template_repo.copyTemplate(new_data)
    
    async def get_template(self, template_id: str) -> GameTemplateResponse:
        template = await self.template_repo.get_by_id(template_id)
        if not template:
            raise ValueError("Template not found")
        
        data = dict(template)

        data["basic"] = {
            "name": template.get("name", ""),
            "target_level": template.get("target_level", "standard"),
            "description": template.get("description", ""),
        }

        data["content"] = {
            "source": template.get("content_source", "system"),
            "subject_code": template.get("subject_code"),
            "subject_name": template.get("subject_name"),
        }

        data["difficulty"] = {"easy_max": 6, "medium_max": 12, "hard_rule": "long_script"}
        if template.get("difficulty_rules"):
            try:
                data["difficulty"].update(json.loads(template["difficulty_rules"]))
            except Exception:
                pass

        if template.get("hasquiz"):
            quiz = {"enabled": True}
            if template.get("questionset"):
                try:
                    quiz.update(json.loads(template["questionset"]))
                except Exception:
                    pass
            quiz["source"] = template.get("quizsource", "doc_ai")
            data["quiz"] = quiz
        else:
            data["quiz"] = {"enabled": False}

        response_data = {
            "id": str(template["id"]),
            "version": template["template_version"],
            "status": template["status"],
            "created_at": template["created_at"],
            "updated_at": template["updated_at"],
            "basic": data["basic"],
            "content": data["content"],
            "difficulty": data["difficulty"],
            "quiz": data["quiz"],
        }
        return GameTemplateResponse.parse_obj(response_data)

    async def update_template(self, template_id: str, payload: TemplateCreate) -> GameTemplateResponse:
        payload = await self._ensure_subject(payload)
        data = payload.to_db_dict()
        row = await self.template_repo.update_template(template_id, data)
        if not row:
            raise ValueError("Update failed or template not found")
        
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
    async def generate_script(self, request: ScriptRequest, user_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        scope_name = (request.selectedScope or "all concepts").strip()
        if scope_name.lower() == "full":
            scope_name = "all concepts"

        selected_scope = await self.template_repo.get_by_moduleName(
            scope_name,
            request.document_hash,
            template_id=request.selectedTemplateId,
            user_id=user_id
        )
        if selected_scope is not None:
            outline_json_str = selected_scope.get("outline_json", "{}")
            outline_json_str = outline_json_str.replace('"fill_in_the_blank"', '"fill_in_blank"')
            script = json.loads(outline_json_str)
            script_id = selected_scope.get("id")
            return {"scriptId": script_id, "script": script}

        chunks = json.loads(request.chunks)
        concepts = json.loads(request.concepts)
        relationships = json.loads(request.relationships)
        concept_chunk_mapping = json.loads(request.concept_chunk_mapping) if request.concept_chunk_mapping else []
        template = None
        if request.selectedTemplateId:
            template = await self.template_repo.get_by_id(request.selectedTemplateId)
        targetLevel = template["target_level"] if template and template.get("target_level") else 'standard'
        
        diff_rules = {}
        if template and template.get("difficulty_rules"):
            dr = template.get("difficulty_rules")
            if isinstance(dr, str):
                try:
                    diff_rules = json.loads(dr)
                except Exception:
                    diff_rules = {}
            elif isinstance(dr, dict):
                diff_rules = dr
        
        req_texts = []
        if diff_rules.get("puzzle_mcq"):
            req_texts.append(f"- Multiple Choice Questions (type: 'multiple_choice'): {diff_rules['puzzle_mcq']}")
        if diff_rules.get("puzzle_sorting"):
            req_texts.append(f"- Sequencing/Sorting Questions (type: 'sequencing'): {diff_rules['puzzle_sorting']}")
        if diff_rules.get("puzzle_fill"):
            req_texts.append(f"- Fill in the Blank Questions (type: 'fill_in_blank'): {diff_rules['puzzle_fill']}")
        
        puzzle_req_str = "\n".join(req_texts) if req_texts else "- Provide a balanced mix of basic and advanced questions."

        client = OpenAI(
            api_key="sk-6e27b47c3d40410d8a0af17ae75763bf",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        prompt = get_prompt("generate_script")
        data = {
            '{concepts_detail}': json.dumps(concepts, ensure_ascii=False),
            '{chunks}': json.dumps(chunks, ensure_ascii=False),
            '{relationships}': json.dumps(relationships, ensure_ascii=False),
            '{concept_chunk_mapping}': json.dumps(concept_chunk_mapping, ensure_ascii=False),
            '{target_level}': targetLevel,
            '{scene_preference}': 'Indoor',
            '{topic}': scope_name,
            '{num_players}': "3",
            '{puzzle_requirements}': puzzle_req_str
        }
        content = prompt.user_prompt_template
        for key, value in data.items():
            content = content.replace(key, value)

        response = client.chat.completions.create(
            model="qwen-long",
            messages=[{'role': 'user', 'content': content}],

        )
        script_json = response.choices[0].message.content
        script = json.loads(script_json)
        script['has_quiz'] = template["hasquiz"] if template and template.get("hasquiz") else False
        
        if template and template.get("difficulty_rules"):
            diff = template.get("difficulty_rules")
            if isinstance(diff, str):
                try:
                    diff = json.loads(diff)
                except Exception:
                    diff = {}
            if isinstance(diff, dict):
                script['template_difficulty'] = {
                    "puzzle_mcq": diff.get('puzzle_mcq', 0),
                    "puzzle_sorting": diff.get('puzzle_sorting', 0),
                    "puzzle_fill": diff.get('puzzle_fill', 0),
                }
      
        script_id = await self.template_repo.save_generated_script(
            request=request, 
            script_data=script,
            user_id=user_id
        )
 
        return {"scriptId": script_id, "script": script}
    
    async def getChunks(self, document_hash: str) -> Optional[list[dict[str, Any]]]:
        if not document_hash or not document_hash.strip():
            return None
            
        document = await self.template_repo.get_parsed_document_by_hash(document_hash)
        if not document:
            return None
        
        chunks_data = document.get("chunks")
        if not chunks_data:
            return []

        try:
            if isinstance(chunks_data, str):
                parsed = json.loads(chunks_data)
            else:
                parsed = chunks_data
            
            if isinstance(parsed, dict) and 'chunks' in parsed:
                return parsed['chunks'] if isinstance(parsed['chunks'], list) else []
            elif isinstance(parsed, list):
                return parsed
            else:
                return []
        except (json.JSONDecodeError, TypeError) as e:
            logger.error(f"Failed to parse chunks for hash {document_hash}: {e}")
            return []
        
    async def getParsedJson(self, document_hash: str) -> Optional[dict[str, Any]]:

        if not document_hash or not document_hash.strip():
            return None
            
        document = await self.template_repo.get_parsed_document_by_hash(document_hash)
        if not document:
            return None
        
        parsed_json_data = document.get("parsed_json")
        if not parsed_json_data:
            raw_text = document.get("raw_text")
            if raw_text:
                prompt = get_prompt("parsed_document")
                content = prompt.system_prompt.replace("{content}", raw_text)
                client = OpenAI(
                    api_key="sk-6e27b47c3d40410d8a0af17ae75763bf",
                    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                )
                
                max_retries = 2
                parsed_json_data = None
                
                for attempt in range(max_retries):
                    try:
                        logger.info(f"Generating parsed_json for {document_hash}, attempt {attempt+1}")
                        response = client.chat.completions.create(
                            model="qwen3.5-35b-a3b",
                            messages=[{'role': 'user', 'content': content}],
                            response_format={"type": "json_object"}
                        )
                        
                        parsed_json_str = response.choices[0].message.content
                        if not parsed_json_str:
                            raise ValueError("AI returned empty content")
                        raw_dict = json.loads(parsed_json_str)
                        parsed_obj = ParsedJsonResponse.parse_obj(raw_dict)
                        parsed_json_data = parsed_obj.dict()
                        break
                    except Exception as e:
                        logger.warning(f"Attempt {attempt + 1} failed for {document_hash}: {e}")
                        if attempt == max_retries - 1:
                            logger.error(f"All {max_retries} attempts failed for {document_hash}")
                            return None

                if parsed_json_data:
                    await self.template_repo.update_parsed_json(document_hash, json.dumps(parsed_json_data, ensure_ascii=False))
                    return parsed_json_data
                return None
            else:
                return None

        try:
            if isinstance(parsed_json_data, str):
                return json.loads(parsed_json_data)
            elif isinstance(parsed_json_data, dict):
                return parsed_json_data
            else:
                logger.error(f"Unexpected type for parsed_json for hash {document_hash}: {type(parsed_json_data)}")
                return None
        except (json.JSONDecodeError, TypeError) as e:
            logger.error(f"Failed to parse parsed_json for hash {document_hash}: {e}")
            return None

    async def generate_script_pipeline(self, request: ScriptRequest, user_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        scope_name = (request.selectedScope or "all concepts").strip()
        if scope_name.lower() == "full":
            scope_name = "all concepts"

        selected_scope = await self.template_repo.get_by_moduleName(
            scope_name,
            request.document_hash,
            template_id=request.selectedTemplateId,
            user_id=user_id
        )
        if selected_scope is not None:
            outline_json_str = selected_scope.get("outline_json", "{}")
            outline_json_str = outline_json_str.replace('"fill_in_the_blank"', '"fill_in_blank"')
            script = json.loads(outline_json_str)
            script_id = selected_scope.get("id")
            return {"scriptId": script_id, "script": script}

        chunks = json.loads(request.chunks)
        concepts = json.loads(request.concepts)
        relationships = json.loads(request.relationships)
        concept_chunk_mapping = json.loads(request.concept_chunk_mapping) if request.concept_chunk_mapping else []
        template = None
        if request.selectedTemplateId:
            template = await self.template_repo.get_by_id(request.selectedTemplateId)
        targetLevel = template["target_level"] if template and template.get("target_level") else 'standard'
        
        diff_rules = {}
        if template and template.get("difficulty_rules"):
            dr = template.get("difficulty_rules")
            if isinstance(dr, str):
                try:
                    diff_rules = json.loads(dr)
                except Exception:
                    diff_rules = {}
            elif isinstance(dr, dict):
                diff_rules = dr
        
        req_texts = []
        if diff_rules.get("puzzle_mcq"):
            req_texts.append(f"- Multiple Choice Questions (type: 'multiple_choice'): {diff_rules['puzzle_mcq']}")
        if diff_rules.get("puzzle_sorting"):
            req_texts.append(f"- Sequencing/Sorting Questions (type: 'sequencing'): {diff_rules['puzzle_sorting']}")
        if diff_rules.get("puzzle_fill"):
            req_texts.append(f"- Fill in the Blank Questions (type: 'fill_in_blank'): {diff_rules['puzzle_fill']}")
        
        puzzle_req_str = "\n".join(req_texts) if req_texts else "- Provide a balanced mix of basic and advanced questions."

        
        pipeline = ScriptGenerationPipeline()
        
        subject_name = template["subject_name"] if template and template.get("subject_name") else "General subject"
        
        script = await pipeline.generate_full_script(
            subject=subject_name,
            topic=scope_name,
            target_level=targetLevel,
            num_players="3",
            concepts=concepts,
            chunks=chunks,
            puzzle_requirements=puzzle_req_str,
            diff_rules=diff_rules
        )

        script.has_quiz = template["hasquiz"] if template and template.get("hasquiz") else False
        
        if template and template.get("difficulty_rules"):
            diff = template.get("difficulty_rules")
            if isinstance(diff, str):
                try:
                    diff = json.loads(diff)
                except Exception:
                    diff = {}
            if isinstance(diff, dict):
                script.template_difficulty = {
                    "puzzle_mcq": diff.get('puzzle_mcq', 0),
                    "puzzle_sorting": diff.get('puzzle_sorting', 0),
                    "puzzle_fill": diff.get('puzzle_fill', 0),
                }
      
        script_dict = script.model_dump()
        script_id = await self.template_repo.save_generated_script(
            request=request, 
            script_data=script_dict,
            user_id=user_id
        )
 
        return {"scriptId": script_id, "script": script_dict}
