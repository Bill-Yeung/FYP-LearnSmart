import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass
from uuid import UUID

from app.models.document import DocumentType, ProcessingStatus
from app.services.infrastructure.file_storage_service import file_storage_service
from app.services.document.processor import document_processor
from app.utils.document_utils import detect_document_type, calculate_checksum
from app.services.messaging.notification_service import notification_service, NotificationType
from app.repositories.source_repository import SourceRepository
from app.repositories.media_repository import MediaRepository
from app.repositories.concept_repository import ConceptRepository
from app.repositories.procedure_repository import ProcedureRepository
from app.repositories.example_repository import ExampleRepository
from app.repositories.assessment_repository import AssessmentRepository
from app.repositories.relationship_repository import RelationshipRepository
from app.repositories.learningpath_repository import LearningPathRepository
from app.repositories.learningobject_repository import LearningObjectRepository
from app.repositories.taxonomy_repository import TaxonomyRepository
from app.services.knowledge.llm_extractor import batched_extractor
from app.services.knowledge.deduplication import deduplication_service, MergeAction, DuplicateTier
from app.services.ai.embeddings import embedding_service
from app.repositories.qdrant_repository import qdrant_repository
from app.repositories.neo4j_repository import neo4j_repository
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

@dataclass
class ProcessingResult:

    success: bool
    document_id: str
    document_type: DocumentType
    title: str
    concepts_extracted: int = 0
    relationships_created: int = 0
    error_message: str | None = None

