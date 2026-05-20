import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, role = "student"):
    uid = uuid4().hex[:8]
    email = f"disc_{uid}@example.com"
    password = "TestPassword123!"
    row = await db.fetchrow(
        """INSERT INTO users (username, email, password_hash, role, display_name, is_active, email_verified)
           VALUES ($1, $2, $3, $4, $5, TRUE, TRUE) RETURNING id""",
        f"disc_{uid}", email, AuthService.hash_password(password), role, f"User {uid}")
    return {"id": str(row["id"]), "email": email, "password": password}

async def _login(client, email, password):
    r = await client.post("/api/auth/login", json = {"email": email, "password": password})
    assert r.status_code == 200
    return r.json()

async def _create_community_and_join(client, db, name = "DiscTest"):

    cr = await client.post("/api/communities", params = {
        "name": name, "community_type": "public"})
    assert cr.status_code == 200
    c = cr.json()["community"]
    return c["url_id"], c["id"]

class TestCreateThread:

    @pytest.mark.asyncio
    async def test_create_thread(self, client, authenticated_user):
        url_id, community_id = await _create_community_and_join(client, None)

        r = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Test Thread",
            "content": "Hello world",
            "thread_type": "discussion"})

        assert r.status_code == 200
        data = r.json()
        assert data["thread"]["title"] == "Test Thread"
        assert data["thread"]["content"] == "Hello world"

    @pytest.mark.asyncio
    async def test_create_thread_not_member(self, client, db, authenticated_user):

        _, community_id = await _create_community_and_join(client, None)
        owner_email = authenticated_user["email"]
        owner_pw = authenticated_user["password"]

        user2 = await _create_user(db)
        await _login(client, user2["email"], user2["password"])

        r = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Should Fail",
            "content": "Not a member"})
        assert r.status_code == 403

        await _login(client, owner_email, owner_pw)

class TestGetThread:

    @pytest.mark.asyncio
    async def test_get_thread_and_views(self, client, authenticated_user):
        _, community_id = await _create_community_and_join(client, None)

        cr = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "View Counter",
            "content": "Test views"})
        thread_id = cr.json()["thread"]["id"]

        r = await client.get(f"/api/discussions/{thread_id}")
        assert r.status_code == 200
        assert r.json()["thread"]["title"] == "View Counter"

    @pytest.mark.asyncio
    async def test_get_nonexistent_thread(self, client, authenticated_user):
        fake_id = str(uuid4())
        r = await client.get(f"/api/discussions/{fake_id}")
        assert r.status_code == 404

class TestListThreads:

    @pytest.mark.asyncio
    async def test_list_threads(self, client, authenticated_user):
        _, community_id = await _create_community_and_join(client, None)

        await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Thread A",
            "content": "Content A"})
        await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Thread B",
            "content": "Content B"})

        r = await client.get("/api/discussions", params = {"community_id": community_id})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 2
        assert len(data["threads"]) >= 2

class TestReplies:

    @pytest.mark.asyncio
    async def test_create_and_list_replies(self, client, authenticated_user):
        _, community_id = await _create_community_and_join(client, None)

        cr = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Reply Thread",
            "content": "Root"})
        thread_id = cr.json()["thread"]["id"]

        rr = await client.post(f"/api/discussions/{thread_id}/replies",
                               params = {"content": "My reply"})
        assert rr.status_code == 200
        assert rr.json()["reply"]["content"] == "My reply"

        lr = await client.get(f"/api/discussions/{thread_id}/replies")
        assert lr.status_code == 200
        assert lr.json()["total"] >= 1

    @pytest.mark.asyncio
    async def test_reply_to_closed_thread_rejected(self, client, db, authenticated_user):

        _, community_id = await _create_community_and_join(client, None)

        cr = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Will Be Closed",
            "content": "Content"})
        thread_id = cr.json()["thread"]["id"]

        await db.execute(
            "UPDATE discussion_threads SET status = 'closed' WHERE id = $1", thread_id)

        r = await client.post(f"/api/discussions/{thread_id}/replies",
                              params = {"content": "Should fail"})
        assert r.status_code == 400
        assert "closed" in r.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_reply_to_removed_thread_rejected(self, client, db, authenticated_user):

        _, community_id = await _create_community_and_join(client, None)

        cr = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Will Be Removed",
            "content": "Content"})
        thread_id = cr.json()["thread"]["id"]

        await db.execute(
            "UPDATE discussion_threads SET status = 'removed' WHERE id = $1", thread_id)

        r = await client.post(f"/api/discussions/{thread_id}/replies",
                              params = {"content": "Should fail"})
        assert r.status_code == 400
        assert "closed" in r.json()["detail"].lower()

class TestAcceptAnswer:

    @pytest.mark.asyncio
    async def test_accept_own_thread_reply(self, client, db, authenticated_user):
        _, community_id = await _create_community_and_join(client, None)
        owner_email = authenticated_user["email"]
        owner_pw = authenticated_user["password"]

        cr = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Accept Test",
            "content": "Question?",
            "thread_type": "question"})
        thread_id = cr.json()["thread"]["id"]

        user2 = await _create_user(db)
        await _login(client, user2["email"], user2["password"])
        await client.post(f"/api/communities/{(await client.get(f'/api/discussions/{thread_id}')).json()['thread']['community_id']}", params={})
        thread_data = (await client.get(f"/api/discussions/{thread_id}")).json()
        comm_id_str = thread_data["thread"]["community_id"]
        comm_row = await db.fetchrow("SELECT url_id FROM communities WHERE id = $1", comm_id_str)
        await client.post(f"/api/communities/{comm_row['url_id']}/join")

        rr = await client.post(f"/api/discussions/{thread_id}/replies",
                               params = {"content": "Here is the answer"})
        reply_id = rr.json()["reply"]["id"]

        await _login(client, owner_email, owner_pw)

        r = await client.post(f"/api/discussions/{thread_id}/replies/{reply_id}/accept")
        assert r.status_code == 200
        assert "accepted" in r.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_accept_reply_from_different_thread(self, client, db, authenticated_user):
       
        _, community_id = await _create_community_and_join(client, None)

        cr1 = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Thread One",
            "content": "Q1",
            "thread_type": "question"})
        thread1_id = cr1.json()["thread"]["id"]

        cr2 = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Thread Two",
            "content": "Q2",
            "thread_type": "question"})
        thread2_id = cr2.json()["thread"]["id"]

        rr = await client.post(f"/api/discussions/{thread2_id}/replies",
                               params = {"content": "Reply in thread 2"})
        reply_id = rr.json()["reply"]["id"]

        r = await client.post(f"/api/discussions/{thread1_id}/replies/{reply_id}/accept")
        assert r.status_code == 404
        assert "Reply not found" in r.json()["detail"]

class TestLikes:

    @pytest.mark.asyncio
    async def test_toggle_thread_like(self, client, authenticated_user):
        _, community_id = await _create_community_and_join(client, None)

        cr = await client.post("/api/discussions", params = {
            "community_id": community_id,
            "title": "Like Test",
            "content": "Like me"})
        thread_id = cr.json()["thread"]["id"]

        r1 = await client.post(f"/api/discussions/{thread_id}/like")
        assert r1.status_code == 200
        assert r1.json()["liked"] is True

        r2 = await client.post(f"/api/discussions/{thread_id}/like")
        assert r2.status_code == 200
        assert r2.json()["liked"] is False
