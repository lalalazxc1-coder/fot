"""
FIX NEW-3, NEW-4: Redis-based rate limiter.
Работает корректно в multi-worker/Docker окружении — все воркеры
используют одно хранилище счётчиков.
Fallback: in-memory при недоступном Redis (одиночный сервер).
"""
import time
import threading
import logging
from collections import defaultdict
from database.redis_client import redis_client

logger = logging.getLogger("fot.ratelimit")

# In-memory fallback (только когда Redis недоступен)
_fallback_store: dict[str, list[float]] = defaultdict(list)
_fallback_lock = threading.Lock()


def check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> bool:
    """
    Проверяет rate limit для ключа (IP, token и т.д.).
    Возвращает True если лимит превышен (нужно блокировать).
    
    Алгоритм: sliding window counter в Redis.
    """
    redis_key = f"ratelimit:{key}"

    if redis_client:
        try:
            pipe = redis_client.pipeline()
            now = time.time()
            window_start = now - window_seconds

            # Sliding window: добавляем текущий timestamp, удаляем старые
            pipe.zremrangebyscore(redis_key, 0, window_start)
            pipe.zadd(redis_key, {str(now): now})
            pipe.zcard(redis_key)
            pipe.expire(redis_key, window_seconds + 1)
            results = pipe.execute()

            count = results[2]  # zcard result
            return count > max_attempts

        except Exception as e:
            logger.warning("Redis rate limit check failed: %s — using in-memory fallback", e)

    # Fallback: in-memory (только для одного воркера)
    now = time.time()
    with _fallback_lock:
        _fallback_store[key] = [
            t for t in _fallback_store[key]
            if now - t < window_seconds
        ]
        if len(_fallback_store[key]) >= max_attempts:
            return True
        _fallback_store[key].append(now)
        # Ограничиваем размер словаря
        if len(_fallback_store) > 10000:
            oldest = next(iter(_fallback_store))
            del _fallback_store[oldest]
    return False


def reset_rate_limit(key: str):
    """Сбросить счётчик для ключа (например, после успешного входа)."""
    redis_key = f"ratelimit:{key}"
    if redis_client:
        try:
            redis_client.delete(redis_key)
        except Exception:
            pass
    with _fallback_lock:
        _fallback_store.pop(key, None)
