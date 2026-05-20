import pytest

from app.repositories.challenge_repository import ChallengeRepository

class FakeDB:

    def __init__(self, fetch_results=None, fetchrow_results=None, fetchval_results=None):
        self._fetch = list(fetch_results or [])
        self._fetchrow = list(fetchrow_results or [])
        self._fetchval = list(fetchval_results or [])
        self.calls: list[tuple[str, str, tuple]] = []

    async def fetch(self, sql, *args):
        self.calls.append(("fetch", sql, args))
        return self._fetch.pop(0) if self._fetch else []

    async def fetchrow(self, sql, *args):
        self.calls.append(("fetchrow", sql, args))
        return self._fetchrow.pop(0) if self._fetchrow else None

    async def fetchval(self, sql, *args):
        self.calls.append(("fetchval", sql, args))
        return self._fetchval.pop(0) if self._fetchval else 0

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        return None

def _last_fetch_call(db: FakeDB) -> tuple[str, tuple]:
    for kind, sql, args in reversed(db.calls):
        if kind == "fetch":
            return sql, args
    raise AssertionError("no fetch call recorded")

@pytest.mark.asyncio
class TestListChallengesQueryConstruction:

    async def test_no_filters_produces_no_where_clause(self):
        db = FakeDB(fetch_results=[[]])
        repo = ChallengeRepository(db)
        await repo.list_challenges()

        sql, args = _last_fetch_call(db)
        assert "WHERE" not in sql
        assert args == (20, 0)

    async def test_community_filter_binds_first_arg(self):
        db = FakeDB(fetch_results=[[]])
        repo = ChallengeRepository(db)
        await repo.list_challenges(community_id="comm-1")

        sql, args = _last_fetch_call(db)
        assert "c.community_id = $1" in sql
        assert args[0] == "comm-1"

    async def test_status_filter_appended(self):
        db = FakeDB(fetch_results=[[]])
        repo = ChallengeRepository(db)
        await repo.list_challenges(status="active")

        sql, args = _last_fetch_call(db)
        assert "c.status = $1" in sql
        assert args[0] == "active"

    async def test_joined_only_requires_user_id(self):

        db = FakeDB(fetch_results=[[]])
        repo = ChallengeRepository(db)
        await repo.list_challenges(joined_only=True, user_id=None)

        sql, _ = _last_fetch_call(db)
        assert "challenge_participants" not in sql

    async def test_joined_only_with_user_adds_exists_clause(self):
        db = FakeDB(fetch_results=[[]])
        repo = ChallengeRepository(db)
        await repo.list_challenges(joined_only=True, user_id="u1")

        sql, args = _last_fetch_call(db)
        assert "EXISTS (SELECT 1 FROM challenge_participants" in sql
        assert "u1" in args

    async def test_all_filters_combined_with_AND(self):
        db = FakeDB(fetch_results=[[]])
        repo = ChallengeRepository(db)
        await repo.list_challenges(
            community_id="c1", status="active", joined_only=True, user_id="u1",
        )

        sql, args = _last_fetch_call(db)

        assert "c.community_id = $1" in sql
        assert "c.status = $2" in sql
        assert "$3" in sql
        assert "LIMIT $4 OFFSET $5" in sql
        assert args[:3] == ("c1", "active", "u1")

    async def test_pagination_offset_math(self):
        db = FakeDB(fetch_results=[[]])
        repo = ChallengeRepository(db)
        await repo.list_challenges(page=3, page_size=10)

        _, args = _last_fetch_call(db)
        assert args[-2:] == (10, 20)

@pytest.mark.asyncio
class TestJoinChallenge:

    async def test_raises_when_already_joined(self):

        db = FakeDB(fetchrow_results=[None])
        repo = ChallengeRepository(db)
        with pytest.raises(ValueError, match="Already joined"):
            await repo.join_challenge("ch-1", "u1")

    async def test_increments_participant_count_on_success(self):
        db = FakeDB(fetchrow_results=[{"challenge_id": "ch-1", "user_id": "u1"}])
        repo = ChallengeRepository(db)
        await repo.join_challenge("ch-1", "u1")

        execute_calls = [c for c in db.calls if c[0] == "execute"]
        assert any("participant_count = participant_count + 1" in c[1] for c in execute_calls)

@pytest.mark.asyncio
class TestFinalizeChallenge:

    async def test_marks_top_submission_as_winner(self):
        submissions = [
            {"id": "s1", "user_id": "u1", "final_score": 92.0},
            {"id": "s2", "user_id": "u2", "final_score": 81.5},
        ]
        db = FakeDB(
            fetch_results=[submissions],
            fetchrow_results=[{
                "id": "ch-1", "title": "T", "community_id": "c1",
                "status": "completed",
            }],
        )
        repo = ChallengeRepository(db)
        result = await repo.finalize_challenge("ch-1")

        rank_updates = [c for c in db.calls if c[0] == "execute" and "rank" in c[1].lower()]
        assert rank_updates[0][2][0] == 1
        assert rank_updates[0][2][1] == "winner"
        assert rank_updates[0][2][2] == "s1"
        assert rank_updates[1][2][0] == 2
        assert rank_updates[1][2][1] == "approved"
        assert rank_updates[1][2][2] == "s2"

        assert result["rankings"][0]["rank"] == 1
        assert result["rankings"][0]["score"] == 92.0
        assert result["rankings"][1]["rank"] == 2

    async def test_marks_challenge_completed(self):
        db = FakeDB(
            fetch_results=[[]],
            fetchrow_results=[{"id": "ch-1", "title": "T", "community_id": "c1"}],
        )
        repo = ChallengeRepository(db)
        await repo.finalize_challenge("ch-1")

        assert any(
            c[0] == "execute" and "status = 'completed'" in c[1]
            for c in db.calls
        )

    async def test_returns_empty_rankings_when_no_submissions(self):
        db = FakeDB(
            fetch_results=[[]],
            fetchrow_results=[{"id": "ch-1", "title": "T", "community_id": "c1"}],
        )
        repo = ChallengeRepository(db)
        result = await repo.finalize_challenge("ch-1")
        assert result["rankings"] == []

    async def test_handles_single_submission_as_winner(self):
        submissions = [{"id": "s1", "user_id": "u1", "final_score": 50.0}]
        db = FakeDB(
            fetch_results=[submissions],
            fetchrow_results=[{"id": "ch-1", "title": "T", "community_id": "c1"}],
        )
        repo = ChallengeRepository(db)
        result = await repo.finalize_challenge("ch-1")

        assert len(result["rankings"]) == 1
        assert result["rankings"][0]["rank"] == 1
