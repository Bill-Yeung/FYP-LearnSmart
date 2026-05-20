import pytest
from app.repositories.password_reset_repository import PasswordResetRepository

class TestOTPGeneration:

    def test_generate_otp_length(self):
        otp = PasswordResetRepository.generate_otp()
        assert len(otp) == 6

    def test_generate_otp_digits_only(self):
        otp = PasswordResetRepository.generate_otp()
        assert otp.isdigit()

    def test_generate_otp_unique(self):
        otps = {PasswordResetRepository.generate_otp() for _ in range(100)}
        assert len(otps) >= 90

class TestOTPHashing:

    def test_hash_otp_consistent(self):
        otp = "123456"
        hash1 = PasswordResetRepository.hash_otp(otp)
        hash2 = PasswordResetRepository.hash_otp(otp)
        assert hash1 == hash2

    def test_hash_otp_different_inputs(self):
        hash1 = PasswordResetRepository.hash_otp("123456")
        hash2 = PasswordResetRepository.hash_otp("654321")
        assert hash1 != hash2

    def test_hash_otp_returns_hex(self):
        result = PasswordResetRepository.hash_otp("123456")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_hash_otp_not_plaintext(self):
        otp = "123456"
        hashed = PasswordResetRepository.hash_otp(otp)
        assert hashed != otp
