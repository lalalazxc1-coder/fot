from sqlalchemy.orm import Session
from fastapi import HTTPException
from database.models import User, LoginLog
from security import verify_password, create_access_token, create_refresh_token, get_password_hash, REFRESH_TOKEN_EXPIRE_DAYS
from jose import jwt
from database.redis_client import register_refresh_session
from datetime import timedelta
from utils.date_utils import now_iso
import logging
import hmac
import re
from typing import Any, Optional, cast

logger = logging.getLogger(__name__)


def _write_login_log(
    db: Session,
    action: str,
    user_id=None,
    user_email=None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Записать событие входа/выхода в login_logs. Не бросает исключений."""
    try:
        log = LoginLog(
            user_id=user_id,
            user_email=user_email,
            action=action,
            ip_address=ip_address or "unknown",
            user_agent=user_agent or "",
            timestamp=now_iso()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.warning("Failed to write login log: %s", e)
        db.rollback()


class AuthService:
    @staticmethod
    def login(db: Session, username: str, password: str, remember_me: bool = False,
              ip_address: Optional[str] = None, user_agent: Optional[str] = None):
        # 1. Fetch User
        user = db.query(User).filter_by(email=username).first()

        if not user:
            _write_login_log(db, "login_failed", user_email=username,
                             ip_address=ip_address, user_agent=user_agent)
            raise HTTPException(status_code=400, detail="Неверный логин или пароль")

        if not getattr(user, "is_active", True):
            _write_login_log(db, "login_blocked", user_id=user.id, user_email=username,
                             ip_address=ip_address, user_agent=user_agent)
            raise HTTPException(status_code=403, detail="Пользователь заблокирован")

        user_row = cast(Any, user)

        # 2. Verify Password
        is_valid = False

        if not str(user_row.hashed_password).startswith("$2"):
            if hmac.compare_digest(str(user_row.hashed_password).encode('utf-8'), password.encode('utf-8')):
                is_valid = True
                user_row.hashed_password = get_password_hash(password)
                db.commit()
                logger.info(f"Auto-migrated password to bcrypt for user {user.id}")
            else:
                logger.warning(f"Legacy plaintext login failed for user {user.id}")
        else:
            if verify_password(password, str(user_row.hashed_password)):
                is_valid = True

        if not is_valid:
            _write_login_log(db, "login_failed", user_id=user.id, user_email=username,
                             ip_address=ip_address, user_agent=user_agent)
            raise HTTPException(status_code=400, detail="Неверный логин или пароль")

        role_name = user.role_rel.name if user.role_rel else "No Role"
        perms = (user.role_rel.permissions or {}) if user.role_rel else {}

        # 3. Записываем успешный вход
        _write_login_log(db, "login_success", user_id=user.id, user_email=username,
                         ip_address=ip_address, user_agent=user_agent)

        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS) if remember_me else timedelta(hours=12)
        refresh_token = create_refresh_token(data={"sub": str(user.id)}, expires_delta=refresh_expires_delta)

        try:
            payload = jwt.get_unverified_claims(refresh_token)
            sid = str(payload.get("sid") or "")
            jti = str(payload.get("jti") or "")
            exp = payload.get("exp")
            if sid and jti and isinstance(exp, int):
                register_refresh_session(sid, jti, exp)
            else:
                logger.error("Generated refresh token missing sid/jti/exp for user %s", user.id)
        except Exception:
            logger.exception("Failed to register refresh session for user %s", user.id)
            raise HTTPException(status_code=500, detail="Login failed")

        return {
            "status": "ok",
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "contact_email": user.contact_email,
            "phone": user.phone,
            "role": role_name,
            "permissions": perms,
            "scope_branches": user.scope_branches or [],
            "scope_departments": user.scope_departments or [],
            "avatar_url": user.avatar_url,
            "job_title": user.job_title,
            "employee_id": user.employee_id,
            "access_token": access_token,
            "refresh_token": refresh_token,
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

        user_row = cast(Any, user)

        # 2. Verify old password
        is_valid = False
        # FIX #10: Use constant-time comparison for plaintext legacy passwords
        if not str(user_row.hashed_password).startswith("$2"):
            if hmac.compare_digest(str(user_row.hashed_password).encode('utf-8'), old_password.encode('utf-8')):
                is_valid = True
        else:
            if verify_password(old_password, str(user_row.hashed_password)):
                is_valid = True

        if not is_valid:
            raise HTTPException(status_code=400, detail="Неверный старый пароль")

        # 3. Update to new bcrypt hash
        user_row.hashed_password = get_password_hash(new_password)
        db.commit()

        return {"status": "success", "message": "Пароль успешно изменен"}
