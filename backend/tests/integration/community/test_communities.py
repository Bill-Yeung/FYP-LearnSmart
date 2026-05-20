import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, role = "student"):

    uid = uuid4().hex[:8]
    username = f"comm_{uid}"
    email = f"comm_{uid}@example.com"
    password = "TestPassword123!"
    row = await db.fetchrow(
        """INSERT INTO users (username, email, password_hash, role, display_name, is_active, email_verified)
           VALUES ($1, $2, $3, $4, $5, TRUE, TRUE) RETURNING id""",
        username, email, AuthService.hash_password(password), role, f"User {uid}")
    return {"id": str(row["id"]), "username": username, "email": email, "password": password}

async def _login(client, email, password):

    r = await client.post("/api/auth/login", json = {"email": email, "password": password})
    assert r.status_code == 200
    return r.json()

class TestCreateCommunity:

    @pytest.mark.asyncio
    async def test_create_public_community(self, client, authenticated_user):
        r = await client.post("/api/communities", params = {
            "name": "Test Community",
            "description": "A test community",
            "community_type": "public"})

        assert r.status_code == 200
        data = r.json()
        assert data["community"]["name"] == "Test Community"
        assert data["community"]["community_type"] == "public"
        assert data["community"]["url_id"]

    @pytest.mark.asyncio
    async def test_create_community_no_auth(self, client):
        r = await client.post("/api/communities", params = {"name": "Unauth"})
        assert r.status_code == 401

class TestListCommunities:

    @pytest.mark.asyncio
    async def test_list_discover(self, client, authenticated_user):

        await client.post("/api/communities", params = {
            "name": "Discoverable", "community_type": "public"})

        r = await client.get("/api/communities", params = {"filter": "discover"})
        assert r.status_code == 200
        data = r.json()
        assert "communities" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_my_communities(self, client, authenticated_user):

        await client.post("/api/communities", params = {
            "name": "MyCommunity", "community_type": "public"})

        r = await client.get("/api/communities", params = {"filter": "my"})
        assert r.status_code == 200
        data = r.json()
        assert "communities" in data

class TestCommunityDetail:

    @pytest.mark.asyncio
    async def test_get_by_url_id(self, client, authenticated_user):
        cr = await client.post("/api/communities", params = {
            "name": "Detail Test", "community_type": "public"})
        url_id = cr.json()["community"]["url_id"]

        r = await client.get(f"/api/communities/{url_id}")
        assert r.status_code == 200
        assert r.json()["community"]["name"] == "Detail Test"

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, authenticated_user):
        r = await client.get("/api/communities/nonexistent-slug-12345")
        assert r.status_code == 404

class TestJoinLeave:

    @pytest.mark.asyncio
    async def test_join_and_leave(self, client, db, authenticated_user):

        cr = await client.post("/api/communities", params = {
            "name": "JoinTest", "community_type": "public"})
        url_id = cr.json()["community"]["url_id"]
        owner_email = authenticated_user["email"]
        owner_password = authenticated_user["password"]

        user2 = await _create_user(db)
        await _login(client, user2["email"], user2["password"])

        r = await client.post(f"/api/communities/{url_id}/join")
        assert r.status_code == 200
        assert "Joined" in r.json()["message"]

        r2 = await client.post(f"/api/communities/{url_id}/join")
        assert r2.status_code == 400
        assert "Already" in r2.json()["detail"]

        r3 = await client.post(f"/api/communities/{url_id}/leave")
        assert r3.status_code == 200
        assert "Left" in r3.json()["message"]

        await _login(client, owner_email, owner_password)

    @pytest.mark.asyncio
    async def test_owner_cannot_leave(self, client, authenticated_user):
        cr = await client.post("/api/communities", params = {
            "name": "OwnerLeaveTest", "community_type": "public"})
        url_id = cr.json()["community"]["url_id"]

        r = await client.post(f"/api/communities/{url_id}/leave")
        assert r.status_code == 400
        assert "Owner cannot leave" in r.json()["detail"]

class TestInviteAuthorization:

    @pytest.mark.asyncio
    async def test_regular_member_cannot_invite(self, client, db, authenticated_user):

        cr = await client.post("/api/communities", params = {
            "name": "InviteAuthTest", "community_type": "public"})
        url_id = cr.json()["community"]["url_id"]
        owner_email = authenticated_user["email"]
        owner_password = authenticated_user["password"]

        user2 = await _create_user(db)
        await _login(client, user2["email"], user2["password"])

        await client.post(f"/api/communities/{url_id}/join")

        r = await client.post(f"/api/communities/{url_id}/invite",
                              params = {"username": user2["username"]})
        assert r.status_code == 403
        assert "Only owners" in r.json()["detail"]

        await _login(client, owner_email, owner_password)

    @pytest.mark.asyncio
    async def test_owner_can_invite(self, client, db, authenticated_user):
        cr = await client.post("/api/communities", params = {
            "name": "InviteOK", "community_type": "public"})
        url_id = cr.json()["community"]["url_id"]

        invitee = await _create_user(db)

        r = await client.post(f"/api/communities/{url_id}/invite",
                              params = {"username": invitee["username"]})
        assert r.status_code == 200
        assert "Invitation sent" in r.json()["message"]

class TestMembers:

    @pytest.mark.asyncio
    async def test_list_members(self, client, authenticated_user):
        cr = await client.post("/api/communities", params = {
            "name": "MembersTest", "community_type": "public"})
        url_id = cr.json()["community"]["url_id"]

        r = await client.get(f"/api/communities/{url_id}/members")
        assert r.status_code == 200
        data = r.json()
        assert "members" in data
        assert data["total"] >= 1

class TestLeaderboard:

    @pytest.mark.asyncio
    async def test_get_leaderboard(self, client, authenticated_user):
        cr = await client.post("/api/communities", params = {
            "name": "LeaderboardTest", "community_type": "public"})
        url_id = cr.json()["community"]["url_id"]

        r = await client.get(f"/api/communities/{url_id}/leaderboard")
        assert r.status_code == 200
        assert "leaderboard" in r.json()
