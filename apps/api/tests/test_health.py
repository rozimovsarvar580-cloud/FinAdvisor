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
