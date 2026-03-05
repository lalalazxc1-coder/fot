import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

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

ALGORITHM = os.environ.get("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  # 15m default
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

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
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def generate_csrf_token() -> str:
    """Generate a random CSRF token for double-submit protection."""
    return secrets.token_urlsafe(32)
