from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError

from finadvisor_api.legacy.config import REDIS_URL
from finadvisor_api.legacy.redis_rate_limit import RedisRateLimiter


class InMemoryRateLimiter:
    def __init__(self, limit: int = 60, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = {}

    def allow(self, key: str, limit: int | None = None, window_seconds: int | None = None) -> bool:
        effective_limit = self.limit if limit is None else limit
        effective_window = self.window_seconds if window_seconds is None else window_seconds
        now = monotonic()
        valid_hits = [hit for hit in self._hits.get(key, []) if now - hit < effective_window]
        self._hits[key] = valid_hits
        if len(valid_hits) >= effective_limit:
            return False
        valid_hits.append(now)
        return True


class RateLimiter:
    """Redis-backed rate limiter with an in-process fallback for local development."""

    def __init__(self, url: str = REDIS_URL, limit: int = 60, window_seconds: int = 60) -> None:
        self._redis = RedisRateLimiter(url=url, limit=limit, window_seconds=window_seconds)
        self._fallback = InMemoryRateLimiter(limit=limit, window_seconds=window_seconds)

    def allow(self, key: str, limit: int | None = None, window_seconds: int | None = None) -> bool:
        try:
            return self._redis.allow(key, limit, window_seconds)
        except RedisError:
            return self._fallback.allow(key, limit, window_seconds)


rate_limiter = RateLimiter()


# Endpoint groups that need rate limits: (prefix, limit, window_seconds).
RATE_LIMITS: tuple[tuple[str, int, int], ...] = (
    ("/auth", 60, 60),
    ("/api/v1/auth", 60, 60),
    ("/agent", 30, 60),
    ("/api/v1/agent", 40, 60),
    ("/chat", 30, 60),
    ("/api/v1/chat", 40, 60),
    ("/api/v1/documents", 30, 60),
    ("/documents", 30, 60),
    ("/plans/analyze", 10, 60),
    ("/api/v1/plans/analyze", 10, 60),
    ("/api/v1/plans", 30, 60),
    ("/api/v1/marketplace", 60, 60),
)


def _matches_prefix(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(f"{prefix}/")


async def rate_limit_middleware(request: Request, call_next):
    client = request.client.host if request.client else "unknown"
    path = request.url.path
    rule = next(
        (
            entry
            for entry in sorted(RATE_LIMITS, key=lambda entry: len(entry[0]), reverse=True)
            if _matches_prefix(path, entry[0])
        ),
        None,
    )
    if rule is not None:
        prefix, limit, window_seconds = rule
        if not rate_limiter.allow(f"{prefix}:{client}", limit, window_seconds):
            request_id = getattr(request.state, "request_id", "unknown")
            return JSONResponse(
                status_code=429,
                content={
                    "code": "rate_limited",
                    "message": "Too many requests",
                    "details": {},
                    "request_id": request_id,
                },
                headers={"Retry-After": str(window_seconds)},
            )
    return await call_next(request)
