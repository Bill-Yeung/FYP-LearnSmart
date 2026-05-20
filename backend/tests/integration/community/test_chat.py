import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix="chat"):
    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    password = "TestPassword123!"
    row = await db.fetchrow(
        """INSERT INTO users (username, email, password_hash, role, display_name, is_active, email_verified)
           VALUES ($1, $2, $3, 'student', $4, TRUE, TRUE) RETURNING id""",
        f"{prefix}_{uid}", email, AuthService.hash_password(password), f"User {uid}")
    return {"id": str(row["id"]), "email": email, "password": password}

async def _login(client, email, password):
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()

async def _create_room(client, name=None, room_type="group"):
    name = name or f"Room {uuid4().hex[:6]}"
    r = await client.post("/api/chat/rooms", json={
        "room_type": room_type,
        "name": name,
        "is_private": True})
    assert r.status_code == 200
    return r.json()["room"]

class TestCreateRoom:

    @pytest.mark.asyncio
    async def test_create_group_room(self, client, authenticated_user):
        r = await client.post("/api/chat/rooms", json={
            "room_type": "group",
            "name": f"Test Group {uuid4().hex[:6]}",
            "is_private": True})
        assert r.status_code == 200
        data = r.json()
        assert "room" in data

    @pytest.mark.asyncio
    async def test_create_room_no_auth(self, client):
        r = await client.post("/api/chat/rooms", json={
            "room_type": "group", "name": "No Auth"})
        assert r.status_code == 401

class TestGetRooms:

    @pytest.mark.asyncio
    async def test_get_user_rooms(self, client, authenticated_user):
        await _create_room(client)

        r = await client.get("/api/chat/rooms")
        assert r.status_code == 200
        data = r.json()
        assert "rooms" in data

    @pytest.mark.asyncio
    async def test_get_rooms_no_auth(self, client):
        r = await client.get("/api/chat/rooms")
        assert r.status_code == 401

class TestGetRoom:

    @pytest.mark.asyncio
    async def test_get_room_as_member(self, client, authenticated_user):
        room = await _create_room(client)

        r = await client.get(f"/api/chat/rooms/{room['id']}")
        assert r.status_code == 200
        assert "room" in r.json()

    @pytest.mark.asyncio
    async def test_get_room_non_member(self, client, db, authenticated_user):

        room = await _create_room(client)

        user2 = await _create_user(db)
        await _login(client, user2["email"], user2["password"])

        r = await client.get(f"/api/chat/rooms/{room['id']}")
        assert r.status_code == 403

        await _login(client, authenticated_user["email"], authenticated_user["password"])

