import asyncpg
from typing import Any, Mapping, Sequence


class BaseRepository:
    def __init__(
        self,
        db: asyncpg.Connection,
        table_name: str | list[str],
        id_column: str = "id",
        deleted_at_column: str | None = None,
    ) -> None:
        self.db = db
        self.table_names = table_name if isinstance(table_name, list) else [table_name]
        self.id_column = id_column
        self.deleted_at_column = deleted_at_column


    def _base_where_not_deleted(self, table_name: str) -> str:
        if self.deleted_at_column:
            return f"{table_name}.{self.deleted_at_column} IS NULL"
        return "TRUE"


    async def get_by_id(self, record_id: Any, table_name: str | None = None) -> asyncpg.Record | None:
        table_name = table_name or self.table_names[0]
        where_not_deleted = self._base_where_not_deleted(table_name)
        query = (
            f"SELECT * FROM {table_name} "
            f"WHERE {self.id_column} = $1 AND {where_not_deleted}"
        )
        return await self.db.fetchrow(query, record_id)

    async def get_all(
        self,
        limit: int = 100,
        offset: int = 0,
        order_by: str | None = None,
        order_desc: bool = True,
        table_name: str | None = None,
    ) -> list[asyncpg.Record]:
        table_name = table_name or self.table_names[0]
        where_not_deleted = self._base_where_not_deleted(table_name)
        order_clause = ""
        if order_by:
            direction = "DESC" if order_desc else "ASC"
            order_clause = f" ORDER BY {order_by} {direction}"

        query = (
            f"SELECT * FROM {table_name} "
            f"WHERE {where_not_deleted}"
            f"{order_clause} "
            f"LIMIT $1 OFFSET $2"
        )
        return await self.db.fetch(query, limit, offset)


    async def create(
        self,
        data: Mapping[str, Any],
        returning: Sequence[str] | None = None,
        table_name: str | None = None,
    ) -> asyncpg.Record | None:
        table_name = table_name or self.table_names[0]
        if not data:
            raise ValueError("data for create() cannot be empty")

        columns = list(data.keys())
        values = list(data.values())
        placeholders = [f"${i}" for i in range(1, len(columns) + 1)]

        returning_clause = ""
        if returning:
            cols = ", ".join(returning)
            returning_clause = f" RETURNING {cols}"

        query = (
            f"INSERT INTO {table_name} "
            f"({', '.join(columns)}) "
            f"VALUES ({', '.join(placeholders)})"
            f"{returning_clause}"
        )

        if returning:
            return await self.db.fetchrow(query, *values)
        else:
            await self.db.execute(query, *values)
            return None


    async def update_by_id(
        self,
        record_id: Any,
        data: Mapping[str, Any],
        returning: Sequence[str] | None = None,
        table_name: str | None = None,
    ) -> asyncpg.Record | None:
        table_name = table_name or self.table_names[0]
        if not data:
            raise ValueError("data for update_by_id() cannot be empty")

        columns = list(data.keys())
        values = list(data.values())

        set_clauses = [f"{col} = ${i}" for i, col in enumerate(columns, start=1)]

        returning_clause = ""
        if returning:
            cols = ", ".join(returning)
            returning_clause = f" RETURNING {cols}"

        query = (
            f"UPDATE {table_name} "
            f"SET {', '.join(set_clauses)} "
            f"WHERE {self.id_column} = ${len(columns) + 1}"
            f"{returning_clause}"
        )

        if returning:
            return await self.db.fetchrow(query, *values, record_id)
        else:
            await self.db.execute(query, *values, record_id)
            return None


    async def soft_delete_by_id(self, record_id: Any, table_name: str | None = None) -> bool:
        table_name = table_name or self.table_names[0]
        if not self.deleted_at_column:
            raise RuntimeError(
                f"Table {table_name} has no deleted_at column configured"
            )

        query = (
            f"UPDATE {table_name} "
            f"SET {self.deleted_at_column} = CURRENT_TIMESTAMP "
            f"WHERE {self.id_column} = $1"
        )
        result = await self.db.execute(query, record_id)
        return result == "UPDATE 1"