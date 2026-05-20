import json
import logging
import re
import tempfile
import os
from typing import Any, Dict, List, Union

import asyncpg

from app.services.ai.provider import ai_provider
from app.services.ai.prompts import get_prompt, format_hints_section
from app.models.game import AnalysisHelperResponse

from app.services.document.processor import document_processor
from app.services.pipelines.document_pipeline import document_pipeline
from app.utils.document_utils import detect_document_type
from app.models.document import DocumentType
from app.repositories.game.game_repository import GameRepository
import asyncpg

logger = logging.getLogger(__name__)


from app.utils.document_utils import calculate_checksum

class DocumentAnalysisService:

    def __init__(self, db: asyncpg.Connection) -> None:
        self.db = db
        self.game_repo = GameRepository(db)
  
    async def analyze_temp(self, source_or_bytes: Union[str, bytes], hash: str, filename: str) -> AnalysisHelperResponse:

        try:
            analysis_prompt = get_prompt("analysis_helper")
            hints_section = format_hints_section(None)

            source_id = ""
            content_for_prompt = ""

            if isinstance(source_or_bytes, (bytes, bytearray)):

                try:
                    decoded = source_or_bytes.decode("utf-8")
                    if len(decoded.strip()) > 0:
                        content_for_prompt = decoded
                    else:
                        content_for_prompt = ""
                except Exception:
                    content_for_prompt = ""

                if not content_for_prompt:
                    tmp_path = None
                    try:

                        with tempfile.NamedTemporaryFile(delete=False) as tmp:
                            tmp.write(source_or_bytes)
                            tmp_path = tmp.name

                        tried = []
                        extracted_text = None
                        for candidate in (DocumentType.powerpoint, DocumentType.pdf, DocumentType.word, DocumentType.text):
                            tried.append(candidate.value)
                            try:
                                extraction_result = await document_processor.file_to_extraction_tree(
                                    file_path=tmp_path,
                                    document_type=candidate)
                                if extraction_result and extraction_result.tree:
                                    tree = extraction_result.tree
                                    sections = tree.get_children(tree.root_id) or [tree.get_node(tree.root_id)]
                                    parts = []
                                    for sec in sections:
                                        sec_text = document_pipeline._collect_node_text(tree, sec, include_children=True)
                                        if sec_text:
                                            parts.append(sec_text)
                                    if parts:
                                        extracted_text = "\n\n".join(parts)
                                        break
                            except Exception:
                                continue

                        if extracted_text:
                            content_for_prompt = extracted_text
                        else:
                            preview = repr(source_or_bytes[:4000])
                            content_for_prompt = f"[Binary or non-UTF8 content]\n{preview}\n\n[tried_types]={tried}"

                    finally:
                        if tmp_path and os.path.exists(tmp_path):
                            try:
                                os.unlink(tmp_path)
                            except Exception:
                                pass
            else:
                source_id = str(source_or_bytes)

            try:
                content_len = len(content_for_prompt) if content_for_prompt is not None else 0
            except Exception:
                content_len = 0
            logger.info("analyze_temp: source_id=%s content_length=%d", source_id or None, content_len)
            if content_len > 0:
                logger.debug("analyze_temp: content snippet (truncated 400 chars): %s", content_for_prompt[:400])

            user_prompt = analysis_prompt.format_user_prompt(
                document_title= filename or "unknown_document",
                source_id = hash,
                batch_number=1,
                total_batches=1,
                page_range="1",
                hints_section=hints_section,
                content=content_for_prompt,
            )

           
            full_prompt = user_prompt

        except Exception as e:
            logger.exception("Error generating user prompt for document analysis")
            raise ValueError(f"Failed to generate user prompt: {e}")

        logger.debug("Generated user prompt (truncated 1000 chars): %s", full_prompt[:1000])

        async with ai_provider.session(system_prompt=analysis_prompt.system_prompt) as s:
            raw_text = await ai_provider.generate(
                prompt=full_prompt,
                session=s,
            )
        raw_text = (raw_text or "").strip()

        logger.info("Raw AI output (truncated 2000 chars): %s", raw_text[:2000])

        def try_load_json(text: str) -> Any:
            try:
                return json.loads(text)
            except Exception:
                return None

        parsed = try_load_json(raw_text)

        if parsed is None:
            first_brace = raw_text.find("{")
            last_brace = raw_text.rfind("}")
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                for end in range(last_brace, first_brace, -1):
                    candidate = raw_text[first_brace:end+1]
                    parsed = try_load_json(candidate)
                    if parsed is not None:
                        logger.debug("Extracted JSON substring successfully")
                        break

        if parsed is None:
            matches = re.findall(r"\{[\s\S]*?\}", raw_text)
            for m in matches:
                parsed = try_load_json(m)
                if parsed is not None:
                    logger.debug("Parsed JSON from regex match")
                    break

        if parsed is None:
            logger.warning("Failed to parse JSON from model output; falling back to heuristic extraction")
            parsed = {}
            def extract_int(field_names: List[str]) -> int:
                for name in field_names:
                    m = re.search(rf"{name}[\s:\-=]*([0-9]{{1,3}})", raw_text, flags=re.IGNORECASE)
                    if m:
                        try:
                            return int(m.group(1))
                        except Exception:
                            continue
                return 0

            parsed["concept"] = extract_int(["concept", "concepts", "Concept"])
            parsed["structure"] = extract_int(["structure", "structures"])
            parsed["apply"] = extract_int(["apply", "applications", "apply"])
            parsed["difficulty_score"] = extract_int(["difficulty", "difficulty_score", "score"]) or 0
            parsed["modules"] = []

        try:
            concept = int(parsed.get("concept") or 0)
            structure = int(parsed.get("structure") or 0)
            apply_count = int(parsed.get("apply") or 0)
            difficulty_score = int(parsed.get("difficulty_score") or parsed.get("difficulty") or 0)

            modules_raw = parsed.get("modules") or []
            modules: List[Dict[str, Union[str, int]]] = []
            if isinstance(modules_raw, list):
                for i, m in enumerate(modules_raw):
                    if isinstance(m, dict):
                        mod_id = m.get("id") or m.get("name") or f"module_{i+1}"
                        mod_name = m.get("name") or m.get("title") or str(mod_id)
                        topic_count = int(m.get("topic_count") or m.get("count") or 0)
                        modules.append({"id": str(mod_id), "name": str(mod_name), "topic_count": int(topic_count)})

            if difficulty_score > 20:
                difficulty_score = 20
            if difficulty_score < 0:
                difficulty_score = 0

            response = AnalysisHelperResponse(
                document_name=filename or "unknown_document",
                concept=concept,
                structure=structure,
                apply=apply_count,
                difficulty_score=difficulty_score,
                modules=modules,
                document_hash=hash,
            )
            summary_data = {
                "total_concepts": response.concept,
                "total_structures": response.structure,
                "total_applications": response.apply,
                "difficulty_score": response.difficulty_score,
                "total_modules": len(response.modules) if response.modules else 0,
            }
            insert_data = {
                "document_name": response.document_name,
                "document_hash": response.document_hash,
                "modules": json.dumps(response.modules),
                "summary": json.dumps(summary_data),
                "checksum": calculate_checksum(source_or_bytes) if isinstance(source_or_bytes, (bytes, bytearray)) else None,
                "raw_text": content_for_prompt if content_for_prompt else None,
            }

            parsed_document_id = await self.game_repo.insert_parsed_document(insert_data)
            return response

        except Exception as e:
            logger.exception("Failed to normalize parsed AI output")
            return AnalysisHelperResponse(
                document_name=filename or "unknown_document",
                concept=0, structure=0, apply=0, difficulty_score=0, modules=[], document_hash=hash)

