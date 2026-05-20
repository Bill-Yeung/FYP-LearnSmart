from __future__ import annotations
import asyncio
import json
import logging
import asyncpg
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta

from app.repositories.game.gamePlay_repository import GamePlayRepository
from app.models.gamePlay import *
from app.services.ai.provider import ai_provider
from app.services.ai.prompts import get_ask_detective_system_prompt, ASK_DETECTIVE_USER_PROMPT
from app.services.game.studyData_service import StudyDataService

logger = logging.getLogger(__name__)

class GamePlayService:
    def __init__(self, db: asyncpg.Connection) -> None:
        self.db = db
        self.play_repo = GamePlayRepository(db)
        self.study_data_service = StudyDataService(db)
    
    def _normalize_text(self, text: str) -> str:
        if not text:
            return ""
        return (text
                .lower()
                .strip()
                .replace('，', ',').replace('。', '.').replace('；', ';')
                .replace('：', ':').replace('（', '(').replace('）', ')')
                .replace('！', '!').replace('？', '?').replace('"', '"').replace('"', '"')
                .replace(''', "'").replace(''', "'")
                .replace('　', ' ')
                .replace('\u200b', '')
                )
    
    def _edit_distance(self, a: str, b: str) -> int:
        if len(a) == 0:
            return len(b)
        if len(b) == 0:
            return len(a)
        
        dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
        for i in range(len(a) + 1):
            dp[i][0] = i
        for j in range(len(b) + 1):
            dp[0][j] = j
        
        for i in range(1, len(a) + 1):
            for j in range(1, len(b) + 1):
                cost = 0 if a[i - 1] == b[j - 1] else 1
                dp[i][j] = min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                )
        
        return dp[len(a)][len(b)]
    
    def _check_fill_in_blank(
        self, 
        user_answer: str, 
        question: QuestionDTO,
        attempt_number: int
    ) -> tuple[bool, str]:
        normalized_user = self._normalize_text(user_answer)
        
        if not normalized_user:
            return False, "Please provide an answer."
        
        candidates = []
        if question.correctAnswer:
            candidates.append(self._normalize_text(question.correctAnswer))
        if question.acceptableAnswers:
            candidates.extend([self._normalize_text(a) for a in question.acceptableAnswers if a])
        
        candidates = list(set(filter(None, candidates)))
        
        if normalized_user in candidates:
            return True, "Correct!"
        
        if attempt_number >= 2 and candidates:
            best_match = min(candidates, key=lambda c: self._edit_distance(normalized_user, c))
            distance = self._edit_distance(normalized_user, best_match)
            
            allowed_typos = 0
            if len(best_match) <= 3:
                allowed_typos = 0
            elif len(best_match) <= 7:
                allowed_typos = 1
            else:
                allowed_typos = 2
            
            if distance <= allowed_typos:
                return True, f"Correct! (Close match to '{best_match}')"
            
            if distance <= allowed_typos + 1:
                return False, f"Very close! Check your spelling. Hint: '{best_match}'"
        
        return False, "Not quite, try again."
    
    async def get_scene_by_script_and_id(self, script_id: str, scene_id: str) -> Optional[SceneDTO]:
        script = await self.play_repo.get_script_by_id(script_id)
        if not script:
            logger.warning(f"[get_scene_by_script_and_id] Script not found: {script_id}")
            return None
        
        script_data = self._parse_json(script.get("outline_json", "{}"))
        logger.info(f"[get_scene_by_script_and_id] script_data keys: {list(script_data.keys())}")
        
        scene_data = self._extract_scene_from_outline(script_data, scene_id)
        if not scene_data:
            logger.warning(f"[get_scene_by_script_and_id] Scene not found: {scene_id}")
            return None

        logger.info(f"[get_scene_by_script_and_id] Found scene_data: {scene_data.get('sceneId')}")
        scene_question_ids = self._get_question_ids_for_scene(script_data, scene_id)
        logger.info(f"[get_scene_by_script_and_id] scene_question_ids: {scene_question_ids}")
        
        dto = self._build_scene_dto(scene_data, scene_question_ids)
        logger.info(f"[get_scene_by_script_and_id] Final DTO questions: {dto.questions}")
        return dto
    
    def _extract_scene_from_outline(self, script_data: Dict, scene_id: str) -> Optional[Dict]:
       
        scenes = script_data.get("scenes") or []
        for scene in scenes:
            if scene.get("sceneId") == scene_id:
                return scene
        return None

    def _get_question_ids_for_scene(self, script_data: Dict, scene_id: str) -> List[str]:
        
        questions = script_data.get("questions") or []
        
        if not isinstance(questions, list):
            logger.warning(f"[_get_question_ids_for_scene] questions is not a list: {type(questions)}, script_data keys: {list(script_data.keys())}")
            return []
        
        if not questions:
            logger.warning(f"[_get_question_ids_for_scene] questions list is empty")
            return []
        

        matching_questions = []
        for idx, q in enumerate(questions):
            if isinstance(q, dict) and q.get("sceneId") == scene_id:
                question_id = q.get("questionId")
                order = q.get("order", 0)
                

                if not isinstance(order, (int, float)):
                    try:
                        order = int(order)
                    except (ValueError, TypeError):
                        order = 0
                
                if question_id:
                    matching_questions.append((order, question_id))
        

        matching_questions.sort(key=lambda x: x[0])
        question_ids = [qid for _, qid in matching_questions]
        
        logger.info(f"[_get_question_ids_for_scene] For scene {scene_id}: found {len(question_ids)} questions: {question_ids}")
        return question_ids
    
    def _build_scene_dto(self, scene_data: Dict, question_ids: Optional[List[str]] = None) -> SceneDTO:
        scene_questions = question_ids if question_ids is not None else scene_data.get("questions") or []
        return SceneDTO(
            sceneId=scene_data.get("sceneId") or "",
            act=scene_data.get("act") or 0,
            order=scene_data.get("order") or 0,
            title=scene_data.get("title") or "",
            location=scene_data.get("location") or "",
            description=scene_data.get("description") or "",
            charactersPresent=scene_data.get("charactersPresent") or [],
            clues=scene_data.get("clues") or [],
            questions=scene_questions
        )
    
    def _parse_json(self, data: Any) -> Dict:
        if isinstance(data, str):
            return json.loads(data)
        return data if isinstance(data, dict) else {}
    
    async def get_script_dto(self, script_id: str) -> Optional[ScriptDTO]:
       
        script = await self.play_repo.get_script_by_id(script_id)
        if not script:
            logger.warning(f"[get_script_dto] Script not found: {script_id}")
            return None
        
        outline_json_str = script.get("outline_json", "{}")
        if isinstance(outline_json_str, str):
            outline_json_str = outline_json_str.replace('"fill_in_the_blank"', '"fill_in_blank"')
        script_data = self._parse_json(outline_json_str)
        logger.info(f"[get_script_dto] Building ScriptDTO for script {script_id}")
        
        doc_parsed_json = self._parse_json(script.get("doc_parsed_json", "{}"))
        chunk_dict = {c.get("id"): c.get("text", "") for c in doc_parsed_json.get("chunks", []) if isinstance(c, dict) and "id" in c}
        concept_chunk_mapping = doc_parsed_json.get("concept_chunk_mapping", [])

        scenes_dto: List[SceneDTO] = []
        scenes = script_data.get("scenes") or []
        for scene in scenes:
            scene_id = scene.get("sceneId")

            scene_question_ids = self._get_question_ids_for_scene(script_data, scene_id)

            scene_dto = self._build_scene_dto(scene, scene_question_ids)
            scenes_dto.append(scene_dto)
        

        questions_dto: List[QuestionDTO] = []
        questions = script_data.get("questions") or []
        for q in questions:
            if isinstance(q, dict):
                try:

                    hints = q.get("hints") or []
                    hints_dto = [HintDTO(**h) if isinstance(h, dict) else h for h in hints]
                    
                    options = q.get("options") or []
                    options_dto = [OptionDTO(**o) if isinstance(o, dict) else o for o in options]
                    
                    items = q.get("items") or []
                    items_dto = [SequencingItemDTO(**i) if isinstance(i, dict) else i for i in items]
                    
                    learn_more = q.get("learnMore") or {}
                    learn_more_dto = LearnMoreDTO(**learn_more) if isinstance(learn_more, dict) else learn_more
                    
                    correct_answer = q.get("correctAnswer")
                    acceptable_answers = q.get("acceptableAnswers") or []
                    if not correct_answer and q.get("correctAnswers"):
                        ans_list = q.get("correctAnswers") or []
                        if isinstance(ans_list, list) and len(ans_list) > 0:
                            correct_answer = str(ans_list[0])
                            acceptable_answers.extend([str(a) for a in ans_list])

                    question_dto = QuestionDTO(
                        questionId=q.get("questionId") or "",
                        sceneId=q.get("sceneId") or "",
                        order=q.get("order") or 0,
                        type=q.get("type") or "multiple_choice",
                        content=q.get("content") or "",
                        knowledgeId=q.get("knowledgeId") or "",
                        relatedKnowledge=q.get("relatedKnowledge") or [],
                        difficulty=q.get("difficulty") or 1,
                        maxAttempts=q.get("maxAttempts") or 3,
                        masteryReward=q.get("masteryReward") or 0,
                        hints=hints_dto,
                        options=options_dto,
                        items=items_dto,
                        correctOrder=q.get("correctOrder"),
                        correctAnswer=correct_answer,
                        acceptableAnswers=acceptable_answers,
                        learnMore=learn_more_dto
                    )
                    questions_dto.append(question_dto)
                except Exception as e:
                    logger.warning(f"[get_script_dto] Failed to construct QuestionDTO: {e}")
        

        clues_dto: List[ClueDTO] = []
        clues = script_data.get("clues") or []
        for c in clues:
            if isinstance(c, dict):
                try:
                    clue_dto = ClueDTO(
                        clueId=c.get("clueId", ""),
                        name=c.get("name", ""),
                        type=self.normalize_clue_type(c.get("type", "")),
                        description=c.get("description", ""),
                        foundInScene=c.get("foundInScene"),
                        foundBy=c.get("foundBy"),
                        reveals=c.get("reveals"),
                        relatedKnowledge=c.get("relatedKnowledge", []),
                        isInLearnLater=c.get("isInLearnLater")
                    )
                    clues_dto.append(clue_dto)
                except Exception as e:
                    logger.warning(f"[get_script_dto] Failed to construct ClueDTO: {e}")
        
        characters_dto: List[CharacterDTO] = []
        characters = script_data.get("characters") or []
        for ch in characters:
            if isinstance(ch, dict):
                try:
                    character_dto = CharacterDTO(
                        characterId=ch.get("characterId", ""),
                        name=ch.get("name", ""),
                        role=ch.get("role", ""),
                        occupation=ch.get("occupation"),
                        background=ch.get("background"),
                        secret=ch.get("secret"),
                        knowledgePoints=ch.get("knowledgePoints", []),
                        goal=ch.get("goal"),
                        scenes=ch.get("scenes") or []
                    )
                    characters_dto.append(character_dto)
                except Exception as e:
                    logger.warning(f"[get_script_dto] Failed to construct CharacterDTO: {e}")
        
        knowledge_dto: List[KnowledgeDTO] = []
        knowledge_base = script_data.get("knowledgeBase", script_data.get("knowledgePoints", []))
        for k in knowledge_base:
            if isinstance(k, dict):
                try:
                    kc_id = k.get("knowledgeId", "")
                    kc_name = k.get("name", "")

                    target_chunks = set()
                    for mapping in concept_chunk_mapping:
                        if isinstance(mapping, dict) and mapping.get("concept") == kc_name:
                            chunk_id = mapping.get("chunk_id")
                            if chunk_id:
                                target_chunks.add(chunk_id)
                    

                    if not target_chunks:
                        for mapping in concept_chunk_mapping:
                            if isinstance(mapping, dict) and mapping.get("concept") == kc_id:
                                chunk_id = mapping.get("chunk_id")
                                if chunk_id:
                                    target_chunks.add(chunk_id)

                    related_texts = []
                    for cid in target_chunks:
                        if cid in chunk_dict:
                            related_texts.append(chunk_dict[cid])

                    k_dto = KnowledgeDTO(
                        knowledgeId=kc_id,
                        name=kc_name,
                        description=k.get("description", ""),
                        category=k.get("category"),
                        difficulty=k.get("difficulty"),
                        appearsIn=k.get("appearsIn"),
                        relatedKnowledge=k.get("relatedKnowledge"),
                        relatedChunksText=related_texts if related_texts else None
                    )
                    knowledge_dto.append(k_dto)
                except Exception as e:
                    logger.warning(f"[get_script_dto] Failed to construct KnowledgeDTO: {e}")
        
        endings_dto: List[EndingDTO] = []
        endings = script_data.get("endings") or []
        for e in endings:
            if isinstance(e, dict):
                try:
                    e_type = e.get("type", "unresolved")
                    if isinstance(e_type, str):
                        e_type = e_type.lower()
                        if e_type in ["correct", "success", "true"]: e_type = "truth"
                        if e_type in ["incorrect", "failure", "partial"]: e_type = "false"
                        if e_type not in ["truth", "false", "unresolved"]: e_type = "unresolved"
                    else:
                        e_type = "unresolved"

                    ending_dto = EndingDTO(
                        endingId=e.get("endingId", ""),
                        type=e_type,
                        title=e.get("title", ""),
                        content=e.get("content", ""),
                        debrief=e.get("debrief", ""),
                        summary=e.get("summary", ""),
                        unlockConditions=e.get("unlockConditions") or {}
                    )
                    endings_dto.append(ending_dto)
                except Exception as e:
                    logger.warning(f"[get_script_dto] Failed to construct EndingDTO: {e}")
        

        try:
            raw_evidence = script_data.get("evidence") or []
            normalized_evidence = []
            if raw_evidence:
                for ev in raw_evidence:
                    if isinstance(ev, dict):
                        ev_copy = ev.copy()
                        ev_copy["type"] = self.normalize_evidence_type(ev.get("type", ""))
                        normalized_evidence.append(ev_copy)

            script_dto = ScriptDTO(
                scriptId=script_id,
                documentHash=script.get("document_hash"),
                documentName=script.get("document_name"),
                version=script_data.get("version"),
                title=script_data.get("title", ""),
                moduleName=script.get("module_name"),
                logline=script_data.get("logline"),
                educational_goals=script_data.get("educational_goals"),
                scenes=scenes_dto,
                questions=questions_dto,
                clues=clues_dto,
                characters=characters_dto,
                knowledgeBase=knowledge_dto,
                evidence=normalized_evidence,
                endings=endings_dto,
                timeLimit=script_data.get("timeLimit"),
                hintPenalty=script_data.get("hintPenalty"),
                masteryRewardBase=script_data.get("masteryRewardBase"),
                maxAttemptsDefault=script_data.get("maxAttemptsDefault")
            )
            logger.info(f"[get_script_dto] Successfully constructed ScriptDTO with {len(scenes_dto)} scenes, each with populated questions")
            return script_dto
        except Exception as e:
            logger.exception(f"[get_script_dto] Failed to construct ScriptDTO: {e}")
            return None
    
    async def get_user_progress(self, user_id: str, script_id: str) -> Optional[UserProgressDTO]:
        progress_data = await self.play_repo.get_user_progress_by_script(user_id, script_id)
        if not progress_data:
            return None
        
        return self._build_user_progress_dto(progress_data)
    
    def _build_user_progress_dto(self, progress_data: Dict) -> UserProgressDTO:
        updated_at = progress_data.get("updated_at")
        if isinstance(updated_at, str):
            try:
                updated_at = datetime.fromisoformat(updated_at)
            except (ValueError, TypeError):
                updated_at = datetime.now()
        elif not isinstance(updated_at, datetime):
            updated_at = datetime.now()
        
        return UserProgressDTO(
            userId=str(progress_data.get("user_id", "")),
            scriptId=str(progress_data.get("script_id", "")),
            currentSceneId=progress_data.get("current_scene_id", ""),
            completedScenes=self._parse_json_array(progress_data.get("completed_scenes")),
            unlockedClues=self._parse_json_array(progress_data.get("unlocked_clues")),
            collectedEvidence=self._parse_json_array(progress_data.get("collected_evidence")),
            answeredQuestions=self._parse_json_array(progress_data.get("answered_questions")),
            correctAnswers=self._parse_json_array(progress_data.get("correct_answers")),
            wrongAnswers=self._parse_json_array(progress_data.get("wrong_answers")),
            studySessionId=str(progress_data.get("study_session_id") or progress_data.get("studySessionId")) if (progress_data.get("study_session_id") or progress_data.get("studySessionId")) else None,
            lastUpdated=updated_at
        )
    
    def _parse_json_array(self, data: Any) -> List[str]:
        if isinstance(data, list):
            return data
        
        if not data:
            return []
            
        if isinstance(data, str):
            try:
                parsed = json.loads(data)
                # Handle double-encoded JSON like '"\\"[]\\""' -> '"[]"' -> "[]"
                while isinstance(parsed, str):
                    try:
                        parsed = json.loads(parsed)
                    except json.JSONDecodeError:
                        break
                
                if isinstance(parsed, list):
                    return parsed
                return []
            except json.JSONDecodeError:
                return []
        
        return []
    
    async def get_scene_context(self, script_id: str, scene_id: str, user_id: str) -> Dict[str, Any]:

        progress_data = await self.play_repo.get_user_progress_by_script(user_id, script_id)
        
        script = await self.play_repo.get_script_by_id(script_id)
        if not script:
            raise ValueError(f"Script {script_id} not found")
        
        scenes = await self.play_repo.get_scenes_from_script_outline(script_id)
        scene_data = None
        for s in scenes:
            if s.get("sceneId") == scene_id:
                scene_data = s
                break
        
        if not scene_data:
            raise ValueError(f"Scene {scene_id} not found in script {script_id}")
        
        clues_found = 0
        questions_answered = 0
        clues_in_scene = scene_data.get("clues") or []
        questions_in_scene = scene_data.get("questions") or []
        
        if progress_data:
            unlocked_clues = self._parse_json_array(progress_data.get("unlocked_clues", []))
            answered_questions = self._parse_json_array(progress_data.get("answered_questions", []))
            
            clues_found = sum(1 for c in clues_in_scene if c.get("clueId") in unlocked_clues)
            questions_answered = sum(1 for q in questions_in_scene if q.get("questionId") in answered_questions)
        
        learn_later_data = await self.play_repo.get_user_learn_later(user_id)
        learn_later_count = 0
        if learn_later_data:
            learn_later_items = self._parse_json_array(learn_later_data.get("learn_later_items", []))
            learn_later_count = len(learn_later_items)
        
        return {
            "sceneId": scene_id,
            "progress": {
                "cluesFound": clues_found,
                "totalClues": len(clues_in_scene),
                "questionsAnswered": questions_answered,
                "totalQuestions": len(questions_in_scene)
            },
            "learnLaterCount": learn_later_count
        }
    
    async def get_parsed_document_chunks(self, document_hash: str) -> Optional[List[Dict[str, Any]]]:

        try:
            parsed_doc = await self.play_repo.get_parsed_document_by_hash(document_hash)
            if not parsed_doc:
                logger.warning(f"No parsed document found for hash: {document_hash}")
                return None

            chunks_data = parsed_doc.get("chunks", [])
            if isinstance(chunks_data, str):
                try:
                    chunks_data = json.loads(chunks_data)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse chunks JSON for hash {document_hash}")
                    chunks_data = []
            
            if not isinstance(chunks_data, list):
                chunks_data = []
            
            chunk_dtos = []
            for idx, chunk in enumerate(chunks_data):

                if not isinstance(chunk, dict):
                    continue
                
                chunk_dto = {
                    "id": chunk.get("id", chunk.get("chunkId", f"chunk_{idx}")),
                    "text": chunk.get("text", chunk.get("content", "")),
                    "mainConcepts": chunk.get("mainConcepts", chunk.get("concepts", [])),
                    "secondaryConcepts": chunk.get("secondaryConcepts", []),
                    "summary": chunk.get("summary", ""),
                    "pageNumber": chunk.get("pageNumber", chunk.get("startLine")),
                    "sectionTitle": chunk.get("sectionTitle")
                }
                chunk_dtos.append(chunk_dto)
            
            return chunk_dtos
        
        except Exception as e:
            logger.exception(f"Failed to get parsed document chunks for hash {document_hash}: {e}")
            return None
    
    async def submit_answer(self, user_id: str, script_id: str, answer_data: SubmitAnswerRequestDTO) -> Dict[str, Any]:
        script = await self.get_script_dto(script_id)
        if not script:
            raise ValueError(f"Script {script_id} not found")

        question = next((q for q in script.questions if q.questionId == answer_data.questionId), None)
        if not question:
            raise ValueError(f"Question {answer_data.questionId} not found")

        is_correct = False
        feedback = "Incorrect"
        clues_unlocked = []
        auto_added_to_learn_later = []
        
        if question.type == 'multiple_choice' and answer_data.selectedOption:
            option_obj = next((o for o in (question.options or []) if o.optionId == answer_data.selectedOption), None)
            if option_obj:
                is_correct = option_obj.isCorrect
                feedback = option_obj.feedback
                if is_correct and option_obj.unlockClues:
                    clues_unlocked = option_obj.unlockClues
        elif question.type == 'sequencing' and answer_data.sequencingOrder:
            is_correct = answer_data.sequencingOrder == question.correctOrder
            feedback = "Correct order!" if is_correct else "Incorrect order. Try again."
        elif question.type == 'fill_in_blank' and answer_data.answerText:
            is_correct, feedback = self._check_fill_in_blank(
                answer_data.answerText,
                question,
                answer_data.attemptNumber
            )
        elif question.type == 'short_answer' and answer_data.answerText:
            is_correct = True
            feedback = "Your response has been recorded for later review."

        progress_data = await self.play_repo.get_user_progress_by_script(user_id, script_id)
        progress_dict = dict(progress_data) if progress_data else {
            "current_scene_id": answer_data.sceneId,
            "completed_scenes": [],
            "unlocked_clues": [],
            "answered_questions": [],
            "correct_answers": [],
            "wrong_answers": [],
            "collected_evidence": []
        }
        
        study_session_id = await self._get_or_create_study_session_id(user_id, script_id, progress_data)
        progress_dict["study_session_id"] = study_session_id
         
        completed_scenes = self._parse_json_array(progress_dict.get("completed_scenes"))
        collected_evidence = self._parse_json_array(progress_dict.get("collected_evidence"))
        unlocked_clues = self._parse_json_array(progress_dict.get("unlocked_clues"))
        answered_questions = self._parse_json_array(progress_dict.get("answered_questions"))
        correct_answers = self._parse_json_array(progress_dict.get("correct_answers"))
        wrong_answers = self._parse_json_array(progress_dict.get("wrong_answers"))

        if is_correct:
            for clue in clues_unlocked:
                if clue not in unlocked_clues:
                    unlocked_clues.append(clue)
            if answer_data.questionId not in answered_questions:
                answered_questions.append(answer_data.questionId)
            if answer_data.questionId not in correct_answers:
                correct_answers.append(answer_data.questionId)
        else:
            if answer_data.questionId not in wrong_answers:
                wrong_answers.append(answer_data.questionId)

            if answer_data.attemptNumber >= 2:
                auto_added_to_learn_later.append({
                    "knowledgeId": question.knowledgeId,
                    "name": "Related Knowledge (Auto-added)"
                })
                await self.add_to_learn_later(
                    user_id, script_id,
                    AddToLearnLaterRequestDTO(
                        knowledgeId=question.knowledgeId,
                        triggerType="question",
                        triggerId=answer_data.questionId,
                        wrongAnswer=answer_data.selectedOption
                    )
                )

        progress_dict["unlocked_clues"] = unlocked_clues
        progress_dict["answered_questions"] = answered_questions
        progress_dict["correct_answers"] = correct_answers
        progress_dict["wrong_answers"] = wrong_answers
        progress_dict["completed_scenes"] = completed_scenes
        progress_dict["collected_evidence"] = collected_evidence
        
        await self.play_repo.create_or_update_user_progress(user_id, script_id, progress_dict)

        record_data = answer_data.model_dump()
        record_data["isCorrect"] = is_correct

        record_data["studySessionId"] = study_session_id
         
        mastery_earned = self.study_data_service.calculate_mastery_earned(
             question,
             is_correct,
             answer_data.hintsUsed,
             answer_data.attemptNumber,
             script,
         )
        record_data["masteryEarned"] = mastery_earned
        
        await self.play_repo.save_user_answer(user_id, script_id, record_data)

        if answer_data.knowledgeId:
            learn_progress = await self.get_learning_progress(user_id, answer_data.knowledgeId, script_id)
            if learn_progress:
                all_answers = await self.play_repo.get_user_answers_by_script_id(user_id, script_id)
                mastery_rate, _, _ = self._calculate_knowledge_mastery_metrics(all_answers, script, answer_data.knowledgeId)
                mastery_label = self._mastery_label_from_rate(mastery_rate)
                await self.update_learning_progress(
                    user_id,
                    answer_data.knowledgeId,
                    script_id=script_id,
                    mastery_level=mastery_label
                )

        scene_data = next((s for s in script.scenes if s.sceneId == answer_data.sceneId), None)
        scene_clues_count = len(scene_data.clues) if scene_data else 0
        scene_questions_count = len(scene_data.questions) if scene_data else 0

        scene_unlocked_clues = [c for c in unlocked_clues if scene_data and c in scene_data.clues]
        scene_req = [q for q in answered_questions if scene_data and q in [qu.questionId if isinstance(qu, QuestionDTO) else qu for qu in scene_data.questions]]

        return {
            "isCorrect": is_correct,
            "feedback": feedback,
            "autoAddedToLearnLater": auto_added_to_learn_later,
            "progress": {
                "cluesFound": len(scene_unlocked_clues),
                "questionsAnswered": len(scene_req),
                "cluesUnlocked": clues_unlocked
            }
        }

    async def report_issue_and_skip(self, user_id: str, script_id: str, report_data: ReportIssueRequestDTO) -> Dict[str, Any]:
        script = await self.get_script_dto(script_id)
        if not script:
            raise ValueError(f"Script {script_id} not found")

        # 1. Save the issue
        await self.play_repo.save_game_issue(
            user_id=user_id,
            script_id=script_id,
            question_id=report_data.questionId,
            issue_type=report_data.issueType,
            user_comment=report_data.userComment
        )

        # 2. Update progress
        progress_data = await self.play_repo.get_user_progress_by_script(user_id, script_id)
        progress_dict = dict(progress_data) if progress_data else {
            "current_scene_id": report_data.sceneId,
            "completed_scenes": [],
            "unlocked_clues": [],
            "answered_questions": [],
            "correct_answers": [],
            "wrong_answers": [],
            "collected_evidence": []
        }
        
        study_session_id = await self._get_or_create_study_session_id(user_id, script_id, progress_dict)
        
        completed_scenes = self._parse_json_array(progress_dict.get("completed_scenes"))
        collected_evidence = self._parse_json_array(progress_dict.get("collected_evidence"))
        unlocked_clues = self._parse_json_array(progress_dict.get("unlocked_clues"))
        correct_answers = self._parse_json_array(progress_dict.get("correct_answers"))
        answered_questions = self._parse_json_array(progress_dict.get("answered_questions"))
        wrong_answers = self._parse_json_array(progress_dict.get("wrong_answers"))

        if report_data.questionId not in answered_questions:
            answered_questions.append(report_data.questionId)
        if report_data.questionId not in wrong_answers:
            wrong_answers.append(report_data.questionId)
            
        progress_dict["answered_questions"] = answered_questions
        progress_dict["wrong_answers"] = wrong_answers
        progress_dict["completed_scenes"] = completed_scenes
        progress_dict["collected_evidence"] = collected_evidence
        progress_dict["unlocked_clues"] = unlocked_clues
        progress_dict["correct_answers"] = correct_answers
        progress_dict["study_session_id"] = study_session_id

        await self.play_repo.create_or_update_user_progress(user_id, script_id, progress_dict)
        
        # 3. Insert a skipped record into user_answers to keep progress/report metrics synced
        question = next((q for q in script.questions if q.questionId == report_data.questionId), None)
        record_data = {
            "questionId": report_data.questionId,
            "sceneId": report_data.sceneId,
            "knowledgeId": question.knowledgeId if question else "unknown",
            "selectedOption": None,
            "sequencingOrder": [],
            "attemptNumber": 1,
            "hintsUsed": 0,
            "isCorrect": False,
            "studySessionId": str(study_session_id) if study_session_id else None,
            "masteryEarned": 0,
        }
        await self.play_repo.save_user_answer(user_id, script_id, record_data)

        return {"success": True, "message": "Issue recorded and question skipped."}

    async def ask_detective(self, user_id: str, data: AskDetectiveRequestDTO) -> Dict[str, Any]:
        script = await self.get_script_dto(data.scriptId)
        if not script:
            raise ValueError(f"Script {data.scriptId} not found")

        question = next((q for q in script.questions if q.questionId == data.questionId), None)
        if not question:
            raise ValueError(f"Question {data.questionId} not found")

        wrong_answers_str = ", ".join(data.wrongAnswers) if data.wrongAnswers else "None yet"

        right_answer_text = "Unknown"
        if question.type == 'multiple_choice':
            right_answer_text = next((o.content for o in (question.options or []) if o.isCorrect), 'Unknown')
        elif question.type == 'fill_in_blank':
            right_answer_text = getattr(question, 'correctAnswer', 'Unknown')
        elif question.type == 'sequencing':
            if getattr(question, 'correctOrder', None) and getattr(question, 'items', None):
                ordered = [next((i.content for i in question.items if i.itemId == qid), '') for qid in question.correctOrder]
                right_answer_text = " -> ".join(filter(bool, ordered))
            else:
                right_answer_text = "Logical sequence of the provided items."
        elif question.type == 'short_answer':
            right_answer_text = "Subjective analysis based on currently available evidence."

        kb_info = "General Investigation Protocol"
        if question.knowledgeId:
            kb = next((k for k in script.knowledgeBase if k.knowledgeId == question.knowledgeId), None)
            if kb:
                kb_info = f"{kb.name}: {kb.description}"

        ask_count = getattr(data, "askCount", 1)

        system_prompt = get_ask_detective_system_prompt(ask_count)
        
        user_prompt = ASK_DETECTIVE_USER_PROMPT.format(
            title=script.title,
            scene_context=next((s.description for s in script.scenes if s.sceneId == data.sceneId), "Unknown"),
            question_content=question.content,
            right_answer_text=right_answer_text,
            kb_info=kb_info,
            wrong_answers_str=wrong_answers_str,
            ask_count=ask_count
        )


        try:
            async with ai_provider.session(system_prompt=system_prompt, provider_name=None) as session:
                hint_text = await ai_provider.generate(
                    prompt=user_prompt,
                    session=session,
                    temperature=0.7,
                    max_tokens=150
                )
        except Exception as e:
            logger.warning(f"[ask_detective] LLM generation failed: {e}")
            hint_text = "*(Sighs)* I see you're stuck, but my radio is cutting out. Try looking at the available evidence one more time, rookie."

        return {
            "isCorrect": False,
            "feedback": hint_text,
            "autoAddedToLearnLater": [],
            "progress": None,
            "isDetectiveHint": True
        }

    async def update_progress(self, user_id: str, script_id: str, data: Dict[str, Any]) -> UserProgressDTO:
        # Normalize client payload keys (camelCase) to storage keys (snake_case)
        # so progress updates from web can be persisted correctly.
        key_map = {
            "currentSceneId": "current_scene_id",
            "completedScenes": "completed_scenes",
            "unlockedClues": "unlocked_clues",
            "collectedEvidence": "collected_evidence",
            "answeredQuestions": "answered_questions",
            "correctAnswers": "correct_answers",
            "wrongAnswers": "wrong_answers",
            "studySessionId": "study_session_id",
        }
        normalized_data = {
            key_map.get(k, k): v
            for k, v in data.items()
        }

        existing = await self.play_repo.get_user_progress_by_script(user_id, script_id)
        if existing:
            existing_dict = dict(existing)
            for field in ["completed_scenes", "unlocked_clues", "collected_evidence", "answered_questions", "correct_answers", "wrong_answers"]:
                existing_dict[field] = self._parse_json_array(existing_dict.get(field))
            
            existing_dict.update(normalized_data)
            updated = await self.play_repo.create_or_update_user_progress(user_id, script_id, existing_dict)
        else:
            updated = await self.play_repo.create_or_update_user_progress(user_id, script_id, normalized_data)
            
        return self._build_user_progress_dto(updated)

    async def add_to_learn_later(self, user_id: str, script_id: str, request: AddToLearnLaterRequestDTO) -> bool:
        src_scene = None
        src_question = None
        if request.triggerType == 'question':
            src_question = request.triggerId
        elif request.triggerType == 'clue':
            src_scene = request.triggerId
            
        return await self.play_repo.add_to_learn_later(
            user_id, script_id, request.knowledgeId, src_scene, src_question
        )

    async def mark_as_mastered(self, user_id: str, request: MarkMasteredRequestDTO, script_id: str | None = None) -> bool:
        if script_id is None:
            script_id = await self.play_repo.get_latest_active_script_id(user_id)
            if not script_id:
                raise ValueError("No active script found for user")
        return await self.play_repo.mark_as_mastered(user_id, script_id, request.knowledgeId)

    async def update_learning_progress(
        self, user_id: str, knowledge_id: str,
        time_spent_minutes: int = 0,
        quiz_attempts: int = 0,
        quiz_passed: bool = False,
        ai_content_viewed: Dict[str, bool] = None,
        personal_notes: str = None,
        mastery_level: str = None,
        script_id: str | None = None
    ) -> bool:
        if not script_id:
            raise ValueError("script_id is required for learning progress updates")

        return await self.play_repo.update_learning_progress(
            user_id=user_id,
            script_id=script_id,
            knowledge_id=knowledge_id,
            time_spent_minutes=time_spent_minutes,
            quiz_attempts=quiz_attempts,
            quiz_passed=quiz_passed,
            ai_content_viewed=ai_content_viewed or {},
            personal_notes=personal_notes,
            mastery_level=mastery_level
        )

    async def get_learning_progress(
        self, user_id: str, knowledge_id: str, script_id: str | None = None
    ) -> Optional[Dict[str, Any]]:
        if not script_id:
            raise ValueError("script_id is required for learning progress retrieval")
        return await self.play_repo.get_learning_progress(user_id, script_id, knowledge_id)

    async def reset_progress(self, user_id: str, script_id: str) -> bool:
        await self.play_repo.reset_user_progress(user_id, script_id)
        return True
    
    async def complete_game(self, user_id: str, script_id: str, ending_id: str) -> bool:
        # Calculate mastery based on progress
        progress_data = await self.get_user_progress(user_id, script_id)
        mastery = 0.0
        if progress_data:
            answered_count = len(progress_data.answeredQuestions)
            correct_count = len(progress_data.correctAnswers)
            if answered_count > 0:
                mastery = round(correct_count / answered_count, 4)
        
        existing_module = await self.db.fetchrow("""
            SELECT id FROM module_progress 
            WHERE user_id = $1 AND script_id = $2 AND module_key = $3
        """, user_id, script_id, 'game_play_ending')

        if existing_module:
            await self.db.execute("""
                UPDATE module_progress SET 
                    mastery = $1, completed = TRUE, completed_at = NOW(), updated_at = NOW()
                WHERE id = $2
            """, mastery, existing_module['id'])
        else:
            await self.db.execute("""
                INSERT INTO module_progress (user_id, script_id, module_key, mastery, completed, completed_at, updated_at)
                VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
                ON CONFLICT (user_id, script_id, module_key) DO UPDATE SET 
                    mastery = EXCLUDED.mastery,
                    completed = TRUE,
                    completed_at = NOW(),
                    updated_at = NOW()
            """, user_id, script_id, 'game_play_ending', mastery)

        await self.db.execute("""
            INSERT INTO user_activity_log (user_id, action_type, resource_type, resource_id, details)
            VALUES ($1, 'COMPLETE_GAME', 'script', $2, $3::jsonb)
            ON CONFLICT (user_id, action_type, resource_type, resource_id) DO UPDATE SET 
                details = EXCLUDED.details,
                updated_at = NOW()
        """, user_id, script_id, json.dumps({
            "endingId": ending_id,
            "mastery": float(mastery),
            "correct_answers": len(progress_data.correctAnswers) if progress_data else 0,
            "total_answered": len(progress_data.answeredQuestions) if progress_data else 0
        }))
        
        await self.db.execute("""
            INSERT INTO user_currency (user_id, balance, total_earned)
             VALUES ($1, 50, 50)
             ON CONFLICT (user_id) DO UPDATE SET 
                balance = user_currency.balance + 50,
                total_earned = user_currency.total_earned + 50
        """, user_id)

        return True

    async def get_script_report(self, user_id: str, script_id: str) -> Optional[ScriptReportDTO]:
        script = await self.get_script_dto(script_id)
        if not script:
            return None

        raw_progress = await self.play_repo.get_user_progress_by_script(user_id, script_id)
        progress = self._build_user_progress_dto(raw_progress) if raw_progress else None
        completion_rate, last_reviewed = self._calculate_completion_stats(
            progress,
            script
        )

        answers = await self.play_repo.get_user_answers_by_script_id(user_id, script_id)
        logger.info(f"[get_script_report] Retrieved {len(answers)} answers for user {user_id}, script {script_id}")

        answer_session_ids = {
            str(ans.get('study_session_id') or ans.get('studySessionId'))
            for ans in answers
            if ans.get('study_session_id') or ans.get('studySessionId')
        }

        current_session_id = None
        if progress:
            current_session_id = progress.studySessionId
            
            if not current_session_id and answers:
                current_session_id = self._find_latest_session_id(answers)
                
        current_answers = []
        if current_session_id:
            current_answers = [
                ans for ans in answers
                if str(ans.get('study_session_id') or ans.get('studySessionId') or '') == current_session_id
            ]
            if not current_answers and not answer_session_ids:
                current_answers = answers
        elif answers and not answer_session_ids:
            current_answers = answers
        current_completion_rate, current_last_reviewed = self._calculate_completion_stats_from_answers(current_answers, script)
        all_time_completion_rate, all_time_last_reviewed = self._calculate_completion_stats_from_answers(answers, script)
        current_date_activity = self._aggregate_daily_answer_activity(current_answers)
        current_sessions = self._calculate_session_count(current_answers, current_session_id)
        current_time_minutes = self._calculate_time_minutes(current_date_activity, current_completion_rate)
        cumulative_date_activity = self._aggregate_daily_answer_activity(answers)
        total_sessions = self._calculate_session_count(answers)
        total_time_minutes = self._calculate_time_minutes(cumulative_date_activity, all_time_completion_rate)
 
        global_answers = await self.play_repo.get_user_activity_last_7_days(user_id)
        global_date_activity = self._aggregate_daily_answer_activity(global_answers)
        activity = self._build_last_7_days_activity(global_date_activity)

        performance = self._build_performance_stats(current_answers, current_time_minutes, script)
        history_performance = self._build_performance_stats(answers, total_time_minutes, script)
 
        learn_later_records = await self.db.fetch(
            """
            SELECT knowledge_id, is_learned, personal_notes
            FROM user_learn_later
            WHERE user_id = $1::uuid AND script_id = $2::uuid
            """,
            str(user_id), str(script_id)
        )
        learned_map = {r['knowledge_id']: r['is_learned'] for r in learn_later_records}
        notes_map = {r['knowledge_id']: r['personal_notes'] for r in learn_later_records}

        key_concepts = self._build_key_concepts(script, answers, completion_rate, learned_map, notes_map)
        wrong_answer_concepts = self._build_wrong_answer_concepts(answers, key_concepts, notes_map)
        review_recommendations = self._build_review_recommendations(wrong_answer_concepts, key_concepts)
 
        stats = ScriptReportStatsDTO(
             totalTimeMinutes=current_time_minutes,
             completionRate=current_completion_rate,
             sessions=current_sessions,
             lastReviewed=current_last_reviewed,
             activity=self._build_last_7_days_activity(current_date_activity),
             totalMasteryScore=performance.totalMasteryScore,
             masteryRate=performance.masteryRate,
             masteryTrend=performance.masteryTrend,
             learningProgressLabel=self._determine_learning_progress_label(current_completion_rate, performance.masteryRate)
         )
        history_stats = ScriptReportStatsDTO(
             totalTimeMinutes=total_time_minutes,
             completionRate=all_time_completion_rate,
             sessions=total_sessions,
             lastReviewed=all_time_last_reviewed,
             activity=self._build_last_7_days_activity(cumulative_date_activity),
             totalMasteryScore=history_performance.totalMasteryScore,
             masteryRate=history_performance.masteryRate,
             masteryTrend=history_performance.masteryTrend
         )

        return ScriptReportDTO(
            scriptId=script_id,
            name=script.title,
            moduleName=script.moduleName,
            documentName=script.documentName,
            stats=stats,
            historyStats=history_stats,
            keyConcepts=key_concepts,
            performance=performance,
            wrongAnswerConcepts=wrong_answer_concepts,
            reviewRecommendations=review_recommendations
        )

    def _calculate_completion_stats(self, progress: Optional[UserProgressDTO], script: ScriptDTO) -> tuple[int, str]:
        completion_rate = 0
        last_reviewed = datetime.now().strftime("%Y-%m-%d")
        if progress:
            total_q = len(script.questions) if script.questions else 1
            answered_q = len(progress.answeredQuestions)
            completion_rate = min(100, int((answered_q / total_q) * 100))
            last_reviewed = progress.lastUpdated.strftime("%Y-%m-%d")
        return completion_rate, last_reviewed

    def _calculate_completion_stats_from_answers(self, answers: list[dict], script: ScriptDTO) -> tuple[int, str]:
        if not answers:
            return 0, "No active session"

        question_ids = set()
        for ans in answers:
            qid = ans.get('question_id') or ans.get('questionId')
            if qid:
                question_ids.add(qid)

        total_q = len(script.questions) if script.questions else 1
        completion_rate = min(100, int((len(question_ids) / total_q) * 100))
        last_reviewed = self._get_latest_activity_date(answers)
        return completion_rate, last_reviewed

    def _build_wrong_answer_concepts(self, answers: list[dict], key_concepts: list[ConceptStatDTO], notes_map: dict[str, str]) -> list[WrongAnswerConceptDTO]:
        concept_lookup = {concept.knowledgeId: concept for concept in key_concepts}
        grouped: dict[str, dict[str, Any]] = {}

        for ans in answers:
            if ans.get('is_correct', False):
                continue

            knowledge_id = ans.get('knowledge_id') or ans.get('knowledgeId')
            if not knowledge_id:
                continue

            entry = grouped.setdefault(knowledge_id, {
                'count': 0,
                'hints': 0,
                'questions': set(),
                'last_ts': None
            })
            entry['count'] += 1
            entry['hints'] += ans.get('hints_used', 0)

            qid = ans.get('question_id') or ans.get('questionId')
            if qid:
                entry['questions'].add(qid)

            ts = ans.get('created_at') or ans.get('timestamp')
            if ts:
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                    except Exception:
                        ts = None
                if ts and (entry['last_ts'] is None or ts > entry['last_ts']):
                    entry['last_ts'] = ts

        wrong_answer_concepts: list[WrongAnswerConceptDTO] = []
        for knowledge_id, data in grouped.items():
            concept = concept_lookup.get(knowledge_id)
            last_error_date = data['last_ts'].strftime("%Y-%m-%d") if data['last_ts'] else datetime.utcnow().strftime("%Y-%m-%d")
            wrong_answer_concepts.append(WrongAnswerConceptDTO(
                knowledgeId=knowledge_id,
                conceptName=concept.text if concept else knowledge_id,
                icon=concept.icon if concept else "❌",
                errorCount=data['count'],
                hintsUsedTotal=data['hints'],
                lastErrorDate=last_error_date,
                relatedQuestions=list(data['questions']),
                personalNotes=notes_map.get(knowledge_id)
            ))

        wrong_answer_concepts.sort(key=lambda item: item.errorCount, reverse=True)
        return wrong_answer_concepts

    async def get_or_initialize_progress(self, user_id: str, script_id: str) -> UserProgressDTO:

        progress = await self.play_repo.get_user_progress_by_script(user_id, script_id)
        study_session_id = await self._get_or_create_study_session_id(user_id, script_id, progress)
        if progress:
            progress["study_session_id"] = study_session_id
            updated = await self.play_repo.create_or_update_user_progress(user_id, script_id, progress)
            return self._build_user_progress_dto(updated)
        
        logger.info(f"[get_or_initialize_progress] Initializing progress for user {user_id}, script {script_id}")
        first_scene_id = await self._get_first_scene_id(script_id)
        
        new_progress = {
            "current_scene_id": first_scene_id,
            "completed_scenes": [],
            "unlocked_clues": [],
            "collected_evidence": [],
            "answered_questions": [],
            "correct_answers": [],
            "wrong_answers": [],
            "study_session_id": study_session_id
        }
        created = await self.play_repo.create_or_update_user_progress(user_id, script_id, new_progress)
        return self._build_user_progress_dto(created)

    async def _get_first_scene_id(self, script_id: str) -> str:

        scenes = await self.play_repo.get_scenes_from_script_outline(script_id)
        
        if not scenes:
            logger.warning(f"[_get_first_scene_id] No scenes found for script {script_id}")
            return ""
        
        sorted_scenes = sorted(scenes, key=lambda s: (s.get("act", 0), s.get("order", 0)))
        first_scene_id = sorted_scenes[0].get("sceneId", "")
        
        logger.info(f"[_get_first_scene_id] First scene for script {script_id}: {first_scene_id}")
        return first_scene_id

    async def get_learn_later_list(self, user_id: str, script_id: Optional[str] = None) -> Dict[str, Any]:

        learn_later_data = await self.play_repo.get_user_learn_later(user_id, script_id=script_id)
        
        if not learn_later_data:
            logger.info(f"[get_learn_later_list] No learn later items for user {user_id}")
            return {
                "items": [],
                "masteredCount": 0,
                "totalCount": 0
            }
        
        raw_items = learn_later_data.get("learn_later_items", [])
        logger.info(f"[get_learn_later_list] Building {len(raw_items)} learn later items")
        
        items = []
        for row in raw_items:
            try:
                item = self._build_learn_later_item_dto(row)
                items.append(item)
            except Exception as e:
                logger.warning(f"[get_learn_later_list] Error building item: {e}")
                continue
        
        mastered_count = sum(1 for item in items if item.get("isLearned", False))
        
        return {
            "items": items,
            "masteredCount": mastered_count,
            "totalCount": len(items)
        }

    def _build_learn_later_item_dto(self, row: Dict[str, Any]) -> Dict[str, Any]:

        item = {
            "knowledgeId": str(row.get("knowledgeId", "")),
            "scriptId": str(row.get("scriptId", "")),
            "scriptTitle": str(row.get("scriptTitle", "Unknown Script")),
            "documentName": str(row.get("documentName", "")) if row.get("documentName") else None,
             "moduleName": str(row.get("moduleName", "")) if row.get("moduleName") else None,
             "subject_code": str(row.get("subject_code", "")) if row.get("subject_code") else None,
             "addedAt": self._format_datetime(row.get("addedAt")),
             "isLearned": bool(row.get("isLearned", False)),
             "learnedAt": self._format_datetime(row.get("learnedAt")),
             "personalNotes": str(row.get("personalNotes", "")) if row.get("personalNotes") else None,
             "name": "Unknown Knowledge",
             "description": "No description available.",
             "triggerType": "manual",
             "triggerInfo": {},
             "relatedChunks": []
        }
        
        if row.get("sourceQuestionId"):
            item["triggerType"] = "question"
            item["triggerInfo"]["questionId"] = str(row.get("sourceQuestionId"))
        elif row.get("sourceSceneId"):
            item["triggerType"] = "clue"
            item["triggerInfo"]["clueId"] = str(row.get("sourceSceneId"))
        
        self._enrich_learn_later_item(item, row)
        
        self._populate_trigger_info(item, row)
        
        return item

    def _enrich_learn_later_item(self, item: Dict[str, Any], row: Dict[str, Any]) -> None:
   
        try:
            doc_data = self._parse_json(row.get("docParsedJson", "{}"))
            if not doc_data:
                return
            

            knowledge_list = doc_data.get("concepts", doc_data.get("knowledge", []))
            for k in knowledge_list:
                if str(k.get("id")) == item["knowledgeId"]:
                    item["name"] = k.get("title", k.get("concept", k.get("id", "Unknown")))
                    item["description"] = k.get("description", k.get("content", ""))
                    break
            

            chunks = doc_data.get("chunks", [])
            matched_chunks = self._match_related_chunks(chunks, item["name"])
            item["relatedChunks"] = matched_chunks
            
        except Exception as e:
            logger.warning(f"[_enrich_learn_later_item] Error enriching item: {e}")

    def _match_related_chunks(self, chunks: List[Dict], concept_name: str) -> List[Dict[str, Any]]:
  
        matched_chunks = []
        
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue
            
            main_concepts = chunk.get("main_concepts", [])
            secondary_concepts = chunk.get("secondary_concepts", [])
            all_concepts = main_concepts + secondary_concepts
            

            if concept_name in all_concepts:
                matched_chunks.append({
                    "chunkId": chunk.get("id", ""),
                    "summary": chunk.get("text", chunk.get("summary", ""))
                })
        
        return matched_chunks

    def _populate_trigger_info(self, item: Dict[str, Any], row: Dict[str, Any]) -> None:
        
        try:
            outline_data = self._parse_json(row.get("scriptOutlineJson", "{}"))
            if not outline_data:
                return
            
            if item["triggerType"] == "question":
                q_id = item["triggerInfo"].get("questionId")
                if q_id:
                    questions = outline_data.get("questions") or []
                    for q in questions:
                        if str(q.get("id")) == q_id:
                            item["triggerInfo"]["questionContent"] = q.get("question", "")
                            break
            
            elif item["triggerType"] == "clue":
                c_id = item["triggerInfo"].get("clueId")
                if c_id:
                    scenes = outline_data.get("scenes") or []
                    for s in scenes:
                        clues = s.get("clues") or []
                        for c in clues:
                            if str(c.get("id")) == c_id:
                                item["triggerInfo"]["clueName"] = c.get("name", "")
                                break
        
        except Exception as e:
            logger.warning(f"[_populate_trigger_info] Error populating trigger info: {e}")

    async def save_progress(
        self,
        user_id: str,
        script_id: str,
        request: SaveProgressRequestDTO
    ) -> Dict[str, Any]:

        updated = None

        if request.progress:
            progress_dict = self._dto_to_progress_dict(request.progress)
            if not progress_dict.get("study_session_id"):
                current_progress = await self.play_repo.get_user_progress_by_script(user_id, script_id)
                progress_dict["study_session_id"] = await self._get_or_create_study_session_id(user_id, script_id, current_progress)
            updated = await self.play_repo.create_or_update_user_progress(
                user_id,
                script_id,
                progress_dict
            )
            logger.info(f"[save_progress] Updated progress for user {user_id}, script {script_id}")

        if request.currentAnswer:
            current_session_id = None
            if request.progress:
                current_session_id = request.progress.get("studySessionId") or request.progress.get("study_session_id")
            await self._save_paused_answer(user_id, script_id, request.currentAnswer, current_session_id)
            logger.info(f"[save_progress] Saved paused answer for user {user_id}")

        return {
            "message": "Progress saved successfully",
            "progress": updated
        }

    def _dto_to_progress_dict(self, progress_dto: Any) -> Dict[str, Any]:

        return {
            "current_scene_id": progress_dto.get("currentSceneId", ""),
            "completed_scenes": progress_dto.get("completedScenes", []),
            "unlocked_clues": progress_dto.get("unlockedClues", []),
            "collected_evidence": progress_dto.get("collectedEvidence", []),
            "answered_questions": progress_dto.get("answeredQuestions", []),
            "correct_answers": progress_dto.get("correctAnswers", []),
            "wrong_answers": progress_dto.get("wrongAnswers", []),
            "study_session_id": progress_dto.get("studySessionId") or progress_dto.get("study_session_id"),
        }

    async def _save_paused_answer(
        self,
        user_id: str,
        script_id: str,
        answer: Any,
        study_session_id: str | None = None
    ) -> None:

        record_data = answer.model_dump()
        record_data["isCorrect"] = False
        record_data["masteryEarned"] = 0
        if study_session_id:
            record_data["studySessionId"] = study_session_id

        await self.play_repo.save_user_answer(user_id, script_id, record_data)

    def _format_datetime(self, dt: Any) -> Optional[str]:

        if dt is None:
            return None
        
        if isinstance(dt, str):
            return dt
        
        if hasattr(dt, "isoformat"):
            return dt.isoformat()
        
        return None

    async def get_chunks_dto(self, document_hash: str) -> List[Dict[str, Any]]:

        chunks = await self.play_repo.getChunks(document_hash)
        
        if chunks is None:
            logger.warning(f"[get_chunks_dto] No chunks found for hash {document_hash}")
            return []
        
        return [self._build_chunk_dto(chunk, document_hash) for chunk in chunks]

    def _build_chunk_dto(self, chunk: Dict[str, Any], document_hash: str) -> Dict[str, Any]:

        return {
            "id": chunk.get("id"),
            "text": chunk.get("text"),
            "startPos": chunk.get("start_pos", 0),
            "endPos": chunk.get("end_pos", 0),
            "mainConcepts": chunk.get("mainConcepts", []),
            "secondaryConcepts": chunk.get("secondaryConcepts", []),
            "chunkType": chunk.get("chunk_type", "section"),
            "summary": chunk.get("summary", ""),
            "documentHash": document_hash
        }
    
    def normalize_clue_type(self, clue_type: str) -> str:
        if not clue_type:
            return "physical"
        t = clue_type.lower()
        if "physical" in t: return "physical"
        if "document" in t: return "documentary"
        if "digital" in t: return "digital"
        if "testimony" in t or "testimonial" in t: return "testimonial"
        if "code" in t or "sample" in t: return "digital"
        if "interactive" in t: return "digital"
        return "physical"

    def normalize_evidence_type(self, evidence_type: str) -> str:
        if not evidence_type:
            return "Physical"
        t = evidence_type.lower()
        if "physical" in t: return "Physical"
        if "document" in t: return "Documentary"
        if "digital" in t: return "Digital"
        if "testimony" in t or "testimonial" in t: return "Testimonial"
        if "code" in t or "sample" in t: return "Digital"
        if "interactive" in t: return "Digital"
        return "Physical"

    def _build_key_concepts(self, script: ScriptDTO, answers: list[dict], completion_rate: int, learned_map: dict[str, bool], notes_map: dict[str, str]) -> list[ConceptStatDTO]:
        key_concepts: list[ConceptStatDTO] = []
        icons = ["🔑", "📚", "🧠", "💡", "🎓", "🧩", "🕵️", "🌟"]

        question_reward_map: dict[str, int] = {
            q.questionId: (q.masteryReward or script.masteryRewardBase or 0)
            for q in script.questions or []
        }

        for idx, kb in enumerate(script.knowledgeBase):
            if not kb.knowledgeId or not kb.name:
                continue

            kb_answers = [ans for ans in answers if ans.get('knowledge_id') == kb.knowledgeId]
            total_attempts = len(kb_answers)
            correct_count = sum(1 for ans in kb_answers if ans.get('is_correct', False))
            show_answer_count = sum(1 for ans in kb_answers if ans.get('hints_used', 0) >= 999)
            hints_used = sum(ans.get('hints_used', 0) for ans in kb_answers if ans.get('hints_used', 0) < 999)

            total_mastery_earned = sum(ans.get('mastery_earned', 0) for ans in kb_answers)
            expected_mastery_total = sum(
                question_reward_map.get(ans.get('question_id', ''), script.masteryRewardBase or 0)
                for ans in kb_answers
            )

            mastery_rate = round((total_mastery_earned / expected_mastery_total * 100), 2) if expected_mastery_total > 0 else 0.0
            mastery_level = int(mastery_rate)
            correct_rate = (correct_count / total_attempts) if total_attempts > 0 else 0

            last_attempt_date = None
            if kb_answers:
                last_ts = kb_answers[-1].get('created_at') or kb_answers[-1].get('timestamp')
                if last_ts:
                    if isinstance(last_ts, str):
                        last_ts = datetime.fromisoformat(last_ts.replace('Z', '+00:00'))
                    last_attempt_date = last_ts.strftime("%Y-%m-%d")

            is_mastered = learned_map.get(kb.knowledgeId, False)
            if not is_mastered and total_attempts >= 2:
                is_mastered = (
                    correct_rate >= 0.8
                    and show_answer_count == 0
                    and mastery_rate >= 60
                )

            key_concepts.append(ConceptStatDTO(
                knowledgeId=kb.knowledgeId,
                icon=icons[idx % len(icons)],
                text=kb.name,
                isMastered=is_mastered,
                personalNotes=notes_map.get(kb.knowledgeId),
                masteryLevel=mastery_level,
                correctCount=correct_count,
                totalAttempts=total_attempts,
                hintsUsed=hints_used,
                lastAttemptDate=last_attempt_date,
                totalMasteryScore=total_mastery_earned,
                masteryRate=mastery_rate
            ))

        return key_concepts

    def _build_review_recommendations(self, wrong_answer_concepts: list[WrongAnswerConceptDTO], key_concepts: list[ConceptStatDTO]) -> list[ReviewRecommendationDTO]:
        review_recommendations: list[ReviewRecommendationDTO] = []
        recommended_knowledge_ids = set()

        for wac in wrong_answer_concepts[:5]:
            priority = 5 if wac.errorCount >= 3 else (4 if wac.errorCount == 2 else 3)
            reason = "high_error_rate" if wac.errorCount >= 3 else ("low_accuracy" if wac.errorCount == 2 else "needs_practice")
            review_recommendations.append(ReviewRecommendationDTO(
                conceptId=wac.knowledgeId,
                conceptName=wac.conceptName,
                reason=reason,
                priority=priority,
                suggestedResources=[
                    {"type": "flashcard", "action": "review"},
                    {"type": "similar_questions", "action": "practice"}
                ]
            ))
            recommended_knowledge_ids.add(wac.knowledgeId)

        for concept in key_concepts:
            if concept.knowledgeId in recommended_knowledge_ids:
                continue
            if concept.totalAttempts > 0 and concept.masteryRate < 60:
                reason = "low_mastery"
                priority = 4 if concept.masteryRate < 50 else 3
                review_recommendations.append(ReviewRecommendationDTO(
                    conceptId=concept.knowledgeId,
                    conceptName=concept.text,
                    reason=reason,
                    priority=priority,
                    suggestedResources=[
                        {"type": "flashcard", "action": "review"},
                        {"type": "similar_questions", "action": "practice"}
                    ]
                ))
                recommended_knowledge_ids.add(concept.knowledgeId)

        return review_recommendations

    def _calculate_knowledge_mastery_metrics(self, answers: list[dict], script: ScriptDTO, knowledge_id: str) -> tuple[float, int, int]:
        kb_answers = [ans for ans in answers if ans.get('knowledge_id') == knowledge_id]
        if not kb_answers:
            return 0.0, 0, 0

        question_reward_map: dict[str, int] = {
            q.questionId: (q.masteryReward or script.masteryRewardBase or 0)
            for q in script.questions or []
        }

        q_history = {}
        for ans in kb_answers:
            q_id = ans.get('question_id')
            if q_id:
                if q_id not in q_history:
                    q_history[q_id] = []
                q_history[q_id].append(ans)

        total_mastery_score = 0.0
        expected_mastery_total = 0.0

        for q_id, history in q_history.items():
            base_reward = question_reward_map.get(q_id, script.masteryRewardBase or 0)
            
            q_score = 0.0
            q_weight_sum = 0.0
            weight = 1.0
            
            for ans in history[:5]:
                q_score += ans.get('mastery_earned', 0) * weight
                q_weight_sum += weight
                weight *= 0.5
                
            normalized_q_score = q_score / q_weight_sum if q_weight_sum > 0 else 0
            
            total_mastery_score += normalized_q_score
            expected_mastery_total += base_reward

        mastery_rate = round((total_mastery_score / expected_mastery_total * 100) if expected_mastery_total > 0 else 0, 2)
        return mastery_rate, total_mastery_score, expected_mastery_total

    def _mastery_label_from_rate(self, mastery_rate: float) -> str:
        if mastery_rate >= 80:
            return 'mastered'
        if mastery_rate >= 60:
            return 'proficient'
        if mastery_rate >= 40:
            return 'familiar'
        return 'unfamiliar'

    async def _get_or_create_study_session_id(self, user_id: str, script_id: str, progress_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        active_session = await self.play_repo.get_active_study_session(user_id, script_id)
        if active_session and active_session.get("id"):
            return str(active_session["id"])

        if progress_data:
            existing_session_id = progress_data.get("study_session_id") or progress_data.get("studySessionId")
            if existing_session_id:
                existing_session = await self.play_repo.get_study_session_by_id(existing_session_id)
                if existing_session and existing_session.get("ended_at") is None:
                    return str(existing_session["id"])

        session = await self.play_repo.create_study_session(user_id, script_id, "study")
        return str(session["id"]) if session else None

    def _get_latest_activity_date(self, answers: list[dict]) -> str:
        latest_ts = None
        for ans in answers:
            ts = ans.get('created_at') or ans.get('timestamp')
            if not ts:
                continue
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                except Exception:
                    continue
            latest_ts = ts if latest_ts is None or ts > latest_ts else latest_ts
        return latest_ts.strftime("%Y-%m-%d") if latest_ts else datetime.utcnow().strftime("%Y-%m-%d")
    
    def _aggregate_daily_answer_activity(self, answers: list[dict]) -> dict[str, int]:
        date_activity: dict[str, int] = {}
        for ans in answers:
            ts = ans.get('created_at') or ans.get('timestamp')
            if not ts:
                ts = datetime.utcnow()
            elif isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                except Exception:
                    ts = datetime.utcnow()

            d_str = ts.strftime("%Y-%m-%d")
            date_activity[d_str] = date_activity.get(d_str, 0) + 2
        return date_activity

    def _calculate_session_count(self, answers: list[dict], current_session_id: str | None = None) -> int:
        session_ids: set[str] = set()
        for ans in answers:
            sid = ans.get('study_session_id') or ans.get('studySessionId')
            if sid:
                session_ids.add(str(sid))

        if current_session_id:
            session_ids.add(current_session_id)

        if session_ids:
            return len(session_ids)

        unique_days: set[str] = set()
        for ans in answers:
            ts = ans.get('created_at') or ans.get('timestamp')
            if not ts:
                continue
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                except Exception:
                    continue
            unique_days.add(ts.strftime("%Y-%m-%d"))
        return len(unique_days) if unique_days else 0

    def _calculate_time_minutes(self, date_activity: dict[str, int], completion_rate: int) -> int:
        return sum(date_activity.values()) if date_activity else (completion_rate // 2)

    def _build_last_7_days_activity(self, date_activity: dict[str, int]) -> list[int]:
        today = datetime.utcnow()
        activity = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            d_str = d.strftime("%Y-%m-%d")
            activity.append(date_activity.get(d_str, 0))
        return activity

    def _build_performance_stats(self, answers: list[dict], total_time_minutes: int, script: ScriptDTO) -> PerformanceStatsDTO:
        total_answers = len(answers)
        correct_answers = sum(1 for ans in answers if ans.get('is_correct', False))
        wrong_answers = total_answers - correct_answers

        answers_by_question: dict[str, list[dict]] = {}
        for ans in answers:
            q_id = ans.get('question_id', '')
            answers_by_question.setdefault(q_id, []).append(ans)

        first_attempt_correct = 0
        final_correct = 0
        for q_answers in answers_by_question.values():
            if q_answers:
                ans_first = q_answers[0]
                if ans_first.get('is_correct', False) and ans_first.get('hints_used', 0) < 999:
                    first_attempt_correct += 1

                ans_last = q_answers[-1]
                if ans_last.get('is_correct', False) and ans_last.get('hints_used', 0) < 999:
                    final_correct += 1

        first_attempt_accuracy = (first_attempt_correct / len(answers_by_question) * 100) if answers_by_question else 0
        improvement_rate = (final_correct - first_attempt_correct) / len(answers_by_question) * 100 if answers_by_question else 0
        avg_time_per_question = (total_time_minutes / len(answers_by_question) * 60) if answers_by_question else 0

        regular_hints_sum = sum(ans.get('hints_used', 0) for ans in answers if ans.get('hints_used', 0) < 999)
        show_answer_count = sum(1 for ans in answers if ans.get('hints_used', 0) >= 999)
        hints_usage_rate = ((regular_hints_sum + show_answer_count) / total_answers * 100) if total_answers > 0 else 0

        total_mastery_score = sum(ans.get('mastery_earned', 0) for ans in answers)
        question_reward_map: dict[str, int] = {
            q.questionId: (q.masteryReward or script.masteryRewardBase or 0)
            for q in script.questions or []
        }
        expected_mastery_total = sum(
            question_reward_map.get(ans.get('question_id', ''), script.masteryRewardBase or 0)
            for ans in answers
        )
        mastery_rate = round((total_mastery_score / expected_mastery_total * 100) if expected_mastery_total > 0 else 0, 2)
        mastery_trend = self._calculate_mastery_trend(answers)

        return PerformanceStatsDTO(
            totalQuestions=len({ans.get('knowledge_id', '') for ans in answers}),
            correctAnswers=correct_answers,
            wrongAnswers=wrong_answers,
            accuracy=round((correct_answers / total_answers * 100) if total_answers > 0 else 0, 2),
            firstAttemptAccuracy=round(first_attempt_accuracy, 2),
            improvementRate=round(improvement_rate, 2),
            averageTimePerQuestion=round(avg_time_per_question, 2),
            hintsUsageRate=round(hints_usage_rate, 2),
            totalMasteryScore=total_mastery_score,
            masteryRate=mastery_rate,
            masteryTrend=round(mastery_trend, 2)
        )

    def _calculate_mastery_trend(self, answers: list[dict]) -> float:
        if not answers:
            return 0.0

        sorted_answers = sorted(
            answers,
            key=lambda ans: self._parse_answer_timestamp(ans)
        )
        if len(sorted_answers) < 2:
            return 0.0

        half = len(sorted_answers) // 2
        first_half = sorted_answers[:half]
        second_half = sorted_answers[half:]

        def avg_mastery(answer_set: list[dict]) -> float:
            if not answer_set:
                return 0.0
            return sum(ans.get('mastery_earned', 0) for ans in answer_set) / len(answer_set)

        first_avg = avg_mastery(first_half)
        second_avg = avg_mastery(second_half)
        return second_avg - first_avg

    def _parse_answer_timestamp(self, ans: dict) -> datetime:
        ts = ans.get('created_at') or ans.get('timestamp')
        if not ts:
            return datetime.utcnow()
        if isinstance(ts, str):
            return datetime.fromisoformat(ts.replace('Z', '+00:00'))
        return ts

    def _determine_learning_progress_label(self, completion_rate: int, mastery_rate: float) -> str:
        if completion_rate >= 90 and mastery_rate >= 80:
            return "Mastered"
        if mastery_rate >= 70:
            return "On Track"
        if completion_rate < 20:
            return "Just Started"
        if mastery_rate >= 50:
            return "Needs Review"
        return "Needs Practice"
    
    def _find_latest_session_id(self, answers: list[dict]) -> str | None:
        latest_session_id = None
        latest_ts = None
        for ans in answers:
            sid = ans.get('study_session_id') or ans.get('studySessionId')
            ts = ans.get('created_at') or ans.get('timestamp')
            if not sid or not ts:
                continue
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                except Exception:
                    continue
            if latest_ts is None or ts > latest_ts:
                latest_ts = ts
                latest_session_id = str(sid)
        return latest_session_id

