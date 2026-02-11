from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import User
from schemas import LoginRequest, LoginResponse
from services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

from security import verify_password, create_access_token
from datetime import timedelta

@router.post("/login", response_model=LoginResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    """
    Login endpoint. Returns JWT token and user info.
    """
    # 1. Delegate Logic to Service
    try:
        response = AuthService.login(db, creds.username, creds.password)
        return response
    except Exception as e:
        # Re-raise HTTPException as is, or wrap generic
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
