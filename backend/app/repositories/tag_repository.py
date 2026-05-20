import asyncpg
from uuid import UUID

class TagRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_id(self, tag_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM tags WHERE id = $1",
            tag_id)

    async def get_by_id_and_user(
        self,
        tag_id: UUID,
        user_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM tags WHERE id = $1 AND user_id = $2",
            tag_id, user_id)

    async def get_by_user(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        total = await self.db.fetchval(
            "SELECT COUNT(*) FROM tags WHERE user_id = $1",
            user_id)

        rows = await self.db.fetch(
            """
            SELECT * FROM tags
            WHERE user_id = $1
            ORDER BY usage_count DESC, name ASC
            LIMIT $2 OFFSET $3
            """,
            user_id, limit, offset)

        return rows, total or 0

    async def get_by_url_id(
        self,
        user_id: UUID,
        url_id: str) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM tags WHERE user_id = $1 AND url_id = $2",
            user_id, url_id)

    async def search_by_name(
        self,
        user_id: UUID,
        query: str,
        limit: int = 20) -> list[asyncpg.Record]:
        return await self.db.fetch(
            """
            SELECT * FROM tags
            WHERE user_id = $1 AND name ILIKE $2
            ORDER BY usage_count DESC, name ASC
            LIMIT $3
            """,
            user_id, f"%{query}%", limit)

    async def create(
        self,
        user_id: UUID,
        name: str,
        url_id: str,
        description: str | None = None,
        color: str | None = None,
        icon: str | None = None,
        is_system: bool = False) -> asyncpg.Record:

        return await self.db.fetchrow(
            """
            INSERT INTO tags (user_id, name, url_id, description, color, icon, is_system)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            """,
            user_id, name, url_id, description, color, icon, is_system)

    async def update(
        self,
        tag_id: UUID,
        user_id: UUID,
        name: str | None = None,
        description: str | None = None,
        color: str | None = None,
        icon: str | None = None) -> asyncpg.Record | None:

        updates = ["updated_at = CURRENT_TIMESTAMP"]
        params = []
        param_count = 0

        if name is not None:
            param_count += 1
            updates.append(f"name = ${param_count}")
            params.append(name)

        if description is not None:
            param_count += 1
            updates.append(f"description = ${param_count}")
            params.append(description)

        if color is not None:
            param_count += 1
            updates.append(f"color = ${param_count}")
            params.append(color)

        if icon is not None:
            param_count += 1
            updates.append(f"icon = ${param_count}")
            params.append(icon)

        params.extend([tag_id, user_id])

        return await self.db.fetchrow(
            f"""
            UPDATE tags
            SET {', '.join(updates)}
            WHERE id = ${param_count + 1} AND user_id = ${param_count + 2}
            RETURNING *
            """,
            *params)

    async def delete(self, tag_id: UUID, user_id: UUID) -> bool:
        result = await self.db.execute(
            "DELETE FROM tags WHERE id = $1 AND user_id = $2",
            tag_id, user_id)
        return result == "DELETE 1"

    async def increment_usage(self, tag_id: UUID) -> None:
        await self.db.execute(
            "UPDATE tags SET usage_count = usage_count + 1 WHERE id = $1",
            tag_id)

    async def decrement_usage(self, tag_id: UUID) -> None:
        await self.db.execute(
            "UPDATE tags SET usage_count = GREATEST(0, usage_count - 1) WHERE id = $1",
            tag_id)

    async def apply_tag(
        self,
        tag_id: UUID,
        entity_type: str,
        entity_id: UUID,
        applied_by: UUID) -> asyncpg.Record | None:

        result = await self.db.fetchrow(
            """
            INSERT INTO tag_applications (tag_id, entity_type, entity_id, applied_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING
            RETURNING *
            """,
            tag_id, entity_type, entity_id, applied_by)

        if result:
            await self.increment_usage(tag_id)

        return result

    async def remove_tag(
        self,
        tag_id: UUID,
        entity_type: str,
        entity_id: UUID) -> bool:

        result = await self.db.execute(
            """
            DELETE FROM tag_applications
            WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3
            """,
            tag_id, entity_type, entity_id)

        if result == "DELETE 1":
            await self.decrement_usage(tag_id)
            return True
        return False

    async def get_entity_tags(
        self,
        entity_type: str,
        entity_id: UUID) -> list[asyncpg.Record]:

        return await self.db.fetch(
            """
            SELECT t.*, ta.applied_at
            FROM tags t
            JOIN tag_applications ta ON t.id = ta.tag_id
            WHERE ta.entity_type = $1 AND ta.entity_id = $2
            ORDER BY t.name
            """,
            entity_type, entity_id)

    async def get_tagged_entities(
        self,
        tag_id: UUID,
        entity_type: str | None = None,
        limit: int = 100,
        offset: int = 0) -> tuple[list[asyncpg.Record], int]:

        if entity_type:
            total = await self.db.fetchval(
                """
                SELECT COUNT(*) FROM tag_applications
                WHERE tag_id = $1 AND entity_type = $2
                """,
                tag_id, entity_type)

            rows = await self.db.fetch(
                """
                SELECT entity_type, entity_id, applied_at, applied_by
                FROM tag_applications
                WHERE tag_id = $1 AND entity_type = $2
                ORDER BY applied_at DESC
                LIMIT $3 OFFSET $4
                """,
                tag_id, entity_type, limit, offset)
        else:
            total = await self.db.fetchval(
                "SELECT COUNT(*) FROM tag_applications WHERE tag_id = $1",
                tag_id)

            rows = await self.db.fetch(
                """
                SELECT entity_type, entity_id, applied_at, applied_by
                FROM tag_applications
                WHERE tag_id = $1
                ORDER BY applied_at DESC
                LIMIT $2 OFFSET $3
                """,
                tag_id, limit, offset)

        return rows, total or 0

    async def get_tag_stats(self, tag_id: UUID) -> dict:

        stats = await self.db.fetch(
            """
            SELECT entity_type, COUNT(*) as count
            FROM tag_applications
            WHERE tag_id = $1
            GROUP BY entity_type
            """,
            tag_id)

        return {row["entity_type"]: row["count"] for row in stats}

    async def get_tags_with_stats(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0) -> tuple[list[dict], int]:

        total = await self.db.fetchval(
            "SELECT COUNT(*) FROM tags WHERE user_id = $1",
            user_id)

        rows = await self.db.fetch(
            """
            SELECT
                t.*,
                COALESCE(counts.concept_count, 0) as concept_count,
                COALESCE(counts.source_count, 0) as source_count,
                COALESCE(counts.diagram_count, 0) as diagram_count,
                COALESCE(counts.flashcard_count, 0) as flashcard_count,
                COALESCE(counts.learning_path_count, 0) as learning_path_count,
                COALESCE(counts.shared_content_count, 0) as shared_content_count,
                COALESCE(counts.vr_scenario_count, 0) as vr_scenario_count,
                COALESCE(counts.generated_script_count, 0) as generated_script_count
            FROM tags t
            LEFT JOIN (
                SELECT
                    tag_id,
                    COUNT(*) FILTER (WHERE entity_type = 'concept') as concept_count,
                    COUNT(*) FILTER (WHERE entity_type = 'source') as source_count,
                    COUNT(*) FILTER (WHERE entity_type = 'subject') as subject_count,
                    COUNT(*) FILTER (WHERE entity_type = 'diagram') as diagram_count,
                    COUNT(*) FILTER (WHERE entity_type = 'flashcard') as flashcard_count,
                    COUNT(*) FILTER (WHERE entity_type = 'learning_path') as learning_path_count,
                    COUNT(*) FILTER (WHERE entity_type = 'shared_content') as shared_content_count,
                    COUNT(*) FILTER (WHERE entity_type = 'vr_scenario') as vr_scenario_count,
                    COUNT(*) FILTER (WHERE entity_type = 'generated_script') as generated_script_count
                FROM tag_applications
                GROUP BY tag_id
            ) counts ON t.id = counts.tag_id
            WHERE t.user_id = $1
            ORDER BY t.usage_count DESC, t.name ASC
            LIMIT $2 OFFSET $3
            """,
            user_id, limit, offset)

        return [dict(row) for row in rows], total or 0

    async def bulk_apply_tags(
        self,
        tag_ids: list[UUID],
        entity_type: str,
        entity_id: UUID,
        applied_by: UUID) -> int:

        count = 0
        for tag_id in tag_ids:
            result = await self.apply_tag(tag_id, entity_type, entity_id, applied_by)
            if result:
                count += 1
        return count