class DocumentPipeline:

    def __init__(self):

        self.initialized = False
        self.postgres_pool = None
        self.embed_model = None
        self.document_processor = None

    async def initialize(
        self,
        postgres_pool,
        embed_model):

        if not postgres_pool:
            raise ValueError("postgres_pool is required")
        if not embed_model:
            raise ValueError("embed_model is required")

        self.postgres_pool = postgres_pool
        self.embed_model = embed_model
        self.document_processor = document_processor

        self.initialized = True
        logger.info("Document pipeline initialized successfully")

    async def upload_file(
        self,
        file,
        filename: str,
        db,
        title: str | None = None,
        is_public: bool = False,
        user_id: UUID | None = None,
        subject_ids: list[UUID] | None = None) -> tuple[str, str, DocumentType]:

        actual_title = title or filename
        doc_type = detect_document_type(filename)

        # Read file content (handle both sync and async file objects)

        result = file.read()
        file_content = await result if hasattr(result, '__await__') else result
        checksum = calculate_checksum(file_content)
        logger.info(f"Uploading file: {filename} (checksum: {checksum[:16]}...)")

        # Check for duplicates before saving to disk

        source_repo = SourceRepository(db)
        existing_source = await source_repo.find_by_checksum(checksum)
        if existing_source:
            raise ValueError(f"We detected the same file has been uploaded before as '{existing_source['document_name']}'. Please upload a different file.")

        media_repo = MediaRepository(db)
        existing_media = await media_repo.find_by_checksum(checksum)
        if existing_media:
            raise ValueError("We detected this file was previously extracted from another document. Please upload a different file.")

        # Save file to disk

        storage_result = await file_storage_service.save_file(
            file = file_content,
            filename = filename)
        file_path = storage_result["file_path"]

        # Create source record

        source_row = await source_repo.create(
            document_name = actual_title,
            document_type = doc_type.value,
            document_path = file_path,
            uploaded_by = user_id,
            is_public = is_public,
            processing_status = ProcessingStatus.pending,
            checksum = checksum)

        document_id = str(source_row["id"])

        # Link source to subjects
        if subject_ids:
            await source_repo.link_to_subjects(
                source_id = source_row["id"],
                subject_ids = subject_ids)

        logger.info(f"Created source record: {document_id}")

        return document_id, file_path, doc_type

    async def process_file_background(
        self,
        document_id: str,
        file_path: str,
        title: str,
        doc_type: DocumentType,
        user_id: str | None = None,
        subject_ids: str | None = None):

        result = ProcessingResult(
            success = False,
            document_id = document_id,
            title = title,
            document_type = doc_type)

        try:

            logger.info(f"[Background] Processing: {document_id}")

            # Update status to processing and Extract document structure

            await self._update_source_status(document_id, ProcessingStatus.processing)
            extraction_result = await self.document_processor.file_to_extraction_tree(
                file_path = file_path,
                document_type = doc_type)

            if not extraction_result or not extraction_result.tree:
                raise Exception("Document extraction failed")

            await self.document_processor.process_embedded_files(extraction_result.tree)
            await self._save_extraction_tree_media(document_id, extraction_result.tree)

            # Process with LLM extraction

            await self._process_extraction_tree(
                document_id = document_id,
                extraction_result = extraction_result,
                doc_type = doc_type,
                title = title,
                user_id = user_id,
                result = result,
                subject_ids = subject_ids)

            # Update extraction counts and status to completed

            await self._update_extraction_counts(
                document_id = document_id,
                concepts_extracted = result.concepts_extracted,
                relationships_extracted = result.relationships_created)
            await self._update_source_status(document_id, ProcessingStatus.completed)
            await self._notify_user(user_id, NotificationType.DOCUMENT_COMPLETED, {
                "document_id": document_id,
                "title": title,
                "status": ProcessingStatus.completed.value,
                "concepts_extracted": result.concepts_extracted,
                "message": "Document processing completed!"})

            result.success = True
            logger.info(f"[Background] Completed: {document_id} | Concepts: {result.concepts_extracted}")

        except Exception as e:

            result.error_message = str(e)
            logger.error(f"[Background] Failed: {document_id} | Error: {e}")

            try:

                await self._update_source_status(document_id, ProcessingStatus.failed, str(e))
                await self._notify_user(user_id, NotificationType.DOCUMENT_FAILED, {
                    "document_id": document_id,
                    "title": title,
                    "status": ProcessingStatus.failed.value,
                    "error": str(e)})
                
            except Exception:
                pass

    def _collect_node_text(self, tree, node, include_children: bool = True) -> str:

        text_parts = []
        node_text = node.metadata.get("output_text", "")
        if node_text:
            text_parts.append(node_text)

        if include_children:

            children = tree.get_children(node.id)

            for child in children:

                child_text = self._collect_node_text(tree, child, include_children = True)
                if child_text:
                    text_parts.append(child_text)

        return "\n".join(text_parts)

    def _get_section_type(self, doc_type: DocumentType) -> str:

        section_types = {
            DocumentType.pdf: "page",
            DocumentType.powerpoint: "slide",
            DocumentType.excel: "sheet",
            DocumentType.word: "section",
            DocumentType.text: "section",
            DocumentType.image: "image",
            DocumentType.audio: "audio",
            DocumentType.video: "video"}
        
        return section_types.get(doc_type, "section")

    def _is_structured_document(self, doc_type: DocumentType) -> bool:

        return doc_type in (
            DocumentType.pdf,
            DocumentType.powerpoint,
            DocumentType.word,
            DocumentType.excel)

    def _is_unstructured_document(self, doc_type: DocumentType) -> bool:

        return doc_type in (
            DocumentType.text,
            DocumentType.audio,
            DocumentType.video,
            DocumentType.image)

    async def _process_extraction_tree(
        self,
        document_id: str,
        extraction_result,
        doc_type: DocumentType,
        title: str,
        user_id: str | None,
        result: ProcessingResult,
        subject_ids: str | None = None):

        tree = extraction_result.tree

        if not tree.root_id:
            logger.warning("No root node in extraction tree")
            return

        sections = tree.get_children(tree.root_id)
        section_type = self._get_section_type(doc_type)
        if not sections:
            sections = [tree.get_node(tree.root_id)]

        logger.info(f"Processing {len(sections)} {section_type}(s) with batched LLM extraction")

        root_hints = extraction_result.get_inherited_hints(tree.root_id) or {}
        section_tuples = []

        for section_idx, section_node in enumerate(sections):

            section_text = self._collect_node_text(tree, section_node, include_children=True)
            if section_text:
                page_num = section_node.metadata.get("page_number", section_idx + 1)
                section_tuples.append((page_num, section_text))

        if not section_tuples:
            logger.warning("No text content found for extraction")
            return

        full_text = "\n\n".join(text for _, text in section_tuples)
        logger.info(
            "Document AI extraction context: document_id=%s, user_id=%s, sections=%s, text_chars=%s",
            document_id,
            user_id or "missing",
            len(section_tuples),
            len(full_text))
        try:
            await self._store_document_chunks(
                document_id = document_id,
                full_text = full_text)
        except Exception as e:
            logger.warning(f"Failed to store document chunks: {e}")

        if self._is_structured_document(doc_type):
            batch_result = await batched_extractor.extract_from_sections(
                sections = section_tuples,
                document_title = title,
                source_id = document_id,
                inherited_hints = root_hints,
                user_id = user_id)
        else:
            full_text = "\n\n".join(text for _, text in section_tuples)
            batch_result = await batched_extractor.extract_from_text(
                text = full_text,
                document_title = title,
                source_id = document_id,
                inherited_hints = root_hints,
                user_id = user_id)

        for error in batch_result.errors:
            logger.warning(f"Extraction error: {error}")

        if batch_result.all_extractions:
            merged_extraction = batched_extractor.merge_extraction_results(batch_result)

            try:
                extraction_output = {
                    "document_id": document_id,
                    "document_title": title,
                    "total_concepts": len(merged_extraction.get("concepts", [])),
                    "total_relationships": len(merged_extraction.get("relationships", [])),
                    "total_learning_paths": len(merged_extraction.get("learning_paths", [])),
                    "batches": batch_result.total_batches,
                    "verification": {
                        "concepts_verified": batch_result.concepts_verified,
                        "concepts_rejected": batch_result.concepts_rejected,
                        "relationships_verified": batch_result.relationships_verified,
                        "relationships_rejected": batch_result.relationships_rejected,
                    },
                    "errors": batch_result.errors,
                    **merged_extraction,
                }
                await file_storage_service.save_text_file(
                    content=json.dumps(extraction_output, indent=2, ensure_ascii=False),
                    filename=f"{document_id}.json",
                    subdirectory="extractions")
                logger.info(f"Extraction results saved to extractions/{document_id}.json")
            except Exception as e:
                logger.warning(f"Failed to save extraction results file: {e}")

            logger.info(
                f"Extraction summary: {len(merged_extraction.get('concepts', []))} concepts, "
                f"{len(merged_extraction.get('relationships', []))} relationships, "
                f"{len(merged_extraction.get('learning_paths', []))} learning paths "
                f"(verified: {batch_result.concepts_verified}c/{batch_result.relationships_verified}r, "
                f"rejected: {batch_result.concepts_rejected}c/{batch_result.relationships_rejected}r)")

        if batch_result.all_extractions:

            await self._store_extraction_results(
                document_id = document_id,
                extraction = merged_extraction,
                user_id = user_id,
                title = title,
                result = result,
                subject_ids = subject_ids)

            if batch_result.final_hints:
                extraction_result.set_subject_hints(tree.root_id, batch_result.final_hints)

        logger.info(
            f"LLM extraction complete: {result.concepts_extracted} concepts, "
            f"{result.relationships_created} relationships "
            f"(from {batch_result.total_batches} batches)")

    async def _store_extraction_results(
        self,
        document_id: str,
        extraction: dict,
        user_id: str | None,
        title: str,
        result: ProcessingResult,
        subject_ids: str | None = None):

        if not self.postgres_pool:
            return

        subject_uuid_list: list[UUID] = []
        if subject_ids:
            for sid in subject_ids.split(","):
                sid = sid.strip()
                if sid:
                    try:
                        subject_uuid_list.append(UUID(sid))
                    except ValueError:
                        pass

        async with self.postgres_pool.acquire() as conn:

            concept_repo = ConceptRepository(conn)
            procedure_repo = ProcedureRepository(conn)
            example_repo = ExampleRepository(conn)
            assessment_repo = AssessmentRepository(conn)
            relationship_repo = RelationshipRepository(conn)
            learning_path_repo = LearningPathRepository(conn)
            learning_object_repo = LearningObjectRepository(conn)
            taxonomy_repo = TaxonomyRepository(conn)

            user_uuid = UUID(user_id) if user_id else None
            doc_uuid = UUID(document_id)
            concept_id_map = {}

            for concept_data in extraction.get("concepts", []):

                try:

                    concept_id = await self._store_concept(
                        concept_repo, procedure_repo, example_repo, assessment_repo,
                        relationship_repo, learning_object_repo, taxonomy_repo,
                        concept_data, doc_uuid, user_uuid)
                    if concept_id:
                        concept_id_map[concept_data["term"]] = concept_id
                        result.concepts_extracted += 1

                        # Auto-link concept to all document subjects
                        for sub_uuid in subject_uuid_list:
                            try:
                                await concept_repo.link_to_subject(
                                    concept_id = concept_id,
                                    subject_id = sub_uuid,
                                    relevance = "core",
                                    created_by = user_uuid)
                            except Exception as sub_e:
                                logger.warning(f"Failed to link concept to subject: {sub_e}")

                except Exception as e:
                    logger.error(f"Failed to store concept '{concept_data.get('term')}': {e}")

            for rel_data in extraction.get("relationships", []):
                try:
                    source_id = concept_id_map.get(rel_data.get("source_concept_term"))
                    target_id = concept_id_map.get(rel_data.get("target_concept_term"))
                    if source_id and target_id:
                        await self._store_relationship(
                            relationship_repo, rel_data, source_id, target_id, doc_uuid, user_uuid)
                        result.relationships_created += 1
                except Exception as e:
                    logger.error(f"Failed to store relationship: {e}")

            for path_data in extraction.get("learning_paths", []):
                try:
                    await self._store_learning_path(
                        learning_path_repo, path_data, concept_id_map, user_uuid)
                except Exception as e:
                    logger.error(f"Failed to store learning path: {e}")

            await self._store_concept_embeddings(
                extraction.get("concepts", []),
                concept_id_map,
                document_id)

            try:
                await neo4j_repository.store_extraction_graph(
                    document_id = document_id,
                    doc_title = title,
                    concepts = extraction.get("concepts", []),
                    relationships = extraction.get("relationships", []),
                    concept_id_map = concept_id_map)
            except Exception as e:
                logger.error(f"Failed to store graph in Neo4j: {e}")

    async def _store_concept(
        self,
        concept_repo: ConceptRepository,
        procedure_repo: ProcedureRepository,
        example_repo: ExampleRepository,
        assessment_repo: AssessmentRepository,
        relationship_repo: RelationshipRepository,
        learning_object_repo: LearningObjectRepository,
        taxonomy_repo: TaxonomyRepository,
        concept_data: dict,
        doc_uuid: UUID,
        user_uuid: UUID | None) -> UUID | None:

        concept_type = concept_data.get("concept_type", "definition")
        term = concept_data.get("term", "")
        description = concept_data.get("description", "")
        difficulty = concept_data.get("difficulty_level")
        keywords = concept_data.get("keywords", [])
        formula_latex = concept_data.get("formula_latex")
        formula_plain = concept_data.get("formula_plain_text")
        language = concept_data.get("language", "en")
        source_pages = concept_data.get("source_pages", [])
        source_location = concept_data.get("source_location")
        suggested_lcc = concept_data.get("suggested_lcc_code")

        async def _merge_into_existing(existing_id: UUID) -> UUID:

            await concept_repo.link_to_source(
                concept_id = existing_id,
                source_id = doc_uuid,
                pages = source_pages if source_pages else None,
                location = source_location,
                created_by = user_uuid)

            if description:
                await concept_repo.append_description(
                    concept_id = existing_id,
                    language = language,
                    new_description = description,
                    new_keywords = keywords if keywords else None)

            try:
                await neo4j_repository.link_concept_to_source(
                    concept_id = str(existing_id),
                    source_id = str(doc_uuid))
            except Exception as e:
                logger.warning(f"Failed to link concept {existing_id} to source in Neo4j: {e}")

            if description or keywords:
                try:
                    await qdrant_repository.update_concept_payload(
                        concept_id = str(existing_id),
                        description = description,
                        keywords = keywords if keywords else None)
                except Exception as e:
                    logger.warning(f"Failed to update concept {existing_id} payload in Qdrant: {e}")

            return existing_id

        # Deduplication 1: Exact Match

        existing_concept = await concept_repo.find_exact_match(
            title = term, concept_type = concept_type, language = language)

        if existing_concept:
            logger.info(f"Dedup (exact): Found existing concept '{term}', linking to source")
            return await _merge_into_existing(existing_concept["id"])

        # Deduplication 2: Semantic Similarity with LLM Decision

        related_concept_id = None
        relationship_type = None

        try:

            embedding_text = f"{term} [{concept_type}]"
            if suggested_lcc:
                embedding_text += f" [{suggested_lcc}]"

            concept_embedding = await embedding_service.embed(embedding_text)
            await qdrant_repository.ensure_collection()

            similar_concepts = await qdrant_repository.find_similar_concepts(
                query_embedding = concept_embedding,
                similarity_threshold = deduplication_service.RELATED_THRESHOLD, limit = 3)

            if similar_concepts:

                new_concept = {"term": term, "description": description, "keywords": keywords}
                dedup_result = await deduplication_service.check_duplicate(
                    new_concept = new_concept,
                    similar_concepts = similar_concepts)

                if dedup_result.tier == DuplicateTier.EXACT:

                    logger.info(
                        f"Dedup (semantic exact): '{term}' matches '{dedup_result.existing_concept_name}' "
                        f"(score: {dedup_result.similarity_score:.3f})")
                    return await _merge_into_existing(UUID(dedup_result.existing_concept_id))

                elif dedup_result.tier == DuplicateTier.RELATED:

                    if dedup_result.action == MergeAction.MERGE:

                        logger.info(
                            f"Dedup (LLM merge): '{term}' → '{dedup_result.existing_concept_name}' "
                            f"Reason: {dedup_result.reason}")
                        return await _merge_into_existing(UUID(dedup_result.existing_concept_id))

                    elif dedup_result.action == MergeAction.CREATE_WITH_RELATIONSHIP:
                        
                        related_concept_id = UUID(dedup_result.existing_concept_id)
                        relationship_type = dedup_result.relationship_type or "related_to"
                        logger.info(
                            f"Dedup (LLM relate): '{term}' will be linked to "
                            f"'{dedup_result.existing_concept_name}' via '{relationship_type}'")

                    elif dedup_result.action == MergeAction.RENAME_EXISTING:

                        existing_id = UUID(dedup_result.existing_concept_id)

                        if dedup_result.new_title:

                            await concept_repo.update_title(
                                concept_id = existing_id, language = language,
                                new_title = dedup_result.new_title)
                            logger.info(
                                f"Dedup (LLM rename): '{dedup_result.existing_concept_name}' "
                                f"→ '{dedup_result.new_title}'")

                            try:
                                rename_text = f"{dedup_result.new_title} [{concept_type}]"
                                if suggested_lcc:
                                    rename_text += f" [{suggested_lcc}]"
                                new_embedding = await embedding_service.embed(rename_text)
                                await qdrant_repository.update_concept_embedding(
                                    concept_id = str(existing_id),
                                    new_name = dedup_result.new_title,
                                    new_embedding = new_embedding)
                            except Exception as e:
                                logger.warning(f"Failed to update Qdrant after rename: {e}")

                        return await _merge_into_existing(existing_id)

        except Exception as e:
            logger.debug(f"Semantic dedup check failed for '{term}': {e}")

        concept_row = await concept_repo.create(
            concept_type = concept_type,
            created_by = user_uuid,
            difficulty_level = difficulty,
            formula_latex = formula_latex)
        concept_id = concept_row["id"]

        await concept_repo.add_translation(
            concept_id = concept_id,
            language = language,
            title = term,
            description = description,
            keywords = keywords,
            formula_plain_text = formula_plain,
            is_primary = True,
            translation_quality = "source")

        await concept_repo.link_to_source(
            concept_id = concept_id,
            source_id = doc_uuid,
            pages = source_pages if source_pages else None,
            location = source_location,
            created_by = user_uuid)

        if concept_type == "procedure":

            proc_row = await procedure_repo.create(
                concept_id = concept_id,
                expected_duration_minutes = concept_data.get("estimated_time_minutes"))
            await procedure_repo.add_translation(
                procedure_id = proc_row["id"],
                language = language,
                purpose = concept_data.get("purpose"),
                preconditions = json.dumps(concept_data.get("preconditions", [])),
                steps = json.dumps(concept_data.get("steps", [])),
                failure_modes = json.dumps(concept_data.get("failure_modes", [])),
                verification_checks = json.dumps(concept_data.get("verification_checks", [])),
                is_primary = True,
                translation_quality = "source")

        elif concept_type == "example":
            example_row = await example_repo.create(concept_id = concept_id)
            await example_repo.add_translation(
                example_id = example_row["id"],
                language = language,
                context = concept_data.get("context"),
                inputs = json.dumps(concept_data.get("inputs", {})),
                outcome = concept_data.get("outcome"),
                lessons_learned = concept_data.get("lessons_learned"),
                is_primary = True,
                translation_quality = "source")

        elif concept_type == "assessment":
            assess_row = await assessment_repo.create(
                concept_id = concept_id,
                question_type = concept_data.get("question_type", "short_answer"),
                estimated_time_minutes = concept_data.get("estimated_time_minutes"))

            question_text = concept_data.get("question") or description or term
            await assessment_repo.add_translation(
                assessment_id = assess_row["id"],
                language = language,
                question = question_text,
                correct_answer = concept_data.get("correct_answer", ""),
                answer_explanations = json.dumps(concept_data.get("answer_explanations", [])),
                is_primary = True,
                translation_quality = "source")

        elif concept_type == "learning_object":
            lo_row = await learning_object_repo.create(
                concept_id = concept_id,
                format = concept_data.get("object_type"),
                duration_minutes = concept_data.get("estimated_duration_minutes"))
            learning_objectives = []
            if obj := concept_data.get("learning_objective"):
                learning_objectives.append(obj)
            await learning_object_repo.add_translation(
                learning_object_id = lo_row["id"],
                language = language,
                learning_objectives = learning_objectives if learning_objectives else None,
                is_primary = True,
                translation_quality = "source")

        suggested_lcc = concept_data.get("suggested_lcc_code")
        if suggested_lcc:
            try:
                taxonomy_node = await taxonomy_repo.get_node_by_code(suggested_lcc)
                if taxonomy_node:
                    await taxonomy_repo.link_concept(
                        concept_id = concept_id,
                        taxonomy_node_id = taxonomy_node["id"],
                        is_primary = True,
                        created_by = user_uuid)
                else:
                    logger.debug(f"LCC code '{suggested_lcc}' not found in taxonomy_nodes")
            except Exception as e:
                logger.debug(f"Failed to link concept '{term}' to LCC '{suggested_lcc}': {e}")

        if related_concept_id and relationship_type:
            try:
                await self._store_relationship(
                    relationship_repo = relationship_repo,
                    rel_data = {
                        "relationship_type": relationship_type,
                        "description": f"Auto-created by deduplication: '{term}' related to existing concept",
                        "strength": 0.7,
                        "language": language},
                    source_concept_id = concept_id,
                    target_concept_id = related_concept_id,
                    doc_uuid = doc_uuid,
                    user_uuid = user_uuid)

                await neo4j_repository.merge_relationship(
                    source_concept_id = str(concept_id),
                    target_concept_id = str(related_concept_id),
                    relationship_type = relationship_type,
                    strength = 0.7,
                    source_document = str(doc_uuid))

                logger.info(f"Created dedup relationship: {term} --[{relationship_type}]--> existing concept")
            except Exception as e:
                logger.warning(f"Failed to create dedup relationship for '{term}': {e}")

        return concept_id

    async def _store_relationship(
        self,
        relationship_repo: RelationshipRepository,
        rel_data: dict,
        source_concept_id: UUID,
        target_concept_id: UUID,
        doc_uuid: UUID,
        user_uuid: UUID | None):

        rel_type = rel_data.get("relationship_type", "related_to")
        description = rel_data.get("description", "")
        strength = rel_data.get("strength", 0.5)
        language = rel_data.get("language", "en")
        source_pages = rel_data.get("source_pages", [])
        source_location = rel_data.get("source_location")

        if rel_type == "custom":
            try:
                await relationship_repo.upsert_discovered_relationship(
                    suggested_relationship = description[:100] if description else "unknown",
                    example_context = {
                        "source": rel_data.get("source_concept_term", ""),
                        "target": rel_data.get("target_concept_term", ""),
                        "text_snippet": rel_data.get("source_quote", "")[:200],
                        "document_id": str(doc_uuid)})
            except Exception as e:
                logger.debug(f"Failed to track discovered relationship: {e}")

        rel_type_row = await relationship_repo.find_type_by_name(rel_type)

        if not rel_type_row:
            logger.debug(f"Skipping unknown relationship type '{rel_type}'")
            return

        if rel_type_row:

            rel_type_id = rel_type_row["id"]

        else:

            new_rel = await relationship_repo.create_type(
                relationship_type = rel_type,
                direction = "unidirectional",
                strength = strength)
            rel_type_id = new_rel["id"]

            await relationship_repo.add_translation(
                relationship_id = rel_type_id,
                language = language,
                name = rel_type.replace("_", " ").title(),
                description = description,
                is_primary = True,
                translation_quality = "source")

        concept_rel = await relationship_repo.create_concept_relationship(
            relationship_id = rel_type_id,
            source_concept_id = source_concept_id,
            target_concept_id = target_concept_id,
            strength = strength,
            created_by = user_uuid)

        if concept_rel:
            await relationship_repo.link_to_source(
                relationship_id = concept_rel["id"],
                source_id = doc_uuid,
                pages = source_pages if source_pages else None,
                location = source_location,
                created_by = user_uuid)

    async def _store_learning_path(
        self,
        learning_path_repo: LearningPathRepository,
        path_data: dict,
        concept_id_map: dict,
        user_uuid: UUID | None):

        title = path_data.get("title", "")
        description = path_data.get("description", "")
        target_term = path_data.get("target_concept_term")
        steps = path_data.get("steps", [])
        language = path_data.get("language", "en")

        target_concept_id = concept_id_map.get(target_term) if target_term else None

        path_row = await learning_path_repo.create(
            target_concept_id = target_concept_id,
            created_by = user_uuid)
        path_id = path_row["id"]

        await learning_path_repo.add_translation(
            learning_path_id = path_id,
            language = language,
            title = title,
            description = description,
            is_primary = True,
            translation_quality = "source")

        for idx, step in enumerate(steps):

            step_concept_term = step.get("concept_term")
            step_concept_id = concept_id_map.get(step_concept_term)
            if not step_concept_id:
                continue

            step_row = await learning_path_repo.add_step(
                path_id = path_id,
                concept_id = step_concept_id,
                step_order = idx + 1,
                is_required = step.get("is_required", True),
                estimated_time_minutes = step.get("estimated_time_minutes"))

            if step_row and step.get("notes"):
                await learning_path_repo.add_step_translation(
                    step_id = step_row["id"],
                    language = language,
                    notes = step.get("notes"),
                    is_primary = True,
                    translation_quality = "source")

    async def _store_document_chunks(
        self,
        document_id: str,
        full_text: str):

        if not full_text or not self.postgres_pool:
            return

        doc_uuid = UUID(document_id)

        # 1. Store full text in PostgreSQL

        try:
            async with self.postgres_pool.acquire() as conn:
                source_repo = SourceRepository(conn)
                await source_repo.update_full_text(
                    source_id = doc_uuid,
                    full_text = full_text)
            logger.info(f"Stored full text ({len(full_text)} chars) for document {document_id}")
        except Exception as e:
            logger.error(f"Failed to store full text for {document_id}: {e}")
            return

        # 2. Split into RAG-sized chunks

        splitter = RecursiveCharacterTextSplitter(
            chunk_size = 500,
            chunk_overlap = 50,
            length_function = len,
            separators = ["\n\n", "\n", ". ", " ", ""])

        raw_chunks = splitter.split_text(full_text)
        if not raw_chunks:
            return

        chunks = []
        current_pos = 0
        for i, chunk_text in enumerate(raw_chunks):
            start = full_text.find(chunk_text[:100], current_pos) if len(chunk_text) >= 100 else full_text.find(chunk_text, current_pos)
            if start == -1:
                start = current_pos
            chunks.append({
                "text": chunk_text,
                "chunk_index": i,
                "total_chunks": len(raw_chunks),
                "start_char": start,
                "end_char": start + len(chunk_text),})
            current_pos = start + len(chunk_text) - 50

        # 3. Embed all chunks

        try:
            chunk_texts = [c["text"] for c in chunks]
            embeddings = await embedding_service.embed_batch(chunk_texts)
        except Exception as e:
            logger.error(f"Failed to embed chunks for {document_id}: {e}")
            return

        # 4. Store in Qdrant (references only, no text)

        try:
            await qdrant_repository.ensure_collection()
            stored = await qdrant_repository.add_document_chunks(
                document_id = document_id,
                chunks = chunks,
                embeddings = embeddings)
            logger.info(f"Stored {stored} chunk embeddings for document {document_id}")
        except Exception as e:
            logger.error(f"Failed to store chunk embeddings for {document_id}: {e}")

    async def _store_concept_embeddings(
        self,
        concepts: list[dict],
        concept_id_map: dict[str, UUID],
        document_id: str):

        if not concepts:
            return

        try:

            await qdrant_repository.ensure_collection()

            stored_count = 0
            for concept_data in concepts:
                term = concept_data.get("term", "")
                concept_id = concept_id_map.get(term)

                if not concept_id:
                    logger.warning(f"Concept '{term}' not in concept_id_map, skipping embedding")
                    continue

                concept_type = concept_data.get("concept_type", "definition")
                lcc_code = concept_data.get("suggested_lcc_code")
                embedding_text = f"{term} [{concept_type}]"
                if lcc_code:
                    embedding_text += f" [{lcc_code}]"

                try:
                    embedding = await embedding_service.embed(embedding_text)
                except Exception as e:
                    logger.warning(f"Failed to generate embedding for '{term}': {e}")
                    continue

                try:
                    await qdrant_repository.add_concept_embedding(
                        concept_id = str(concept_id),
                        concept_name = term,
                        description = concept_data.get("description", ""),
                        keywords = concept_data.get("keywords", []),
                        learning_objectives = [],
                        difficulty = concept_data.get("difficulty_level", "intermediate"),
                        concept_type = concept_type,
                        embedding = embedding,
                        subject = None,
                        lcc_code = lcc_code)
                    stored_count += 1
                except Exception as e:
                    logger.warning(f"Failed to store embedding for '{term}': {e}")
                    continue

            logger.info(f"Stored {stored_count}/{len(concepts)} concept embeddings for document {document_id}")

        except Exception as e:
            logger.error(f"Failed to store concept embeddings: {e}")

    async def _save_extraction_tree_media(self, document_id: str, extraction_tree):
  
        if not self.postgres_pool:
            return

        root_node = extraction_tree.get_node(extraction_tree.root_id)
        root_children = extraction_tree.get_children(root_node.id)
        media_nodes = []

        for child in root_children:

            if child.extraction_type in ("page", "slide", "sheet"):
                page_children = extraction_tree.get_children(child.id)
                logger.debug(f"Collecting {len(page_children)} media from {child.source_path}, page metadata: {child.metadata.get('page_number')}")
                for media_child in page_children:
                    logger.debug(f"  - Media node: {media_child.source_path}, extraction_location: '{media_child.metadata.get('extraction_location')}'")
                media_nodes.extend(page_children)

            elif child.extraction_type in ("text_content", "headers", "footers",
                "footnotes", "endnotes", "comments", "equations", "full_ocr"):
                continue

            else:
                media_nodes.append(child)

        async with self.postgres_pool.acquire() as conn:

            source_repo = SourceRepository(conn)
            media_repo = MediaRepository(conn)

            for node in media_nodes:
                await self._save_media_node(source_repo, media_repo, document_id, node)

    def _map_document_type_to_media_type(self, document_type: str) -> str | None:

        mapping = {
            'table': 'text',
            'chart': 'image',
            'diagram': 'image',
            'code': 'text',
            'website': 'text'}
        
        valid_types = {'pdf', 'word', 'excel', 'powerpoint', 
                       'image', 'video', 'audio', 'text'}

        if document_type in valid_types:
            return document_type

        if document_type in mapping:
            return mapping[document_type]

        return None

    async def _save_media_node(
        self,
        source_repo: SourceRepository,
        media_repo: MediaRepository,
        document_id: str,
        node):

        logger.debug(f"_save_media_node called for: {node.source_path}, extraction_location in metadata: '{node.metadata.get('extraction_location')}'")

        media_type = self._map_document_type_to_media_type(node.document_type)

        if media_type is None:
            logger.debug(f"Skipping unsupported media type: {node.document_type}")
            return

        file_url = None
        checksum = None
        storage_method = "local_path"

        if node.metadata.get("data"):

            try:

                file_bytes = base64.b64decode(node.metadata["data"])
                checksum = calculate_checksum(file_bytes)

                if await source_repo.find_by_checksum(checksum):
                    return
                if await media_repo.find_by_checksum(checksum):
                    return

                suggested_filename = node.metadata.get("suggested_filename")
                if not suggested_filename:
                    ext = node.metadata.get("format", "bin")
                    suggested_filename = f"{document_id}_{node.extraction_type}_{str(node.id)[:8]}.{ext}"

                save_result = await file_storage_service.save_file(
                    file = file_bytes,
                    filename = suggested_filename,
                    subdirectory = f"extracted/{document_id}")
                
                file_url = save_result["file_path"]
                node.metadata.pop("data", None)

            except Exception as e:
                logger.warning(f"Failed to save media: {e}")
                return
            
        else:

            if media_type == "image" and node.document_type in ("chart", "diagram"):
                logger.debug(f"Skipping {node.document_type} without image data: {node.source_path}")
                return

            file_url = node.source_path

        pages = self._extract_pages(node.metadata.get("extraction_location"))
        content = node.metadata.get("output_text")

        logger.debug(f"Saving media: extraction_location='{node.metadata.get('extraction_location')}' -> pages={pages}")

        await media_repo.create(
            source_id = UUID(document_id),
            media_type = media_type,
            storage_method = storage_method,
            file_url = file_url,
            checksum = checksum,
            pages = pages,
            extraction_location = node.metadata.get("extraction_location"),
            metadata = node.metadata if node.metadata else None,
            content = content)

    def _extract_pages(self, extraction_location: str | None) -> list[int] | None:

        if not extraction_location:
            return None

        match = re.search(r'page\s+(\d+)', extraction_location)
        if match:
            return [int(match.group(1))]

        match = re.search(r'pages\s+(\d+)-(\d+)', extraction_location)
        if match:
            return list(range(int(match.group(1)), int(match.group(2)) + 1))

        return None

    async def _update_extraction_counts(
        self,
        document_id: str,
        concepts_extracted: int,
        relationships_extracted: int):

        if not self.postgres_pool:
            return

        async with self.postgres_pool.acquire() as conn:

            source_repo = SourceRepository(conn)
            await source_repo.update_extraction_counts(
                source_id = UUID(document_id),
                concepts_extracted = concepts_extracted,
                relationships_extracted = relationships_extracted)

    async def _update_source_status(
        self,
        document_id: str,
        status: ProcessingStatus,
        error_message: str | None = None):

        if not self.postgres_pool:
            return

        async with self.postgres_pool.acquire() as conn:

            source_repo = SourceRepository(conn)
            await source_repo.update_status(
                source_id = UUID(document_id),
                status = status,
                error_message = error_message)

    async def _notify_user(
        self,
        user_id: str | None,
        event_type: NotificationType,
        data: dict):

        if user_id and self.postgres_pool:

            async with self.postgres_pool.acquire() as db:
                await notification_service.notify(
                    user_id = str(user_id),
                    event_type = event_type,
                    data = data,
                    db = db)

# Global instance
document_pipeline = DocumentPipeline()
