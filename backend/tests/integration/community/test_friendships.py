import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix="friend"):
    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    password = "TestPassword123!"
    row = await db.fetchrow(
        """INSERT INTO users (username, email, password_hash, role, display_name, is_active, email_verified)
           VALUES ($1, $2, $3, 'student', $4, TRUE, TRUE) RETURNING id""",
        f"{prefix}_{uid}", email, AuthService.hash_password(password), f"User {uid}")
    return {"id": str(row["id"]), "username": f"{prefix}_{uid}", "email": email, "password": password}

async def _login(client, email, password):
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()

class TestListFriendships:

    @pytest.mark.asyncio
    async def test_list_friendships(self, client, authenticated_user):
        r = await client.get("/api/friendships")
        assert r.status_code == 200
        data = r.json()
        assert "friendships" in data
        assert "incoming_requests" in data

    @pytest.mark.asyncio
    async def test_list_friendships_filter_status(self, client, authenticated_user):
        r = await client.get("/api/friendships", params={"status": "accepted"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_list_friendships_no_auth(self, client):
        r = await client.get("/api/friendships")
        assert r.status_code == 401

class TestSendFriendRequest:

    @pytest.mark.asyncio
    async def test_send_friend_request(self, client, db, authenticated_user):
        user2 = await _create_user(db)

        r = await client.post("/api/friendships/request",
                              params={"friend_username": user2["username"]})
        assert r.status_code == 200
        data = r.json()
        assert "friendship" in data
        assert data["friendship"]["status"] == "pending"

    @pytest.mark.asyncio
    async def test_send_request_to_self(self, client, authenticated_user):
        r = await client.post("/api/friendships/request",
                              params={"friend_username": authenticated_user["user"]["username"]})
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_send_request_nonexistent_user(self, client, authenticated_user):
        r = await client.post("/api/friendships/request",
                              params={"friend_username": f"nobody_{uuid4().hex[:6]}"})
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_send_duplicate_request(self, client, db, authenticated_user):
        user2 = await _create_user(db, "dupfriend")

        await client.post("/api/friendships/request",
                          params={"friend_username": user2["username"]})

        r = await client.post("/api/friendships/request",
                              params={"friend_username": user2["username"]})
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_send_request_no_auth(self, client):
        r = await client.post("/api/friendships/request",
                              params={"friend_username": "someuser"})
        assert r.status_code == 401

class TestAcceptFriendRequest:

    @pytest.mark.asyncio
    async def test_accept_friend_request(self, client, db, authenticated_user):
        owner_email = authenticated_user["email"]
        owner_pw = authenticated_user["password"]

        user2 = await _create_user(db, "acceptee")

        send_r = await client.post("/api/friendships/request",
                                   params={"friend_username": user2["username"]})
        friendship_id = send_r.json()["friendship"]["id"]

        await _login(client, user2["email"], user2["password"])

        r = await client.post(f"/api/friendships/{friendship_id}/accept")
        assert r.status_code == 200
        assert "accepted" in r.json()["message"].lower()

        await _login(client, owner_email, owner_pw)

    @pytest.mark.asyncio
    async def test_accept_nonexistent_request(self, client, authenticated_user):
        r = await client.post("/api/friendships/999999/accept")
        assert r.status_code == 404

class TestRemoveFriend:

    @pytest.mark.asyncio
    async def test_remove_pending_request(self, client, db, authenticated_user):
        user2 = await _create_user(db, "removepend")

        send_r = await client.post("/api/friendships/request",
                                   params={"friend_username": user2["username"]})
        friendship_id = send_r.json()["friendship"]["id"]

        r = await client.delete(f"/api/friendships/{friendship_id}")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_remove_accepted_friend(self, client, db, authenticated_user):
        owner_email = authenticated_user["email"]
        owner_pw = authenticated_user["password"]

        user2 = await _create_user(db, "removeacc")

        send_r = await client.post("/api/friendships/request",
                                   params={"friend_username": user2["username"]})
        friendship_id = send_r.json()["friendship"]["id"]

        await _login(client, user2["email"], user2["password"])
        await client.post(f"/api/friendships/{friendship_id}/accept")

        await _login(client, owner_email, owner_pw)
        r = await client.delete(f"/api/friendships/{friendship_id}")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_remove_nonexistent_friendship(self, client, authenticated_user):
        r = await client.delete("/api/friendships/999999")
        assert r.status_code == 404
