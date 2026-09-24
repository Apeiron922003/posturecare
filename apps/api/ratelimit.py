from __future__ import annotations

import threading
import time
from collections import deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from constants import RATE_LIMIT_PER_TOKEN, RATE_LIMIT_START_PER_CLIENT, RATE_LIMIT_WINDOW_SEC


class SlidingWindow:
    """In-process sliding-window counter. Correct only with a single API process —
    the same constraint the tick loop already imposes (Dockerfile: --workers 1)."""

    def __init__(self, limit: int, window_sec: float) -> None:
        self.limit = limit
        self.window = window_sec
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, now: float | None = None) -> float | None:
        """Record a hit. Returns None if allowed, else seconds until a slot frees."""
        ts = time.monotonic() if now is None else now
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and ts - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.limit:
                return self.window - (ts - q[0])
            q.append(ts)
            if len(self._hits) > 50_000:
                self._evict(ts)
            return None

    def _evict(self, ts: float) -> None:
        for k in [k for k, q in self._hits.items() if not q or ts - q[-1] >= self.window]:
            del self._hits[k]


def client_key(request: Request) -> str:
    # The Pages proxy forwards the visitor IP; Fly sets Fly-Client-IP for direct hits.
    for h in ("x-posturecare-client-ip", "fly-client-ip"):
        v = request.headers.get(h)
        if v:
            return v.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, per_token: int = RATE_LIMIT_PER_TOKEN, start_per_client: int = RATE_LIMIT_START_PER_CLIENT):
        super().__init__(app)
        self.tokens = SlidingWindow(per_token, RATE_LIMIT_WINDOW_SEC)
        self.starts = SlidingWindow(start_per_client, RATE_LIMIT_WINDOW_SEC)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and path != "/api/health":
            token = request.headers.get("x-device-token")
            key = f"t:{token}" if token else f"c:{client_key(request)}"
            wait = self.tokens.hit(key)
            if wait is None and request.method == "POST" and path == "/api/sessions/start":
                wait = self.starts.hit(client_key(request))
            if wait is not None:
                # Client treats this like a network error: retry, never release the camera.
                return JSONResponse(
                    {"detail": "rate limited"},
                    status_code=429,
                    headers={"Retry-After": str(max(1, int(wait) + 1))},
                )
        return await call_next(request)
