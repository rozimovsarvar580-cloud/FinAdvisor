from redis import Redis

from .config import REDIS_URL


class RedisRateLimiter:
    _INCREMENT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""

    def __init__(self, url: str = REDIS_URL, limit: int = 60, window_seconds: int = 60) -> None:
        self.client = Redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        self.limit = limit
        self.window_seconds = window_seconds

    def allow(self, key: str, limit: int | None = None, window_seconds: int | None = None) -> bool:
        effective_limit = self.limit if limit is None else limit
        effective_window = self.window_seconds if window_seconds is None else window_seconds
        redis_key = f"finadvisor:rate:{key}"
        count = self.client.eval(self._INCREMENT_SCRIPT, 1, redis_key, effective_window)
        return count <= effective_limit
