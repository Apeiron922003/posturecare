from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from constants import READINGS_RETENTION_SEC, RETENTION_SWEEP_SEC
from observability import init_sentry
from ratelimit import RateLimitMiddleware
from routers import reports, rules, sessions
from store import MemoryStore

log = logging.getLogger("posturecare")
init_sentry()


def build_store():
    url = os.environ.get("DATABASE_URL")
    if url:
        from pg_store import PostgresStore

        return PostgresStore(url)
    return MemoryStore()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = build_store()

    async def loop():
        last_sweep = 0.0
        while True:
            await asyncio.sleep(2)
            try:
                app.state.store.tick_all()
            except Exception:
                log.exception("tick_all failed")
            now = time.time()
            if now - last_sweep >= RETENTION_SWEEP_SEC:
                last_sweep = now
                try:
                    removed = app.state.store.purge_readings(now - READINGS_RETENTION_SEC)
                    if removed:
                        log.info("purged %d readings older than retention", removed)
                except Exception:
                    log.exception("purge_readings failed")

    task = asyncio.create_task(loop())
    yield
    task.cancel()


app = FastAPI(title="PostureCare V0-web", lifespan=lifespan)

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)

app.include_router(sessions.router)
app.include_router(rules.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    return {"ok": True}
