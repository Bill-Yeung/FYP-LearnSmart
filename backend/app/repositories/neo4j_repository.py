import asyncio
import logging
import re
from neo4j import Driver

from app.core.database import neo4j_db

logger = logging.getLogger(__name__)

DOWNWARD_TYPES = (
    'has_part', 'has_member', 'has_characteristic', 'has_subsequence',
    'has_participant', 'has_prerequisite', 'location_of',
    'results_in_assembly_of', 'determines', 'produces', 'regulates',
    'enables', 'generalizes', 'derives_into', 'contributes_to',
)

UPWARD_TYPES = (
    'part_of', 'member_of', 'characteristic_of', 'is_subsequence_of',
    'participates_in', 'prerequisite_of', 'located_in',
    'results_in_breakdown_of', 'determined_by', 'produced_by',
    'regulated_by', 'specialized_by', 'derives_from',
    'implemented_by', 'proven_by', 'approximated_by',
    'replaced_by', 'is_owned_by',
)

LATERAL_TYPES = (
    'similar_to', 'connected_to', 'interacts_with', 'correlated_with',
    'contradicts', 'overlaps', 'adjacent_to', 'simultaneous_with',
    'causally_related_to', 'exemplifies', 'applies_to', 'applied_in',
    'builds_on', 'implements', 'proves', 'approximates', 'replaces',
    'implies', 'capable_of', 'owns',
    'author', 'introduced_by', 'surrounded_by',
)

TEMPORAL_TYPES = (
    'happens_during', 'before_or_simultaneous_with',
    'starts_before', 'ends_after',
)

BIDIRECTIONAL_TYPES = (
    'similar_to', 'connected_to', 'interacts_with', 'correlated_with',
    'contradicts', 'overlaps', 'adjacent_to', 'simultaneous_with',
)

_NEO4J_REL_SANITIZE = re.compile(r'[^A-Z0-9_]')

def _sanitize_rel_type(rel_type: str) -> str:

    clean = rel_type.upper().replace(" ", "_")
    return _NEO4J_REL_SANITIZE.sub("", clean) or "RELATED_TO"

