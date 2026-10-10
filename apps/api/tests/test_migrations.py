from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory


def test_migrations_form_one_chain_and_upgrade_fresh_sqlite(monkeypatch) -> None:
    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    config.set_main_option("sqlalchemy.url", "sqlite://")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    script = ScriptDirectory.from_config(config)
    revisions = list(script.walk_revisions())

    assert sum(revision.down_revision is None for revision in revisions) == 1
    assert all(not isinstance(revision.down_revision, tuple) for revision in revisions)
    assert script.get_heads() == ["20261004_04"]

    command.upgrade(config, "head")
