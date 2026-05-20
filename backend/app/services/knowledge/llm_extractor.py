import json
import logging
import re
import asyncio
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings, PROVIDER_CONFIGS, resolve_model
from app.core.enums import UserPriority
from app.services.ai.provider import AIProvider, content_budget, LLMPriority
from app.services.knowledge.citations import remove_citations_clean
from app.services.ai.embeddings import embedding_service
from app.services.ai.prompts import (
    EXTRACTION_PROMPT,
    format_hints_section,
    estimate_hints_tokens)
from app.services.document.chunker import semantic_batcher
from app.core.utils import rouge_l

logger = logging.getLogger(__name__)


class ExtractedConcept(BaseModel):
    term: str
    description: str
    concept_type: str = "definition"
    keywords: list[str] = Field(default_factory = list)
    difficulty_level: str | None = None
    formula_latex: str | None = None
    formula_plain_text: str | None = None
    source_quote: str = ""
    source_pages: list[int] = Field(default_factory = list)
    source_location: str | None = None
    language: str = "en"

    purpose: str | None = None
    preconditions: list[dict] = Field(default_factory = list)
    steps: list[dict] = Field(default_factory = list)
    failure_modes: list[dict] = Field(default_factory = list)
    verification_checks: list[dict] = Field(default_factory = list)
    estimated_time_minutes: int | None = None

    context: str | None = None
    inputs: dict = Field(default_factory = dict)
    outcome: str | None = None
    lessons_learned: str | None = None

    question_type: str | None = None
    question: str | None = None
    correct_answer: str | None = None
    answer_explanations: list[dict] = Field(default_factory = list)

    learning_objective: str | None = None
    object_type: str | None = None
    estimated_duration_minutes: int | None = None
    interactivity_level: str | None = None

    suggested_lcc_code: str | None = None

    @field_validator('concept_type')
    @classmethod
    def validate_concept_type(cls, v):
        valid = {'definition', 'procedure', 'example', 'assessment', 'entity', 'formula', 'learning_object'}
        if v not in valid:
            raise ValueError(f"Invalid concept_type '{v}'. Must be one of: {valid}")
        return v

    @field_validator('difficulty_level')
    @classmethod
    def validate_difficulty(cls, v):
        if v is None:
            return None
        valid = {'beginner', 'intermediate', 'advanced', 'expert'}
        if v not in valid:
            raise ValueError(f"Invalid difficulty_level '{v}'. Must be one of: {valid}")
        return v

class ExtractedRelationship(BaseModel):
    source_concept_term: str
    target_concept_term: str
    relationship_type: str
    description: str = ""
    strength: float = Field(default = 0.5, ge = 0.0, le = 1.0)
    source_quote: str = ""
    source_pages: list[int] = Field(default_factory=list)
    source_location: str | None = None
    language: str = "en"

class LearningPathStep(BaseModel):
    concept_term: str
    is_required: bool = True
    estimated_time_minutes: int | None = None
    notes: str | None = None

class ExtractedLearningPath(BaseModel):
    title: str
    description: str = ""
    target_concept_term: str | None = None
    steps: list[LearningPathStep] = Field(default_factory = list)
    language: str = "en"

class SubjectHints(BaseModel):
    topics: list[str] = Field(default_factory = list)
    keywords: list[str] = Field(default_factory = list)
    context_summary: str | None = None

class LLMExtractionResponse(BaseModel):

    concepts: list[ExtractedConcept] = Field(default_factory = list)
    relationships: list[ExtractedRelationship] = Field(default_factory = list)
    learning_paths: list[ExtractedLearningPath] = Field(default_factory = list)
    subject_hints: SubjectHints = Field(default_factory = SubjectHints)

    def to_dict(self) -> dict:

        return {
            "concepts": [c.model_dump() for c in self.concepts],
            "relationships": [r.model_dump() for r in self.relationships],
            "learning_paths": [lp.model_dump() for lp in self.learning_paths],
            "subject_hints": self.subject_hints.model_dump()}

