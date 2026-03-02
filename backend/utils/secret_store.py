import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


_PREFIX = "enc:"


def _fernet() -> Fernet:
    key_material = os.environ.get("SECRETS_ENCRYPTION_KEY") or os.environ.get("SECRET_KEY") or "dev-insecure-key"
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
