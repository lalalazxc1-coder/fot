import os
import redis
import logging
from datetime import datetime, timezone
from typing import Optional
from utils.env_loader import load_project_env

load_project_env()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")


def _get_positive_float_env(name: str, default: float) -> float:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        parsed = float(value)
        if parsed > 0:
            return parsed
    except (TypeError, ValueError):
        pass
    return default


REDIS_CONNECT_TIMEOUT = _get_positive_float_env("REDIS_CONNECT_TIMEOUT", 2.0)
REDIS_SOCKET_TIMEOUT = _get_positive_float_env("REDIS_SOCKET_TIMEOUT", 2.0)

logger = logging.getLogger("fot.redis")

_REFRESH_CURRENT_PREFIX = "refresh:current:"
_REFRESH_USED_PREFIX = "refresh:used:"
_REFRESH_REVOKED_PREFIX = "refresh:revoked:"

_testing_refresh_current: dict[str, tuple[str, int]] = {}
_testing_refresh_used: dict[str, int] = {}
_testing_refresh_revoked: dict[str, int] = {}

# Setup Redis client for Token Blacklist
# FIX #C1: Fail-CLOSED — если Redis недоступен, токены не проходят проверку
# (пользователь будет вынужден перезайти, но отозванные токены не будут приняты)
redis_client: Optional[redis.Redis] = None
if ENVIRONMENT == "testing":
    logger.info("Skipping Redis connection in testing environment")
else:
    try:
        client = redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
            socket_timeout=REDIS_SOCKET_TIMEOUT,
        )
        if client is not None:
            client.ping()
        redis_client = client
        logger.info("Redis connected successfully: %s", REDIS_URL)
    except Exception as e:
        logger.error(
            "Redis connection FAILED: %s. "
            "SECURITY: Token blacklist is ENFORCED (fail-closed) — all requests will require re-login.",
            e
        )
        redis_client = None


def blacklist_token(token: str, exp_timestamp: int):
    """
    Store the token in Redis blacklist until it expires.
    """
    if not token:
        return

    if not redis_client:
        logger.warning("Redis unavailable — cannot blacklist token (token will expire naturally)")
        return

    now = int(datetime.now(timezone.utc).timestamp())
    ttl = exp_timestamp - now
    if ttl > 0:
        try:
            redis_client.setex(f"blacklist:{token}", ttl, "revoked")
        except Exception as e:
            logger.error("Failed to blacklist token: %s", e)


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _ttl_from_exp(exp_timestamp: int) -> int:
    return exp_timestamp - _now_ts()


def _cleanup_testing_refresh_store() -> None:
    now = _now_ts()

    expired_current = [sid for sid, (_, exp) in _testing_refresh_current.items() if exp <= now]
    for sid in expired_current:
        _testing_refresh_current.pop(sid, None)

    expired_used = [jti for jti, exp in _testing_refresh_used.items() if exp <= now]
    for jti in expired_used:
        _testing_refresh_used.pop(jti, None)

    expired_revoked = [sid for sid, exp in _testing_refresh_revoked.items() if exp <= now]
    for sid in expired_revoked:
        _testing_refresh_revoked.pop(sid, None)


def register_refresh_session(session_id: str, refresh_jti: str, session_exp: int) -> None:
    if not session_id or not refresh_jti:
        return

    ttl = _ttl_from_exp(session_exp)
    if ttl <= 0:
        return

    if ENVIRONMENT == "testing":
        _cleanup_testing_refresh_store()
        _testing_refresh_current[session_id] = (refresh_jti, session_exp)
        return

    if not redis_client:
        logger.warning("Redis unavailable - cannot register refresh session")
        return

    try:
        redis_client.setex(f"{_REFRESH_CURRENT_PREFIX}{session_id}", ttl, refresh_jti)
    except Exception as e:
        logger.error("Failed to register refresh session: %s", e)


