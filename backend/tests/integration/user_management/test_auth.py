import pytest

class TestRegister:

    @pytest.mark.asyncio
    async def test_register_success(self, client, test_user_data):

        response = await client.post("/api/auth/register", json = test_user_data)

        assert response.status_code == 201

        data = response.json()

        assert data["username"] == test_user_data["username"]
        assert data["email"] == test_user_data["email"]
        assert data["role"] == "student"
        assert data["is_active"] is True
        assert "id" in data
        assert "password" not in data
        assert "password_hash" not in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client, registered_user, test_user_data):

        test_user_data["email"] = registered_user["email"]
        test_user_data["username"] = "different_username"
        response = await client.post("/api/auth/register", json = test_user_data)

        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client, registered_user, test_user_data):

        test_user_data["username"] = registered_user["username"]
        test_user_data["email"] = "different@example.com"
        response = await client.post("/api/auth/register", json = test_user_data)

        assert response.status_code == 400
        assert "Username already taken" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client):

        response = await client.post("/api/auth/register", json = {
            "username": "testuser",
            "email": "not-an-email",
            "password": "TestPassword123!"})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_password(self, client):

        response = await client.post("/api/auth/register", json = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "short"})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_username(self, client):

        response = await client.post("/api/auth/register", json = {
            "username": "ab",
            "email": "test@example.com",
            "password": "TestPassword123!"})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_with_role(self, client, test_user_data):

        test_user_data["role"] = "teacher"
        response = await client.post("/api/auth/register", json = test_user_data)

        assert response.status_code == 201
        assert response.json()["role"] == "teacher"

class TestLogin:

    @pytest.mark.asyncio
    async def test_login_success(self, client, registered_user):

        response = await client.post("/api/auth/login", json = {
            "email": registered_user["email"],
            "password": registered_user["password"]})

        assert response.status_code == 200

        data = response.json()

        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client, registered_user):

        response = await client.post("/api/auth/login", json = {
            "email": registered_user["email"],
            "password": "WrongPassword123!"})

        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, client):

        response = await client.post("/api/auth/login", json = {
            "email": "nonexistent@example.com",
            "password": "TestPassword123!"})

        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_invalid_email_format(self, client):

        response = await client.post("/api/auth/login", json = {
            "email": "not-an-email",
            "password": "TestPassword123!"})

        assert response.status_code == 422

class TestRefreshToken:

    @pytest.mark.asyncio
    async def test_refresh_success(self, client, authenticated_user):

        response = await client.post("/api/auth/refresh", json = {
            "refresh_token": authenticated_user["refresh_token"]})

        assert response.status_code == 200

        data = response.json()

        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != authenticated_user["refresh_token"]

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client):

        response = await client.post("/api/auth/refresh", json = {
            "refresh_token": "invalid.token.here"})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_fails(self, client, authenticated_user):

        client.cookies.clear()

        response = await client.post("/api/auth/refresh", json = {
            "refresh_token": authenticated_user["access_token"]})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_rotation(self, client, authenticated_user):

        old_refresh = authenticated_user["refresh_token"]

        client.cookies.clear()

        response1 = await client.post("/api/auth/refresh", json = {
            "refresh_token": old_refresh})

        assert response1.status_code == 200

        new_tokens = response1.json()

        client.cookies.clear()

        response2 = await client.post("/api/auth/refresh", json = {
            "refresh_token": old_refresh})

        assert response2.status_code == 401

class TestLogout:

    @pytest.mark.asyncio
    async def test_logout_success(self, client, authenticated_user):

        response = await client.post("/api/auth/logout", json = {
            "refresh_token": authenticated_user["refresh_token"]})

        assert response.status_code == 200
        assert "Successfully logged out" in response.json()["message"]

    @pytest.mark.asyncio
    async def test_logout_invalidates_refresh_token(self, client, authenticated_user):

        await client.post("/api/auth/logout", json = {
            "refresh_token": authenticated_user["refresh_token"]})
        response = await client.post("/api/auth/refresh", json = {
            "refresh_token": authenticated_user["refresh_token"]})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_logout_invalid_token(self, client):

        response = await client.post("/api/auth/logout", json = {
            "refresh_token": "invalid.token.here"})

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_logout_already_logged_out(self, client, authenticated_user):

        await client.post("/api/auth/logout", json = {
            "refresh_token": authenticated_user["refresh_token"]})
        response = await client.post("/api/auth/logout", json = {
            "refresh_token": authenticated_user["refresh_token"]})

        assert response.status_code == 400

class TestLogoutAll:

    @pytest.mark.asyncio
    async def test_logout_all_success(self, client, authenticated_user):

        response = await client.post("/api/auth/logout/all", json = {
            "refresh_token": authenticated_user["refresh_token"]})

        assert response.status_code == 200
        assert "Successfully logged out" in response.json()["message"]

    @pytest.mark.asyncio
    async def test_logout_all_invalidates_all_sessions(self, client, registered_user):

        login1 = await client.post("/api/auth/login", json = {
            "email": registered_user["email"],
            "password": registered_user["password"]})
        login2 = await client.post("/api/auth/login", json = {
            "email": registered_user["email"],
            "password": registered_user["password"]})
        tokens1 = login1.json()
        tokens2 = login2.json()
        await client.post("/api/auth/logout/all", json = {
            "refresh_token": tokens1["refresh_token"]})
        response1 = await client.post("/api/auth/refresh", json = {
            "refresh_token": tokens1["refresh_token"]})
        response2 = await client.post("/api/auth/refresh", json = {
            "refresh_token": tokens2["refresh_token"]})

        assert response1.status_code == 401
        assert response2.status_code == 401
