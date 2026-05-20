from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from app.core.database import get_postgres
from app.core.dependencies import get_current_user, require_admin, require_teacher
from app.repositories.email_change_otp_repository import EmailChangeOtpRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.user_preferences_repository import UserPreferencesRepository
from app.repositories.user_repository import UserRepository
from app.models.user import (
    UserResponse, UserUpdate, UserProfileResponse, PasswordChange, UserSessionResponse,
    UserPreferencesResponse, UserPreferencesUpdate, EmailChangeRequest, EmailChangeVerify,
)
from app.services import AuthService
from app.services.messaging import email_service
from uuid import UUID

router = APIRouter(prefix = "/users", tags = ["Users"])

async def _audit(db, actor, action_type: str, resource_type: str, resource_id: str):
    await db.execute(
        """
        INSERT INTO admin_audit_log
          (actor_id, actor_email, action_type, module, resource_type, resource_id)
        VALUES ($1, $2, $3, $4, $5, $6::uuid)
        """,
        actor["id"], actor.get("email"), action_type, "user_management", resource_type, resource_id,
    )

@router.get("/me", response_model = UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    return dict(current_user)

@router.patch("/me", response_model = UserResponse)
async def update_me(
    data: UserUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserRepository(db)
    update_fields = data.model_dump(exclude_unset = True)

    if not update_fields:
        return dict(current_user)

    user = await repo.update(current_user["id"], **update_fields)
    return dict(user)

@router.post("/me/change-password")
async def change_password(
    data: PasswordChange,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    if not current_user["password_hash"]:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Cannot change password for OAuth-only accounts")

    if not AuthService.verify_password(data.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Current password is incorrect")

    repo = UserRepository(db)
    new_hash = AuthService.hash_password(data.new_password)
    await repo.update_password(current_user["id"], new_hash)

    return {"message": "Password changed successfully"}

@router.get("/me/profile", response_model = UserProfileResponse)
async def get_my_profile(
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserRepository(db)
    profile = await repo.get_profile(current_user["id"])

    if profile is None:
        profile = await repo.create_profile(current_user["id"])

    return dict(profile)

@router.patch("/me/profile", response_model = UserProfileResponse)
async def update_my_profile(
    bio: str | None = None,
    avatar_url: str | None = None,
    organization: str | None = None,
    department: str | None = None,
    level: str | None = None,
    timezone: str | None = None,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserRepository(db)

    update_fields = {}
    if bio is not None:
        update_fields["bio"] = bio
    if avatar_url is not None:
        update_fields["avatar_url"] = avatar_url
    if organization is not None:
        update_fields["organization"] = organization
    if department is not None:
        update_fields["department"] = department
    if level is not None:
        update_fields["level"] = level
    if timezone is not None:
        update_fields["timezone"] = timezone

    profile = await repo.get_profile(current_user["id"])

    if profile is None:
        profile = await repo.create_profile(current_user["id"], **update_fields)
    else:
        profile = await repo.update_profile(current_user["id"], **update_fields)

    return dict(profile)

@router.get("/me/sessions", response_model = list[UserSessionResponse])
async def get_my_sessions(
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = SessionRepository(db)
    sessions = await repo.get_user_sessions(current_user["id"])
    return [dict(s) for s in sessions]

@router.delete("/me/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid session ID format")

    repo = SessionRepository(db)

    session = await repo.get_by_id(sid)
    if session is None:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Session not found or already expired")

    if session["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Cannot delete another user's session")

    success = await repo.delete(sid)

    if not success:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Session not found")

    return {"message": "Session deleted successfully"}

@router.delete("/me/sessions")
async def delete_all_other_sessions(
    request: Request,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    # locate the caller's own session via refresh-token cookie so we don't kill it
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "No active session cookie")

    repo = SessionRepository(db)
    token_hash = AuthService.hash_token(refresh_token)
    current = await repo.get_by_token_hash(token_hash)
    if current is None:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Current session not found")

    removed = await repo.delete_all_except(current_user["id"], current["id"])
    return {"removed": removed}

@router.get("/me/preferences", response_model = UserPreferencesResponse)
async def get_my_preferences(
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserPreferencesRepository(db)
    prefs = await repo.get(current_user["id"])
    if prefs is None:
        prefs = await repo.upsert_defaults(current_user["id"])
    return dict(prefs)

@router.patch("/me/preferences", response_model = UserPreferencesResponse)
async def update_my_preferences(
    data: UserPreferencesUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserPreferencesRepository(db)
    await repo.upsert_defaults(current_user["id"])
    update_fields = data.model_dump(exclude_unset=True)
    prefs = await repo.patch(current_user["id"], **update_fields)
    return dict(prefs)

@router.delete("/me")
async def delete_my_account(
    response: Response,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    # soft-delete: deactivate user, then revoke ALL their sessions
    user_repo = UserRepository(db)
    session_repo = SessionRepository(db)

    success = await user_repo.deactivate(current_user["id"])
    if not success:
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = "Failed to deactivate account")

    await session_repo.delete_user_sessions(current_user["id"])

    # match logout cookie-clearing behavior
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")

    return {"message": "Account deactivated"}

@router.post("/me/email-change/request")
async def request_email_change(
    data: EmailChangeRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    new_email = data.new_email.lower().strip()

    if new_email == (current_user.get("email") or "").lower():
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "New email matches current email")

    # fail fast before sending OTP if it's already taken
    user_repo = UserRepository(db)
    if await user_repo.email_exists(new_email):
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Email already in use")

    otp_repo = EmailChangeOtpRepository(db)
    otp_plain = otp_repo.generate_otp()
    await otp_repo.upsert(current_user["id"], new_email, otp_plain)

    sent = await email_service.send_email_change_otp(new_email, otp_plain)
    if not sent:
        raise HTTPException(
            status_code = status.HTTP_502_BAD_GATEWAY,
            detail = "Failed to send verification email")

    return {"message": "Verification code sent to new email"}

@router.post("/me/email-change/verify", response_model = UserResponse)
async def verify_email_change(
    data: EmailChangeVerify,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    otp_repo = EmailChangeOtpRepository(db)
    user_repo = UserRepository(db)

    pending = await otp_repo.get(current_user["id"])
    if pending is None:
        raise HTTPException(status_code = 400, detail = "No pending email change")

    if pending["expires_at"] < datetime.utcnow():
        await otp_repo.delete(current_user["id"])
        raise HTTPException(status_code = 400, detail = "Verification code expired")

    if pending["attempts"] >= 5:
        await otp_repo.delete(current_user["id"])
        raise HTTPException(status_code = 429, detail = "Too many attempts")

    if otp_repo.hash_otp(data.otp) != pending["otp_hash"]:
        await otp_repo.increment_attempts(current_user["id"])
        raise HTTPException(status_code = 400, detail = "Invalid verification code")

    new_email = pending["new_email"]
    # race-condition guard: another user may have grabbed it between request and verify
    if await user_repo.email_exists(new_email):
        await otp_repo.delete(current_user["id"])
        raise HTTPException(status_code = 409, detail = "Email already in use")

    updated = await user_repo.update(current_user["id"], email=new_email)
    await otp_repo.delete(current_user["id"])

    return dict(updated)

@router.get("/search")
async def search_users(
    q: str = "",
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    if not q or len(q) < 2:
        return {"users": []}
    rows = await db.fetch(
        """
        SELECT id, username, email, display_name
        FROM users
        WHERE (LOWER(username) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1))
          AND id != $2 AND is_active = TRUE
        ORDER BY username ASC
        LIMIT 10
        """,
        f"%{q}%", current_user["id"],
    )
    return {"users": [dict(r) for r in rows]}

@router.get("", response_model = list[UserResponse])
async def list_users(
    limit: int = 100,
    offset: int = 0,
    role: str | None = None,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    repo = UserRepository(db)

    if role:
        users = await repo.get_by_role(role, limit)
    else:
        users = await repo.get_all(limit, offset)

    return [dict(u) for u in users]

@router.get("/{user_id}", response_model = UserResponse)
async def get_user(
    user_id: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    repo = UserRepository(db)
    user = await repo.get_by_id(uid)

    if user is None:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    return dict(user)

@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    if uid == current_user["id"]:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Cannot deactivate your own account")

    repo = UserRepository(db)
    success = await repo.deactivate(uid)

    if not success:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    await _audit(db, current_user, "deactivate_user", "user", user_id)
    return {"message": "User deactivated successfully"}

@router.post("/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    repo = UserRepository(db)
    success = await repo.activate(uid)

    if not success:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    await _audit(db, current_user, "activate_user", "user", user_id)
    return {"message": "User activated successfully"}

@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    if uid == current_user["id"]:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Cannot change your own role")

    valid_roles = ["student", "teacher", "admin"]
    if role not in valid_roles:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    repo = UserRepository(db)
    user = await repo.update(uid, role=role)

    if not user:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    return {"message": "User role updated successfully"}
