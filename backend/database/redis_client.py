import os
import redis
from datetime import datetime, timezone

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Setup Redis client for Token Blacklist
# If Redis is unavailable, skip blacklist feature but don't crash the server.
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    # Ping to check if Redis is accessible during startup
    redis_client.ping()
except Exception as e:
    print(f"⚠️ Redis connection failed: {e}. Token blacklist will be ignored.")
    redis_client = None

def blacklist_token(token: str, exp_timestamp: int):
    """
    Store the token in Redis blacklist until it expires.
    """
    if not redis_client or not token:
        return
        
    now = int(datetime.now(timezone.utc).timestamp())
    ttl = exp_timestamp - now
    if ttl > 0:
        try:
            redis_client.setex(f"blacklist:{token}", ttl, "revoked")
        except Exception as e:
            print(f"⚠️ Failed to blacklist token: {e}")

def is_token_blacklisted(token: str) -> bool:
    """
    Check if token exists in the Redis blacklist.
    """
    if not redis_client or not token:
        return False
        
    try:
        return redis_client.exists(f"blacklist:{token}") > 0
    except Exception as e:
        print(f"⚠️ Failed to check token blacklist: {e}")
        return False
