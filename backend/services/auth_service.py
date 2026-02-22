from sqlalchemy.orm import Session
from fastapi import HTTPException
from database.models import User
from security import verify_password, create_access_token, get_password_hash
from datetime import timedelta
import logging
import hmac
import re

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def login(db: Session, username: str, password: str, remember_me: bool = False):
        # 1. Fetch User
        user = db.query(User).filter_by(email=username).first()

        # FIX #25: Unified error message prevents user enumeration
        if not user:
            raise HTTPException(status_code=400, detail="Неверный логин или пароль")

        if not getattr(user, "is_active", True):
            raise HTTPException(status_code=403, detail="Пользователь заблокирован")

        # 2. Verify Password
        is_valid = False

        # FIX #10: Legacy plaintext password migration with constant-time comparison
        if not user.hashed_password.startswith("$2"):
            # Legacy plaintext password — use hmac.compare_digest for constant-time comparison
            if hmac.compare_digest(user.hashed_password.encode('utf-8'), password.encode('utf-8')):
                is_valid = True
                # Auto-migrate to bcrypt hash on successful login
                user.hashed_password = get_password_hash(password)
                db.commit()
                logger.info(f"Auto-migrated password to bcrypt for user {user.id}")
            else:
                logger.warning(f"Legacy plaintext login failed for user {user.id} — consider force-migrating")
        else:
            # Normal bcrypt verification
            if verify_password(password, user.hashed_password):
                is_valid = True

        # FIX #25: Same error message whether user exists or password is wrong
        if not is_valid:
            raise HTTPException(status_code=400, detail="Неверный логин или пароль")

        role_name = user.role_rel.name if user.role_rel else "No Role"
        perms = user.role_rel.permissions if user.role_rel else {}

        # 3. Create Token
        # Extend token life if "remember me" is checked (e.g. 30 days)
        expires_delta = timedelta(days=30) if remember_me else None
        access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=expires_delta)

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
    def _validate_password_strength(password: str):
        """
        FIX #11: Enforce strong password requirements.
        - Minimum 8 characters
        - At least 1 letter
        - At least 1 digit
        """
        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 8 символов")
        if len(password) > 128:
            raise HTTPException(status_code=400, detail="Пароль слишком длинный (макс. 128 символов)")
        if not re.search(r'[a-zA-Zа-яА-Я]', password):
            raise HTTPException(status_code=400, detail="Пароль должен содержать хотя бы одну букву")
        if not re.search(r'\d', password):
            raise HTTPException(status_code=400, detail="Пароль должен содержать хотя бы одну цифру")

    @staticmethod
    def change_password(db: Session, user: User, old_password: str, new_password: str):
        # 1. Validate new password strength (FIX #11)
        AuthService._validate_password_strength(new_password)

        # 2. Verify old password
        is_valid = False
        # FIX #10: Use constant-time comparison for plaintext legacy passwords
        if not user.hashed_password.startswith("$2"):
            if hmac.compare_digest(user.hashed_password.encode('utf-8'), old_password.encode('utf-8')):
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
