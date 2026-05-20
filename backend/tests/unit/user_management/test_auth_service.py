import pytest
from uuid import uuid4
from datetime import datetime, timezone

from app.services import AuthService

class TestPasswordHashing:

    def test_hash_password_returns_hash(self):

        password = "TestPassword123!"
        hashed = AuthService.hash_password(password)

        assert hashed != password
        assert len(hashed) > 0
        assert hashed.startswith("$2b$")

    def test_hash_password_different_each_time(self):

        password = "TestPassword123!"
        hash1 = AuthService.hash_password(password)
        hash2 = AuthService.hash_password(password)

        assert hash1 != hash2

    def test_verify_password_correct(self):

        password = "TestPassword123!"
        hashed = AuthService.hash_password(password)

        assert AuthService.verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):

        password = "TestPassword123!"
        wrong_password = "WrongPassword123!"
        hashed = AuthService.hash_password(password)

        assert AuthService.verify_password(wrong_password, hashed) is False

    def test_verify_password_empty(self):

        password = "TestPassword123!"
        hashed = AuthService.hash_password(password)

        assert AuthService.verify_password("", hashed) is False

class TestTokenCreation:

    def test_create_access_token(self):

        user_id = uuid4()
        role = "student"
        token = AuthService.create_access_token(user_id, role)

        assert isinstance(token, str)
        assert len(token) > 0
        assert token.count(".") == 2

    def test_create_refresh_token(self):

        user_id = uuid4()
        token = AuthService.create_refresh_token(user_id)

        assert isinstance(token, str)
        assert len(token) > 0
        assert token.count(".") == 2

    def test_create_tokens_returns_both(self):

        user_id = uuid4()
        role = "teacher"
        tokens = AuthService.create_tokens(user_id, role)

        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert "token_type" in tokens
        assert tokens["token_type"] == "bearer"

class TestTokenDecoding:

    def test_decode_valid_access_token(self):

        user_id = uuid4()
        role = "student"
        token = AuthService.create_access_token(user_id, role)
        payload = AuthService.decode_token(token)

        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["role"] == role
        assert payload["type"] == "access"

    def test_decode_valid_refresh_token(self):

        user_id = uuid4()
        token = AuthService.create_refresh_token(user_id)
        payload = AuthService.decode_token(token)

        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "refresh"

    def test_decode_invalid_token(self):

        payload = AuthService.decode_token("invalid.token.here")

        assert payload is None

    def test_decode_empty_token(self):

        payload = AuthService.decode_token("")

        assert payload is None

    def test_decode_malformed_token(self):

        payload = AuthService.decode_token("not-a-jwt")

        assert payload is None

class TestVerifyRefreshToken:

    def test_verify_valid_refresh_token(self):

        user_id = uuid4()
        token = AuthService.create_refresh_token(user_id)
        result = AuthService.verify_refresh_token(token)

        assert result == user_id

    def test_verify_access_token_as_refresh_fails(self):

        user_id = uuid4()
        token = AuthService.create_access_token(user_id, "student")
        result = AuthService.verify_refresh_token(token)

        assert result is None

    def test_verify_invalid_refresh_token(self):

        result = AuthService.verify_refresh_token("invalid.token.here")

        assert result is None

class TestTokenHashing:

    def test_hash_token_consistent(self):

        token = "some_refresh_token_value"
        hash1 = AuthService.hash_token(token)
        hash2 = AuthService.hash_token(token)

        assert hash1 == hash2

    def test_hash_token_different_inputs(self):

        token1 = "token_one"
        token2 = "token_two"
        hash1 = AuthService.hash_token(token1)
        hash2 = AuthService.hash_token(token2)

        assert hash1 != hash2

    def test_hash_token_returns_hex(self):

        token = "some_token"
        hashed = AuthService.hash_token(token)

        assert len(hashed) == 64
        assert all(c in "0123456789abcdef" for c in hashed)

class TestSessionHelpers:

    def test_create_session_id_unique(self):

        id1 = AuthService.create_session_id()
        id2 = AuthService.create_session_id()

        assert id1 != id2

    def test_get_refresh_token_expiry_in_future(self):
        
        expiry = AuthService.get_refresh_token_expiry()

        assert expiry > datetime.utcnow()
