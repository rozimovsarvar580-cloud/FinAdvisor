from redis import Redis

from .config import REDIS_URL


class RedisRateLimiter:
    def __init__(self, url: str = REDIS_URL, limit: int = 60, window_seconds: int = 60) -> None:
        self.client = Redis.from_url(url, decode_responses=True)
        self.limit = limit
        self.window_seconds = window_seconds

    def allow(self, key: str) -> bool:
        redis_key = f"finadvisor:rate:{key}"
        count = self.client.incr(redis_key)
        if count == 1:
            self.client.expire(redis_key, self.window_seconds)
        return count <= self.limit
