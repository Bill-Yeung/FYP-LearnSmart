import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from uuid import UUID

from app.services.ai.embeddings import embedding_service
from app.repositories.qdrant_repository import qdrant_repository
from app.repositories.concept_repository import ConceptRepository
from app.repositories.relationship_repository import RelationshipRepository
from app.services.ai.provider import AIProvider

logger = logging.getLogger(__name__)

@dataclass
class RetrievalResult:
    concept_matches: List[Dict[str, Any]] = field(default_factory=list)
    related_concepts: List[Dict[str, Any]] = field(default_factory=list)
    prerequisites: List[Dict[str, Any]] = field(default_factory=list)
    context_text: str = ""
    vector_results_count: int = 0
    graph_results_count: int = 0


@dataclass
class HybridContext:
    relevant_chunks: List[str] = field(default_factory=list)
    definitions: List[Dict[str, str]] = field(default_factory=list)
    prerequisites: List[str] = field(default_factory=list)
    related: List[Dict[str, str]] = field(default_factory=list)

class HybridRetrievalService:

    def __init__(self, ai_provider: Optional[AIProvider] = None):
        self.ai_provider = ai_provider or AIProvider()

    async def query(
        self,
        question: str,
        db_connection,
        top_k: int = 5,
        include_prerequisites: bool = True,
        include_related: bool = True,
        max_graph_depth: int = 2,
        language: str = "en"
    ) -> RetrievalResult:

        result = RetrievalResult()

        # Step 1: Vector similarity search
        
        try:
            query_embedding = await embedding_service.embed(question)
            vector_results = await qdrant_repository.search(
                query_embedding=query_embedding,
                limit=top_k,
                score_threshold=0.5
            )
            result.vector_results_count = len(vector_results)

            for vr in vector_results:
                result.concept_matches.append({
                    "concept_id": vr.get("concept_id"),
                    "name": vr.get("name"),
                    "description": vr.get("description"),
                    "type": vr.get("type"),
                    "score": vr.get("score", 0.0),
                    "source": "vector"
                })

        except Exception as e:
            logger.warning(f"Vector search failed: {e}")

        # Step 2: Graph expansion
        
        if db_connection and (include_prerequisites or include_related):
            concept_repo = ConceptRepository(db_connection)
            relationship_repo = RelationshipRepository(db_connection)

            concept_ids = [m["concept_id"] for m in result.concept_matches if m.get("concept_id")]

            for concept_id in concept_ids[:3]:
                try:
                    concept_uuid = UUID(concept_id) if isinstance(concept_id, str) else concept_id

                    if include_related:
                        related = await relationship_repo.get_concept_relationships(
                            concept_id=concept_uuid,
                            language=language,
                            direction="both"
                        )

                        for rel in related[:5]:
                            rel_concept = {
                                "concept_id": str(rel.get("target_concept_id") or rel.get("source_concept_id")),
                                "name": rel.get("target_title") or rel.get("source_title"),
                                "relationship_type": rel.get("relationship_type"),
                                "relationship_name": rel.get("relationship_name"),
                                "source": "graph"
                            }
                            if rel_concept not in result.related_concepts:
                                result.related_concepts.append(rel_concept)

                    if include_prerequisites:
                        prereq_rels = await relationship_repo.get_by_type(
                            concept_id=concept_uuid,
                            relationship_type="prerequisite_of",
                            language=language
                        )

                        for rel in prereq_rels:
                            prereq = {
                                "concept_id": str(rel.get("target_concept_id")),
                                "name": rel.get("related_concept_title"),
                                "description": rel.get("related_concept_description"),
                                "source": "graph"
                            }
                            if prereq not in result.prerequisites:
                                result.prerequisites.append(prereq)

                except Exception as e:
                    logger.warning(f"Graph expansion failed for concept {concept_id}: {e}")

            result.graph_results_count = len(result.related_concepts) + len(result.prerequisites)

        # Step 3: Build combined context
        result.context_text = self._build_context_text(result, language)

        return result

    def _build_context_text(self, result: RetrievalResult, language: str) -> str:

        parts = []

        if result.concept_matches:
            parts.append("## Relevant Concepts\n")
            for match in result.concept_matches:
                name = match.get("name", "Unknown")
                description = match.get("description", "")
                score = match.get("score", 0.0)
                parts.append(f"**{name}** (relevance: {score:.2f})")
                if description:
                    parts.append(f"{description}\n")

        if result.prerequisites:
            parts.append("\n## Prerequisites (learn these first)\n")
            for prereq in result.prerequisites:
                name = prereq.get("name", "Unknown")
                description = prereq.get("description", "")
                parts.append(f"- **{name}**")
                if description:
                    parts.append(f": {description[:200]}...")

        if result.related_concepts:
            parts.append("\n## Related Concepts\n")
            seen = set()
            for rel in result.related_concepts:
                name = rel.get("name", "Unknown")
                rel_type = rel.get("relationship_name") or rel.get("relationship_type", "related")
                if name not in seen:
                    parts.append(f"- {name} ({rel_type})")
                    seen.add(name)

        return "\n".join(parts)

    async def generate_answer(
        self,
        question: str,
        retrieval_result: RetrievalResult,
        system_prompt: Optional[str] = None
    ) -> str:

        if not system_prompt:
            system_prompt = """You are an educational assistant. Answer the user's question using the provided context.

Guidelines:
1. Use information from the Relevant Concepts section as primary sources
2. Mention Prerequisites if the user should learn something first
3. Suggest Related Concepts for further exploration
4. Be accurate and cite the concepts by name
5. If the context doesn't contain enough information, say so"""

        user_prompt = f"""Context:
{retrieval_result.context_text}

Question: {question}

Please provide a helpful, educational answer based on the context above."""

        try:
            async with self.ai_provider.session(system_prompt=system_prompt) as s:
                answer = await self.ai_provider.generate(
                    prompt=user_prompt,
                    session=s,
                    temperature=0.7
                )
            return answer
        except Exception as e:
            logger.error(f"Answer generation failed: {e}")
            return f"I found {len(retrieval_result.concept_matches)} relevant concepts but couldn't generate an answer: {str(e)}"

    async def semantic_search(
        self,
        query: str,
        top_k: int = 10,
        filter_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:

        try:
            query_embedding = await embedding_service.embed(query)
            results = await qdrant_repository.search(
                query_embedding=query_embedding,
                limit=top_k,
                filter_type=filter_type
            )
            return results
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []

    async def search_documents(
        self,
        query: str,
        top_k: int = 20,
        score_threshold: float = 0.3
    ) -> Dict[str, float]:

        try:

            query_embedding = await embedding_service.embed(query)

            chunk_results = await qdrant_repository.search(
                query_embedding=query_embedding,
                limit=top_k * 3,
                score_threshold=score_threshold)

            document_scores = {}
            for result in chunk_results:
                if result.get("embedding_type") == "chunk":
                    doc_id = result.get("document_id")
                    score = result.get("score", 0.0)
                    if doc_id not in document_scores or score > document_scores[doc_id]:
                        document_scores[doc_id] = score

            logger.info(f"Document search found {len(document_scores)} unique documents")
            return document_scores

        except Exception as e:
            logger.error(f"Document search failed: {e}")
            return {}

# Global instance
hybrid_retrieval_service = HybridRetrievalService()
