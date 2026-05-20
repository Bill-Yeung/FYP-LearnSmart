import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix = "fb"):
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

class TestFeedbackRequests:

    @pytest.mark.asyncio
    async def test_create_feedback_request(self, client, authenticated_user):
        r = await client.post("/api/feedback/requests", params = {
            "entity_type": "diagram",
            "entity_id": str(uuid4()),
            "title": "Please review my diagram"})

        assert r.status_code == 200
        data = r.json()
        assert "request" in data
        assert data["request"]["title"] == "Please review my diagram"

    @pytest.mark.asyncio
    async def test_list_feedback_requests(self, client, authenticated_user):

        await client.post("/api/feedback/requests", params = {
            "entity_type": "diagram",
            "entity_id": str(uuid4()),
            "title": "Review this"})

        r = await client.get("/api/feedback/requests")
        assert r.status_code == 200
        data = r.json()
        assert "requests" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_feedback_requests_no_auth(self, client):
        r = await client.get("/api/feedback/requests")
        assert r.status_code == 401

class TestFeedbackRespond:

    @pytest.mark.asyncio
    async def test_respond_to_feedback_request(self, client, db, authenticated_user):
        owner_email = authenticated_user["email"]
        owner_pw = authenticated_user["password"]

        cr = await client.post("/api/feedback/requests", params = {
            "entity_type": "diagram",
            "entity_id": str(uuid4()),
            "title": "Need help"})
        request_id = cr.json()["request"]["id"]

        user2 = await _create_user(db, "reviewer")
        await _login(client, user2["email"], user2["password"])

        r = await client.post(f"/api/feedback/requests/{request_id}/respond",
                              params = {"content": "Looks good!",
                                        "rating": 4})
        assert r.status_code == 200
        assert "feedback" in r.json()

        await _login(client, owner_email, owner_pw)

class TestMarkHelpful:

    @pytest.mark.asyncio
    async def test_mark_feedback_helpful(self, client, db, authenticated_user):
        owner_email = authenticated_user["email"]
        owner_pw = authenticated_user["password"]

        cr = await client.post("/api/feedback/requests", params = {
            "entity_type": "diagram",
            "entity_id": str(uuid4()),
            "title": "Help me"})
        request_id = cr.json()["request"]["id"]

        user2 = await _create_user(db, "helper")
        await _login(client, user2["email"], user2["password"])

        rr = await client.post(f"/api/feedback/requests/{request_id}/respond",
                               params = {"content": "Here is my feedback",
                                         "rating": 5})
        feedback_id = rr.json()["feedback"]["id"]

        await _login(client, owner_email, owner_pw)

        r = await client.post(f"/api/feedback/responses/{feedback_id}/helpful")
        assert r.status_code == 200
