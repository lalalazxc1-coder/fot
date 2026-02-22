from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import User
from schemas import LoginRequest, LoginResponse
from services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

from security import verify_password, create_access_token
from datetime import timedelta

@router.post("/login", response_model=LoginResponse)
def login(creds: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Login endpoint. Returns JWT token and user info, and sets HttpOnly cookie.
    """
    try:
        auth_data = AuthService.login(db, creds.username, creds.password, getattr(creds, 'remember_me', False))
        
        # FIX #19: Security - HttpOnly cookie
        max_age = 30 * 24 * 60 * 60 if getattr(creds, 'remember_me', False) else None
        response.set_cookie(
            key="access_token",
            value=auth_data["access_token"],
            httponly=True,
            secure=False,  # Set to True in HTTPS prod
            samesite="lax",
            max_age=max_age 
        )
        return auth_data
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

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

@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_active_user)):
    """
    Logout endpoint. Clears HttpOnly cookie.
    """
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=False
    )
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
