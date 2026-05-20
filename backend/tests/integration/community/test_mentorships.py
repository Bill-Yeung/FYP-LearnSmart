import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix = "mentor"):
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

async def _setup_mentorship(client, db, authenticated_user, subject = "Math"):
    
    owner_email = authenticated_user["email"]
    owner_pw = authenticated_user["password"]
    mentor_id = authenticated_user["user"]["id"]

    await client.post("/api/mentorships/mentors/register",
                      params = {"subjects": subject})

    user2 = await _create_user(db, "mentee")
    await _login(client, user2["email"], user2["password"])

    cr = await client.post("/api/mentorships",
                           params = {"mentor_id": mentor_id,
                                     "subject": subject})
    mentorship_id = cr.json()["mentorship"]["id"]

    await _login(client, owner_email, owner_pw)

    return mentorship_id, user2

class TestMentorRegistration:

    @pytest.mark.asyncio
    async def test_register_as_mentor(self, client, authenticated_user):
        r = await client.post("/api/mentorships/mentors/register",
                              params = {"subjects": "Python,Math",
                                        "bio": "I love teaching"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_register_mentor_no_auth(self, client):
        r = await client.post("/api/mentorships/mentors/register",
                              params = {"subjects": "Python"})
        assert r.status_code == 401

class TestListMentors:

    @pytest.mark.asyncio
    async def test_list_mentors(self, client, authenticated_user):
        r = await client.get("/api/mentorships/mentors")
        assert r.status_code == 200
        data = r.json()
        assert "mentors" in data

    @pytest.mark.asyncio
    async def test_search_mentors(self, client, authenticated_user):
        r = await client.get("/api/mentorships/mentors",
                             params = {"search": "Python"})
        assert r.status_code == 200

class TestMentorAvailability:

    @pytest.mark.asyncio
    async def test_toggle_availability(self, client, authenticated_user):

        await client.post("/api/mentorships/mentors/register",
                          params = {"subjects": "Science"})

        r = await client.put("/api/mentorships/mentors/availability",
                             params = {"available": "false"})
        assert r.status_code == 200

class TestRequestMentorship:

    @pytest.mark.asyncio
    async def test_request_mentorship(self, client, db, authenticated_user):
        owner_email = authenticated_user["email"]
        owner_pw = authenticated_user["password"]

        await client.post("/api/mentorships/mentors/register",
                          params = {"subjects": "Math"})
        mentor_id = authenticated_user["user"]["id"]

        user2 = await _create_user(db, "mentee")
        await _login(client, user2["email"], user2["password"])

        r = await client.post("/api/mentorships",
                              params = {"mentor_id": mentor_id,
                                        "subject": "Math"})
        assert r.status_code == 200
        assert "mentorship" in r.json()

        await _login(client, owner_email, owner_pw)

class TestAcceptMentorship:

    @pytest.mark.asyncio
    async def test_accept_mentorship(self, client, db, authenticated_user):
        mentorship_id, _ = await _setup_mentorship(client, db, authenticated_user, "Physics")

        r = await client.post(f"/api/mentorships/{mentorship_id}/accept")
        assert r.status_code == 200
        assert "accepted" in r.json()["message"].lower()


class TestDeclineMentorship:

    @pytest.mark.asyncio
    async def test_decline_mentorship(self, client, db, authenticated_user):
        mentorship_id, _ = await _setup_mentorship(client, db, authenticated_user, "History")

        r = await client.post(f"/api/mentorships/{mentorship_id}/decline")
        assert r.status_code == 200
        assert "declined" in r.json()["message"].lower()

class TestEndMentorship:

    @pytest.mark.asyncio
    async def test_end_mentorship(self, client, db, authenticated_user):
        mentorship_id, _ = await _setup_mentorship(client, db, authenticated_user, "Chemistry")

        r_accept = await client.post(f"/api/mentorships/{mentorship_id}/accept")
        assert r_accept.status_code == 200

        r = await client.post(f"/api/mentorships/{mentorship_id}/end")
        assert r.status_code == 200

class TestMyMentorships:

    @pytest.mark.asyncio
    async def test_get_my_mentorships(self, client, authenticated_user):
        r = await client.get("/api/mentorships/my")
        assert r.status_code == 200
        data = r.json()
        assert "mentorships" in data

class TestMentorshipStats:

    @pytest.mark.asyncio
    async def test_get_stats(self, client, authenticated_user):
        r = await client.get("/api/mentorships/stats")
        assert r.status_code == 200
