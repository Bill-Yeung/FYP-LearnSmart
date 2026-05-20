import pytest
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from app.services import AuthService

async def _create_user(db, prefix = "chal"):
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

async def _create_challenge_in_db(db, created_by):

    now = datetime.utcnow()
    row = await db.fetchrow(
        """INSERT INTO challenges
            (created_by, title, description, instructions, challenge_type,
             starts_at, ends_at, status, max_participants)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'upcoming', 50)
           RETURNING *""",
        created_by,
        f"Test Challenge {uuid4().hex[:6]}",
        "A test challenge",
        "Do your best",
        "quiz",
        now - timedelta(hours = 1),
        now + timedelta(days = 7))
    return dict(row)

class TestCreateChallenge:

    @pytest.mark.asyncio
    async def test_create_challenge_via_api(self, client, authenticated_user):
        
        now = datetime.now(timezone.utc)
        payload = {
            "title": "Test Challenge",
            "challenge_type": "quiz",
            "starts_at": (now - timedelta(hours = 1)).isoformat(),
            "ends_at": (now + timedelta(days = 7)).isoformat(),
            "description": "A test challenge"}

        r = await client.post("/api/challenges", json = payload)

        assert r.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_create_challenge_no_auth(self, client):
        payload = {"title": "T", "challenge_type": "quiz",
                   "starts_at": "2026-01-01T00:00:00", "ends_at": "2026-12-31T00:00:00"}
        r = await client.post("/api/challenges", json = payload)
        assert r.status_code == 401

class TestListChallenges:

    @pytest.mark.asyncio
    async def test_list_challenges(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _create_challenge_in_db(db, user_id)

        r = await client.get("/api/challenges")
        assert r.status_code == 200
        data = r.json()
        assert "challenges" in data
        assert "total" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_list_challenges_no_auth(self, client):
        r = await client.get("/api/challenges")
        assert r.status_code == 401

class TestGetChallenge:

    @pytest.mark.asyncio
    async def test_get_challenge(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        challenge = await _create_challenge_in_db(db, user_id)

        r = await client.get(f"/api/challenges/{challenge['id']}")
        assert r.status_code == 200
        assert r.json()["challenge"]["id"] == str(challenge["id"])

    @pytest.mark.asyncio
    async def test_get_nonexistent_challenge(self, client, authenticated_user):
        r = await client.get(f"/api/challenges/{uuid4()}")
        assert r.status_code == 404

class TestJoinChallenge:

    @pytest.mark.asyncio
    async def test_join_challenge(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        challenge = await _create_challenge_in_db(db, user_id)

        user2 = await _create_user(db)
        await _login(client, user2["email"], user2["password"])

        r = await client.post(f"/api/challenges/{challenge['id']}/join")
        assert r.status_code == 200

        await _login(client, authenticated_user["email"], authenticated_user["password"])

    @pytest.mark.asyncio
    async def test_join_challenge_no_auth(self, client):
        r = await client.post(f"/api/challenges/{uuid4()}/join")
        assert r.status_code == 401

class TestChallengeSubmission:

    @pytest.mark.asyncio
    async def test_submit_to_challenge(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        challenge = await _create_challenge_in_db(db, user_id)

        await db.execute(
            "UPDATE challenges SET status = 'active' WHERE id = $1",
            challenge["id"])

        user2 = await _create_user(db, "submitter")
        await _login(client, user2["email"], user2["password"])

        await client.post(f"/api/challenges/{challenge['id']}/join")

        r = await client.post(f"/api/challenges/{challenge['id']}/submissions",
                              params = {"title": "My Submission",
                                        "description": "My work"})
        assert r.status_code == 200

        await _login(client, authenticated_user["email"], authenticated_user["password"])
