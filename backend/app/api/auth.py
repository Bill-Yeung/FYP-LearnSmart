import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from app.core.database import get_postgres
from app.repositories.password_reset_repository import PasswordResetRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository
from app.services import AuthService
from app.services.messaging import email_service
from app.models.user import UserCreate, UserResponse, UserLogin, Token, RefreshTokenRequest, PasswordResetRequest, PasswordResetVerifyOTP

class OAuthUrlResponse(BaseModel):
    url: str

router = APIRouter(prefix = "/auth", tags = ["Authentication"])

@router.get("/check")
async def check_auth(request: Request, db = Depends(get_postgres)):

    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")

    if not access_token:
        return {"authenticated": False}

    payload = AuthService.decode_token(access_token)
    if payload is None or payload.get("type") != "access":
        return {"authenticated": False}

    # resolve current session id from the refresh-token cookie (best-effort)
    current_session_id = None
    if refresh_token:
        token_hash = AuthService.hash_token(refresh_token)
        session = await SessionRepository(db).get_by_token_hash(token_hash)
        if not session:
            return {"authenticated": False}
        current_session_id = str(session["id"])
    else:
        return {"authenticated": False}

    return {"authenticated": True, "current_session_id": current_session_id}

@router.post("/register", response_model = UserResponse,
             status_code = status.HTTP_201_CREATED)
async def register(data: UserCreate, db = Depends(get_postgres)):

    repo = UserRepository(db)

    if await repo.email_exists(data.email):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Email already registered")

    if await repo.username_exists(data.username):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Username already taken")

    password_hash = AuthService.hash_password(data.password)

    user = await repo.create(
        username = data.username,
        email = data.email,
        password_hash = password_hash,
        role = data.role.value,
        display_name = data.display_name)

    return dict(user)

@router.post("/login")
async def login(data: UserLogin, request: Request, response: Response, db = Depends(get_postgres)):

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(data.email)

    if user is None:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid email or password")

    if user["oauth_provider"] and not user["password_hash"]:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = f"This account uses {user['oauth_provider'].title()} login. \
                        Please sign in with {user['oauth_provider'].title()}.")

    if not AuthService.verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid email or password")

    if not user["is_active"]:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Account is deactivated")

    tokens = AuthService.create_tokens(user["id"], user["role"])
    session_repo = SessionRepository(db)
    session_id = AuthService.create_session_id()
    token_hash = AuthService.hash_token(tokens["refresh_token"])
    expires_at = AuthService.get_refresh_token_expiry()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await session_repo.create(
        session_id = session_id,
        user_id = user["id"],
        token_hash = token_hash,
        expires_at = expires_at,
        ip_address = ip_address,
        user_agent = user_agent)

    await session_repo.delete_oldest_sessions(user["id"], keep_count = 5)
    await user_repo.update_last_login(user["id"])

    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600,
        path="/"
    )

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer",
    }

@router.post("/refresh")
async def refresh_token(
    data: RefreshTokenRequest | None = None,
    request: Request = None,
    response: Response = None,
    db = Depends(get_postgres)):

    refresh_token_value = request.cookies.get("refresh_token") if request else None
    if not refresh_token_value and data:
        refresh_token_value = data.refresh_token

    if not refresh_token_value:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "No refresh token provided")

    user_id = AuthService.verify_refresh_token(refresh_token_value)

    if user_id is None:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid or expired refresh token")

    session_repo = SessionRepository(db)
    token_hash = AuthService.hash_token(refresh_token_value)
    session = await session_repo.get_by_token_hash(token_hash)

    if session is None:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Token has been revoked or expired")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "User not found")

    if not user["is_active"]:
        await session_repo.delete(session["id"])
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Account is deactivated")
    
    await session_repo.delete(session["id"])
    tokens = AuthService.create_tokens(user["id"], user["role"])
    new_session_id = AuthService.create_session_id()
    new_token_hash = AuthService.hash_token(tokens["refresh_token"])
    expires_at = AuthService.get_refresh_token_expiry()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await session_repo.create(
        session_id = new_session_id,
        user_id = user["id"],
        token_hash = new_token_hash,
        expires_at = expires_at,
        ip_address = ip_address,
        user_agent = user_agent)

    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600,
        path="/"
    )

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer",
    }

