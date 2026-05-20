import asyncpg
import secrets
import hashlib
from datetime import datetime, timedelta
from uuid import UUID

OTP_TTL_MINUTES = 10
MAX_ATTEMPTS = 5


class EmailChangeOtpRepository:

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    @staticmethod
    def generate_otp() -> str:
        return ''.join(str(secrets.randbelow(10)) for _ in range(6))

    @staticmethod
    def hash_otp(otp: str) -> str:
        return hashlib.sha256(otp.encode()).hexdigest()

    async def upsert(self, user_id: UUID, new_email: str, otp_plain: str) -> asyncpg.Record:

        otp_hash = self.hash_otp(otp_plain)
        expires_at = datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)
        return await self.db.fetchrow(
            """
            INSERT INTO email_change_otps (user_id, new_email, otp_hash, expires_at, attempts)
            VALUES ($1, $2, $3, $4, 0)
            ON CONFLICT (user_id) DO UPDATE
              SET new_email = EXCLUDED.new_email,
                  otp_hash = EXCLUDED.otp_hash,
                  expires_at = EXCLUDED.expires_at,
                  attempts = 0,
                  created_at = NOW()
            RETURNING *
            """,
            user_id, new_email, otp_hash, expires_at)

    async def get(self, user_id: UUID) -> asyncpg.Record | None:
        return await self.db.fetchrow(
            "SELECT * FROM email_change_otps WHERE user_id = $1",
            user_id)

    async def increment_attempts(self, user_id: UUID) -> int:
        row = await self.db.fetchrow(
            "UPDATE email_change_otps SET attempts = attempts + 1 WHERE user_id = $1 RETURNING attempts",
            user_id)
        return row["attempts"] if row else 0

    async def delete(self, user_id: UUID) -> bool:
        result = await self.db.execute(
            "DELETE FROM email_change_otps WHERE user_id = $1",
            user_id)
        return result == "DELETE 1"
