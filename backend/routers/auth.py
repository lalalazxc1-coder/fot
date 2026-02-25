from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import User
from schemas import LoginRequest, LoginResponse
from services.auth_service import AuthService
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

from security import verify_password, create_access_token, SECRET_KEY, ALGORITHM
from datetime import timedelta

# NEW-2 FIX: secure=True автоматически включается в production
# На дев-сервере (HTTP) остаётся False, чтобы не мешать локальной разработке
SECURE_COOKIES = os.environ.get("ENVIRONMENT", "development") == "production"

@router.post("/login", response_model=LoginResponse)
def login(creds: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Login endpoint. Returns JWT token and user info, and sets HttpOnly cookie.
    """
    # Извлекаем IP и User-Agent для логирования
    ip = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    ua = request.headers.get("User-Agent", "")

    try:
        auth_data = AuthService.login(
            db, creds.username, creds.password,
            getattr(creds, 'remember_me', False),
            ip_address=ip, user_agent=ua
        )
        max_age = 30 * 24 * 60 * 60 if getattr(creds, 'remember_me', False) else None
        response.set_cookie(
            key="access_token", value=auth_data["access_token"],
            httponly=True, secure=SECURE_COOKIES, samesite="lax", max_age=max_age
        )
        response.set_cookie(
            key="refresh_token", value=auth_data["refresh_token"],
            httponly=True, secure=SECURE_COOKIES, samesite="lax", max_age=max_age
        )
        safe_auth_data = {k: v for k, v in auth_data.items() if k not in ('access_token', 'refresh_token')}
        return safe_auth_data
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

from fastapi import Request
from jose import jwt, JWTError

@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    """Refresh access token using long-lived refresh_token in HttpOnly cookie"""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
        
    if is_token_blacklisted(refresh_token):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")
    
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
            
        user_id_str: str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        user_id = int(user_id_str)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Пользователь заблокирован или не найден")
        
    new_access_token = create_access_token(data={"sub": str(user.id)})
    
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=SECURE_COOKIES,  # NEW-2
        samesite="lax",
    )
    
    return {"status": "ok"}

# New endpoint for password change
from schemas import ChangePasswordRequest
from dependencies import get_current_active_user
from security import get_password_hash

@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Change password for the current user.
    """
    # Delegate logic to Service
    return AuthService.change_password(db, current_user, data.old_password, data.new_password)

from database.redis_client import blacklist_token, is_token_blacklisted

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db),
           current_user: User = Depends(get_current_active_user)):
    """
    Logout endpoint. Clears HttpOnly cookie and adds tokens to Redis blacklist.
    """
    from services.auth_service import _write_login_log
    ip = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    ua = request.headers.get("User-Agent", "")

    access_token = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    refresh_token_cookie = request.cookies.get("refresh_token")

    for token in [access_token, refresh_token_cookie]:
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                exp = payload.get("exp")
                if exp:
                    blacklist_token(token, exp)
            except JWTError:
                pass

    # Записываем logout в лог сессий
    _write_login_log(db, "logout", user_id=current_user.id,
                     user_email=current_user.email, ip_address=ip, user_agent=ua)

    response.delete_cookie(key="access_token", httponly=True, samesite="lax", secure=SECURE_COOKIES)
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax", secure=SECURE_COOKIES)
    return {"status": "logged_out", "message": "Cookie cleared"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_active_user)):
    role_name = current_user.role_rel.name if current_user.role_rel else "No Role"
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": role_name,
        "permissions": perms,
        "scope_branches": current_user.scope_branches or [],
        "scope_departments": current_user.scope_departments or []
    }

@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification
    # Get all unread + last 5 read
    unread = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).order_by(Notification.id.desc()).all()
    read = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == True).order_by(Notification.id.desc()).limit(5).all()
    return unread + read

@router.patch("/notifications/{id}/read")
def mark_read(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification
    note = db.get(Notification, id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(404, "Notification not found")
    note.is_read = True
    db.commit()
    return {"status": "ok"}

@router.post("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({Notification.is_read: True})
    db.commit()
    return {"status": "ok"}

@router.delete("/notifications")
def delete_all_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import Notification
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"status": "ok"}
