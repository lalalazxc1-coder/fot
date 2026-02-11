from sqlalchemy.orm import Session
from fastapi import HTTPException
from database.models import User
from security import verify_password, create_access_token, get_password_hash
from datetime import timedelta

class AuthService:
    @staticmethod
    def login(db: Session, username: str, password: str):
        # 1. Fetch User
        user = db.query(User).filter_by(email=username).first()
        
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
            
        # 2. Verify Password (supports both plaintext (legacy) and bcrypt hash)
        is_valid = False
        try:
            if verify_password(password, user.hashed_password):
                is_valid = True
        except Exception:
            # Fallback for legacy plain text passwords during migration
            # DEPRECATED: This logic should ideally be removed once all users are migrated
            if user.hashed_password == password:
                is_valid = True
                # Auto-migrate on successful login?
                # We could do: 
                # user.hashed_password = get_password_hash(password)
                # db.commit()
                # But let's stick to the existing logic for now to avoid side effects during login unless requested.

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

    @staticmethod
    def change_password(db: Session, user: User, old_password: str, new_password: str):
        # 1. Verify old password
        is_valid = False
        try:
            if verify_password(old_password, user.hashed_password):
                is_valid = True
        except Exception:
            # Fallback for plain text
            if user.hashed_password == old_password:
                is_valid = True
                
        if not is_valid:
            raise HTTPException(status_code=400, detail="Неверный старый пароль")

        # 2. Update to new hash
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        
        return {"status": "success", "message": "Пароль успешно изменен"}
