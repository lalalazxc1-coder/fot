from datetime import timedelta
import logging
import os
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import User
from database.redis_client import (
    blacklist_token,
    get_current_refresh_jti,
    is_refresh_session_revoked,
    is_refresh_token_used,
    is_token_blacklisted,
    mark_refresh_token_used,
    register_refresh_session,
    revoke_refresh_session,
)
from dependencies import get_current_active_user
from schemas import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    NotificationItemResponse,
    StatusResponse,
)
from security import (
    ALGORITHM,
    REFRESH_SECRET_KEY,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    generate_csrf_token,
)
from services.auth_service import AuthService, _write_login_log

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("fot.auth")

SECURE_COOKIES = os.environ.get("ENVIRONMENT", "development") == "production"
REFRESH_REMEMBER_DAYS = 30
REFRESH_SESSION_HOURS = 12


def _set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,
        secure=SECURE_COOKIES,
        samesite="lax",
    )


def _ensure_csrf_cookie(request: Request, response: Response) -> str:
    csrf_token = request.cookies.get("csrf_token") or generate_csrf_token()
    _set_csrf_cookie(response, csrf_token)
    return csrf_token


def _refresh_timedelta(remember_me: bool) -> timedelta:
    return timedelta(days=REFRESH_REMEMBER_DAYS) if remember_me else timedelta(hours=REFRESH_SESSION_HOURS)


def _cookie_max_age_seconds(remember_me: bool) -> int | None:
    return REFRESH_REMEMBER_DAYS * 24 * 60 * 60 if remember_me else None


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, remember_me: bool) -> None:
    max_age = _cookie_max_age_seconds(remember_me)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=SECURE_COOKIES,
        samesite="lax",
        max_age=max_age,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=SECURE_COOKIES,
        samesite="lax",
        max_age=max_age,
    )
    response.set_cookie(
        key="remember_me",
        value="1" if remember_me else "0",
        httponly=False,
        secure=SECURE_COOKIES,
        samesite="lax",
        max_age=max_age,
    )


def _token_exp(payload: dict[str, Any]) -> int:
    exp = payload.get("exp")
    if isinstance(exp, int):
        return exp
    raise HTTPException(status_code=401, detail="Invalid token payload")


def _token_jti(payload: dict[str, Any]) -> str:
    jti = str(payload.get("jti") or "").strip()
    if not jti:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return jti


def _token_sid(payload: dict[str, Any]) -> str:
    sid = str(payload.get("sid") or "").strip()
    if not sid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return sid


def _decode_refresh_token(token_value: str) -> tuple[int, str, str, int]:
    try:
        payload = cast(dict[str, Any], jwt.decode(token_value, REFRESH_SECRET_KEY, algorithms=[ALGORITHM]))
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id_str = cast(str | None, payload.get("sub"))
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id, _token_sid(payload), _token_jti(payload), _token_exp(payload)


def _get_request_ip(request: Request) -> str:
    from utils.network import get_client_ip
    return get_client_ip(request)


