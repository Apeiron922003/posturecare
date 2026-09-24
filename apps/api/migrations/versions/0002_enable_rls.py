"""enable row level security (Supabase exposes `public` via its REST API)

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = ("sessions", "readings", "device_rules")


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    # No policies on purpose: anon/authenticated roles (PostgREST) see nothing.
    # The API connects as the table owner, which bypasses RLS.
    for t in TABLES:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for t in TABLES:
        op.execute(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY")
