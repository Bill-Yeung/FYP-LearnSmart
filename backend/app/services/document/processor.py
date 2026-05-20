from uuid import UUID
import logging
import tempfile
import os
import base64

from app.models.document import DocumentType
from app.utils.document_utils import detect_document_type
from app.services.document.extraction_tree import ExtractionTree, ExtractionResult, NodeMetadata
from app.services.document.subprocessor import (
    pdf_processor,
    word_processor,
    excel_processor,
    powerpoint_processor,
    audio_processor,
    video_processor,
    image_processor)
from app.services.infrastructure.background_executor import run_in_background

logger = logging.getLogger(__name__)

class DocumentProcessor:

    def __init__(self):

        self._tree_processors = {
            DocumentType.pdf: pdf_processor,
            DocumentType.word: word_processor,
            DocumentType.excel: excel_processor,
            DocumentType.powerpoint: powerpoint_processor}

        self._simple_processors = {
            DocumentType.image: image_processor,
            DocumentType.audio: audio_processor,
            DocumentType.video: video_processor,}

    async def _process_with_tree_processor(
        self,
        processor,
        file_path: str,
        tree: ExtractionTree | None,
        parent_node_id: UUID | None) -> ExtractionTree:

        result_tree = await run_in_background(
            processor.process_sync,
            file_path = file_path,
            tree = tree,
            parent_node_id = parent_node_id)

        return result_tree if tree is None else tree

    def _add_node_to_tree(
        self,
        tree: ExtractionTree | None,
        file_path: str,
        doc_type: DocumentType,
        parent_node_id: UUID | None,
        metadata: NodeMetadata) -> ExtractionTree:

        if tree is None:
            tree = ExtractionTree()
            tree.add_root(
                source_path = file_path,
                document_type = doc_type.value,
                metadata = metadata)
        else:
            tree.add_child(
                parent_id = parent_node_id,
                source_path = file_path,
                document_type = doc_type.value,
                extraction_type = "embedded_document",
                metadata = metadata)

        return tree

    async def _process_simple(
        self,
        processor,
        file_path: str,
        doc_type: DocumentType,
        tree: ExtractionTree | None,
        parent_node_id: UUID | None) -> ExtractionTree:

        result = await run_in_background(processor.process, file_path)

        if not result.success:
            raise Exception(f"{doc_type.value.capitalize()} processing failed: {result.error}")

        return self._add_node_to_tree(
            tree, file_path, doc_type, parent_node_id,
            metadata = {"output_text": result.output_text})

    def _process_text(
        self,
        file_path: str,
        doc_type: DocumentType,
        tree: ExtractionTree | None,
        parent_node_id: UUID | None) -> ExtractionTree:

        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()

        return self._add_node_to_tree(
            tree, file_path, doc_type, parent_node_id,
            metadata = {"output_text": text})

    async def file_to_extraction_tree(
        self,
        file_path: str,
        document_type: DocumentType | str = DocumentType.text,
        tree: ExtractionTree | None = None,
        parent_node_id: UUID | None = None) -> ExtractionResult | None:

        if isinstance(document_type, str):
            doc_type = DocumentType(document_type)
        else:
            doc_type = document_type

        is_root = tree is None

        try:

            if doc_type in self._tree_processors:

                processor = self._tree_processors[doc_type]
                tree = await self._process_with_tree_processor(
                    processor, file_path, tree, parent_node_id)

            elif doc_type in self._simple_processors:
                processor = self._simple_processors[doc_type]
                tree = await self._process_simple(
                    processor, file_path, doc_type, tree, parent_node_id)

            elif doc_type == DocumentType.text:
                tree = self._process_text(
                    file_path, doc_type, tree, parent_node_id)

            else:
                raise Exception(f"Unsupported document type: {doc_type}")

            if is_root:
                return ExtractionResult(tree = tree)
            else:
                logger.debug(f"Processed embedded file: {file_path} (type: {doc_type.value})")
                return None

        except Exception as e:

            if is_root:
                logger.error(f"Document extraction failed for {file_path}: {e}")
            else:
                logger.warning(f"Failed to process embedded file {file_path}: {e}")
            raise

    async def process_embedded_files(self, tree: ExtractionTree) -> None:
        
        embedded_nodes = [
            node for node in tree.nodes.values()
            if node.extraction_type == "embedded_document" and node.metadata.get("data")]

        if not embedded_nodes:
            return

        logger.info(f"Processing {len(embedded_nodes)} embedded files...")

        for node in embedded_nodes:

            try:

                data_b64 = node.metadata.get("data")
                if not data_b64:
                    continue

                original_filename = node.metadata.get("original_filename", "embedded.bin")
                detected_type = detect_document_type(original_filename)

                if detected_type is None:
                    logger.debug(f"Skipping unsupported embedded file: {original_filename}")
                    continue

                file_bytes = base64.b64decode(data_b64)
                ext = os.path.splitext(original_filename)[1] if '.' in original_filename else '.bin'

                with tempfile.NamedTemporaryFile(suffix = ext, delete=False) as tmp:
                    tmp.write(file_bytes)
                    temp_path = tmp.name

                try:

                    await self.file_to_extraction_tree(
                        file_path = temp_path,
                        document_type = detected_type,
                        tree = tree,
                        parent_node_id = node.id)

                    node.document_type = detected_type.value
                    logger.debug(f"Processed embedded file: {original_filename}")

                finally:

                    if os.path.exists(temp_path):
                        os.unlink(temp_path)

            except Exception as e:
                logger.warning(f"Failed to process embedded file: {e}")

# Global instance
document_processor = DocumentProcessor()
