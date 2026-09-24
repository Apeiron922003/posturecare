from __future__ import annotations

from alembic import context

from models import Base

target_metadata = Base.metadata

# Only the programmatic path is supported (migrate.upgrade_to_head passes a live
# connection), so the store and migrations always use the same engine settings.
connection = context.config.attributes.get("connection")
if connection is None:
    raise RuntimeError("run migrations via migrate.upgrade_to_head(engine)")

context.configure(connection=connection, target_metadata=target_metadata)
with context.begin_transaction():
    context.run_migrations()
