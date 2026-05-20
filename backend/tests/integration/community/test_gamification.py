import pytest

class TestPointsSummary:

    @pytest.mark.asyncio
    async def test_get_points_summary(self, client, authenticated_user):
        r = await client.get("/api/gamification/points/summary")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_points_summary_no_auth(self, client):
        r = await client.get("/api/gamification/points/summary")
        assert r.status_code == 401

class TestPointsHistory:

    @pytest.mark.asyncio
    async def test_get_points_history(self, client, authenticated_user):
        r = await client.get("/api/gamification/points/history")
        assert r.status_code == 200
        data = r.json()
        assert "transactions" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_points_history_pagination(self, client, authenticated_user):
        r = await client.get("/api/gamification/points/history",
                             params = {"page": 1, "page_size": 5})
        assert r.status_code == 200

class TestStreaks:

    @pytest.mark.asyncio
    async def test_record_daily_study(self, client, authenticated_user):
        r = await client.post("/api/gamification/streak",
                              params = {"streak_type": "daily_study"})
        assert r.status_code == 200

class TestBadges:

    @pytest.mark.asyncio
    async def test_get_badges(self, client, authenticated_user):
        r = await client.get("/api/gamification/badges")
        assert r.status_code == 200
        data = r.json()
        assert "badges" in data

class TestLeaderboard:

    @pytest.mark.asyncio
    async def test_global_leaderboard(self, client, authenticated_user):
        r = await client.get("/api/gamification/leaderboard")
        assert r.status_code == 200
        data = r.json()
        assert "leaderboard" in data

    @pytest.mark.asyncio
    async def test_leaderboard_no_auth(self, client):
        r = await client.get("/api/gamification/leaderboard")
        assert r.status_code == 401

class TestShop:

    @pytest.mark.asyncio
    async def test_get_shop_items(self, client, authenticated_user):
        r = await client.get("/api/gamification/shop")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_get_shop_items_by_category(self, client, authenticated_user):
        r = await client.get("/api/gamification/shop", params={"category": "fun"})
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        for item in data["items"]:
            assert item["category"] == "fun"

    @pytest.mark.asyncio
    async def test_shop_no_auth(self, client):
        r = await client.get("/api/gamification/shop")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_purchase_nonexistent_item(self, client, authenticated_user):
        fake_id = "00000000-0000-0000-0000-000000000000"
        r = await client.post(f"/api/gamification/shop/{fake_id}/purchase")
        assert r.status_code in (400, 404, 500)