class Neo4jRepository:

    @property
    def driver(self) -> Driver:
        if neo4j_db.driver is None:
            raise RuntimeError("Neo4j not connected. Call connect() first.")
        return neo4j_db.driver

    async def link_concept_to_source(self, concept_id: str, source_id: str):

        def _run(tx):
            tx.run(
                """
                MATCH (c:Concept {id: $concept_id})
                MATCH (s:Source {id: $source_id})
                MERGE (c)-[:EXTRACTED_FROM]->(s)
                """,
                concept_id = concept_id, source_id = source_id)

        await self._write(_run)

    async def merge_relationship(
        self,
        source_concept_id: str,
        target_concept_id: str,
        relationship_type: str,
        strength: float = 0.5,
        source_document: str | None = None):

        neo4j_rel_type = _sanitize_rel_type(relationship_type)

        def _run(tx):
            tx.run(
                f"""
                MATCH (a:Concept {{id: $source_id}})
                MATCH (b:Concept {{id: $target_id}})
                MERGE (a)-[r:{neo4j_rel_type}]->(b)
                SET r.strength = $strength,
                    r.source_document = $doc_id
                """,
                source_id = source_concept_id,
                target_id = target_concept_id,
                strength = strength,
                doc_id = source_document)

        await self._write(_run)

    async def store_extraction_graph(
        self,
        document_id: str,
        doc_title: str,
        concepts: list[dict],
        relationships: list[dict],
        concept_id_map: dict):

        stored_concepts = 0
        stored_relationships = 0

        def _write_graph(tx):
            nonlocal stored_concepts, stored_relationships

            tx.run(
                """
                MERGE (s:Source {id: $id})
                SET s.document_name = $name
                """,
                id = document_id, name = doc_title)

            for concept_data in concepts:
                term = concept_data.get("term", "")
                concept_id = concept_id_map.get(term)
                if not concept_id:
                    continue

                concept_id_str = str(concept_id)
                concept_type = concept_data.get("concept_type", "definition")
                difficulty = concept_data.get("difficulty_level")
                lcc_code = concept_data.get("suggested_lcc_code")

                tx.run(
                    """
                    MERGE (c:Concept {id: $id})
                    SET c.concept_type = $concept_type,
                        c.difficulty_level = $difficulty,
                        c.lcc_code = $lcc_code
                    """,
                    id = concept_id_str,
                    concept_type = concept_type,
                    difficulty = difficulty,
                    lcc_code = lcc_code)

                tx.run(
                    """
                    MATCH (c:Concept {id: $concept_id})
                    MATCH (s:Source {id: $source_id})
                    MERGE (c)-[:EXTRACTED_FROM]->(s)
                    """,
                    concept_id = concept_id_str, source_id = document_id)

                if lcc_code:
                    tx.run(
                        """
                        MATCH (c:Concept {id: $concept_id})
                        MATCH (t:TaxonomyNode {lcc_code: $lcc_code})
                        MERGE (c)-[:CLASSIFIED_AS]->(t)
                        """,
                        concept_id = concept_id_str, lcc_code = lcc_code)

                stored_concepts += 1

            for rel_data in relationships:
                source_term = rel_data.get("source_concept_term")
                target_term = rel_data.get("target_concept_term")
                source_id = concept_id_map.get(source_term)
                target_id = concept_id_map.get(target_term)

                if not source_id or not target_id:
                    continue

                rel_type = _sanitize_rel_type(
                    rel_data.get("relationship_type", "RELATED_TO"))

                tx.run(
                    f"""
                    MATCH (a:Concept {{id: $source_id}})
                    MATCH (b:Concept {{id: $target_id}})
                    MERGE (a)-[r:{rel_type}]->(b)
                    SET r.strength = $strength,
                        r.source_document = $doc_id
                    """,
                    source_id = str(source_id),
                    target_id = str(target_id),
                    strength = rel_data.get("strength", 0.5),
                    doc_id = document_id)

                stored_relationships += 1

        await self._write(_write_graph)

        logger.info(
            f"Neo4j: stored {stored_concepts} concept nodes, "
            f"{stored_relationships} relationships for document {document_id}")

    async def expand_concepts(
        self,
        seed_ids: list[str],
        depth: int = 1,
        allowed_rel_types: list[str] | None = None,
        bidirectional_types: list[str] | None = None,
        max_nodes: int = 200) -> list[str]:

        if not seed_ids:
            return []

        allowed = [_sanitize_rel_type(t) for t in (allowed_rel_types or [])]
        bidir = [_sanitize_rel_type(t) for t in (bidirectional_types or [])]

        if not allowed and not bidir:
            return seed_ids

        cypher_depth = 10 if depth == 0 else max(1, min(depth, 10))

        all_types = list(set(allowed + bidir))
        type_filter = "|".join(all_types)

        def _run(tx):

            result = tx.run(
                f"""
                MATCH (seed:Concept) WHERE seed.id IN $seed_ids
                WITH collect(seed) AS seeds
                UNWIND seeds AS s
                OPTIONAL MATCH path = (s)-[*1..{cypher_depth}]-(neighbor:Concept)
                WHERE ALL(r IN relationships(path) WHERE type(r) IN $allowed_types)
                WITH seeds, collect(DISTINCT neighbor) AS neighbors
                UNWIND seeds + neighbors AS node
                WITH DISTINCT node
                WHERE node IS NOT NULL
                RETURN node.id AS concept_id
                LIMIT $max_nodes
                """,
                seed_ids = seed_ids,
                allowed_types = all_types,
                max_nodes = max_nodes)
            return [record["concept_id"] for record in result]

        return await self._read(_run)

    async def get_relationships_between(
        self,
        concept_ids: list[str]) -> list[dict]:

        if not concept_ids:
            return []

        def _run(tx):
            result = tx.run(
                """
                MATCH (a:Concept)-[r]->(b:Concept)
                WHERE a.id IN $concept_ids
                  AND b.id IN $concept_ids
                  AND NOT type(r) IN ['EXTRACTED_FROM', 'CLASSIFIED_AS']
                RETURN DISTINCT
                    a.id AS source_concept_id,
                    b.id AS target_concept_id,
                    type(r) AS relationship_type,
                    r.strength AS strength
                """,
                concept_ids = concept_ids)
            return [dict(record) for record in result]

        return await self._read(_run)

    async def get_taxonomy_for_concepts(
        self,
        concept_ids: list[str]) -> list[dict]:

        if not concept_ids:
            return []

        def _run(tx):
            result = tx.run(
                """
                MATCH (c:Concept)-[:CLASSIFIED_AS]->(t:TaxonomyNode)
                WHERE c.id IN $concept_ids
                RETURN c.id AS concept_id,
                    t.lcc_code AS lcc_code,
                    t.lcc_label AS lcc_label,
                    t.lcc_hierarchy_level AS lcc_hierarchy_level
                """,
                concept_ids = concept_ids)
            return [dict(record) for record in result]

        return await self._read(_run)

    async def execute_cypher_file(self, filepath: str) -> int:

        import os

        if not os.path.exists(filepath):
            logger.warning(f"Cypher file not found: {filepath}")
            return 0

        with open(filepath) as f:
            content = f.read()

        def _run(tx):
            count = 0
            commands = content.split(";")

            for cmd in commands:

                lines = [line for line in cmd.split('\n')
                         if line.strip() and not line.strip().startswith('//')]
                cmd_clean = '\n'.join(lines).strip()

                if not cmd_clean:
                    continue

                try:
                    tx.run(cmd_clean)
                    count += 1
                except Exception:
                    pass

            return count

        count = await self._write_with_result(_run)
        filename = os.path.basename(filepath)
        logger.info(f"Neo4j init: {filename} — {count} commands")
        return count

    async def _read(self, work_fn):

        def _run_sync():
            with self.driver.session() as session:
                return session.execute_read(work_fn)

        return await asyncio.to_thread(_run_sync)

    async def _write(self, work_fn):

        def _run_sync():
            with self.driver.session() as session:
                session.execute_write(work_fn)

        await asyncio.to_thread(_run_sync)

    async def _write_with_result(self, work_fn):


        def _run_sync():
            with self.driver.session() as session:
                return session.execute_write(work_fn)

        return await asyncio.to_thread(_run_sync)

# Global instance
neo4j_repository = Neo4jRepository()
