from sqlalchemy.orm import Session
from fastapi import HTTPException
from database.models import User
from security import verify_password, create_access_token, get_password_hash
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def login(db: Session, username: str, password: str):
        # 1. Fetch User
        user = db.query(User).filter_by(email=username).first()

        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        # 2. Verify Password
        is_valid = False

        # Check if password is still stored as plaintext (legacy migration)
        if not user.hashed_password.startswith("$2"):
            # Legacy plaintext password — compare directly
            if user.hashed_password == password:
                is_valid = True
                # Auto-migrate to bcrypt hash on successful login
                user.hashed_password = get_password_hash(password)
                db.commit()
                logger.info(f"Auto-migrated password to bcrypt for user {user.id}")
        else:
            # Normal bcrypt verification
            if verify_password(password, user.hashed_password):
                is_valid = True

        if not is_valid:
            raise HTTPException(status_code=400, detail="Incorrect password")

        role_name = user.role_rel.name if user.role_rel else "No Role"
        perms = user.role_rel.permissions if user.role_rel else {}

        # 3. Create Token
        access_token = create_access_token(data={"sub": str(user.id)})

        return {
            "status": "ok",
            "user_id": user.id,
            "full_name": user.full_name,
            "role": role_name,
            "permissions": perms,
            "scope_branches": user.scope_branches or [],
            "scope_departments": user.scope_departments or [],
            "access_token": access_token,
        }

    @staticmethod
    def change_password(db: Session, user: User, old_password: str, new_password: str):
        # 1. Validate new password strength
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 6 символов")

        # 2. Verify old password
        is_valid = False
        if not user.hashed_password.startswith("$2"):
            # Legacy plaintext
            if user.hashed_password == old_password:
                is_valid = True
        else:
            if verify_password(old_password, user.hashed_password):
                is_valid = True

        if not is_valid:
            raise HTTPException(status_code=400, detail="Неверный старый пароль")

        # 3. Update to new bcrypt hash
        user.hashed_password = get_password_hash(new_password)
        db.commit()

        return {"status": "success", "message": "Пароль успешно изменен"}
