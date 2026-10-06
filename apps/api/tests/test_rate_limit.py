from finadvisor_api.legacy.rate_limit import InMemoryRateLimiter


def test_rate_limiter_blocks_after_limit():
    limiter = InMemoryRateLimiter(limit=2, window_seconds=60)
    assert limiter.allow("client") is True
    assert limiter.allow("client") is True
    assert limiter.allow("client") is False
