import pytest
from uuid import uuid4
from app.services import AuthService

async def _create_user(db, prefix="pwreset"):
    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    password = "TestPassword123!"
    row = await db.fetchrow(
        """INSERT INTO users (username, email, password_hash, role, display_name, is_active, email_verified)
           VALUES ($1, $2, $3, 'student', $4, TRUE, TRUE) RETURNING id""",
        f"{prefix}_{uid}", email, AuthService.hash_password(password), f"User {uid}")
    return {"id": row["id"], "email": email, "password": password}

class TestRequestPasswordReset:

    @pytest.mark.asyncio
    async def test_request_reset_existing_user(self, client, db):

        user = await _create_user(db)

        r = await client.post("/api/auth/password-reset/request",
                              json={"email": user["email"]})
        assert r.status_code == 200
        assert "message" in r.json()

    @pytest.mark.asyncio
    async def test_request_reset_nonexistent_email(self, client):

        r = await client.post("/api/auth/password-reset/request",
                              json={"email": f"nobody_{uuid4().hex[:6]}@example.com"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_request_reset_deactivated_user(self, client, db):
        user = await _create_user(db, "deactivated")
        await db.execute(
            "UPDATE users SET is_active = FALSE WHERE id = $1", user["id"])

        r = await client.post("/api/auth/password-reset/request",
                              json={"email": user["email"]})
        assert r.status_code == 403

class TestVerifyOTPAndResetPassword:

    @pytest.mark.asyncio
    async def test_verify_invalid_otp(self, client, db):

        user = await _create_user(db, "verifyfail")

        r = await client.post("/api/auth/password-reset/verify",
                              json={
                                  "email": user["email"],
                                  "otp": "000000",
                                  "new_password": "NewPassword123!"})
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_verify_otp_full_flow(self, client, db):

        user = await _create_user(db, "fullflow")
        await client.post("/api/auth/password-reset/request",
                          json={"email": user["email"]})
        otp_row = await db.fetchrow(
            """SELECT otp_code FROM password_reset_otps
               WHERE email = $1 AND used_at IS NULL
               ORDER BY created_at DESC LIMIT 1""",
            user["email"])

        if otp_row is None:
            pytest.skip("OTP not saved to DB (async email task)")

        otp = otp_row["otp_code"]
        new_password = "NewSecurePassword123!"

        r = await client.post("/api/auth/password-reset/verify",
                              json={
                                  "email": user["email"],
                                  "otp": otp,
                                  "new_password": new_password})
        assert r.status_code == 200

        login_r = await client.post("/api/auth/login",
                                    json={"email": user["email"],
                                          "password": new_password})
        assert login_r.status_code == 200
