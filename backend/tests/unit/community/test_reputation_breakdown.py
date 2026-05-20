import pytest

from app.repositories.reputation_repository import ReputationRepository

class FakeDB:

    def __init__(self, row=None):
        self._row = row

    async def fetchrow(self, *args, **kwargs):
        return self._row

    async def fetchval(self, *args, **kwargs):
        return None

    async def fetch(self, *args, **kwargs):
        return []

def _expected_categories():
    return ["teaching", "content", "feedback", "engagement", "reliability"]

@pytest.mark.asyncio
class TestGetBreakdownDefaults:

    async def test_returns_five_zero_categories_when_no_reputation(self):
        repo = ReputationRepository(FakeDB(row=None))
        out = await repo.get_breakdown(user_id="u1")

        assert [item["category"] for item in out] == _expected_categories()
        assert all(item["score"] == 0 for item in out)

    async def test_default_categories_have_labels_and_icons(self):
        repo = ReputationRepository(FakeDB(row=None))
        out = await repo.get_breakdown(user_id="u1")

        for item in out:
            assert isinstance(item["label"], str) and item["label"]
            assert isinstance(item["icon"], str) and item["icon"]

@pytest.mark.asyncio
class TestGetBreakdownPopulated:

    async def test_maps_row_scores_into_breakdown(self):
        row = {
            "teaching_score": 12,
            "content_score": 34,
            "feedback_score": 56,
            "engagement_score": 78,
            "reliability_score": 90,
        }
        repo = ReputationRepository(FakeDB(row=row))
        out = await repo.get_breakdown(user_id="u1")

        by_cat = {item["category"]: item["score"] for item in out}
        assert by_cat == {
            "teaching": 12,
            "content": 34,
            "feedback": 56,
            "engagement": 78,
            "reliability": 90,
        }

    async def test_missing_dimension_in_row_defaults_to_zero(self):
        row = {
            "teaching_score": 5,
            "feedback_score": 7,
            "engagement_score": 9,
            "reliability_score": 11,
        }
        repo = ReputationRepository(FakeDB(row=row))
        out = await repo.get_breakdown(user_id="u1")

        by_cat = {item["category"]: item["score"] for item in out}
        assert by_cat["content"] == 0
        assert by_cat["teaching"] == 5
        assert by_cat["reliability"] == 11

    async def test_breakdown_preserves_canonical_order(self):
        row = {k + "_score": 1 for k in _expected_categories()}
        repo = ReputationRepository(FakeDB(row=row))
        out = await repo.get_breakdown(user_id="u1")
        assert [item["category"] for item in out] == _expected_categories()
