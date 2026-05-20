import pytest

class TestReputationSummary:

    @pytest.mark.asyncio
    async def test_get_reputation_summary(self, client, authenticated_user):
        r = await client.get("/api/reputation/me")
        assert r.status_code == 200
        data = r.json()
        assert "total_score" in data or "summary" in data

    @pytest.mark.asyncio
    async def test_reputation_summary_no_auth(self, client):
        r = await client.get("/api/reputation/me")
        assert r.status_code == 401

class TestReputationBreakdown:

    @pytest.mark.asyncio
    async def test_get_breakdown(self, client, authenticated_user):
        r = await client.get("/api/reputation/me/breakdown")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_breakdown_no_auth(self, client):
        r = await client.get("/api/reputation/me/breakdown")
        assert r.status_code == 401

class TestReputationEvents:

    @pytest.mark.asyncio
    async def test_get_events(self, client, authenticated_user):
        r = await client.get("/api/reputation/me/events")
        assert r.status_code == 200
        data = r.json()
        assert "events" in data

    @pytest.mark.asyncio
    async def test_events_pagination(self, client, authenticated_user):
        r = await client.get("/api/reputation/me/events",
                             params = {"limit": 5, "offset": 0})
        assert r.status_code == 200

class TestReputationLevels:

    @pytest.mark.asyncio
    async def test_get_levels(self, client, authenticated_user):
        r = await client.get("/api/reputation/levels")
        assert r.status_code == 200
        data = r.json()
        assert "levels" in data