class BatchExtractionResult(BaseModel):
    all_extractions: list[dict] = Field(default_factory = list)
    total_concepts: int = 0
    total_relationships: int = 0
    total_learning_paths: int = 0
    total_batches: int = 0
    final_hints: dict = Field(default_factory = dict)
    errors: list[str] = Field(default_factory = list)
    concepts_verified: int = 0
    concepts_rejected: int = 0
    relationships_verified: int = 0
    relationships_rejected: int = 0

    class Config:
        arbitrary_types_allowed = True

class SourceReferenceVerifier:

    ACCEPT_THRESHOLD = 0.85

    @classmethod
    def verify_reference(cls, claimed_text: str, source_text: str) -> tuple[bool, float]:

        if not claimed_text or not source_text:
            return False, 0.0

        precision, _, _ = rouge_l(claimed_text, source_text)
        is_valid = precision >= cls.ACCEPT_THRESHOLD

        return is_valid, round(precision, 4)

    @classmethod
    def verify_extraction(
        cls,
        extraction: dict,
        source_text: str,
        reject_unverified: bool = True) -> tuple[dict, dict]:
        
        stats = {
            "concepts_total": 0,
            "concepts_verified": 0,
            "concepts_rejected": 0,
            "relationships_total": 0,
            "relationships_verified": 0,
            "relationships_rejected": 0}

        verified = {
            "concepts": [],
            "relationships": [],
            "learning_paths": extraction.get("learning_paths", []),
            "subject_hints": extraction.get("subject_hints", {})}

        for concept in extraction.get("concepts", []):

            stats["concepts_total"] += 1
            description = concept.get("description", "")
            desc_clean = remove_citations_clean(description)

            if desc_clean:
                is_verified, confidence = cls.verify_reference(desc_clean, source_text)
            else:
                is_verified, confidence = False, 0.0

            concept["_verified"] = is_verified
            concept["_confidence"] = round(confidence, 4)

            if is_verified:
                verified["concepts"].append(concept)
                stats["concepts_verified"] += 1
            else:
                stats["concepts_rejected"] += 1
                if not reject_unverified:
                    verified["concepts"].append(concept)
                else:
                    logger.info(
                        f"Rejected concept '{concept.get('term', '?')}': "
                        f"ROUGE-L precision {confidence:.3f} < {cls.ACCEPT_THRESHOLD} (source mismatch) | "
                        f"desc='{desc_clean[:100]}'")

        for rel in extraction.get("relationships", []):
            stats["relationships_total"] += 1
            quote = rel.get("source_quote", "")
            is_verified, confidence = cls.verify_reference(quote, source_text)

            if is_verified:
                rel["_verified"] = True
                rel["_confidence"] = confidence
                verified["relationships"].append(rel)
                stats["relationships_verified"] += 1
            else:
                stats["relationships_rejected"] += 1
                if not reject_unverified:
                    rel["_verified"] = False
                    rel["_confidence"] = confidence
                    verified["relationships"].append(rel)
                else:
                    logger.info(
                        f"Rejected relationship '{rel.get('source_concept_term', '?')}' -> "
                        f"'{rel.get('target_concept_term', '?')}': ROUGE-L precision {confidence:.3f} | "
                        f"source_quote='{quote[:100]}'")

        return verified, stats

