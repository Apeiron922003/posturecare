from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
BASELINE = "0001"


def upgrade_to_head(engine: Engine) -> None:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        tables = set(inspect(conn).get_table_names())
        # Databases created before migrations existed (Base.metadata.create_all):
        # adopt them at the baseline instead of failing on CREATE TABLE.
        if "sessions" in tables and "alembic_version" not in tables:
            command.stamp(cfg, BASELINE)
        command.upgrade(cfg, "head")
