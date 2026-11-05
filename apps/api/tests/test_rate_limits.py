import asyncio
from unittest.mock import Mock

import pytest
from fastapi import Request
from redis.exceptions import RedisError

from finadvisor_api.legacy import rate_limit


def make_request(path: str) -> Request:
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "client": ("192.0.2.1", 1234),
            "server": ("testserver", 80),
        }
    )


@pytest.mark.parametrize(
    ("path", "expected_prefix"),
    [
        ("/auth/login", "/auth"),
        ("/plans/analyze", "/plans/analyze"),
        ("/documents/plan-1/pdf", "/documents"),
        ("/chat/stream", "/chat"),
        ("/api/v1/auth/login", "/api/v1/auth"),
        ("/api/v1/plans/analyze", "/api/v1/plans/analyze"),
        ("/api/v1/plans/plan-1/export.xlsx", "/api/v1/plans"),
    ],
)
def test_rate_limit_middleware_limits_sensitive_routes(
    path: str,
    expected_prefix: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = make_request(path)
    limiter = Mock()
    limiter.allow.return_value = False
    monkeypatch.setattr(rate_limit, "rate_limiter", limiter)
    called = False

    async def call_next(_: Request):
        nonlocal called
        called = True
        return Mock()

    response = asyncio.run(rate_limit.rate_limit_middleware(request, call_next))

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"
    assert limiter.allow.call_args.args[0] == f"{expected_prefix}:192.0.2.1"
    assert called is False


def test_rate_limit_middleware_does_not_limit_unmatched_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = make_request("/health")
    limiter = Mock()
    monkeypatch.setattr(rate_limit, "rate_limiter", limiter)
    expected_response = Mock()

    async def call_next(_: Request):
        return expected_response

    response = asyncio.run(rate_limit.rate_limit_middleware(request, call_next))

    assert response is expected_response
    limiter.allow.assert_not_called()


def test_rate_limiter_uses_in_memory_fallback_when_redis_is_unavailable() -> None:
    limiter = rate_limit.RateLimiter(url="redis://localhost")
    limiter._redis.allow = Mock(side_effect=RedisError("unavailable"))
    limiter._fallback.allow = Mock(return_value=True)

    assert limiter.allow("client", limit=3, window_seconds=20) is True
    limiter._fallback.allow.assert_called_once_with("client", 3, 20)