def get_current_refresh_jti(session_id: str) -> Optional[str]:
    if not session_id:
        return None

    if ENVIRONMENT == "testing":
        _cleanup_testing_refresh_store()
        entry = _testing_refresh_current.get(session_id)
        return entry[0] if entry else None

    if not redis_client:
        logger.warning("Redis unavailable - cannot read refresh session (fail-closed)")
        return None

    try:
        value = redis_client.get(f"{_REFRESH_CURRENT_PREFIX}{session_id}")
        return value if isinstance(value, str) else None
    except Exception as e:
        logger.error("Failed to read refresh session: %s", e)
        return None


def mark_refresh_token_used(refresh_jti: str, token_exp: int) -> None:
    if not refresh_jti:
        return

    ttl = _ttl_from_exp(token_exp)
    if ttl <= 0:
        return

    if ENVIRONMENT == "testing":
        _cleanup_testing_refresh_store()
        _testing_refresh_used[refresh_jti] = token_exp
        return

    if not redis_client:
        logger.warning("Redis unavailable - cannot mark refresh token used")
        return

    try:
        redis_client.setex(f"{_REFRESH_USED_PREFIX}{refresh_jti}", ttl, "1")
    except Exception as e:
        logger.error("Failed to mark refresh token used: %s", e)


def is_refresh_token_used(refresh_jti: str) -> bool:
    if not refresh_jti:
        return True

    if ENVIRONMENT == "testing":
        _cleanup_testing_refresh_store()
        return refresh_jti in _testing_refresh_used

    if not redis_client:
        logger.warning("Redis unavailable - denying refresh token check (fail-closed)")
        return True

    try:
        return redis_client.get(f"{_REFRESH_USED_PREFIX}{refresh_jti}") is not None
    except Exception as e:
        logger.error("Failed to check refresh token usage: %s - denying access", e)
        return True


def revoke_refresh_session(session_id: str, session_exp: int) -> None:
    if not session_id:
        return

    ttl = _ttl_from_exp(session_exp)
    if ttl <= 0:
        return

    if ENVIRONMENT == "testing":
        _cleanup_testing_refresh_store()
        _testing_refresh_revoked[session_id] = session_exp
        _testing_refresh_current.pop(session_id, None)
        return

    if not redis_client:
        logger.warning("Redis unavailable - cannot revoke refresh session")
        return

    try:
        redis_client.setex(f"{_REFRESH_REVOKED_PREFIX}{session_id}", ttl, "1")
        redis_client.delete(f"{_REFRESH_CURRENT_PREFIX}{session_id}")
    except Exception as e:
        logger.error("Failed to revoke refresh session: %s", e)


def is_refresh_session_revoked(session_id: str) -> bool:
    if not session_id:
        return False

    if ENVIRONMENT == "testing":
        _cleanup_testing_refresh_store()
        return session_id in _testing_refresh_revoked

    if not redis_client:
        logger.warning("Redis unavailable - denying refresh session check (fail-closed)")
        return True

    try:
        return redis_client.get(f"{_REFRESH_REVOKED_PREFIX}{session_id}") is not None
    except Exception as e:
        logger.error("Failed to check refresh session revocation: %s - denying access", e)
        return True


def is_token_blacklisted(token: str) -> bool:
    """
    Check if token exists in the Redis blacklist.

    FIX #C1: Fail-CLOSED strategy:
    - Redis недоступен → возвращаем True (блокируем токен)
    - Это вынуждает пользователя перезайти при падении Redis,
      но исключает использование отозванных токенов.
    """
    if not token:
        return False

    # Testing should not fail auth when Redis is intentionally absent.
    if ENVIRONMENT == "testing":
        return False

    if isinstance(token, str) and token.lower() == "none":
        return False

    if not redis_client:
        # FIX #C1: При недоступности Redis — fail-closed
        # Короткий TTL токена (30 мин) делает это приемлемым UX
        logger.warning("Redis unavailable — denying token validation (fail-closed)")
        return True

    try:
        return redis_client.get(f"blacklist:{token}") is not None
    except Exception as e:
        logger.error("Failed to check token blacklist: %s — denying access (fail-closed)", e)
        return True  # FIX #C1: Ошибка проверки = блокируем
