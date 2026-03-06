import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from utils.env_loader import load_project_env

load_project_env()

# Configuration — loaded from environment variables
ENVIRONMENT = (os.environ.get("ENVIRONMENT") or "development").strip().lower()


def _resolve_secret_key() -> str:
    configured = (os.environ.get("SECRET_KEY") or os.environ.get("FOT_SECRET_KEY") or "").strip()
    if configured:
        return configured

    if ENVIRONMENT == "production":
        raise RuntimeError("SECRET_KEY is required in production")

    generated = secrets.token_hex(32)
    print("WARNING: SECRET_KEY not set in environment. Generated a random key.")
    print("This means all JWT tokens will be invalidated on server restart.")
    print("Set SECRET_KEY in .env or environment for production use.")
    return generated


SECRET_KEY = _resolve_secret_key()


def _resolve_refresh_secret_key() -> str:
    configured = (os.environ.get("REFRESH_SECRET_KEY") or "").strip()
    if configured:
        return configured

    if ENVIRONMENT == "production":
        raise RuntimeError("REFRESH_SECRET_KEY is required in production")

    # In dev: derive a different key from SECRET_KEY so token types can't be swapped
    return SECRET_KEY + "_refresh_dev_only"


REFRESH_SECRET_KEY = _resolve_refresh_secret_key()

_ALLOWED_ALGORITHMS = {"HS256", "HS384", "HS512"}
ALGORITHM = os.environ.get("ALGORITHM", "HS256")
if ALGORITHM not in _ALLOWED_ALGORITHMS:
    raise RuntimeError(
        f"Unsupported JWT ALGORITHM '{ALGORITHM}'. "
        f"Allowed values: {sorted(_ALLOWED_ALGORITHMS)}"
    )
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  # 15m default
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 7d default (matches docker-compose)

# Password Hashing (single source of truth)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.setdefault("sid", uuid.uuid4().hex)
    to_encode.setdefault("jti", uuid.uuid4().hex)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def generate_csrf_token() -> str:
    """Generate a random CSRF token for double-submit protection."""
    return secrets.token_urlsafe(32)
