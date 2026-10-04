"""create email verifications

Revision ID: 0005_create_email_verifications
Revises: 0004_create_plan_versions
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_create_email_verifications"
down_revision = "0004_create_plan_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_verifications",
        sa.Column("email", sa.String(length=320), primary_key=True),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("email_verifications")
