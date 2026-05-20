import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix = "share"):
    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    password = "TestPassword123!"
    row = await db.fetchrow(
        """INSERT INTO users (username, email, password_hash, role, display_name, is_active, email_verified)
           VALUES ($1, $2, $3, 'student', $4, TRUE, TRUE) RETURNING id""",
        f"{prefix}_{uid}", email, AuthService.hash_password(password), f"User {uid}")
    return {"id": str(row["id"]), "email": email, "password": password}

async def _login(client, email, password):
    r = await client.post("/api/auth/login", json = {"email": email, "password": password})
    assert r.status_code == 200
    return r.json()

async def _create_diagram(db, user_id):

    row = await db.fetchrow(
        """INSERT INTO diagrams (user_id, title, diagram_type, diagram_data, url_slug)
           VALUES ($1, 'Test Diagram', 'knowledge_map', '{"nodes":[],"links":[]}', $2)
           RETURNING id""",
        user_id, uuid4().hex[:12])
    return str(row["id"])

class TestShareContent:

    @pytest.mark.asyncio
    async def test_share_content(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram_id = await _create_diagram(db, user_id)

        r = await client.post("/api/shared-content", params = {
            "entity_type": "diagram",
            "entity_id": diagram_id,
            "title": "My Shared Diagram"})

        assert r.status_code == 200
        data = r.json()
        assert "item" in data
        assert data["item"]["title"] == "My Shared Diagram"

    @pytest.mark.asyncio
    async def test_share_content_no_auth(self, client):
        r = await client.post("/api/shared-content", params = {
            "entity_type": "diagram",
            "entity_id": str(uuid4()),
            "title": "Should Fail"})
        assert r.status_code == 401

class TestListSharedContent:

    @pytest.mark.asyncio
    async def test_list_shared_content(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram_id = await _create_diagram(db, user_id)

        await client.post("/api/shared-content", params = {
            "entity_type": "diagram",
            "entity_id": diagram_id,
            "title": "Listed Content"})

        r = await client.get("/api/shared-content")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_shared_content_no_auth(self, client):
        r = await client.get("/api/shared-content")
        assert r.status_code == 401

class TestGetSharedContent:

    @pytest.mark.asyncio
    async def test_get_shared_content(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram_id = await _create_diagram(db, user_id)

        cr = await client.post("/api/shared-content", params = {
            "entity_type": "diagram",
            "entity_id": diagram_id,
            "title": "Get Me"})
        content_id = cr.json()["item"]["id"]

        r = await client.get(f"/api/shared-content/{content_id}")
        assert r.status_code == 200
        assert r.json()["item"]["title"] == "Get Me"

    @pytest.mark.asyncio
    async def test_get_nonexistent_content(self, client, authenticated_user):
        r = await client.get(f"/api/shared-content/{uuid4()}")
        assert r.status_code == 404

class TestRateContent:

    @pytest.mark.asyncio
    async def test_rate_content(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram_id = await _create_diagram(db, user_id)

        cr = await client.post("/api/shared-content", params = {
            "entity_type": "diagram",
            "entity_id": diagram_id,
            "title": "Rate Me"})
        content_id = cr.json()["item"]["id"]

        user2 = await _create_user(db, "rater")
        await _login(client, user2["email"], user2["password"])

        r = await client.post(f"/api/shared-content/{content_id}/rate",
                              params = {"rating": 5, "review_text": "Great!"})
        assert r.status_code == 200

        await _login(client, authenticated_user["email"], authenticated_user["password"])

class TestRecordAction:

    @pytest.mark.asyncio
    async def test_record_download_action(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram_id = await _create_diagram(db, user_id)

        cr = await client.post("/api/shared-content", params = {
            "entity_type": "diagram",
            "entity_id": diagram_id,
            "title": "Action Test"})
        content_id = cr.json()["item"]["id"]

        r = await client.post(f"/api/shared-content/{content_id}/download",
                              params = {"action_type": "view"})
        assert r.status_code == 200
