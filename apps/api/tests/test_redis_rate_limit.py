from unittest.mock import Mock

from finadvisor_api.legacy.redis_rate_limit import RedisRateLimiter


def test_redis_rate_limiter_sets_expiry_on_first_hit():
    client = Mock()
    client.incr.return_value = 1
    limiter = RedisRateLimiter(limit=2, window_seconds=30)
    limiter.client = client

    assert limiter.allow("client") is True
    client.expire.assert_called_once_with("finadvisor:rate:client", 30)
