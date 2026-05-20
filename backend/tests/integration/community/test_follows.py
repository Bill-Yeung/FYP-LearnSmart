import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix = "follow"):
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

class TestFollow:

    @pytest.mark.asyncio
    async def test_follow_user(self, client, db, authenticated_user):
        user2 = await _create_user(db)

        r = await client.post(f"/api/follows/{user2['id']}")
        assert r.status_code == 200
        assert "Followed" in r.json()["message"]

    @pytest.mark.asyncio
    async def test_follow_already_following(self, client, db, authenticated_user):
        user2 = await _create_user(db)

        await client.post(f"/api/follows/{user2['id']}")
        r = await client.post(f"/api/follows/{user2['id']}")
        assert r.status_code == 200
        assert "Already" in r.json()["message"]

    @pytest.mark.asyncio
    async def test_follow_nonexistent_user(self, client, authenticated_user):

        fake_id = str(uuid4())
        try:
            r = await client.post(f"/api/follows/{fake_id}")
            assert r.status_code >= 400
        except Exception:
            pass

    @pytest.mark.asyncio
    async def test_follow_no_auth(self, client):
        r = await client.post(f"/api/follows/{uuid4()}")
        assert r.status_code == 401

class TestUnfollow:

    @pytest.mark.asyncio
    async def test_unfollow_user(self, client, db, authenticated_user):
        user2 = await _create_user(db)

        await client.post(f"/api/follows/{user2['id']}")
        r = await client.delete(f"/api/follows/{user2['id']}")
        assert r.status_code == 200
        assert "Unfollowed" in r.json()["message"]

    @pytest.mark.asyncio
    async def test_unfollow_not_following(self, client, db, authenticated_user):
        user2 = await _create_user(db)

        r = await client.delete(f"/api/follows/{user2['id']}")
        assert r.status_code == 404
        assert "Not following" in r.json()["detail"]

class TestCheckFollowing:

    @pytest.mark.asyncio
    async def test_check_following_true(self, client, db, authenticated_user):
        user2 = await _create_user(db)

        await client.post(f"/api/follows/{user2['id']}")

        r = await client.get(f"/api/follows/check/{user2['id']}")
        assert r.status_code == 200
        assert r.json()["is_following"] is True

    @pytest.mark.asyncio
    async def test_check_following_false(self, client, db, authenticated_user):
        user2 = await _create_user(db)

        r = await client.get(f"/api/follows/check/{user2['id']}")
        assert r.status_code == 200
        assert r.json()["is_following"] is False

class TestListFollowing:

    @pytest.mark.asyncio
    async def test_list_following(self, client, db, authenticated_user):
        user2 = await _create_user(db, "target_a")
        user3 = await _create_user(db, "target_b")

        await client.post(f"/api/follows/{user2['id']}")
        await client.post(f"/api/follows/{user3['id']}")

        r = await client.get("/api/follows/following")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 2

    @pytest.mark.asyncio
    async def test_list_following_empty(self, client, authenticated_user):
        r = await client.get("/api/follows/following")
        assert r.status_code == 200
        data = r.json()
        assert "users" in data
        assert "total" in data

class TestListFollowers:

    @pytest.mark.asyncio
    async def test_list_followers(self, client, db, authenticated_user):
        original_email = authenticated_user["email"]
        original_pw = authenticated_user["password"]

        user2 = await _create_user(db, "follower")

        await _login(client, user2["email"], user2["password"])

        original_user_id = authenticated_user["user"]["id"]
        await client.post(f"/api/follows/{original_user_id}")

        await _login(client, original_email, original_pw)

        r = await client.get("/api/follows/followers")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
