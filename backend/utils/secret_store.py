import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


_PREFIX = "enc:"


def _resolve_key_material() -> str:
    explicit_key = (os.environ.get("SECRETS_ENCRYPTION_KEY") or "").strip()
    if explicit_key:
        return explicit_key

    env = (os.environ.get("ENVIRONMENT") or "development").strip().lower()
    if env == "production":
        raise RuntimeError("SECRETS_ENCRYPTION_KEY is required in production")

    secret_key = (os.environ.get("SECRET_KEY") or "").strip()
    if secret_key:
        return secret_key

    return "dev-insecure-key"


def _fernet() -> Fernet:
    key_material = _resolve_key_material()
    key_bytes = key_material.encode("utf-8")
    derived = hashlib.sha256(key_bytes).digest()
    fernet_key = base64.urlsafe_b64encode(derived)
    return Fernet(fernet_key)


def is_secret_encrypted(value: Optional[str]) -> bool:
    return bool(value and isinstance(value, str) and value.startswith(_PREFIX))


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if is_secret_encrypted(raw):
        return raw
    token = _fernet().encrypt(raw.encode("utf-8")).decode("utf-8")
    return f"{_PREFIX}{token}"


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if not is_secret_encrypted(raw):
        return raw
    token = raw[len(_PREFIX):]
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
