import asyncpg
from uuid import UUID

class TaxonomyRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_node_by_code(self, lcc_code: str) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM taxonomy_nodes WHERE lcc_code = $1",
            lcc_code)

    async def get_children(self, parent_id: UUID) -> list[asyncpg.Record]:
        return await self.db.fetch(
            "SELECT * FROM taxonomy_nodes WHERE parent_id = $1 ORDER BY lcc_code",
            parent_id)

    async def search_by_name(
        self,
        query: str,
        limit: int = 50) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT *, similarity(name, $1) AS score
            FROM taxonomy_nodes
            WHERE name % $1
            ORDER BY score DESC
            LIMIT $2
            """,
            query, limit)

    async def link_concept(
        self,
        concept_id: UUID,
        taxonomy_node_id: UUID,
        is_primary: bool = False,
        created_by: UUID | None = None) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            """
            INSERT INTO concept_taxonomy (concept_id, taxonomy_node_id, is_primary, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (concept_id, taxonomy_node_id) DO NOTHING
            RETURNING *
            """,
            concept_id, taxonomy_node_id, is_primary, created_by)