@router.post("/logout")
async def logout(
    data: RefreshTokenRequest | None = None,
    request: Request = None,
    response: Response = None,
    db = Depends(get_postgres)):

    refresh_token_value = request.cookies.get("refresh_token") if request else None
    if not refresh_token_value and data:
        refresh_token_value = data.refresh_token

    if not refresh_token_value:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "No refresh token provided")

    session_repo = SessionRepository(db)
    token_hash = AuthService.hash_token(refresh_token_value)
    deleted = await session_repo.delete_by_token_hash(token_hash)

    if not deleted:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid or already revoked token")

    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

    return {"message": "Successfully logged out"}

@router.post("/logout/all")
async def logout_all(
    data: RefreshTokenRequest | None = None,
    request: Request = None,
    response: Response = None,
    db = Depends(get_postgres)):

    refresh_token_value = request.cookies.get("refresh_token") if request else None
    if not refresh_token_value and data:
        refresh_token_value = data.refresh_token

    if not refresh_token_value:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "No refresh token provided")

    user_id = AuthService.verify_refresh_token(refresh_token_value)

    if user_id is None:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid or expired refresh token")

    session_repo = SessionRepository(db)
    token_hash = AuthService.hash_token(refresh_token_value)
    session = await session_repo.get_by_token_hash(token_hash)

    if session is None:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Token has been revoked")

    deleted_count = await session_repo.delete_user_sessions(user_id)

    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

    return {"message": f"Successfully logged out from {deleted_count} device(s)"}

@router.get("/google", response_model = OAuthUrlResponse)
async def google_auth_url(state: str | None = None):
    url = AuthService.get_google_auth_url(state)
    return {"url": url}

@router.get("/google/callback")
async def google_callback(code: str, request: Request, db = Depends(get_postgres)):

    oauth_data = await AuthService.exchange_google_code(code)

    if oauth_data is None:
        return RedirectResponse(url="/login?oauth=error&message=Failed+to+authenticate+with+Google")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_oauth(oauth_data["provider"], oauth_data["oauth_id"])

    if user is None:

        user = await user_repo.get_by_email(oauth_data["email"])

        if user is not None:
            await user_repo.link_oauth(
                user["id"],
                oauth_data["provider"],
                oauth_data["oauth_id"])
        else:
            user = await user_repo.create_oauth_user(
                email = oauth_data["email"],
                oauth_provider = oauth_data["provider"],
                oauth_id = oauth_data["oauth_id"],
                display_name = oauth_data["name"]
            )

    if not user["is_active"]:
        return RedirectResponse(url="/login?oauth=error&message=Account+is+deactivated")

    tokens = AuthService.create_tokens(user["id"], user["role"])
    session_repo = SessionRepository(db)
    session_id = AuthService.create_session_id()
    token_hash = AuthService.hash_token(tokens["refresh_token"])
    expires_at = AuthService.get_refresh_token_expiry()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await session_repo.create(
        session_id = session_id,
        user_id = user["id"],
        token_hash = token_hash,
        expires_at = expires_at,
        ip_address = ip_address,
        user_agent = user_agent)

    await session_repo.delete_oldest_sessions(user["id"], keep_count = 5)
    await user_repo.update_last_login(user["id"])

    redirect = RedirectResponse(url="/login?oauth=success", status_code=302)
    redirect.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600,
        path="/"
    )
    redirect.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    return redirect

@router.get("/github", response_model = OAuthUrlResponse)
async def github_auth_url(state: str | None = None):
    url = AuthService.get_github_auth_url(state)
    return {"url": url}

