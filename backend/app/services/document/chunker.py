from typing import List, Optional
from dataclasses import dataclass
import re
import logging

from llama_index.core.node_parser import SemanticSplitterNodeParser
from llama_index.core.schema import Document
from app.core.utils import cosine_similarity

logger = logging.getLogger(__name__)

@dataclass
class ContentChunk:
    text: str
    chunk_index: int
    total_chunks: int
    start_char: int
    end_char: int

class SemanticChunker:

    def __init__(
        self,
        embed_model,
        buffer_size: int = 1,
        breakpoint_percentile_threshold: int = 95):

        self.splitter = SemanticSplitterNodeParser(
            embed_model = embed_model,
            buffer_size = buffer_size,
            breakpoint_percentile_threshold = breakpoint_percentile_threshold)

    def chunk_text(self, text: str, metadata: dict | None = None) -> list[dict]:

        if metadata is None:
            metadata = {}

        doc = Document(text=text, metadata=metadata)
        nodes = self.splitter.get_nodes_from_documents([doc])

        chunks = []

        for i, node in enumerate(nodes):
            chunks.append({
                "text": node.text,
                "metadata": {
                    **metadata,
                    "chunk_index": i,
                    **node.metadata}})

        return chunks

class SemanticBatcher:

    def __init__(
        self,
        similarity_threshold: float = 0.5,
        max_batch_sections: int = 15,
        min_batch_sections: int = 5):

        self.similarity_threshold = similarity_threshold
        self.max_batch_sections = max_batch_sections
        self.min_batch_sections = min_batch_sections

    def batch_by_similarity(
        self,
        sections: list[tuple[any, str]],
        embeddings: list[list[float]],
        max_chars: int) -> list[list[tuple[any, str]]]:

        if not sections:
            return []

        if len(sections) != len(embeddings):
            raise ValueError(
                f"Sections and embeddings count mismatch: {len(sections)} vs {len(embeddings)}")

        similarities = []
        for i in range(len(embeddings) - 1):
            sim = cosine_similarity(embeddings[i], embeddings[i + 1])
            similarities.append(sim)

        break_points = set()
        for i, sim in enumerate(similarities):
            if sim < self.similarity_threshold:
                break_points.add(i + 1)

        logger.debug(
            f"Semantic batcher found {len(break_points)} break points "
            f"at threshold {self.similarity_threshold}")

        batches = []
        current_batch = []
        current_chars = 0

        for i, (section_id, section_text) in enumerate(sections):

            section_chars = len(section_text)
            should_break = False

            if len(current_batch) >= self.max_batch_sections:
                should_break = True

            elif current_chars + section_chars > max_chars and current_batch:
                should_break = True

            elif i in break_points and current_batch and len(current_batch) >= self.min_batch_sections:
                should_break = True

            if should_break:
                batches.append(current_batch)
                current_batch = []
                current_chars = 0

            current_batch.append((section_id, section_text))
            current_chars += section_chars

        if current_batch:
            batches.append(current_batch)

        avg_sections = len(sections) / len(batches) if batches else 0
        logger.info(
            f"Semantic batching: {len(sections)} sections into {len(batches)} batches "
            f"(avg {avg_sections:.1f} sections/batch, "
            f"min {self.min_batch_sections}/max {self.max_batch_sections} per batch, "
            f"{len(break_points)} semantic breaks at threshold {self.similarity_threshold})")

        return batches

# Global instance
semantic_batcher = SemanticBatcher()