from dataclasses import replace

from fastapi.testclient import TestClient
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError

from finadvisor_api import main

app = main.app

client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_security_headers_are_present() -> None:
    response = client.get("/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"
    assert response.headers["content-security-policy"] == (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )


def test_cors_allows_configured_origin_and_rejects_unlisted_origin() -> None:
    allowed = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    rejected = client.options(
        "/health",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-origin" not in rejected.headers


def test_readiness_check_returns_ok_when_dependencies_and_migrations_are_ready(monkeypatch) -> None:
    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, _statement):
            return None

    class Engine:
        def connect(self):
            return Connection()

    class RedisClient:
        @staticmethod
        def from_url(*_args, **_kwargs):
            return RedisClient()

        def ping(self):
            return True

    class Migrations:
        @staticmethod
        def from_config(_config):
            return Migrations()

        def get_current_head(self):
            return "head"

    class MigrationState:
        @staticmethod
        def configure(_connection):
            return MigrationState()

        def get_current_revision(self):
            return "head"

    monkeypatch.setattr(main, "engine", Engine())
    monkeypatch.setattr(main.Redis, "from_url", RedisClient.from_url)
    monkeypatch.setattr(main.ScriptDirectory, "from_config", Migrations.from_config)
    monkeypatch.setattr(main.MigrationContext, "configure", MigrationState.configure)

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "redis": "ok", "migrations": "ok"},
    }


def test_readiness_check_returns_service_unavailable_when_dependency_fails(monkeypatch) -> None:
    monkeypatch.setattr(
        main, "settings", replace(main.settings, environment="production")
    )

    class FailedEngine:
        def connect(self):
            raise SQLAlchemyError("database unavailable")

    class FailedRedis:
        @staticmethod
        def from_url(*_args, **_kwargs):
            raise RedisError("redis unavailable")

    monkeypatch.setattr(main, "engine", FailedEngine())
    monkeypatch.setattr(main.Redis, "from_url", FailedRedis.from_url)

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "error", "redis": "error", "migrations": "error"},
    }


def test_readiness_check_uses_local_fallback_when_redis_is_unavailable(monkeypatch) -> None:
    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, _statement):
            return None

    class Engine:
        def connect(self):
            return Connection()

    class FailedRedis:
        @staticmethod
        def from_url(*_args, **_kwargs):
            raise RedisError("redis unavailable")

    class Migrations:
        @staticmethod
        def from_config(_config):
            return Migrations()

        def get_current_head(self):
            return "head"

    class MigrationState:
        @staticmethod
        def configure(_connection):
            return MigrationState()

        def get_current_revision(self):
            return "head"

    monkeypatch.setattr(
        main, "settings", replace(main.settings, environment="development")
    )
    monkeypatch.setattr(main, "engine", Engine())
    monkeypatch.setattr(main.Redis, "from_url", FailedRedis.from_url)
    monkeypatch.setattr(main.ScriptDirectory, "from_config", Migrations.from_config)
    monkeypatch.setattr(main.MigrationContext, "configure", MigrationState.configure)

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "redis": "fallback", "migrations": "ok"},
    }
