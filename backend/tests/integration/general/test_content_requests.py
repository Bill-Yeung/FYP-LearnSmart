import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix = "creq"):
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

class TestCreateContentRequest:

    @pytest.mark.asyncio
    async def test_create_content_request(self, client, authenticated_user):
        r = await client.post("/api/content-requests", params = {
            "title": "Need a Python tutorial",
            "request_type": "content",
            "description": "Looking for beginner Python content"})

        assert r.status_code == 200
        data = r.json()
        assert "request" in data
        assert data["request"]["title"] == "Need a Python tutorial"

    @pytest.mark.asyncio
    async def test_create_content_request_no_auth(self, client):
        r = await client.post("/api/content-requests", params = {
            "title": "Should Fail"})
        assert r.status_code == 401

class TestListContentRequests:

    @pytest.mark.asyncio
    async def test_list_all_requests(self, client, authenticated_user):

        await client.post("/api/content-requests", params = {
            "title": "List Test",
            "request_type": "content"})

        r = await client.get("/api/content-requests")
        assert r.status_code == 200
        data = r.json()
        assert "requests" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_my_requests(self, client, authenticated_user):
        r = await client.get("/api/content-requests", params = {"tab": "my"})
        assert r.status_code == 200

class TestGetContentRequest:

    @pytest.mark.asyncio
    async def test_get_content_request(self, client, authenticated_user):
        cr = await client.post("/api/content-requests", params = {
            "title": "Get Me",
            "request_type": "content"})
        request_id = cr.json()["request"]["id"]

        r = await client.get(f"/api/content-requests/{request_id}")
        assert r.status_code == 200
        assert r.json()["request"]["title"] == "Get Me"

    @pytest.mark.asyncio
    async def test_get_nonexistent_request(self, client, authenticated_user):
        r = await client.get(f"/api/content-requests/{uuid4()}")
        assert r.status_code == 404

class TestVoteContentRequest:

    @pytest.mark.asyncio
    async def test_toggle_vote(self, client, db, authenticated_user):

        cr = await client.post("/api/content-requests", params = {
            "title": "Vote Test",
            "request_type": "content"})
        request_id = cr.json()["request"]["id"]

        user2 = await _create_user(db, "voter")
        await _login(client, user2["email"], user2["password"])

        r1 = await client.post(f"/api/content-requests/{request_id}/vote")
        assert r1.status_code == 200

        r2 = await client.post(f"/api/content-requests/{request_id}/vote")
        assert r2.status_code == 200

        await _login(client, authenticated_user["email"], authenticated_user["password"])

class TestCompleteContentRequest:

    @pytest.mark.asyncio
    async def test_complete_request(self, client, authenticated_user):
        cr = await client.post("/api/content-requests", params = {
            "title": "Fulfill Me",
            "request_type": "content"})
        request_id = cr.json()["request"]["id"]

        r = await client.post(f"/api/content-requests/{request_id}/complete")
        assert r.status_code == 200