class BatchedKnowledgeExtractor:

    def __init__(
        self,
        ai_provider: AIProvider | None = None,
        verify_sources: bool = True,
        reject_unverified: bool = True,
        model_key: str | None = None):

        self.ai_provider = ai_provider or AIProvider()
        self.prompt = EXTRACTION_PROMPT
        self.verify_sources = verify_sources
        self.reject_unverified = reject_unverified
        self.model_key = model_key

        provider_name = self._get_provider_name()
        config = PROVIDER_CONFIGS.get(provider_name)
        model = resolve_model(config, model_key) if config else None
        model_name = model.name if model else "unknown"

        logger.info(f"BatchedKnowledgeExtractor initialized")
        logger.info(f"  Prompt base tokens: {self.prompt.base_tokens}")
        logger.info(f"  Source verification: {verify_sources}")
        logger.info(f"  Provider: {provider_name}, Model: {model_name}")

    def _get_provider_name(self) -> str:

        for name, config in PROVIDER_CONFIGS.items():
            if self.model_key in config.models:
                return name
        return next(iter(PROVIDER_CONFIGS))

    def _merge_hints(self, accumulated: dict, new_hints: dict) -> dict:
        
        if not new_hints:
            return accumulated

        result = accumulated.copy()
        result["topics"] = list(set(
            result.get("topics", []) + new_hints.get("topics", [])))[:20]
        result["keywords"] = list(set(
            result.get("keywords", []) + new_hints.get("keywords", [])))[:30]

        if new_summary := new_hints.get("context_summary"):
            result["context_summary"] = new_summary

        return result

    def _verify_and_accumulate(
        self,
        extraction: dict,
        source_text: str,
        result: BatchExtractionResult,
        accumulated_hints: dict) -> dict:
        
        if self.verify_sources:
            extraction, stats = SourceReferenceVerifier.verify_extraction(
                extraction=extraction,
                source_text=source_text,
                reject_unverified=self.reject_unverified)
            result.concepts_verified += stats["concepts_verified"]
            result.concepts_rejected += stats["concepts_rejected"]
            result.relationships_verified += stats["relationships_verified"]
            result.relationships_rejected += stats["relationships_rejected"]

        result.all_extractions.append(extraction)
        result.total_concepts += len(extraction.get("concepts", []))
        result.total_relationships += len(extraction.get("relationships", []))
        result.total_learning_paths += len(extraction.get("learning_paths", []))

        if subject_hints := extraction.get("subject_hints"):
            accumulated_hints = self._merge_hints(accumulated_hints, subject_hints)

        return accumulated_hints

    def _parse_llm_response(self, response: str) -> tuple[dict | None, str | None]:

        try:

            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1]) if len(lines) > 2 else response
                if response.startswith("json"):
                    response = response[4:].strip()

            data = json.loads(response)
            extraction = LLMExtractionResponse.model_validate(data)
            return extraction.to_dict(), None

        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON: {e}"
            logger.warning(error_msg)
            return None, error_msg

        except Exception as e:
            error_msg = f"Validation error: {e}"
            logger.warning(error_msg)
            return None, error_msg

    async def _llm_extract(
        self,
        batch_content: str,
        batch_number: int,
        total_batches: int,
        page_range: str,
        document_title: str,
        source_id: str,
        hints: dict,
        user_id: str | None = None,
        llm_priority: LLMPriority = LLMPriority.NORMAL,
        user_priority: UserPriority = UserPriority.REGULAR) -> dict | None:

        hints_section = format_hints_section(hints)
        base_prompt = self.prompt.format_user_prompt(
            document_title = document_title,
            source_id = source_id,
            batch_number = batch_number,
            total_batches = total_batches,
            page_range = page_range,
            hints_section = hints_section,
            content = batch_content)

        max_retries = 3
        last_error = None

        for attempt in range(max_retries):

            try:

                if last_error and attempt > 0:
                    user_prompt = (
                        f"{base_prompt}\n\n"
                        f"IMPORTANT: Your previous response had an error: {last_error}\n"
                        f"Please fix this and return valid JSON.")
                else:
                    user_prompt = base_prompt

                provider_name = self._get_provider_name()
                config = PROVIDER_CONFIGS.get(provider_name)
                model = resolve_model(config, self.model_key) if config else None
                max_tokens = model.max_output_tokens if model else 4096
                logger.info(
                    "Batch %s/%s AI token accounting context: user_id=%s, prompt_chars=%s, provider=%s, model=%s",
                    batch_number,
                    total_batches,
                    user_id or "missing",
                    len(user_prompt),
                    provider_name,
                    model.name if model else "unknown")

                async with self.ai_provider.session(
                    system_prompt=self.prompt.system_prompt,
                    user_id=user_id) as s:
                    response = await self.ai_provider.generate(
                        prompt = user_prompt,
                        session = s,
                        temperature = 0.1,
                        json_mode = True,
                        max_tokens = max_tokens,
                        model_key = self.model_key,
                        llm_priority = llm_priority,
                        user_priority = user_priority)

                if not response:
                    last_error = "Empty response"
                    continue

                logger.info(f"Batch {batch_number} raw response: {len(response)} chars")

                extraction, error = self._parse_llm_response(response)

                if extraction:
                    logger.info(
                        f"Batch {batch_number}/{total_batches}: "
                        f"{len(extraction.get('concepts', []))} concepts, "
                        f"{len(extraction.get('relationships', []))} relationships")
                    return extraction

                last_error = error
                logger.warning(f"Batch {batch_number} attempt {attempt + 1} failed: {error}")

            except Exception as e:
                last_error = str(e)
                logger.error(f"Batch extraction failed: {e}")

            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)

        logger.error(f"Batch {batch_number} failed after {max_retries} attempts")
        return None

    async def extract_from_sections(
        self,
        sections: list[tuple[int, str]],
        document_title: str,
        source_id: str,
        inherited_hints: dict | None = None,
        user_id: str | None = None,
        use_semantic_batching: bool = True,
        llm_priority: LLMPriority = LLMPriority.NORMAL,
        user_priority: UserPriority = UserPriority.REGULAR) -> BatchExtractionResult:

        result = BatchExtractionResult()

        if not sections:
            return result

        provider_name = self._get_provider_name()
        hints = inherited_hints.copy() if inherited_hints else {}
        hints_tokens = estimate_hints_tokens(hints)

        _, max_chars = content_budget.calculate_content_budget(
            prompt_tokens = self.prompt.base_tokens,
            hints_tokens = hints_tokens,
            output_ratio = self.prompt.output_ratio,
            provider_name = provider_name,
            model_key = self.model_key)

        config = PROVIDER_CONFIGS.get(provider_name)
        model = resolve_model(config, self.model_key) if config else None
        model_name = model.name if model else "unknown"
        logger.info(f"Budget: model={model_name}, output_ratio={self.prompt.output_ratio}, max_chars={max_chars}")

        batches = None
        if use_semantic_batching and len(sections) > 3:
            try:
                section_texts = [text for _, text in sections]
                logger.info(f"Generating embeddings for {len(sections)} sections...")
                embeddings = await embedding_service.embed_batch(section_texts)
                batches = semantic_batcher.batch_by_similarity(
                    sections = sections,
                    embeddings = embeddings,
                    max_chars = max_chars)
            except Exception as e:
                logger.warning(f"Semantic batching failed, falling back to size-based: {e}")
                batches = None

        if batches is None:
            batches = content_budget.batch_by_size(
                sections = sections,
                prompt_tokens = self.prompt.base_tokens,
                hints_tokens = hints_tokens,
                output_ratio = self.prompt.output_ratio,
                provider_name = provider_name,
                model_key = self.model_key)

        result.total_batches = len(batches)
        logger.info(f"Processing {len(sections)} sections in {len(batches)} batches (parallel)")

        result = await self._run_parallel(
            batches = batches,
            document_title = document_title,
            source_id = source_id,
            hints = hints,
            user_id = user_id,
            llm_priority = llm_priority,
            user_priority = user_priority,
            result = result)

        logger.info(f"Extraction complete: {result.total_concepts} concepts, {result.total_relationships} relationships")
        return result

    def _get_max_concurrent(self) -> int:

        provider_name = self._get_provider_name()
        return self.ai_provider.get_provider_max_concurrent(provider_name)

    async def _run_parallel(
        self,
        batches: list,
        document_title: str,
        source_id: str,
        hints: dict,
        user_id: str | None,
        llm_priority: LLMPriority,
        user_priority: UserPriority,
        result: BatchExtractionResult) -> BatchExtractionResult:

        provider_name = self._get_provider_name()
        config = PROVIDER_CONFIGS.get(provider_name)
        if config and config.is_local and config.provider_name != "ollama":
            reachable = await self.ai_provider.check_provider_reachable(config)
            logger.info(f"Pre-dispatch health check: {config.provider_name} reachable={reachable}")

        max_concurrent = self._get_max_concurrent()
        logger.info(
            f"Starting extraction of {len(batches)} batches "
            f"(max {max_concurrent} concurrent, gated by provider semaphore)")

        batch_data = []
        for batch_idx, batch in enumerate(batches):
            page_numbers = [p[0] for p in batch]
            page_range = f"{min(page_numbers)}-{max(page_numbers)}"
            batch_content = "\n\n---PAGE BREAK---\n\n".join(
                f"[Page {page_num}]\n{text}" for page_num, text in batch)
            raw_source_text = "\n\n".join(text for _, text in batch)

            batch_data.append({
                "batch_idx": batch_idx,
                "batch_content": batch_content,
                "page_range": page_range,
                "raw_source_text": raw_source_text})

        results_list: list[tuple[int, dict | None, str] | Exception] = [None] * len(batch_data)

        async def extract_one(idx: int, data: dict):
            logger.info(f"Queued batch {data['batch_idx'] + 1}/{len(batches)}")
            try:
                extraction = await self._llm_extract(
                    batch_content = data["batch_content"],
                    batch_number = data["batch_idx"] + 1,
                    total_batches = len(batches),
                    page_range = data["page_range"],
                    document_title = document_title,
                    source_id = source_id,
                    hints = hints,
                    user_id = user_id,
                    llm_priority = llm_priority,
                    user_priority = user_priority)
                results_list[idx] = (data["batch_idx"], extraction, data["raw_source_text"])
            except Exception as e:
                results_list[idx] = e

        tasks = [extract_one(i, data) for i, data in enumerate(batch_data)]
        await asyncio.gather(*tasks)

        all_hints = {}
        for item in results_list:
            if isinstance(item, Exception):
                logger.error(f"Batch extraction error: {item}")
                result.errors.append(f"Batch extraction error: {str(item)}")
                continue

            if item is None:
                result.errors.append("Batch result missing")
                continue

            batch_idx, extraction, raw_source_text = item
            if extraction:
                all_hints = self._verify_and_accumulate(
                    extraction, raw_source_text, result, all_hints)
            else:
                result.errors.append(f"Batch {batch_idx + 1} extraction failed")

        result.final_hints = all_hints
        return result

    async def extract_from_text(
        self,
        text: str,
        document_title: str,
        source_id: str,
        inherited_hints: dict | None = None,
        user_id: str | None = None) -> BatchExtractionResult:

        result = BatchExtractionResult()

        if not text or len(text.strip()) < 50:
            return result

        provider_name = self._get_provider_name()
        accumulated_hints = inherited_hints.copy() if inherited_hints else {}
        hints_tokens = estimate_hints_tokens(accumulated_hints)

        chunks = content_budget.chunk_text_by_size(
            text = text,
            prompt_tokens = self.prompt.base_tokens,
            hints_tokens = hints_tokens,
            output_ratio = self.prompt.output_ratio,
            provider_name = provider_name,
            model_key = self.model_key)

        result.total_batches = len(chunks)
        logger.info(f"Processing {len(text)} chars in {len(chunks)} chunks")

        for chunk in chunks:

            page_range = f"chunk {chunk.chunk_index + 1}"

            extraction = await self._llm_extract(
                batch_content = chunk.text,
                batch_number = chunk.chunk_index + 1,
                total_batches = chunk.total_chunks,
                page_range = page_range,
                document_title = document_title,
                source_id = source_id,
                hints = accumulated_hints,
                user_id = user_id)

            if extraction:
                accumulated_hints = self._verify_and_accumulate(
                    extraction, chunk.text, result, accumulated_hints)
            else:
                result.errors.append(f"Chunk {chunk.chunk_index + 1} extraction failed")

        result.final_hints = accumulated_hints
        logger.info(f"Extraction complete: {result.total_concepts} concepts from {result.total_batches} chunks")
        return result

    def merge_extraction_results(self, batch_result: BatchExtractionResult) -> dict:

        merged = {
            "concepts": [],
            "relationships": [],
            "learning_paths": [],
            "subject_hints": batch_result.final_hints}

        seen_terms = set()
        seen_relationships = set()

        for extraction in batch_result.all_extractions:

            for concept in extraction.get("concepts", []):
                term = concept.get("term", "").lower().strip()
                if term and term not in seen_terms:
                    seen_terms.add(term)
                    merged["concepts"].append(concept)

            for rel in extraction.get("relationships", []):
                rel_key = (
                    rel.get("source_concept_term", "").lower(),
                    rel.get("target_concept_term", "").lower(),
                    rel.get("relationship_type", ""))
                if rel_key not in seen_relationships:
                    seen_relationships.add(rel_key)
                    merged["relationships"].append(rel)

            merged["learning_paths"].extend(extraction.get("learning_paths", []))

        logger.info(f"Merged: {len(merged['concepts'])} concepts, {len(merged['relationships'])} relationships")
        return merged

batched_extractor = BatchedKnowledgeExtractor(model_key="deepseek-reasoner")
