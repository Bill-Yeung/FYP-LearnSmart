import pytest

class TestGetMe:

    @pytest.mark.asyncio
    async def test_get_me_success(self, client, authenticated_user):

        response = await client.get(
            "/api/users/me",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"})

        assert response.status_code == 200

        data = response.json()

        assert data["email"] == authenticated_user["email"]
        assert data["username"] == authenticated_user["username"]
        assert "password" not in data
        assert "password_hash" not in data

    @pytest.mark.asyncio
    async def test_get_me_no_token(self, client):

        response = await client.get("/api/users/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_invalid_token(self, client):

        response = await client.get(
            "/api/users/me",
            headers = {"Authorization": "Bearer invalid.token.here"})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_expired_token_format(self, client):

        response = await client.get(
            "/api/users/me",
            headers = {"Authorization": "Bearer"})

        assert response.status_code == 401

class TestUpdateMe:

    @pytest.mark.asyncio
    async def test_update_display_name(self, client, authenticated_user):

        response = await client.patch(
            "/api/users/me",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"},
            json = {"display_name": "New Display Name"})

        assert response.status_code == 200
        assert response.json()["display_name"] == "New Display Name"

    @pytest.mark.asyncio
    async def test_update_preferred_language(self, client, authenticated_user):

        response = await client.patch(
            "/api/users/me",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"},
            json = {"preferred_language": "zh"})

        assert response.status_code == 200
        assert response.json()["preferred_language"] == "zh"

    @pytest.mark.asyncio
    async def test_update_multiple_fields(self, client, authenticated_user):

        response = await client.patch(
            "/api/users/me",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"},
            json = {
                "display_name": "Updated Name",
                "preferred_language": "fr"})

        assert response.status_code == 200

        data = response.json()

        assert data["display_name"] == "Updated Name"
        assert data["preferred_language"] == "fr"

    @pytest.mark.asyncio
    async def test_update_empty_body(self, client, authenticated_user):

        response = await client.patch(
            "/api/users/me",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"},
            json = {})

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_no_auth(self, client):

        response = await client.patch(
            "/api/users/me",
            json = {"display_name": "Test"})

        assert response.status_code == 401

class TestChangePassword:

    @pytest.mark.asyncio
    async def test_change_password_success(self, client, authenticated_user):

        response = await client.post(
            "/api/users/me/change-password",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"},
            json = {
                "current_password": authenticated_user["password"],
                "new_password": "NewPassword456!"})

        assert response.status_code == 200
        assert "Password changed" in response.json()["message"]

        login_response = await client.post("/api/auth/login", json = {
            "email": authenticated_user["email"],
            "password": "NewPassword456!"})

        assert login_response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, client, authenticated_user):

        response = await client.post(
            "/api/users/me/change-password",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"},
            json = {
                "current_password": "WrongPassword123!",
                "new_password": "NewPassword456!"})

        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_change_password_short_new(self, client, authenticated_user):

        response = await client.post(
            "/api/users/me/change-password",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"},
            json = {
                "current_password": authenticated_user["password"],
                "new_password": "short"})

        assert response.status_code == 422

class TestAdminEndpoints:

    @pytest.mark.asyncio
    async def test_list_users_as_admin(self, client, admin_user, registered_user):

        response = await client.get(
            "/api/users",
            headers = {"Authorization": f"Bearer {admin_user['access_token']}"})

        assert response.status_code == 200

        data = response.json()

        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_list_users_as_student_forbidden(self, client, authenticated_user):

        response = await client.get(
            "/api/users",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"})

        assert response.status_code == 403
        assert "Admin access required" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_user_by_id_as_admin(self, client, admin_user, registered_user):

        user_id = registered_user["user"]["id"]
        response = await client.get(
            f"/api/users/{user_id}",
            headers = {"Authorization": f"Bearer {admin_user['access_token']}"})

        assert response.status_code == 200
        assert response.json()["id"] == user_id

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, client, admin_user):

        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/api/users/{fake_id}",
            headers = {"Authorization": f"Bearer {admin_user['access_token']}"})

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_user_invalid_id_format(self, client, admin_user):

        response = await client.get(
            "/api/users/not-a-uuid",
            headers = {"Authorization": f"Bearer {admin_user['access_token']}"})

        assert response.status_code == 400
        assert "Invalid user ID" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_deactivate_user_as_admin(self, client, admin_user, registered_user):

        user_id = registered_user["user"]["id"]
        response = await client.delete(
            f"/api/users/{user_id}",
            headers = {"Authorization": f"Bearer {admin_user['access_token']}"})
        
        assert response.status_code == 200
        assert "deactivated" in response.json()["message"].lower()

        login_response = await client.post("/api/auth/login", json = {
            "email": registered_user["email"],
            "password": registered_user["password"]})

        assert login_response.status_code == 403
        assert "deactivated" in login_response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_deactivate_user_as_student_forbidden(self, client, authenticated_user):

        response = await client.delete(
            "/api/users/00000000-0000-0000-0000-000000000000",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"})

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_users_by_role(self, client, admin_user):

        response = await client.get(
            "/api/users?role=admin",
            headers = {"Authorization": f"Bearer {admin_user['access_token']}"})

        assert response.status_code == 200

        data = response.json()

        assert all(u["role"] == "admin" for u in data)


class TestSessions:

    @pytest.mark.asyncio
    async def test_list_sessions(self, client, authenticated_user):
        response = await client.get(
            "/api/users/me/sessions",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_list_sessions_no_auth(self, client):
        response = await client.get("/api/users/me/sessions")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_session_invalid_id(self, client, authenticated_user):
        response = await client.delete(
            "/api/users/me/sessions/not-a-uuid",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"})
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_session_not_found(self, client, authenticated_user):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.delete(
            f"/api/users/me/sessions/{fake_id}",
            headers = {"Authorization": f"Bearer {authenticated_user['access_token']}"})
        assert response.status_code == 404
