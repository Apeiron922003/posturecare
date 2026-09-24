from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from db import engine_kwargs, normalize_database_url
from main import app
from migrate import upgrade_to_head
from models import Base
from ratelimit import SlidingWindow
from session_sm import Reading
from store import MemoryStore


def test_normalize_database_url_pins_psycopg3():
    assert normalize_database_url("postgres://u:p@h:5432/d") == "postgresql+psycopg://u:p@h:5432/d"
    assert normalize_database_url("postgresql://u:p@h/d") == "postgresql+psycopg://u:p@h/d"
    assert normalize_database_url("postgresql+psycopg://u@h/d") == "postgresql+psycopg://u@h/d"


def test_engine_kwargs_supabase_pooler_and_ssl():
    pooled = engine_kwargs("postgresql+psycopg://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres")
    assert pooled["connect_args"] == {"prepare_threshold": None, "sslmode": "require"}
    local = engine_kwargs("postgresql+psycopg://u:p@127.0.0.1:5432/d")
    assert local["connect_args"] == {}
    explicit = engine_kwargs("postgresql+psycopg://u:p@db.example.com/d?sslmode=verify-full")
    assert "sslmode" not in explicit["connect_args"]


def test_migrations_create_schema_and_one_active_index(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'a.db'}")
    upgrade_to_head(engine)
    upgrade_to_head(engine)  # idempotent
    insp = inspect(engine)
    assert {"sessions", "readings", "device_rules", "alembic_version"} <= set(insp.get_table_names())
    assert "sessions_one_active_per_token" in {i["name"] for i in insp.get_indexes("sessions")}


def test_migrations_adopt_legacy_create_all_db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'b.db'}")
    Base.metadata.create_all(engine)
    upgrade_to_head(engine)
    with engine.connect() as c:
        assert c.execute(text("select version_num from alembic_version")).scalar() == "0001"


def test_sql_store_purge_readings(tmp_path):
    from pg_store import PostgresStore

    store = PostgresStore(f"sqlite:///{tmp_path / 'c.db'}")
    s = store.start("tok", "tab", now=1000.0)
    old = Reading(ts=100.0, pitch=None, yaw=None, roll=None, distance_cm=None, ear=None, blink_count=0, face_present=False, flags=[])
    new = Reading(ts=5000.0, pitch=None, yaw=None, roll=None, distance_cm=None, ear=None, blink_count=0, face_present=False, flags=[])
    store.add_readings(s.id, "tok", [old, new])
    assert store.purge_readings(1000.0) == 1
    assert [r.ts for r in store.get(s.id).readings] == [5000.0]


def test_memory_store_purge_readings():
    store = MemoryStore()
    s = store.start("tok", "tab", now=1000.0)
    mk = lambda ts: Reading(ts=ts, pitch=None, yaw=None, roll=None, distance_cm=None, ear=None, blink_count=0, face_present=False, flags=[])
    store.add_readings(s.id, "tok", [mk(1.0), mk(2000.0)])
    assert store.purge_readings(1000.0) == 1
    assert len(store.get(s.id).readings) == 1


def test_sliding_window():
    w = SlidingWindow(limit=2, window_sec=10)
    assert w.hit("k", now=0) is None
    assert w.hit("k", now=1) is None
    assert w.hit("k", now=2) == 8
    assert w.hit("other", now=2) is None
    assert w.hit("k", now=10.5) is None  # first hit expired


def test_rate_limit_returns_429_and_health_is_exempt():
    with TestClient(app) as c:
        headers = {"X-Device-Token": "flood"}
        codes = [c.get("/api/rules", headers=headers).status_code for _ in range(305)]
        assert codes.count(429) == 5
        r = c.get("/api/rules", headers=headers)
        assert r.status_code == 429 and int(r.headers["Retry-After"]) >= 1
        assert all(c.get("/api/health").status_code == 200 for _ in range(5))
        assert c.get("/api/rules", headers={"X-Device-Token": "someone-else"}).status_code == 200


def test_input_limits():
    with TestClient(app) as c:
        long = {"X-Device-Token": "x" * 200}
        assert c.get("/api/rules", headers=long).status_code == 400
        h = {"X-Device-Token": "lim"}
        sid = c.post("/api/sessions/start", json={"tab_id": "t"}, headers=h).json()["session_id"]
        many = [{"ts": 1.0, "face_present": False}] * 51
        assert c.post(f"/api/sessions/{sid}/readings", json={"readings": many}, headers=h).status_code == 422
        assert c.post("/api/sessions/start", json={"tab_id": ""}, headers=h).status_code == 422
