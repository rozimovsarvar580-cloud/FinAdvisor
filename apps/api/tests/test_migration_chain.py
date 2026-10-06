from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_migrations_form_one_linear_chain() -> None:
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    revisions = list(script.walk_revisions())
    bases = [revision for revision in revisions if revision.down_revision is None]
    merges = [
        revision
        for revision in revisions
        if isinstance(revision.down_revision, tuple)
    ]

    assert len(bases) == 1
    assert not merges
    assert script.get_heads() == ["20261004_03"]
