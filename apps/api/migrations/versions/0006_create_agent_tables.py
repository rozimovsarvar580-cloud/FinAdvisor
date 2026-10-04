"""create desktop agent device and command tables

Revision ID: 0006_create_agent_tables
Revises: 20261003_03
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_create_agent_tables"
down_revision = "20261003_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_devices",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="registered"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agent_devices_owner_email", "agent_devices", ["owner_email"])
    op.create_table(
        "agent_commands",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("owner_email", sa.String(length=320), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["agent_devices.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_agent_commands_owner_email", "agent_commands", ["owner_email"])
    op.create_index("ix_agent_commands_device_id", "agent_commands", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_commands_device_id", table_name="agent_commands")
    op.drop_index("ix_agent_commands_owner_email", table_name="agent_commands")
    op.drop_table("agent_commands")
    op.drop_index("ix_agent_devices_owner_email", table_name="agent_devices")
    op.drop_table("agent_devices")
