from __future__ import annotations

from typing import Any

from sqlalchemy.engine import make_url


def normalize_database_url(url: str) -> str:
    """Supabase/Heroku hand out `postgres://` / `postgresql://`; SQLAlchemy would pick
    psycopg2 (not installed). Pin the psycopg 3 driver."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def engine_kwargs(url: str) -> dict[str, Any]:
    u = make_url(url)
    host = u.host or ""
    connect_args: dict[str, Any] = {}
    # Supabase transaction pooler (Supavisor, :6543) multiplexes server connections,
    # so psycopg's server-side prepared statements would land on the wrong backend.
    if u.port == 6543 or host.endswith("pooler.supabase.com"):
        connect_args["prepare_threshold"] = None
    if host not in ("", "localhost", "127.0.0.1") and "sslmode" not in u.query:
        connect_args["sslmode"] = "require"
    return {"pool_pre_ping": True, "connect_args": connect_args}
