import os
import secrets
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load .env file
load_dotenv()
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuration — loaded from environment variables
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("FOT_SECRET_KEY")
if not SECRET_KEY:
    # Auto-generate for development; in production .env MUST provide SECRET_KEY
    SECRET_KEY = secrets.token_hex(32)
    print("⚠️  WARNING: SECRET_KEY not set in environment. Generated a random key.")
    print("   This means all JWT tokens will be invalidated on server restart.")
    print("   Set SECRET_KEY in .env or environment for production use.")

ALGORITHM = os.environ.get("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h default

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
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
