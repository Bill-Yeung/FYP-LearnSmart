from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import hashlib
import httpx
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes = ["bcrypt"], deprecated = "auto")

class AuthService:

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def create_access_token(user_id: UUID, role: str) -> str:

        expire = datetime.now(timezone.utc) + timedelta(
            minutes = settings.access_token_expire_minutes)
        
        payload = {
            "sub": str(user_id),
            "role": role,
            "exp": expire,
            "type": "access"
        }

        return jwt.encode(payload, settings.secret_key, algorithm = settings.algorithm)

    @staticmethod
    def create_refresh_token(user_id: UUID) -> str:

        expire = datetime.now(timezone.utc) + timedelta(
            days = settings.refresh_token_expire_days)

        payload = {
            "sub": str(user_id),
            "exp": expire,
            "type": "refresh",
            "jti": str(uuid4())
        }

        return jwt.encode(payload, settings.secret_key, algorithm = settings.algorithm)

    @staticmethod
    def create_tokens(user_id: UUID, role: str) -> dict:

        return {
            "access_token": AuthService.create_access_token(user_id, role),
            "refresh_token": AuthService.create_refresh_token(user_id),
            "token_type": "bearer"}

    @staticmethod
    def decode_token(token: str) -> dict | None:

        try:

            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms = [settings.algorithm])
            
            return payload
        
        except:
            return None

    @staticmethod
    def verify_refresh_token(token: str) -> UUID | None:

        payload = AuthService.decode_token(token)

        if payload is None:
            return None

        if payload.get("type") != "refresh":
            return None

        user_id_str = payload.get("sub")

        if user_id_str is None:
            return None

        try:

            return UUID(user_id_str)
        
        except ValueError:
            return None

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def create_session_id() -> UUID:
        return uuid4()

    @staticmethod
    def get_refresh_token_expiry() -> datetime:
        return datetime.utcnow() + timedelta(
            days = settings.refresh_token_expire_days)

    @staticmethod
    def get_google_auth_url(state: str | None = None) -> str:

        params = {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent"}
        
        if state:
            params["state"] = state

        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    @staticmethod
    async def exchange_google_code(code: str) -> dict | None:

        async with httpx.AsyncClient() as client:

            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data = {
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.google_redirect_uri})

            if token_response.status_code != 200:
                return None

            tokens = token_response.json()
            access_token = tokens.get("access_token")

            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers = {"Authorization": f"Bearer {access_token}"})

            if user_response.status_code != 200:
                return None

            user_info = user_response.json()

            return {
                "provider": "google",
                "oauth_id": user_info.get("id"),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
                "email_verified": user_info.get("verified_email", False)}

    @staticmethod
    def get_github_auth_url(state: str | None = None) -> str:

        params = {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "user:email read:user"}
        
        if state:
            params["state"] = state

        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://github.com/login/oauth/authorize?{query}"

    @staticmethod
    async def exchange_github_code(code: str) -> dict | None:

        async with httpx.AsyncClient() as client:

            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data = {
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                    "redirect_uri": settings.github_redirect_uri},
                headers = {"Accept": "application/json"})

            if token_response.status_code != 200:
                return None

            tokens = token_response.json()
            access_token = tokens.get("access_token")

            if not access_token:
                return None

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json"}

            user_response = await client.get(
                "https://api.github.com/user",
                headers = headers)

            if user_response.status_code != 200:
                return None

            user_info = user_response.json()
            email = user_info.get("email")

            if not email:
                
                email_response = await client.get(
                    "https://api.github.com/user/emails",
                    headers = headers)

                if email_response.status_code == 200:
                    emails = email_response.json()
                    for e in emails:
                        if e.get("primary"):
                            email = e.get("email")
                            break

            return {
                "provider": "github",
                "oauth_id": str(user_info.get("id")),
                "email": email,
                "name": user_info.get("name") or user_info.get("login"),
                "picture": user_info.get("avatar_url"),
                "email_verified": True}
