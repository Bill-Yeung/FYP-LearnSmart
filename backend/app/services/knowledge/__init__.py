"""
Knowledge Services

Provides knowledge graph building and management:
- LLM-based knowledge extraction
- Deduplication with LLM merge decisions
- Citation tracking utilities

Note: Vector store operations moved to app.repositories.qdrant_repository
"""
from app.services.knowledge.deduplication import (
    DeduplicationService,
    deduplication_service,
    DuplicateTier,
    MergeAction,
    DuplicateCheckResult
)
from app.services.knowledge.llm_extractor import batched_extractor
from app.services.knowledge.knowledge_retrieval_service import (
    KnowledgeRetrievalService,
    knowledge_service
)
from app.services.knowledge.citations import (
    extract_citations,
    extract_citations_detailed,
    extract_page_numbers,
    citation_coverage,
    remove_citations,
)

__all__ = [
    # Deduplication
    "DeduplicationService",
    "deduplication_service",
    "DuplicateTier",
    "MergeAction",
    "DuplicateCheckResult",
    # Knowledge Retrieval (cross-module)
    "KnowledgeRetrievalService",
    "knowledge_service",
    # Extraction
    "batched_extractor",
    # Citations
    "extract_citations",
    "extract_citations_detailed",
    "extract_page_numbers",
    "citation_coverage",
    "remove_citations",
]
