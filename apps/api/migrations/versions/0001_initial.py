"""initial schema: sessions, readings, device_rules

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("device_token", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("started_at", sa.Float(), nullable=False),
        sa.Column("grace_sec", sa.Integer(), nullable=False),
        sa.Column("lease_generation", sa.Integer(), nullable=False),
        sa.Column("owner_tab_id", sa.String(), nullable=True),
        sa.Column("last_seen", sa.Float(), nullable=False),
        sa.Column("last_face_present", sa.Boolean(), nullable=False),
        sa.Column("face_lost_since", sa.Float(), nullable=True),
        sa.Column("away_since", sa.Float(), nullable=True),
        sa.Column("exposure_reset_done", sa.Boolean(), nullable=False),
        sa.Column("exposure_sec", sa.Float(), nullable=False),
        sa.Column("governor", sa.JSON(), nullable=False),
        sa.UniqueConstraint("id"),
    )
    op.create_index("ix_sessions_device_token", "sessions", ["device_token"])
    op.create_index("ix_sessions_state", "sessions", ["state"])
    # BRULE-001: one open session per device token, enforced by the database.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_per_token ON sessions (device_token) "
        "WHERE state IN ('calibrating','monitoring','away','break')"
    )

    op.create_table(
        "readings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("ts", sa.Float(), nullable=False),
        sa.Column("pitch", sa.Float(), nullable=True),
        sa.Column("yaw", sa.Float(), nullable=True),
        sa.Column("roll", sa.Float(), nullable=True),
        sa.Column("distance_cm", sa.Float(), nullable=True),
        sa.Column("ear", sa.Float(), nullable=True),
        sa.Column("blink_count", sa.Integer(), nullable=False),
        sa.Column("face_present", sa.Boolean(), nullable=False),
        sa.Column("flags", sa.JSON(), nullable=False),
    )
    op.create_index("ix_readings_session_id", "readings", ["session_id"])
    op.create_index("ix_readings_ts", "readings", ["ts"])

    op.create_table(
        "device_rules",
        sa.Column("device_token", sa.String(), primary_key=True),
        sa.Column("rules", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("device_rules")
    op.drop_table("readings")
    op.drop_table("sessions")
