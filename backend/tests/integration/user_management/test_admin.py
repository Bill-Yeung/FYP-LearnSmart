import pytest

class TestAdminContent:

    @pytest.mark.asyncio
    async def test_list_content_as_admin(self, client, admin_headers):
        response = await client.get("/api/admin/content", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_list_content_filter_by_type(self, client, admin_headers):
        response = await client.get(
            "/api/admin/content",
            headers=admin_headers,
            params={"content_type": "document"})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        for item in data["items"]:
            assert item["type"] == "document"

    @pytest.mark.asyncio
    async def test_list_content_filter_by_status(self, client, admin_headers):
        response = await client.get(
            "/api/admin/content",
            headers=admin_headers,
            params={"status": "approved"})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    @pytest.mark.asyncio
    async def test_list_content_with_pagination(self, client, admin_headers):
        response = await client.get(
            "/api/admin/content",
            headers=admin_headers,
            params={"limit": 5, "offset": 0})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) <= 5

    @pytest.mark.asyncio
    async def test_list_content_unauthorized(self, client):
        response = await client.get("/api/admin/content")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_content_non_admin(self, client, auth_headers):
        response = await client.get("/api/admin/content", headers=auth_headers)
        assert response.status_code in [403, 401]

class TestAdminSettings:

    @pytest.mark.asyncio
    async def test_get_settings_as_admin(self, client, admin_headers):
        response = await client.get("/api/admin/settings", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "services" in data

        stats = data["stats"]
        assert "total_users" in stats
        assert "total_documents" in stats
        assert "total_discussions" in stats
        assert "total_communities" in stats
        assert "total_flashcards" in stats
        assert "total_questions" in stats
        assert "ai_tokens_used_this_month" in stats

        services = data["services"]
        assert services["database"] == "operational"
        assert services["storage"] == "operational"
        assert services["ai_service"] == "operational"

    @pytest.mark.asyncio
    async def test_get_settings_unauthorized(self, client):
        response = await client.get("/api/admin/settings")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_settings_non_admin(self, client, auth_headers):
        response = await client.get("/api/admin/settings", headers=auth_headers)
        assert response.status_code in [403, 401]
