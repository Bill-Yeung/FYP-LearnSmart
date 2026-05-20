from __future__ import annotations

from typing import Any, List, Optional

from app.repositories.game.base_repository import BaseRepository


class SubjectRepository(BaseRepository):

    def __init__(self, db) -> None:
        super().__init__(db=db, table_name="subjects")

    async def list_subjects(self) -> List[dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT id, code, name
            FROM subjects
            ORDER BY code ASC
            """
        )

        return [
            {
                "id": str(row["id"]),
                "code": row["code"],
                "name": row["name"],
            }
            for row in rows
        ]

    async def get_by_code(self, code: str) -> Optional[dict[str, Any]]:

        row = await self.db.fetchrow(
            "SELECT id, code, name FROM subjects WHERE code = $1",
            code,
        )
        if not row:
            return None

        return {
            "id": str(row["id"]),
            "code": row["code"],
            "name": row["name"],
        }

    async def create_subject(self, code: str, name: Optional[str]) -> dict[str, Any]:

        row = await self.db.fetchrow(
            """
            INSERT INTO subjects (code, name)
            VALUES ($1, $2)
            RETURNING id, code, name
            """,
            code,
            name,
        )

        return {
            "id": str(row["id"]),
            "code": row["code"],
            "name": row["name"],
        }
    async def get_name(self, subject_code: str) -> Optional[str]:
        row = await self.db.fetchrow(
            "SELECT name FROM subjects WHERE code = $1",
            subject_code,
        )
        if not row:
            return None
        return row["name"]
