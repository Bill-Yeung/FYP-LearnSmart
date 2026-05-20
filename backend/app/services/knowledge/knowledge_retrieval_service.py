import logging
from typing import Optional
from uuid import UUID

from app.repositories.concept_repository import ConceptRepository
from app.repositories.source_repository import SourceRepository
from app.repositories.relationship_repository import RelationshipRepository
from app.repositories.neo4j_repository import (
    neo4j_repository,
    DOWNWARD_TYPES, UPWARD_TYPES, LATERAL_TYPES, BIDIRECTIONAL_TYPES,
)
from app.services.retrieval.hybrid_retrieval import hybrid_retrieval_service, RetrievalResult

logger = logging.getLogger(__name__)

class KnowledgeRetrievalService:

    async def get_knowledge_for_topic(
        self,
        topic: str,
        db,
        user_id: Optional[UUID] = None,
        top_k: int = 8,
        include_related: bool = True,
        include_prerequisites: bool = True,
        include_document_text: bool = False,
        language: str = "en",
    ) -> str:
       
        result: RetrievalResult = await hybrid_retrieval_service.query(
            question=topic,
            db_connection=db,
            top_k=top_k,
            include_prerequisites=include_prerequisites,
            include_related=include_related,
            language=language,
        )

        parts = [result.context_text]

        if include_document_text and result.concept_matches:
            doc_text = await self._fetch_source_text_for_concepts(
                concept_matches=result.concept_matches,
                db=db,
                max_chars_per_source=3000,
            )
            if doc_text:
                parts.append("\n## Source Document Excerpts\n")
                parts.append(doc_text)

        return "\n".join(parts)

    async def get_knowledge_from_document(
        self,
        source_id: UUID,
        db,
        include_concepts: bool = True,
        include_summary: bool = True,
        include_full_text: bool = False,
        include_relationships: bool = True,
        language: str = "en",
    ) -> str:
        
        source_repo = SourceRepository(db)
        concept_repo = ConceptRepository(db)

        parts = []

        source = await source_repo.get_by_id(source_id)
        if not source:
            return ""

        parts.append(f"# Document: {source['document_name']}\n")

        if include_summary and source.get("ai_summary"):
            parts.append("## Summary\n")
            parts.append(source["ai_summary"])
            parts.append("")

        if include_concepts:
            concepts, total = await concept_repo.get_by_source(
                source_id=source_id,
                language=language,
                limit=200,
            )
            if concepts:
                parts.append(f"## Extracted Concepts ({total} total)\n")
                for c in concepts:
                    title = c.get("title") or "Untitled"
                    desc = c.get("description") or ""
                    ctype = c.get("concept_type") or ""
                    difficulty = c.get("difficulty_level") or ""
                    keywords = c.get("keywords") or []

                    parts.append(f"### {title}")
                    parts.append(f"Type: {ctype} | Difficulty: {difficulty}")
                    if keywords:
                        parts.append(f"Keywords: {', '.join(keywords)}")
                    if desc:
                        parts.append(desc)
                    parts.append("")

                if include_relationships:
                    rel_text = await self._fetch_relationships_for_concepts(
                        concept_ids=[c["id"] for c in concepts],
                        db=db,
                        language=language,
                    )
                    if rel_text:
                        parts.append("## Concept Relationships\n")
                        parts.append(rel_text)

        if include_full_text and source.get("full_text"):
            parts.append("## Full Document Text\n")
            parts.append(source["full_text"])

        return "\n".join(parts)

    async def get_knowledge_for_concepts(
        self,
        concept_ids: list[UUID],
        db,
        include_relationships: bool = True,
        include_source_text: bool = False,
        language: str = "en",
    ) -> str:
        
        concept_repo = ConceptRepository(db)
        parts = []

        for cid in concept_ids:
            concept = await concept_repo.get_with_translation(cid, language)
            if not concept:
                continue

            title = concept.get("title") or "Untitled"
            desc = concept.get("description") or ""
            ctype = concept.get("concept_type") or ""
            difficulty = concept.get("difficulty_level") or ""
            keywords = concept.get("keywords") or []

            parts.append(f"### {title}")
            parts.append(f"Type: {ctype} | Difficulty: {difficulty}")
            if keywords:
                parts.append(f"Keywords: {', '.join(keywords)}")
            if desc:
                parts.append(desc)
            parts.append("")

        if include_relationships and concept_ids:
            rel_text = await self._fetch_relationships_for_concepts(
                concept_ids=concept_ids,
                db=db,
                language=language,
            )
            if rel_text:
                parts.append("## Relationships Between Concepts\n")
                parts.append(rel_text)

        if include_source_text:
            source_text = await self._fetch_source_text_for_concept_ids(
                concept_ids=concept_ids,
                db=db,
                max_chars_per_source=2000,
            )
            if source_text:
                parts.append("## Source Document Excerpts\n")
                parts.append(source_text)

        return "\n".join(parts)

    async def get_user_knowledge_overview(
        self,
        user_id: UUID,
        db,
        language: str = "en",
        max_concepts: int = 100,
    ) -> str:
       
        source_repo = SourceRepository(db)
        concept_repo = ConceptRepository(db)

        sources, total_sources = await source_repo.get_by_user(user_id, limit=50)
        parts = [f"# Knowledge Base Overview ({total_sources} documents)\n"]

        for src in sources[:20]:
            parts.append(f"- **{src['document_name']}** ({src['document_type']}) — "
                         f"{src.get('concepts_extracted', 0)} concepts")

        all_concepts = []
        for src in sources[:10]:
            concepts, _ = await concept_repo.get_by_source(
                source_id=src["id"],
                language=language,
                limit=30,
            )
            all_concepts.extend(concepts)

        if all_concepts:
            parts.append(f"\n## Available Concepts ({len(all_concepts)} loaded)\n")
            for c in all_concepts[:max_concepts]:
                title = c.get("title") or "Untitled"
                ctype = c.get("concept_type") or ""
                parts.append(f"- {title} ({ctype})")

        return "\n".join(parts)

    async def get_concepts_structured(
        self,
        topic: str,
        db,
        top_k: int = 10,
        language: str = "en",
    ) -> list[dict]:
        
        result = await hybrid_retrieval_service.query(
            question=topic,
            db_connection=db,
            top_k=top_k,
            include_prerequisites=False,
            include_related=False,
            language=language,
        )
        return result.concept_matches

    async def get_concept(
        self,
        concept_id: UUID,
        db,
        language: str = "en",
    ) -> dict | None:
        
        concept_repo = ConceptRepository(db)
        row = await concept_repo.get_with_translation(concept_id, language)
        return dict(row) if row else None

    async def get_concepts_by_subject(
        self,
        subject_id: UUID,
        user_id: UUID,
        db,
        relevance: str | None = None,
        language: str = "en",
        include_taxonomy: bool = False,
    ) -> list[dict]:
       
        concept_repo = ConceptRepository(db)
        rows = await concept_repo.get_by_subject(
            subject_id=subject_id,
            user_id=user_id,
            relevance=relevance,
        )
        concepts = [dict(r) for r in rows]
        if include_taxonomy and concepts:
            await self._attach_taxonomy(concepts)
        return concepts

    async def get_concepts_by_document(
        self,
        source_id: UUID,
        db,
        language: str = "en",
        limit: int = 100,
        offset: int = 0,
        include_taxonomy: bool = False,
    ) -> tuple[list[dict], int]:
        
        concept_repo = ConceptRepository(db)
        rows, total = await concept_repo.get_by_source(
            source_id=source_id,
            language=language,
            limit=limit,
            offset=offset,
        )
        concepts = [dict(r) for r in rows]
        if include_taxonomy and concepts:
            await self._attach_taxonomy(concepts)
        return concepts, total

    async def get_concepts_by_user(
        self,
        user_id: UUID,
        db,
        include_taxonomy: bool = False,
    ) -> list[dict]:
        
        concept_repo = ConceptRepository(db)
        rows = await concept_repo.get_all_for_user(user_id)
        concepts = [dict(r) for r in rows]
        if include_taxonomy and concepts:
            await self._attach_taxonomy(concepts)
        return concepts

    async def get_concept_with_relationships(
        self,
        concept_id: UUID,
        db,
        language: str = "en",
    ) -> dict:
        
        concept_repo = ConceptRepository(db)
        relationship_repo = RelationshipRepository(db)

        concept = await concept_repo.get_with_translation(concept_id, language)
        if not concept:
            return {"concept": None, "outgoing_relationships": [], "incoming_relationships": []}

        outgoing = await relationship_repo.get_concept_relationships(
            concept_id=concept_id, language=language, direction="outgoing",
        )
        incoming = await relationship_repo.get_concept_relationships(
            concept_id=concept_id, language=language, direction="incoming",
        )

        return {
            "concept": dict(concept),
            "outgoing_relationships": [dict(r) for r in outgoing],
            "incoming_relationships": [dict(r) for r in incoming],
        }

    async def get_prerequisites(
        self,
        concept_id: UUID,
        db,
        language: str = "en",
    ) -> list[dict]:
        
        relationship_repo = RelationshipRepository(db)
        rows = await relationship_repo.get_by_type(
            concept_id=concept_id,
            relationship_type="has_prerequisite",
            language=language,
        )
        return [dict(r) for r in rows]

    async def expand_concept_graph(
        self,
        seed_ids: list[UUID],
        db,
        depth: int = 2,
        include_lateral: bool = True,
        include_upward: bool = False,
        include_taxonomy: bool = False,
        max_nodes: int = 200,
    ) -> dict:
        
        seed_strs = [str(sid) for sid in seed_ids]

        allowed = list(DOWNWARD_TYPES)
        if include_lateral:
            allowed.extend(LATERAL_TYPES)
        if include_upward:
            allowed.extend(UPWARD_TYPES)

        expanded_ids = await neo4j_repository.expand_concepts(
            seed_ids=seed_strs,
            depth=depth,
            allowed_rel_types=allowed,
            bidirectional_types=list(BIDIRECTIONAL_TYPES),
            max_nodes=max_nodes,
        )

        links = await neo4j_repository.get_relationships_between(expanded_ids)

        concept_repo = ConceptRepository(db)
        concept_uuids = []
        for cid in expanded_ids:
            try:
                concept_uuids.append(UUID(cid))
            except ValueError:
                logger.warning(f"Invalid UUID from Neo4j: {cid}")

        nodes_raw = await concept_repo.get_by_ids(concept_uuids) if concept_uuids else []
        nodes = [dict(r) for r in nodes_raw]

        if include_taxonomy and nodes:
            await self._attach_taxonomy(nodes)

        return {
            "nodes": nodes,
            "links": links,
            "seed_ids": seed_ids,
        }


    async def _attach_taxonomy(self, concepts: list[dict]) -> None:
       
        concept_ids = [str(c["id"]) for c in concepts if c.get("id")]
        if not concept_ids:
            return

        try:
            tax_rows = await neo4j_repository.get_taxonomy_for_concepts(concept_ids)
            tax_map: dict[str, dict] = {}
            for row in tax_rows:
                cid = row["concept_id"]
                if cid not in tax_map:
                    tax_map[cid] = {
                        "lcc_code": row.get("lcc_code"),
                        "lcc_label": row.get("lcc_label"),
                        "lcc_hierarchy_level": row.get("lcc_hierarchy_level"),
                    }

            for c in concepts:
                cid_str = str(c["id"])
                tax = tax_map.get(cid_str)
                if tax:
                    c["lcc_code"] = tax["lcc_code"]
                    c["lcc_label"] = tax["lcc_label"]
                    c["lcc_hierarchy_level"] = tax["lcc_hierarchy_level"]
                else:
                    c["lcc_code"] = None
                    c["lcc_label"] = None
                    c["lcc_hierarchy_level"] = None
        except Exception as e:
            logger.warning(f"Failed to attach taxonomy: {e}")

    async def _fetch_source_text_for_concepts(
        self,
        concept_matches: list[dict],
        db,
        max_chars_per_source: int = 3000,
    ) -> str:
        
        seen_sources = set()
        parts = []

        for match in concept_matches[:5]:
            concept_id = match.get("concept_id")
            if not concept_id:
                continue

            try:
                cid = UUID(concept_id) if isinstance(concept_id, str) else concept_id
                rows = await db.fetch(
                    """
                    SELECT s.document_name, s.full_text, cs.pages, cs.location
                    FROM concept_sources cs
                    JOIN sources s ON cs.source_id = s.id
                    WHERE cs.concept_id = $1
                    """,
                    cid,
                )
                for row in rows:
                    doc_name = row["document_name"]
                    if doc_name in seen_sources:
                        continue
                    seen_sources.add(doc_name)

                    full_text = row.get("full_text") or ""
                    excerpt = full_text[:max_chars_per_source]
                    if len(full_text) > max_chars_per_source:
                        excerpt += "..."

                    if excerpt.strip():
                        parts.append(f"**{doc_name}**")
                        location = row.get("location") or ""
                        pages = row.get("pages") or []
                        if pages:
                            parts.append(f"Pages: {', '.join(str(p) for p in pages)}")
                        if location:
                            parts.append(f"Section: {location}")
                        parts.append(excerpt)
                        parts.append("")
            except Exception as e:
                logger.warning(f"Failed to fetch source text for concept {concept_id}: {e}")

        return "\n".join(parts)

    async def _fetch_source_text_for_concept_ids(
        self,
        concept_ids: list[UUID],
        db,
        max_chars_per_source: int = 2000,
    ) -> str:
        
        seen_sources = set()
        parts = []

        for cid in concept_ids[:10]:
            try:
                rows = await db.fetch(
                    """
                    SELECT s.document_name, s.full_text, cs.pages
                    FROM concept_sources cs
                    JOIN sources s ON cs.source_id = s.id
                    WHERE cs.concept_id = $1
                    """,
                    cid,
                )
                for row in rows:
                    doc_name = row["document_name"]
                    if doc_name in seen_sources:
                        continue
                    seen_sources.add(doc_name)

                    full_text = row.get("full_text") or ""
                    excerpt = full_text[:max_chars_per_source]
                    if len(full_text) > max_chars_per_source:
                        excerpt += "..."

                    if excerpt.strip():
                        parts.append(f"**{doc_name}**")
                        parts.append(excerpt)
                        parts.append("")
            except Exception as e:
                logger.warning(f"Failed to fetch source text for concept {cid}: {e}")

        return "\n".join(parts)

    async def _fetch_relationships_for_concepts(
        self,
        concept_ids: list[UUID],
        db,
        language: str = "en",
    ) -> str:
        
        relationship_repo = RelationshipRepository(db)
        parts = []
        seen = set()

        for cid in concept_ids[:20]:
            try:
                rels = await relationship_repo.get_concept_relationships(
                    concept_id=cid,
                    language=language,
                    direction="both",
                )
                for rel in rels[:5]:
                    source_title = rel.get("source_title") or "?"
                    target_title = rel.get("target_title") or "?"
                    rel_name = rel.get("relationship_name") or rel.get("relationship_type") or "related"
                    key = f"{source_title}-{rel_name}-{target_title}"
                    if key not in seen:
                        seen.add(key)
                        parts.append(f"- {source_title} —[{rel_name}]→ {target_title}")
            except Exception as e:
                logger.warning(f"Failed to fetch relationships for {cid}: {e}")

        return "\n".join(parts)

# Global
knowledge_service = KnowledgeRetrievalService()
