import os

import redis
from redis.exceptions import RedisError

REDIS_URL = os.getenv("REDIS_URL")
REDIRECT_CACHE_TTL_SECONDS = int(os.getenv("REDIRECT_CACHE_TTL_SECONDS", "300"))

redis_client: redis.Redis | None = (
    redis.Redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None
)
memory_cache: dict[str, str] = {}


def get_redirect_url(token: str) -> str | None:
    if redis_client is None:
        return memory_cache.get(token)

    try:
        return redis_client.get(_redirect_key(token))
    except RedisError:
        return None


def set_redirect_url(token: str, url: str) -> None:
    if redis_client is None:
        memory_cache[token] = url
        return

    try:
        redis_client.setex(_redirect_key(token), REDIRECT_CACHE_TTL_SECONDS, url)
    except RedisError:
        return


def delete_redirect_url(token: str) -> None:
    if redis_client is None:
        memory_cache.pop(token, None)
        return

    try:
        redis_client.delete(_redirect_key(token))
    except RedisError:
        return


def _redirect_key(token: str) -> str:
    return f"redirect:{token}"
