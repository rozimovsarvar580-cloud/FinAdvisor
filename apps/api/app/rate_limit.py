from collections import defaultdict
from time import monotonic

from fastapi import Request


class InMemoryRateLimiter:
    def __init__(self, limit: int = 60, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        now = monotonic()
        valid_hits = [hit for hit in self._hits[key] if now - hit < self.window_seconds]
        self._hits[key] = valid_hits
        if len(valid_hits) >= self.limit:
            return False
        valid_hits.append(now)
        return True


rate_limiter = InMemoryRateLimiter()


async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/v1/auth"):
        client = request.client.host if request.client else "unknown"
        if not rate_limiter.allow(client):
            from fastapi.responses import JSONResponse

            request_id = getattr(request.state, "request_id", "unknown")
            return JSONResponse(
                status_code=429,
                content={
                    "code": "rate_limited",
                    "message": "Too many requests",
                    "details": {},
                    "request_id": request_id,
                },
            )
    return await call_next(request)