class TestRoomMembers:

    @pytest.mark.asyncio
    async def test_get_room_members(self, client, authenticated_user):
        room = await _create_room(client)

        r = await client.get(f"/api/chat/rooms/{room['id']}/members")
        assert r.status_code == 200
        data = r.json()
        assert "members" in data
        assert len(data["members"]) >= 1

    @pytest.mark.asyncio
    async def test_add_member_to_room(self, client, db, authenticated_user):
        room = await _create_room(client)
        user2 = await _create_user(db, "member")

        r = await client.post(f"/api/chat/rooms/{room['id']}/members",
                              json={"user_id": user2["id"], "role": "member"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_remove_member_from_room(self, client, db, authenticated_user):
        room = await _create_room(client)
        user2 = await _create_user(db, "removee")

        await client.post(f"/api/chat/rooms/{room['id']}/members",
                          json={"user_id": user2["id"], "role": "member"})

        r = await client.delete(f"/api/chat/rooms/{room['id']}/members/{user2['id']}")
        assert r.status_code == 200

class TestMessages:

    @pytest.mark.asyncio
    async def test_send_message(self, client, authenticated_user):
        room = await _create_room(client)

        r = await client.post(f"/api/chat/rooms/{room['id']}/messages",
                              json={"content": "Hello, world!", "message_type": "text"})
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert data["message"]["content"] == "Hello, world!"

    @pytest.mark.asyncio
    async def test_get_messages(self, client, authenticated_user):
        room = await _create_room(client)

        await client.post(f"/api/chat/rooms/{room['id']}/messages",
                          json={"content": "Test message", "message_type": "text"})

        r = await client.get(f"/api/chat/rooms/{room['id']}/messages")
        assert r.status_code == 200
        data = r.json()
        assert "messages" in data
        assert len(data["messages"]) >= 1

    @pytest.mark.asyncio
    async def test_send_message_non_member(self, client, db, authenticated_user):
        room = await _create_room(client)

        user2 = await _create_user(db, "nonmember")
        await _login(client, user2["email"], user2["password"])

        r = await client.post(f"/api/chat/rooms/{room['id']}/messages",
                              json={"content": "Should fail", "message_type": "text"})
        assert r.status_code == 403

        await _login(client, authenticated_user["email"], authenticated_user["password"])

class TestEditMessage:

    @pytest.mark.asyncio
    async def test_edit_own_message(self, client, authenticated_user):
        room = await _create_room(client)
        send_r = await client.post(f"/api/chat/rooms/{room['id']}/messages",
                                   json={"content": "Original", "message_type": "text"})
        msg_id = send_r.json()["message"]["id"]
        r = await client.put(f"/api/chat/messages/{msg_id}",
                             json={"content": "Edited"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_edit_nonexistent_message(self, client, authenticated_user):
        r = await client.put(f"/api/chat/messages/{uuid4()}",
                             json={"content": "Nope"})
        assert r.status_code == 404

class TestDeleteMessage:

    @pytest.mark.asyncio
    async def test_delete_own_message(self, client, authenticated_user):
        room = await _create_room(client)

        send_r = await client.post(f"/api/chat/rooms/{room['id']}/messages",
                                   json={"content": "To be deleted", "message_type": "text"})
        msg_id = send_r.json()["message"]["id"]

        r = await client.delete(f"/api/chat/messages/{msg_id}")
        assert r.status_code == 200

class TestReadReceipts:

    @pytest.mark.asyncio
    async def test_mark_message_read(self, client, authenticated_user):
        room = await _create_room(client)

        send_r = await client.post(f"/api/chat/rooms/{room['id']}/messages",
                                   json={"content": "Read me", "message_type": "text"})
        msg_id = send_r.json()["message"]["id"]

        r = await client.post(f"/api/chat/messages/{msg_id}/read")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_mark_room_read(self, client, authenticated_user):
        room = await _create_room(client)

        r = await client.post(f"/api/chat/rooms/{room['id']}/read")
        assert r.status_code == 200

class TestMuteRoom:

    @pytest.mark.asyncio
    async def test_mute_room(self, client, authenticated_user):
        room = await _create_room(client)

        r = await client.post(f"/api/chat/rooms/{room['id']}/mute",
                              params={"is_muted": "true"})
        assert r.status_code == 200
        assert r.json()["is_muted"] is True

    @pytest.mark.asyncio
    async def test_unmute_room(self, client, authenticated_user):
        room = await _create_room(client)

        r = await client.post(f"/api/chat/rooms/{room['id']}/mute",
                              params={"is_muted": "false"})
        assert r.status_code == 200
        assert r.json()["is_muted"] is False

class TestReactions:

    @pytest.mark.asyncio
    async def test_add_reaction(self, client, authenticated_user):
        room = await _create_room(client)

        send_r = await client.post(f"/api/chat/rooms/{room['id']}/messages",
                                   json={"content": "React to me", "message_type": "text"})
        msg_id = send_r.json()["message"]["id"]

        r = await client.post(f"/api/chat/messages/{msg_id}/reactions",
                              json={"emoji": "thumbsup"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_remove_reaction(self, client, authenticated_user):
        room = await _create_room(client)

        send_r = await client.post(f"/api/chat/rooms/{room['id']}/messages",
                                   json={"content": "React then unreact", "message_type": "text"})
        msg_id = send_r.json()["message"]["id"]

        await client.post(f"/api/chat/messages/{msg_id}/reactions",
                          json={"emoji": "heart"})

        r = await client.delete(f"/api/chat/messages/{msg_id}/reactions/heart")
        assert r.status_code == 200

class TestDirectRoom:

    @pytest.mark.asyncio
    async def test_create_direct_room(self, client, db, authenticated_user):
        user2 = await _create_user(db, "direct")

        r = await client.post("/api/chat/rooms/direct",
                              json={"recipient_id": user2["id"]})
        assert r.status_code == 200
        assert "room" in r.json()
