from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import User
from schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

from security import verify_password, create_access_token
from datetime import timedelta

@router.post("/login", response_model=LoginResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    # 1. Fetch User
    user = db.query(User).filter_by(email=creds.username).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
        
    # 2. Verify Password (supports both plaintext (legacy) and bcrypt hash)
    is_valid = False
    try:
        if verify_password(creds.password, user.hashed_password):
            is_valid = True
    except Exception:
        # Fallback for legacy plain text passwords during migration
        if user.hashed_password == creds.password:
            is_valid = True

    if not is_valid:
        raise HTTPException(status_code=400, detail="Incorrect password")
        
    role_name = user.role_rel.name if user.role_rel else "No Role"
    perms = user.role_rel.permissions if user.role_rel else {}
    
    # 3. Create Token
    access_token_expires = timedelta(minutes=60*24) # 24 hours
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {
        "status": "ok", 
        "user_id": user.id, 
        "full_name": user.full_name, 
        "role": role_name,
        "permissions": perms,
        "scope_branches": user.scope_branches or [],
        "scope_departments": user.scope_departments or [],
        "access_token": access_token
    }

# New endpoint for password change
from schemas import ChangePasswordRequest
from security import get_password_hash
from dependencies import get_current_active_user

@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # 1. Verify old password
    is_valid = False
    try:
        if verify_password(data.old_password, current_user.hashed_password):
            is_valid = True
    except Exception:
        # Fallback for plain text
        if current_user.hashed_password == data.old_password:
            is_valid = True
            
    if not is_valid:
        raise HTTPException(status_code=400, detail="Неверный старый пароль")

    # 2. Update to new hash
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    
    return {"status": "success", "message": "Пароль успешно изменен"}

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
