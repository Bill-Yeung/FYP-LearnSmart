import asyncpg
import json
import re
from uuid import UUID

def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug[:200].strip('-')

class DiagramRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(
        self,
        diagram_id: UUID,
        user_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM diagrams WHERE id = $1 AND user_id = $2",
            diagram_id, user_id)

    async def get_by_slug(
        self,
        slug: str,
        user_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM diagrams WHERE url_slug = $1 AND user_id = $2",
            slug, user_id)

    async def list_by_user(
        self,
        user_id: UUID,
        diagram_type: str | None = None,
        page: int = 1,
        page_size: int = 20) -> tuple[list[asyncpg.Record], int]:

        where = "WHERE user_id = $1 AND diagram_type IS NOT NULL"
        params: list = [user_id]
        idx = 2

        if diagram_type:
            where += f" AND diagram_type = ${idx}"
            params.append(diagram_type)
            idx += 1

        total = await self.db.fetchval(
            f"SELECT COUNT(*) FROM diagrams {where}", *params)

        params.append(page_size)
        params.append((page - 1) * page_size)
        rows = await self.db.fetch(
            f"""
            SELECT id, url_slug, title, description, diagram_type, layout_type,
                   node_count, link_count, is_edited, is_public,
                   last_viewed_at, created_at, updated_at
            FROM diagrams
            {where}
            ORDER BY updated_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *params)

        return rows, total or 0

    async def get_recent(
        self,
        user_id: UUID,
        limit: int = 5) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT id, url_slug, title, description, diagram_type, layout_type,
                   node_count, link_count, is_edited,
                   last_viewed_at, created_at, updated_at
            FROM diagrams
            WHERE user_id = $1 AND last_viewed_at IS NOT NULL
            ORDER BY last_viewed_at DESC
            LIMIT $2
            """,
            user_id, limit)

    async def touch_last_viewed(self, diagram_id: UUID) -> None:
        await self.db.execute(
            "UPDATE diagrams SET last_viewed_at = CURRENT_TIMESTAMP WHERE id = $1",
            diagram_id)

    async def _generate_unique_slug(self, user_id: UUID, title: str) -> str:
        base_slug = slugify(title) or "diagram"
        slug = base_slug
        counter = 1
        while True:
            existing = await self.db.fetchval(
                "SELECT 1 FROM diagrams WHERE user_id = $1 AND url_slug = $2",
                user_id, slug)
            if not existing:
                return slug
            slug = f"{base_slug}-{counter}"
            counter += 1

    async def create(
        self,
        user_id: UUID,
        title: str,
        diagram_type: str,
        diagram_data: dict,
        layout_type: str,
        node_count: int,
        link_count: int,
        source_document_ids: list[UUID] | None = None,
        source_concept_ids: list[UUID] | None = None) -> asyncpg.Record:

        url_slug = await self._generate_unique_slug(user_id, title)

        return await self.db.fetchrow(
            """
            INSERT INTO diagrams (
                user_id, url_slug, source_document_ids, source_concept_ids,
                title, diagram_type, diagram_data, layout_type,
                node_count, link_count, last_viewed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING id, url_slug, title, diagram_type, node_count, link_count, created_at
            """,
            user_id,
            url_slug,
            source_document_ids,
            source_concept_ids,
            title,
            diagram_type,
            json.dumps(diagram_data),
            layout_type,
            node_count,
            link_count)

    async def update(
        self,
        diagram_id: UUID,
        user_id: UUID,
        title: str | None = None,
        description: str | None = None,
        diagram_data: dict | None = None,
        view_state: dict | None = None,
        is_edited: bool | None = None) -> asyncpg.Record | None:

        existing = await self.db.fetchrow(
            "SELECT id FROM diagrams WHERE id = $1 AND user_id = $2",
            diagram_id, user_id)
        if not existing:
            return None

        sets = ["updated_at = CURRENT_TIMESTAMP"]
        params: list = []
        idx = 1

        if title is not None:
            sets.append(f"title = ${idx}")
            params.append(title)
            idx += 1
            new_slug = await self._generate_unique_slug(user_id, title)
            sets.append(f"url_slug = ${idx}")
            params.append(new_slug)
            idx += 1

        if description is not None:
            sets.append(f"description = ${idx}")
            params.append(description)
            idx += 1

        if diagram_data is not None:
            sets.append(f"diagram_data = ${idx}::jsonb")
            params.append(json.dumps(diagram_data))
            idx += 1
            nodes = diagram_data.get("nodes", [])
            links = diagram_data.get("links", [])
            sets.append(f"node_count = ${idx}")
            params.append(len(nodes))
            idx += 1
            sets.append(f"link_count = ${idx}")
            params.append(len(links))
            idx += 1

        if view_state is not None:
            sets.append(f"view_state = ${idx}::jsonb")
            params.append(json.dumps(view_state))
            idx += 1

        if is_edited is not None:
            sets.append(f"is_edited = ${idx}")
            params.append(is_edited)
            idx += 1

        params.append(diagram_id)

        return await self.db.fetchrow(
            f"""
            UPDATE diagrams SET {', '.join(sets)}
            WHERE id = ${idx}
            RETURNING id, url_slug, title, diagram_type, node_count, link_count, is_edited, updated_at
            """,
            *params)

    async def delete(self, diagram_id: UUID, user_id: UUID) -> bool:
        result = await self.db.execute(
            "DELETE FROM diagrams WHERE id = $1 AND user_id = $2",
            diagram_id, user_id)
        return result == "DELETE 1"
