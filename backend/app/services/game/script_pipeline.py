import json
import logging
import re
from typing import Any, Optional, Dict, List
import asyncio
from app.services.ai.provider import AIProvider, SessionContext, LLMPriority
from app.services.ai.prompts import get_prompt
from app.models.script_schema import GeneratedGameScriptDTO, ScriptQuestion, ScriptClue

logger = logging.getLogger(__name__)

class ScriptGenerationPipeline:
    def __init__(self, ai_provider: Optional[AIProvider] = None):
        self.ai_provider = ai_provider or AIProvider()
        self.batch_size = 4
        self.max_blueprint_attempts = 3
        self.max_batch_attempts = 2

        self.ID_PATTERNS = {
            "CHARACTER": re.compile(r'^CHAR_.+$'),
            "SCENE": re.compile(r'^SCENE_.+$'),
            "CLUE": re.compile(r'^CLUE_.+$'),
            "QUESTION": re.compile(r'^Q_.+$'),
            "KNOWLEDGE": re.compile(r'^[a-fA-F0-9\-]{36}$|^CONC_.+$'),
            "EVIDENCE": re.compile(r'^EVIDENCE_.+$'),
            "ENDING": re.compile(r'^ENDING_.+$'),
            "OPTION": re.compile(r'^OPT_.+$'),
            "ITEM": re.compile(r'^ITEM_.+$'),
            "HINT": re.compile(r'^HINT_.+$'),
        }

    def _select_provider_name(self) -> Optional[str]:
        preferred_order = ["qwen", "macmini", "deepseek", "openrouter", "ollama"]
        available = {provider.provider_name for provider in self.ai_provider.providers}
        for candidate in preferred_order:
            if candidate in available:
                return candidate
        return next(iter(available), None)

    async def _generate_blueprint(self, subject: str, topic: str, target_level: str, scene_preference: str, num_players: str, concepts_list: List[Dict]) -> Dict[str, Any]:

        prompt_template = get_prompt("generate_script_blueprint")
        
        mapped_concepts = [{"id": c.get("id", ""), "name": c.get("term", c.get("title", ""))} for c in concepts_list]
        concepts_names = json.dumps(mapped_concepts, ensure_ascii=False)
        blueprint_schema = json.dumps(GeneratedGameScriptDTO.model_json_schema(), ensure_ascii=False)

        content = prompt_template.user_prompt_template.replace(
            "{subject}", subject
        ).replace(
            "{topic}", topic
        ).replace(
            "{target_level}", str(target_level)
        ).replace(
            "{scene_preference}", scene_preference
        ).replace(
            "{num_players}", str(num_players)
        ).replace(
            "{concepts_list}", concepts_names
        ).replace(
            "{json_schema}", blueprint_schema
        )

        session = SessionContext()
        provider_name = self._select_provider_name()
        if provider_name:
            session.provider_name = provider_name

        reply_str = await self.ai_provider.generate(
            prompt=content,
            session=session,
            json_mode=True,
            temperature=0.4
        )
        
        if reply_str.startswith("```"):
            reply_str = reply_str.strip("`").replace("json\n", "", 1)

        try:
            return json.loads(reply_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode blueprint JSON: {reply_str}")
            raise RuntimeError("Blueprint JSON generation failed") from e

    async def _generate_blueprint_with_retry(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        last_error = None
        for attempt in range(1, self.max_blueprint_attempts + 1):
            try:
                blueprint = await self._generate_blueprint(*args, **kwargs)
                self._validate_blueprint(blueprint)
                return blueprint
            except Exception as exc:
                last_error = exc
                logger.warning(f"Blueprint validation failed on attempt {attempt}/{self.max_blueprint_attempts}: {exc}")
                if attempt == self.max_blueprint_attempts:
                    raise
                await asyncio.sleep(0.5)

    async def _generate_puzzles_batch(self, blueprint_context_str: str, concepts_batch: List[Dict], chunks: List[Dict], puzzle_requirements: str, batch_num: int, total_batches: int, diff_rules: Dict = None) -> Dict[str, Any]:

        prompt_template = get_prompt("generate_script_puzzles")
        
        if diff_rules:
            import math
            batch_req_texts = []
            if diff_rules.get("puzzle_mcq"):
                target = math.ceil(int(diff_rules["puzzle_mcq"]) / total_batches)
                batch_req_texts.append(f"- Multiple Choice Questions (type: 'multiple_choice'): EXACTLY {target}")
            if diff_rules.get("puzzle_sorting"):
                target = math.ceil(int(diff_rules["puzzle_sorting"]) / total_batches)
                batch_req_texts.append(f"- Sequencing/Sorting Questions (type: 'sequencing'): EXACTLY {target}")
            if diff_rules.get("puzzle_fill"):
                target = math.ceil(int(diff_rules["puzzle_fill"]) / total_batches)
                batch_req_texts.append(f"- Fill in the Blank Questions (type: 'fill_in_blank'): EXACTLY {target}")
                
            batch_puzzle_reqs = (
                f"You MUST generate exactly these numbers of puzzles for this specific batch:\n"
                f"{chr(10).join(batch_req_texts)}"
            )
        else:
            batch_puzzle_reqs = (
                f"The following are the TOTAL requirements for the entire game (across {total_batches} batches).\n"
                f"For this current batch ({batch_num}/{total_batches}), you should proportionally generate "
                f"about 1/{total_batches} of these numbers (e.g. round UP to ensure we meet minimums, if 15 total / 4 batches = generate ~4 here):\n"
                f"{puzzle_requirements}"
            )
        
        puzzle_schema = json.dumps({
            "questions": [ScriptQuestion.model_json_schema()],
            "clues": [ScriptClue.model_json_schema()]
        }, ensure_ascii=False)

        content = prompt_template.user_prompt_template.replace(
            "{blueprint_context}", blueprint_context_str
        ).replace(
            "{concepts_details}", json.dumps(concepts_batch, ensure_ascii=False)
        ).replace(
            "{chunks}", json.dumps(chunks, ensure_ascii=False)
        ).replace(
            "{puzzle_requirements}", batch_puzzle_reqs
        ).replace(
            "{json_schema}", puzzle_schema
        ).replace(
            "{batch_num}", str(batch_num)
        ).replace(
            "{total_batches}", str(total_batches)
        )

        session = SessionContext()
        provider_name = self._select_provider_name()
        if provider_name:
            session.provider_name = provider_name
        
        reply_str = await self.ai_provider.generate(
            prompt=content,
            session=session,
            json_mode=True,
            temperature=0.3
        )
        
        if reply_str.startswith("```"):
            reply_str = reply_str.strip("`").replace("json\n", "", 1)
            
        try:
            return json.loads(reply_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode puzzle batch JSON: {reply_str}")
            return {"questions": [], "clues": []}
    
    async def _generate_puzzles_batch_with_retry(self, blueprint_context_str: str, concepts_batch: List[Dict], chunks: List[Dict], puzzle_requirements: str, batch_num: int, total_batches: int, blueprint: Dict[str, Any], diff_rules: Dict = None) -> Dict[str, Any]:
        last_error = None
        for attempt in range(1, self.max_batch_attempts + 1):
            batch_result = await self._generate_puzzles_batch(
                blueprint_context_str, concepts_batch, chunks, puzzle_requirements, batch_num, total_batches, diff_rules
            )
            try:
                self._validate_puzzle_batch(batch_result, blueprint, batch_num, total_batches, diff_rules or {})
                return batch_result
            except Exception as exc:
                last_error = exc
                logger.warning(f"Puzzle batch {batch_num} validation failed on attempt {attempt}/{self.max_batch_attempts}: {exc}")
                if attempt == self.max_batch_attempts:
                    raise
                await asyncio.sleep(0.5)

    def _normalize_script_dict(self, data: Any) -> Any:

        if isinstance(data, dict):

            if "type" in data and data["type"] == "fill_in_the_blank":
                data["type"] = "fill_in_blank"
            
            return {key: self._normalize_script_dict(value) for key, value in data.items()}
        
        if isinstance(data, list):
            return [self._normalize_script_dict(item) for item in data]
        
        if isinstance(data, str):
            if data.lower() == "true":
                return True
            if data.lower() == "false":
                return False
            return data.strip()
            
        return data

    def _apply_python_validations(self, script_dict: Dict[str, Any], diff_rules: Optional[Dict[str, Any]] = None) -> GeneratedGameScriptDTO:
        script_dict = self._normalize_script_dict(script_dict)
        errors = self._collect_full_script_errors(script_dict, diff_rules)
        if errors:
            logger.warning("Final validation failed, attempting safe fallback fixes")
            self._attempt_safe_fixes(script_dict)
            errors = self._collect_full_script_errors(script_dict, diff_rules)
            if errors:
                raise RuntimeError("Final script validation failed:\n" + "\n".join(errors))
 
        character_map = {c["characterId"]: c for c in script_dict.get("characters", [])}
        scene_map = {s["sceneId"]: s for s in script_dict.get("scenes", [])}
        
        # Rule 1: Bidirectional link character <-> scenes
        for scene_id, scene in scene_map.items():
            for char_id in scene.get("charactersPresent", []):
                if char_id in character_map:
                    if scene_id not in character_map[char_id].get("scenes", []):
                        character_map[char_id].setdefault("scenes", []).append(scene_id)
        
        for char_id, char in character_map.items():
            for scene_id in char.get("scenes", []):
                if scene_id in scene_map:
                    if char_id not in scene_map[scene_id].get("charactersPresent", []):
                        scene_map[scene_id].setdefault("charactersPresent", []).append(char_id)
                        
        # Rule 2: Ensure Detective appears in all Scenes
        detective_id = None
        for char in character_map.values():
            if char.get("role", "").lower() == "detective":
                detective_id = char["characterId"]
                break
        
        if detective_id:
            all_scene_ids = list(scene_map.keys())
            character_map[detective_id]["scenes"] = list(set(character_map[detective_id].get("scenes", []) + all_scene_ids))
            for scene in scene_map.values():
                if detective_id not in scene.get("charactersPresent", []):
                    scene.setdefault("charactersPresent", []).append(detective_id)
                    
        script_dict["characters"] = list(character_map.values())
        script_dict["scenes"] = list(scene_map.values())

        scene_order_map = {s.get("sceneId", ""): s.get("order", 999) for s in script_dict.get("scenes", []) if isinstance(s, dict)}
        if isinstance(script_dict.get("questions"), list):
            script_dict["questions"].sort(
                key=lambda q: (scene_order_map.get(q.get("sceneId", ""), 999), 0) if isinstance(q, dict) else (999, 0)
            )

        return GeneratedGameScriptDTO.model_validate(script_dict)

    async def generate_full_script(self, subject: str, topic: str, target_level: str, num_players: str, concepts: List[Dict], chunks: List[Dict], puzzle_requirements: str, diff_rules: Dict = None) -> GeneratedGameScriptDTO:
        
        # 1. Blueprint Generation
        logger.info(f"Pipeline Step 1: Generating Blueprint for {topic}")
        blueprint = await self._generate_blueprint_with_retry(
            subject=subject,
            topic=topic,
            target_level=target_level,
            scene_preference="Indoor",
            num_players=num_players,
            concepts_list=concepts
        )
        
        blueprint.setdefault("questions", [])
        blueprint.setdefault("clues", [])
        
        blueprint_context_str = json.dumps({
             "scenes": blueprint.get("scenes", []),
             "characters": blueprint.get("characters", [])
         }, ensure_ascii=False)

        # 2. Batch Concept Tasks
        logger.info(f"Pipeline Step 2: Generating Puzzles. Concepts total: {len(concepts)}")
        batches = [concepts[i:i + self.batch_size] for i in range(0, len(concepts), self.batch_size)]
        
        tasks = []
        for i, batch in enumerate(batches):
            tasks.append(self._generate_puzzles_batch_with_retry(
                blueprint_context_str,
                batch,
                chunks,
                puzzle_requirements,
                i+1,
                len(batches),
                blueprint,
                diff_rules
            ))
         
        batch_results = await asyncio.gather(*tasks)
        
        for idx, br in enumerate(batch_results):
            blueprint["questions"].extend(br.get("questions", []))
            blueprint["clues"].extend(br.get("clues", []))
            
        # 3. Validation & Post-process
        logger.info(f"Pipeline Step 3: Pydantic Validation & ID Alignment")
        final_script_obj = self._apply_python_validations(blueprint, diff_rules)
        
        return final_script_obj

    def _extract_id_sets(self, script_dict: Dict[str, Any]) -> Dict[str, set]:
        scenes = script_dict.get("scenes", []) or []
        characters = script_dict.get("characters", []) or []
        knowledge = script_dict.get("knowledgeBase", []) or []
        questions = script_dict.get("questions", []) or []
        clues = script_dict.get("clues", []) or []

        return {
            "scene_ids": {s.get("sceneId") for s in scenes if isinstance(s, dict) and s.get("sceneId")},
            "character_ids": {c.get("characterId") for c in characters if isinstance(c, dict) and c.get("characterId")},
            "knowledge_ids": {k.get("knowledgeId") for k in knowledge if isinstance(k, dict) and k.get("knowledgeId")},
            "question_ids": {q.get("questionId") for q in questions if isinstance(q, dict) and q.get("questionId")},
            "clue_ids": {c.get("clueId") for c in clues if isinstance(c, dict) and c.get("clueId")},
        }

    def _validate_blueprint(self, blueprint: Dict[str, Any]) -> None:
        errors: List[str] = []
        required_fields = [
            "title", "logline", "educational_goals", "characters", "scenes",
            "clues", "questions", "knowledgeBase", "evidence", "endings", "puzzleConfig"
        ]
        for field in required_fields:
            if field not in blueprint:
                errors.append(f"Blueprint missing required field: {field}")

        if not isinstance(blueprint.get("scenes", []), list):
            errors.append("Blueprint field scenes must be a list")
        if not isinstance(blueprint.get("characters", []), list):
            errors.append("Blueprint field characters must be a list")
        if not isinstance(blueprint.get("knowledgeBase", []), list):
            errors.append("Blueprint field knowledgeBase must be a list")
        if not isinstance(blueprint.get("puzzleConfig", {}), dict):
            errors.append("Blueprint field puzzleConfig must be an object")

        ids = self._extract_id_sets(blueprint)
        scene_ids = ids["scene_ids"]
        character_ids = ids["character_ids"]
        knowledge_ids = ids["knowledge_ids"]

        for scene in blueprint.get("scenes", []):
            if not isinstance(scene, dict):
                errors.append("Each scene must be an object")
                continue
            scene_id = scene.get("sceneId")
            if not scene_id:
                errors.append("Scene missing sceneId")
            if not isinstance(scene.get("charactersPresent", []), list):
                errors.append(f"Scene {scene_id} charactersPresent must be a list")
            for char_id in scene.get("charactersPresent", []):
                if char_id not in character_ids:
                    errors.append(f"Scene {scene_id} references unknown character {char_id}")
        for char in blueprint.get("characters", []):
            if not isinstance(char, dict):
                errors.append("Each character must be an object")
                continue
            char_id = char.get("characterId")
            if not char_id:
                errors.append("Character missing characterId")
            if not isinstance(char.get("scenes", []), list):
                errors.append(f"Character {char_id} scenes must be a list")
            for scene_id in char.get("scenes", []):
                if scene_id not in scene_ids:
                    errors.append(f"Character {char_id} references unknown scene {scene_id}")
        for knowledge in blueprint.get("knowledgeBase", []):
            if not isinstance(knowledge, dict):
                errors.append("Each knowledge item must be an object")
                continue
            for scene_id in knowledge.get("appearsIn", []):
                if scene_id not in scene_ids:
                    errors.append(f"Knowledge {knowledge.get('knowledgeId')} appearsIn unknown scene {scene_id}")

        if errors:
            raise RuntimeError("Blueprint validation failed:\n" + "\n".join(errors))

    def _validate_question_type(self, question: Dict[str, Any], scene_ids: set, knowledge_ids: set, batch_index: int, errors: List[str]) -> None:
        qid = question.get("questionId", "<unknown>")
        if not question.get("questionId"):
            errors.append(f"Batch {batch_index}: question missing questionId")
        if not question.get("sceneId"):
            errors.append(f"Batch {batch_index}: question {qid} missing sceneId")
        elif question.get("sceneId") not in scene_ids:
            errors.append(f"Batch {batch_index}: question {qid} references unknown scene {question.get('sceneId')}")
        if not question.get("knowledgeId"):
            errors.append(f"Batch {batch_index}: question {qid} missing knowledgeId")
        elif question.get("knowledgeId") not in knowledge_ids:
            errors.append(f"Batch {batch_index}: question {qid} references unknown knowledgeId {question.get('knowledgeId')}")
        qtype = question.get("type")
        if qtype == "fill_in_the_blank":
            question["type"] = "fill_in_blank"
            qtype = "fill_in_blank"
        if qtype not in {"multiple_choice", "sequencing", "fill_in_blank"}:
            errors.append(f"Batch {batch_index}: question {qid} has unsupported type {qtype}")
            return

        if qtype == "multiple_choice":
            options = question.get("options") or []
            if not isinstance(options, list) or len(options) < 2:
                errors.append(f"Batch {batch_index}: multiple choice question {qid} must have at least 2 options")
            else:
                seen = set()
                correct_found = False
                for opt in options:
                    if not isinstance(opt, dict):
                        errors.append(f"Batch {batch_index}: invalid option object in question {qid}")
                        continue
                    if not opt.get("optionId"):
                        errors.append(f"Batch {batch_index}: option in question {qid} missing optionId")
                    elif opt["optionId"] in seen:
                        errors.append(f"Batch {batch_index}: duplicate optionId {opt['optionId']} in question {qid}")
                    else:
                        seen.add(opt["optionId"])
                    if opt.get("isCorrect") is True:
                        correct_found = True
                    if not opt.get("feedback"):
                        errors.append(f"Batch {batch_index}: option {opt.get('optionId')} in question {qid} missing feedback")
                if not correct_found:
                    errors.append(f"Batch {batch_index}: multiple choice question {qid} must have at least one correct option")
        elif qtype == "sequencing":
            items = question.get("items") or []
            correct_order = question.get("correctOrder") or []
            if not isinstance(items, list) or len(items) < 2:
                errors.append(f"Batch {batch_index}: sequencing question {qid} must have at least 2 items")
            if not isinstance(correct_order, list) or len(correct_order) < 2:
                errors.append(f"Batch {batch_index}: sequencing question {qid} must have correctOrder of itemIds")
            else:
                item_ids = {item.get("itemId") for item in items if isinstance(item, dict) and item.get("itemId")}
                for order_id in correct_order:
                    if order_id not in item_ids:
                        errors.append(f"Batch {batch_index}: correctOrder id {order_id} for question {qid} is not present in items")
        elif qtype == "fill_in_blank":
            answers = question.get("correctAnswers") or []
            if isinstance(answers, str):
                answers = [answers]
            if not isinstance(answers, list) or len(answers) == 0:
                errors.append(f"Batch {batch_index}: fill in blank question {qid} must provide correctAnswers")

    def _validate_puzzle_batch(self, batch_result: Dict[str, Any], blueprint: Dict[str, Any], batch_index: int, total_batches: int, diff_rules: Dict[str, Any]) -> None:
        errors: List[str] = []
        if not isinstance(batch_result.get("questions", []), list):
            errors.append(f"Batch {batch_index}: questions must be a list")
        if not isinstance(batch_result.get("clues", []), list):
            errors.append(f"Batch {batch_index}: clues must be a list")

        ids = self._extract_id_sets(blueprint)
        scene_ids = ids["scene_ids"]
        knowledge_ids = ids["knowledge_ids"]

        question_ids = set()
        clue_ids = set()
        for question in batch_result.get("questions", []):
            if not isinstance(question, dict):
                errors.append(f"Batch {batch_index}: each question must be an object")
                continue
            qid = question.get("questionId")
            if qid in question_ids:
                errors.append(f"Batch {batch_index}: duplicate questionId {qid}")
            question_ids.add(qid)
            self._validate_question_type(question, scene_ids, knowledge_ids, batch_index, errors)

        for clue in batch_result.get("clues", []):
            if not isinstance(clue, dict):
                errors.append(f"Batch {batch_index}: each clue must be an object")
                continue
            clue_id = clue.get("clueId")
            if not clue_id:
                errors.append(f"Batch {batch_index}: clue missing clueId")
            elif clue_id in clue_ids:
                errors.append(f"Batch {batch_index}: duplicate clueId {clue_id}")
            clue_ids.add(clue_id)
            found_in_scene = clue.get("foundInScene")
            if found_in_scene and found_in_scene not in scene_ids:
                errors.append(f"Batch {batch_index}: clue {clue_id} references unknown foundInScene {found_in_scene}")
            for knowledge_id in clue.get("relatedKnowledge", []):
                if knowledge_id not in knowledge_ids:
                    errors.append(f"Batch {batch_index}: clue {clue_id} references unknown knowledge {knowledge_id}")

        expected_counts = {}
        if diff_rules:
            if diff_rules.get("puzzle_mcq"):
                expected_counts["multiple_choice"] = -(-int(diff_rules["puzzle_mcq"]) // total_batches)
            if diff_rules.get("puzzle_sorting"):
                expected_counts["sequencing"] = -(-int(diff_rules["puzzle_sorting"]) // total_batches)
            if diff_rules.get("puzzle_fill"):
                expected_counts["fill_in_blank"] = -(-int(diff_rules["puzzle_fill"]) // total_batches)
            actual_counts = {k: 0 for k in expected_counts}
            for question in batch_result.get("questions", []):
                qtype = question.get("type")
                if qtype == "fill_in_the_blank":
                    qtype = "fill_in_blank"
                if qtype in actual_counts:
                    actual_counts[qtype] += 1
            for qtype, expected in expected_counts.items():
                if actual_counts.get(qtype, 0) != expected:
                    errors.append(f"Batch {batch_index}: expected {expected} {qtype} questions, found {actual_counts.get(qtype, 0)}")

        if len(batch_result.get("questions", [])) == 0 and sum(expected_counts.values()) > 0:
            raise RuntimeError("Puzzle batch validation failed: No questions generated in this batch.\n" + "\n".join(errors))
        elif errors:
            logger.warning(f"Puzzle batch validation warnings (will let auto-fixes handle):\n" + "\n".join(errors))

    def _validate_id_formats(self, script_dict: Dict[str, Any], errors: List[str]) -> None:

        containers = [
            ("characters", "CHARACTER", "characterId"),
            ("scenes", "SCENE", "sceneId"),
            ("clues", "CLUE", "clueId"),
            ("questions", "QUESTION", "questionId"),
            ("knowledgeBase", "KNOWLEDGE", "knowledgeId"),
            ("evidence", "EVIDENCE", "evidenceId"),
            ("endings", "ENDING", "endingId"),
        ]
        for container, pattern_key, id_field in containers:
            for item in script_dict.get(container, []):
                if not isinstance(item, dict):
                    continue
                item_id = item.get(id_field, "")
                if item_id and not self.ID_PATTERNS[pattern_key].match(item_id):
                    logger.warning(f"{pattern_key} ID format mismatch: {item_id} doesn't match {self.ID_PATTERNS[pattern_key].pattern}. Tolerating.")
                    
        for question in script_dict.get("questions", []):
            if not isinstance(question, dict):
                continue
            for opt in question.get("options", []):
                if isinstance(opt, dict):
                    opt_id = opt.get("optionId", "")
                    if opt_id and not self.ID_PATTERNS["OPTION"].match(opt_id):
                        logger.warning(f"OPTION ID format mismatch: {opt_id}. Tolerating.")
            for item in question.get("items", []):
                if isinstance(item, dict):
                    item_id = item.get("itemId", "")
                    if item_id and not self.ID_PATTERNS["ITEM"].match(item_id):
                        logger.warning(f"ITEM ID format mismatch: {item_id}. Tolerating.")
            for hint in question.get("hints", []):
                if isinstance(hint, dict):
                    hint_id = hint.get("hintId", "")
                    if hint_id and not self.ID_PATTERNS["HINT"].match(hint_id):
                        logger.warning(f"HINT ID format mismatch: {hint_id}. Tolerating.")

    def _validate_id_uniqueness(self, script_dict: Dict[str, Any], errors: List[str]) -> None:
        all_ids: Dict[str, List[str]] = {}
        containers = [
            ("CHARACTER", "characters", "characterId"),
            ("SCENE", "scenes", "sceneId"),
            ("CLUE", "clues", "clueId"),
            ("QUESTION", "questions", "questionId"),
            ("KNOWLEDGE", "knowledgeBase", "knowledgeId"),
            ("EVIDENCE", "evidence", "evidenceId"),
            ("ENDING", "endings", "endingId"),
        ]
        for entity_type, container, id_field in containers:
            ids = set()
            for item in script_dict.get(container, []):
                if not isinstance(item, dict):
                    continue
                item_id = item.get(id_field)
                if item_id:
                    if item_id in ids:
                        errors.append(f"Duplicate {entity_type} ID: {item_id} appears multiple times in {container}")
                    ids.add(item_id)
                    all_ids.setdefault(item_id, []).append(entity_type)
        for question in script_dict.get("questions", []):
            if not isinstance(question, dict):
                continue
            qid = question.get("questionId", "UNKNOWN_Q")
            local_opts = set()
            for opt in question.get("options", []) or []:
                if isinstance(opt, dict):
                    opt_id = opt.get("optionId")
                    if opt_id:
                        if opt_id in local_opts:
                            errors.append(f"Duplicate OPTION ID (Composite Key Error): {opt_id} appears multiple times within question {qid}")
                        local_opts.add(opt_id)
                        all_ids.setdefault(f"{qid}::{opt_id}", []).append("OPTION")
            local_items = set()
            for item in question.get("items", []) or []:
                if isinstance(item, dict):
                    item_id = item.get("itemId")
                    if item_id:
                        if item_id in local_items:
                            errors.append(f"Duplicate ITEM ID (Composite Key Error): {item_id} appears multiple times within question {qid}")
                        local_items.add(item_id)
                        all_ids.setdefault(f"{qid}::{item_id}", []).append("ITEM")
            local_hints = set()
            for hint in question.get("hints", []) or []:
                if isinstance(hint, dict):
                    hint_id = hint.get("hintId")
                    if hint_id:
                        if hint_id in local_hints:
                            errors.append(f"Duplicate HINT ID (Composite Key Error): {hint_id} appears multiple times within question {qid}")
                        local_hints.add(hint_id)
                        all_ids.setdefault(f"{qid}::{hint_id}", []).append("HINT")
        for id_val, types in all_ids.items():
            if len(types) > 1:
                errors.append(f"ID {id_val} appears in multiple entity types: {', '.join(types)}")

    def _collect_full_script_errors(self, script_dict: Dict[str, Any], diff_rules: Optional[Dict[str, Any]] = None) -> List[str]:
        errors: List[str] = []
        ids = self._extract_id_sets(script_dict)
        scene_ids = ids["scene_ids"]
        character_ids = ids["character_ids"]
        knowledge_ids = ids["knowledge_ids"]
        question_ids = ids["question_ids"]
        clue_ids = ids["clue_ids"]

        for question in script_dict.get("questions", []):
            if not isinstance(question, dict):
                errors.append("Each question must be an object")
                continue
            qid = question.get("questionId")
            if question.get("sceneId") not in scene_ids:
                errors.append(f"Question {qid} references unknown scene {question.get('sceneId')}")
            if question.get("knowledgeId") not in knowledge_ids:
                errors.append(f"Question {qid} references unknown knowledge {question.get('knowledgeId')}")
            self._validate_question_type(question, scene_ids, knowledge_ids, 0, errors)
        for clue in script_dict.get("clues", []):
            if not isinstance(clue, dict):
                errors.append("Each clue must be an object")
                continue
            if clue.get("foundInScene") and clue.get("foundInScene") not in scene_ids:
                errors.append(f"Clue {clue.get('clueId')} references unknown foundInScene {clue.get('foundInScene')}")
            for knowledge_id in clue.get("relatedKnowledge", []):
                if knowledge_id not in knowledge_ids:
                    errors.append(f"Clue {clue.get('clueId')} references unknown knowledge {knowledge_id}")
        for character in script_dict.get("characters", []):
            if not isinstance(character, dict):
                errors.append("Each character must be an object")
                continue
            for scene_id in character.get("scenes", []):
                if scene_id not in scene_ids:
                    errors.append(f"Character {character.get('characterId')} references unknown scene {scene_id}")
        for ending in script_dict.get("endings", []):
            if not isinstance(ending, dict):
                errors.append("Each ending must be an object")
                continue
            unlock = ending.get("unlockConditions", {}) or {}
            for scene_id in unlock.get("requiredScenes", []):
                if scene_id not in scene_ids:
                    errors.append(f"Ending {ending.get('endingId')} requires unknown scene {scene_id}")
            for question_id in unlock.get("requiredQuestions", []):
                if question_id not in question_ids:
                    errors.append(f"Ending {ending.get('endingId')} requires unknown question {question_id}")
            for clue_id in unlock.get("requiredClues", []):
                if clue_id not in clue_ids:
                    errors.append(f"Ending {ending.get('endingId')} requires unknown clue {clue_id}")
        for evidence in script_dict.get("evidence", []):
            if not isinstance(evidence, dict):
                errors.append("Each evidence item must be an object")
                continue
            for clue_id in evidence.get("clueIds", []):
                if clue_id not in clue_ids:
                    errors.append(f"Evidence {evidence.get('evidenceId')} references unknown clue {clue_id}")
            for knowledge_id in evidence.get("relatedKnowledge", []):
                if knowledge_id not in knowledge_ids:
                    errors.append(f"Evidence {evidence.get('evidenceId')} references unknown knowledge {knowledge_id}")

        if diff_rules:
            expected_total = {
                "multiple_choice": int(diff_rules.get("puzzle_mcq", 0) or 0),
                "sequencing": int(diff_rules.get("puzzle_sorting", 0) or 0),
                "fill_in_blank": int(diff_rules.get("puzzle_fill", 0) or 0),
            }
            actual_total = {"multiple_choice": 0, "sequencing": 0, "fill_in_blank": 0}
            for question in script_dict.get("questions", []):
                qtype = question.get("type")
                if qtype == "fill_in_the_blank":
                    qtype = "fill_in_blank"
                if qtype in actual_total:
                    actual_total[qtype] += 1
            for qtype, expected in expected_total.items():
                if expected and actual_total.get(qtype, 0) != expected:
                    logger.warning(f"Final script expected {expected} {qtype} questions, found {actual_total.get(qtype, 0)}")

        self._validate_id_formats(script_dict, errors)
        self._validate_id_uniqueness(script_dict, errors)

        return errors

    def _validate_full_script(self, script_dict: Dict[str, Any], diff_rules: Optional[Dict[str, Any]] = None) -> None:
        errors = self._collect_full_script_errors(script_dict, diff_rules)
        if errors:
            raise RuntimeError("Final script validation failed:\n" + "\n".join(errors))

    def _attempt_safe_fixes(self, script_dict: Dict[str, Any]) -> None:
        import uuid
        
        entity_id_map = {
            "characters": ("characterId", "CHAR_AUTO_"),
            "scenes": ("sceneId", "SCENE_AUTO_"),
            "clues": ("clueId", "CLUE_AUTO_"),
            "questions": ("questionId", "Q_AUTO_"),
            "knowledgeBase": ("knowledgeId", "CONC_AUTO_"),
            "evidence": ("evidenceId", "EVIDENCE_AUTO_"),
            "endings": ("endingId", "ENDING_AUTO_"),
        }

        for container, (id_field, auto_prefix) in entity_id_map.items():
            for item in script_dict.get(container, []):
                if isinstance(item, dict):
                    if not item.get(id_field):
                        item[id_field] = f"{auto_prefix}{uuid.uuid4().hex[:8].upper()}"

        scene_ids = self._extract_id_sets(script_dict)["scene_ids"]
        character_ids = self._extract_id_sets(script_dict)["character_ids"]
        knowledge_ids = self._extract_id_sets(script_dict)["knowledge_ids"]
        question_ids = self._extract_id_sets(script_dict)["question_ids"]
        clue_ids = self._extract_id_sets(script_dict)["clue_ids"]

        for scene in script_dict.get("scenes", []):
            if isinstance(scene, dict):
                scene["charactersPresent"] = [cid for cid in scene.get("charactersPresent", []) if cid in character_ids]
                scene["clues"] = [cid for cid in scene.get("clues", []) if cid in clue_ids]
        for char in script_dict.get("characters", []):
            if isinstance(char, dict):
                char["scenes"] = [sid for sid in char.get("scenes", []) if sid in scene_ids]
                char["knowledgePoints"] = [kid for kid in char.get("knowledgePoints", []) if kid in knowledge_ids]
        for knowledge in script_dict.get("knowledgeBase", []):
            if isinstance(knowledge, dict):
                knowledge["appearsIn"] = [sid for sid in knowledge.get("appearsIn", []) if sid in scene_ids]
                knowledge["relatedKnowledge"] = [kid for kid in knowledge.get("relatedKnowledge", []) if kid in knowledge_ids]
        valid_questions = []
        for question in script_dict.get("questions", []):
            if isinstance(question, dict):

                question.pop("nextSceneIdCorrect", None)
                question.pop("nextSceneIdIncorrect", None)
                
                opts = question.get("options", [])
                if isinstance(opts, list):
                    for opt in opts:
                        if isinstance(opt, dict):
                            if not opt.get("optionId"):
                                opt["optionId"] = f"OPT_AUTO_{uuid.uuid4().hex[:8].upper()}"
                            opt.pop("nextSceneId", None)
                            
                is_valid = True
                
                if question.get("sceneId") not in scene_ids:
                    if scene_ids:
                        question["sceneId"] = list(scene_ids)[0]
                    else:
                        is_valid = False
                        
                if question.get("knowledgeId") not in knowledge_ids:
                    if knowledge_ids:
                        question["knowledgeId"] = list(knowledge_ids)[0]
                    else:
                        is_valid = False
                
                # 1. Multiple Choice: Prune if less than 2 options or no correct answer
                if question.get("type") == "multiple_choice":
                    if not isinstance(opts, list) or len(opts) < 2:
                        is_valid = False
                    else:
                        has_correct = any(isinstance(o, dict) and o.get("isCorrect") for o in opts)
                        if not has_correct:
                            is_valid = False

                # 2. Sequencing: Prune if missing items or correct order
                elif question.get("type") == "sequencing":
                    items = question.get("items", [])
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict) and not item.get("itemId"):
                                item["itemId"] = f"ITEM_AUTO_{uuid.uuid4().hex[:8].upper()}"
                    correct_order = question.get("correctOrder", [])
                    if not isinstance(items, list) or len(items) < 2:
                        is_valid = False
                    elif not isinstance(correct_order, list) or len(correct_order) < 2:
                        is_valid = False

                # 3. Fill in the blank: empty array is fine (AI will judge at runtime)
                elif question.get("type") == "fill_in_blank":
                    if not isinstance(question.get("correctAnswers"), list):
                        question["correctAnswers"] = []
                        
                if not is_valid:
                    logger.warning(f"Pruning invalid {question.get('type')} question: missing correct answer or structural requirements. Q_ID: {question.get('questionId')}")
                    continue

                if isinstance(question.get("relatedKnowledge"), list):
                    question["relatedKnowledge"] = [kid for kid in question["relatedKnowledge"] if kid in knowledge_ids]
                
                hints = question.get("hints", [])
                if isinstance(hints, list):
                    for hint in hints:
                        if isinstance(hint, dict) and not hint.get("hintId"):
                            hint["hintId"] = f"HINT_AUTO_{uuid.uuid4().hex[:8].upper()}"
                    question["hints"] = [hint for hint in hints if isinstance(hint, dict) and hint.get("hintId")]
                
                valid_questions.append(question)
                
        script_dict["questions"] = valid_questions
        for clue in script_dict.get("clues", []):
            if isinstance(clue, dict):
                if clue.get("foundInScene") not in scene_ids:
                    clue["foundInScene"] = None
                clue["relatedKnowledge"] = [kid for kid in clue.get("relatedKnowledge", []) if kid in knowledge_ids]
        for evidence in script_dict.get("evidence", []):
            if isinstance(evidence, dict):
                evidence["clueIds"] = [cid for cid in evidence.get("clueIds", []) if cid in clue_ids]
                evidence["relatedKnowledge"] = [kid for kid in evidence.get("relatedKnowledge", []) if kid in knowledge_ids]
        for ending in script_dict.get("endings", []):
            if isinstance(ending, dict):
                unlock = ending.setdefault("unlockConditions", {})
                unlock["requiredScenes"] = [sid for sid in unlock.get("requiredScenes", []) if sid in scene_ids]
                unlock["requiredQuestions"] = [qid for qid in unlock.get("requiredQuestions", []) if qid in question_ids]
                unlock["requiredClues"] = [cid for cid in unlock.get("requiredClues", []) if cid in clue_ids]
