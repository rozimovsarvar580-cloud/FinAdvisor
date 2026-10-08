"""Add pgvector knowledge chunks.

Revision ID: 20261003_02
Revises: 20261003_01
Create Date: 2026-10-03
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "20261003_02"
down_revision: str | None = "20261003_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source", sa.String(length=300), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("content", sa.String(length=5000), nullable=False),
        sa.Column("embedding", Vector(16), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("knowledge_chunks")