@router.post("/login", response_model=LoginResponse, response_model_exclude_none=True)
def login(creds: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = _get_request_ip(request)
    ua = request.headers.get("User-Agent", "")

    try:
        remember_me = bool(getattr(creds, "remember_me", False))
        auth_data = AuthService.login(
            db,
            creds.username,
            creds.password,
            remember_me,
            ip_address=ip,
            user_agent=ua,
        )
        _set_auth_cookies(response, auth_data["access_token"], auth_data["refresh_token"], remember_me)
        _set_csrf_cookie(response, generate_csrf_token())

        safe_auth_data = {k: v for k, v in auth_data.items() if k not in ("access_token", "refresh_token")}
        safe_auth_data.setdefault("contact_email", None)
        safe_auth_data.setdefault("phone", None)
        return safe_auth_data
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error during login")
        raise HTTPException(status_code=400, detail="Login failed")


@router.post("/refresh", response_model=StatusResponse)
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    if is_token_blacklisted(refresh_token_value):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    user_id, sid, old_jti, old_exp = _decode_refresh_token(refresh_token_value)

    if is_refresh_session_revoked(sid):
        raise HTTPException(status_code=401, detail="Refresh session has been revoked")

    if is_refresh_token_used(old_jti):
        revoke_refresh_session(sid, old_exp)
        blacklist_token(refresh_token_value, old_exp)
        raise HTTPException(status_code=401, detail="Refresh token reuse detected")

    current_jti = get_current_refresh_jti(sid)
    if current_jti is not None and current_jti != old_jti:
        revoke_refresh_session(sid, old_exp)
        blacklist_token(refresh_token_value, old_exp)
        raise HTTPException(status_code=401, detail="Refresh token reuse detected")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Пользователь заблокирован или не найден")

    remember_me = request.cookies.get("remember_me") == "1"
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_delta = _refresh_timedelta(remember_me)
    new_refresh_token = create_refresh_token(data={"sub": str(user.id), "sid": sid}, expires_delta=refresh_delta)
    _, _, new_jti, new_exp = _decode_refresh_token(new_refresh_token)

    mark_refresh_token_used(old_jti, old_exp)
    blacklist_token(refresh_token_value, old_exp)
    register_refresh_session(sid, new_jti, new_exp)

    _set_auth_cookies(response, access_token, new_refresh_token, remember_me)
    _ensure_csrf_cookie(request, response)
    return {"status": "ok"}


@router.post("/change-password", response_model=StatusResponse)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return AuthService.change_password(db, current_user, data.old_password, data.new_password)


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ip = _get_request_ip(request)
    ua = request.headers.get("User-Agent", "")

    access_token = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    refresh_token_cookie = request.cookies.get("refresh_token")

    if refresh_token_cookie:
        try:
            _, sid, _, exp = _decode_refresh_token(refresh_token_cookie)
            revoke_refresh_session(sid, exp)
        except HTTPException:
            logger.debug("Skipping refresh session revoke for invalid refresh token during logout")

    for token in [access_token, refresh_token_cookie]:
        if token:
            try:
                payload = cast(dict[str, Any], jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]))
                exp = payload.get("exp")
                if isinstance(exp, int):
                    blacklist_token(token, exp)
            except JWTError:
                logger.debug("Skipping blacklist for invalid token during logout")

    _write_login_log(
        db,
        "logout",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip,
        user_agent=ua,
    )

    response.delete_cookie(key="access_token", httponly=True, samesite="lax", secure=SECURE_COOKIES)
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax", secure=SECURE_COOKIES)
    response.delete_cookie(key="remember_me", httponly=False, samesite="lax", secure=SECURE_COOKIES)
    response.delete_cookie(key="csrf_token", httponly=False, samesite="lax", secure=SECURE_COOKIES)
    return {"status": "logged_out", "message": "Cookie cleared"}


@router.get("/me", response_model=CurrentUserResponse)
def get_me(request: Request, response: Response, current_user: User = Depends(get_current_active_user)):
    _ensure_csrf_cookie(request, response)
    role_name = current_user.role_rel.name if current_user.role_rel else "No Role"
    perms = (current_user.role_rel.permissions or {}) if current_user.role_rel else {}

    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "contact_email": current_user.contact_email,
        "phone": current_user.phone,
        "role": role_name,
        "permissions": perms,
        "scope_branches": current_user.scope_branches or [],
        "scope_departments": current_user.scope_departments or [],
        "avatar_url": current_user.avatar_url,
        "job_title": current_user.job_title,
        "employee_id": current_user.employee_id,
    }


@router.get("/csrf")
def get_csrf_token(request: Request, response: Response):
    token = _ensure_csrf_cookie(request, response)
    return {"csrf_token": token}


@router.get("/notifications", response_model=list[NotificationItemResponse])
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification

    unread = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .order_by(Notification.id.desc())
        .all()
    )
    read = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == True)
        .order_by(Notification.id.desc())
        .limit(5)
        .all()
    )
    return unread + read


@router.patch("/notifications/{id}/read", response_model=StatusResponse)
def mark_read(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification

    note_row = cast(Any, db.get(Notification, id))
    if note_row is None:
        raise HTTPException(404, "Notification not found")
    if note_row.user_id != current_user.id:
        raise HTTPException(404, "Notification not found")
    setattr(note_row, "is_read", True)
    db.commit()
    return {"status": "ok"}


@router.post("/notifications/read-all", response_model=StatusResponse)
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification

    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update(
        {Notification.is_read: True}
    )
    db.commit()
    return {"status": "ok"}


@router.delete("/notifications", response_model=StatusResponse)
def delete_all_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification

    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"status": "ok"}
