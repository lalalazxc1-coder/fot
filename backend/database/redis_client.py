import os
import redis
import logging
from datetime import datetime, timezone

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

logger = logging.getLogger("fot.redis")

# Setup Redis client for Token Blacklist
# FIX #C1: Fail-CLOSED — если Redis недоступен, токены не проходят проверку
# (пользователь будет вынужден перезайти, но отозванные токены не будут приняты)
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
    redis_client.ping()
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

    if not redis_client:
        # FIX #C1: При недоступности Redis — fail-closed
        # Короткий TTL токена (30 мин) делает это приемлемым UX
        logger.warning("Redis unavailable — denying token validation (fail-closed)")
        return True

    try:
        return redis_client.exists(f"blacklist:{token}") > 0
    except Exception as e:
        logger.error("Failed to check token blacklist: %s — denying access (fail-closed)", e)
        return True  # FIX #C1: Ошибка проверки = блокируем
