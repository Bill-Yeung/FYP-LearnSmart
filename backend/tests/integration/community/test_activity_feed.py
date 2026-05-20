import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix = "feed"):
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

async def _insert_activity(db, actor_id, activity_type = "shared"):

    row = await db.fetchrow(
        """INSERT INTO activity_feed (actor_id, activity_type, entity_type, entity_id)
           VALUES ($1, $2, 'diagram', $3)
           RETURNING id""",
        actor_id, activity_type, uuid4())
    return str(row["id"])

class TestActivityFeed:

    @pytest.mark.asyncio
    async def test_get_feed_all(self, client, authenticated_user):
        r = await client.get("/api/activity-feed")
        assert r.status_code == 200
        data = r.json()
        assert "activities" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_get_feed_following(self, client, authenticated_user):
        r = await client.get("/api/activity-feed", params = {"feed_type": "following"})
        assert r.status_code == 200
        data = r.json()
        assert "activities" in data

    @pytest.mark.asyncio
    async def test_get_feed_no_auth(self, client):
        r = await client.get("/api/activity-feed")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_get_feed_pagination(self, client, authenticated_user):
        r = await client.get("/api/activity-feed",
                             params = {"page": 1, "page_size": 5})
        assert r.status_code == 200

class TestActivityLike:

    @pytest.mark.asyncio
    async def test_toggle_like(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        activity_id = await _insert_activity(db, user_id)

        r1 = await client.post(f"/api/activity-feed/{activity_id}/like")
        assert r1.status_code == 200
        assert r1.json()["liked"] is True

        r2 = await client.post(f"/api/activity-feed/{activity_id}/like")
        assert r2.status_code == 200
        assert r2.json()["liked"] is False

    @pytest.mark.asyncio
    async def test_like_no_auth(self, client):
        r = await client.post(f"/api/activity-feed/{uuid4()}/like")
        assert r.status_code == 401

class TestActivityComments:

    @pytest.mark.asyncio
    async def test_post_and_get_comments(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        activity_id = await _insert_activity(db, user_id)

        r1 = await client.post(f"/api/activity-feed/{activity_id}/comments",
                               params = {"content": "Nice work!"})
        assert r1.status_code == 200
        assert "comment" in r1.json()

        r2 = await client.get(f"/api/activity-feed/{activity_id}/comments")
        assert r2.status_code == 200
        data = r2.json()
        assert "comments" in data
        assert len(data["comments"]) >= 1

    @pytest.mark.asyncio
    async def test_comment_no_auth(self, client):
        r = await client.post(f"/api/activity-feed/{uuid4()}/comments",
                              params = {"content": "Should fail"})
        assert r.status_code == 401