@router.get("/github/callback")
async def github_callback(code: str, request: Request, db = Depends(get_postgres)):

    oauth_data = await AuthService.exchange_github_code(code)

    if oauth_data is None:
        return RedirectResponse(url="/login?oauth=error&message=Failed+to+authenticate+with+GitHub")

    if oauth_data["email"] is None:
        return RedirectResponse(url="/login?oauth=error&message=GitHub+account+has+no+email")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_oauth(oauth_data["provider"], oauth_data["oauth_id"])

    if user is None:

        user = await user_repo.get_by_email(oauth_data["email"])

        if user is not None:
            await user_repo.link_oauth(
                user["id"],
                oauth_data["provider"],
                oauth_data["oauth_id"])
        else:
            user = await user_repo.create_oauth_user(
                email = oauth_data["email"],
                oauth_provider = oauth_data["provider"],
                oauth_id = oauth_data["oauth_id"],
                display_name = oauth_data["name"])

    if not user["is_active"]:
        return RedirectResponse(url="/login?oauth=error&message=Account+is+deactivated")

    tokens = AuthService.create_tokens(user["id"], user["role"])
    session_repo = SessionRepository(db)
    session_id = AuthService.create_session_id()
    token_hash = AuthService.hash_token(tokens["refresh_token"])
    expires_at = AuthService.get_refresh_token_expiry()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    await session_repo.create(
        session_id = session_id,
        user_id = user["id"],
        token_hash = token_hash,
        expires_at = expires_at,
        ip_address = ip_address,
        user_agent = user_agent)

    await session_repo.delete_oldest_sessions(user["id"], keep_count = 5)
    await user_repo.update_last_login(user["id"])

    redirect = RedirectResponse(url="/login?oauth=success", status_code=302)
    redirect.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600,
        path="/"
    )
    redirect.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    return redirect

@router.post("/password-reset/request")
async def request_password_reset(
    data: PasswordResetRequest,
    request: Request,
    db = Depends(get_postgres)):

    user_repo = UserRepository(db)
    reset_repo = PasswordResetRepository(db)

    user = await user_repo.get_by_email(data.email)

    if not user:
        return {"message": "If the email exists, an OTP has been sent"}

    if not user["is_active"]:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Account is deactivated")

    recent_count = await reset_repo.count_recent_requests(data.email, hours=1)
    if recent_count >= 3:
        raise HTTPException(
            status_code = status.HTTP_429_TOO_MANY_REQUESTS,
            detail = "Too many reset requests. Please try again later")

    otp = reset_repo.generate_otp()
    ip_address = request.client.host if request.client else None

    await reset_repo.create(
        user_id = user["id"],
        email = data.email,
        otp_code = otp,
        ip_address = ip_address)

    asyncio.create_task(
        email_service.send_otp_email(
            email = data.email,
            otp = otp,
            username = user["username"]
        )
    )

    return {"message": "If the email exists, an OTP has been sent"}

@router.post("/password-reset/verify")
async def verify_otp_and_reset_password(
    data: PasswordResetVerifyOTP,
    db = Depends(get_postgres)):

    user_repo = UserRepository(db)
    reset_repo = PasswordResetRepository(db)

    reset_record = await reset_repo.verify_otp(data.email, data.otp)

    if not reset_record:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid or expired OTP")

    user = await user_repo.get_by_email(data.email)
    if not user:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    new_password_hash = AuthService.hash_password(data.new_password)

    await user_repo.update_password(user["id"], new_password_hash)
    await reset_repo.mark_as_used(reset_record["id"])

    session_repo = SessionRepository(db)
    await session_repo.delete_user_sessions(user["id"])

    asyncio.create_task(
        email_service.send_password_changed_notification(
            email = data.email,
            username = user["username"]
        )
    )

    return {"message": "Password reset successfully. All sessions have been logged out"}
