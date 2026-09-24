from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Protocol

from constants import ACTIVE_STATES, DEFAULT_RULES, GRACE_SEC
from session_sm import (
    Reading,
    Session,
    accrue_exposure,
    apply_grace,
    empty_governor,
    merge_governor,
    on_face,
    owner_live,
    tick,
)


class Store(Protocol):
    def start(self, device_token: str, tab_id: str, now: float | None = None) -> Session: ...
    def get(self, session_id: str) -> Session | None: ...
    def get_active(self, device_token: str) -> Session | None: ...
    def takeover(self, session_id: str, device_token: str, tab_id: str, now: float | None = None) -> tuple[Session, bool]: ...
    def heartbeat(
        self,
        session_id: str,
        device_token: str,
        tab_id: str,
        lease_generation: int,
        face_present: bool,
        governor_state: dict[str, Any] | None,
        now: float | None = None,
    ) -> Session: ...
    def stop(self, session_id: str, device_token: str) -> Session: ...
    def add_readings(self, session_id: str, device_token: str, items: list[Reading]) -> None: ...
    def action(
        self,
        session_id: str,
        device_token: str,
        tab_id: str,
        lease_generation: int,
        action_type: str,
        now: float | None = None,
    ) -> Session: ...
    def get_rules(self, device_token: str) -> dict[str, Any]: ...
    def put_rules(self, device_token: str, rules: dict[str, Any]) -> None: ...
    def tick_all(self, now: float | None = None) -> None: ...
    def purge_readings(self, before_ts: float) -> int: ...


class LeaseError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(detail)


class MemoryStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._by_id: dict[str, Session] = {}
        self._active_token: dict[str, str] = {}
        self._rules: dict[str, dict[str, Any]] = {}

    def _now(self, now: float | None) -> float:
        return time.time() if now is None else now

    def get(self, session_id: str) -> Session | None:
        with self._lock:
            return self._by_id.get(session_id)

    def get_active(self, device_token: str) -> Session | None:
        with self._lock:
            sid = self._active_token.get(device_token)
            if not sid:
                return None
            session = self._by_id.get(sid)
            if session is None or session.state not in ACTIVE_STATES:
                self._active_token.pop(device_token, None)
                return None
            return session

    def _require_owned(self, session_id: str, device_token: str) -> Session:
        session = self._by_id.get(session_id)
        if session is None:
            raise LeaseError(404, "session not found")
        if session.device_token != device_token:
            raise LeaseError(403, "device_token does not own session")
        return session

    def start(self, device_token: str, tab_id: str, now: float | None = None) -> Session:
        ts = self._now(now)
        with self._lock:
            existing = self.get_active(device_token)
            if existing is not None:
                tick(existing, ts)
                if existing.state not in ACTIVE_STATES:
                    pass
                else:
                    return existing
            session = Session(
                id=str(uuid.uuid4()),
                device_token=device_token,
                state="calibrating",
                started_at=ts,
                grace_sec=GRACE_SEC,
                lease_generation=1,
                owner_tab_id=tab_id,
                last_seen=ts,
                last_face_present=False,
                governor=empty_governor(),
            )
            self._by_id[session.id] = session
            self._active_token[device_token] = session.id
            return session

    def takeover(
        self, session_id: str, device_token: str, tab_id: str, now: float | None = None
    ) -> tuple[Session, bool]:
        ts = self._now(now)
        with self._lock:
            session = self._require_owned(session_id, device_token)
            tick(session, ts)
            if session.state == "ended":
                raise LeaseError(409, "session ended")
            if session.owner_tab_id == tab_id:
                session.last_seen = ts
                return session, True
            session.lease_generation += 1
            session.owner_tab_id = tab_id
            session.last_seen = ts
            return session, True

    def heartbeat(
        self,
        session_id: str,
        device_token: str,
        tab_id: str,
        lease_generation: int,
        face_present: bool,
        governor_state: dict[str, Any] | None,
        now: float | None = None,
    ) -> Session:
        ts = self._now(now)
        with self._lock:
            session = self._require_owned(session_id, device_token)
            if session.state == "ended":
                raise LeaseError(409, "session ended")
            if session.lease_generation != lease_generation or session.owner_tab_id != tab_id:
                raise LeaseError(409, "stale lease")
            merge_governor(session, governor_state)
            session.last_seen = ts
            on_face(session, face_present, ts)
            tick(session, ts)
            accrue_exposure(session, face_present)
            apply_grace(session, ts)
            return session

    def stop(self, session_id: str, device_token: str) -> Session:
        with self._lock:
            session = self._require_owned(session_id, device_token)
            session.state = "ended"
            session.owner_tab_id = None
            if self._active_token.get(device_token) == session_id:
                self._active_token.pop(device_token, None)
            return session

    def add_readings(self, session_id: str, device_token: str, items: list[Reading]) -> None:
        with self._lock:
            session = self._require_owned(session_id, device_token)
            if session.state not in ("calibrating", "monitoring"):
                return
            session.readings.extend(items)

    def action(
        self,
        session_id: str,
        device_token: str,
        tab_id: str,
        lease_generation: int,
        action_type: str,
        now: float | None = None,
    ) -> Session:
        ts = self._now(now)
        with self._lock:
            session = self._require_owned(session_id, device_token)
            if session.state == "ended":
                raise LeaseError(409, "session ended")
            if session.lease_generation != lease_generation or session.owner_tab_id != tab_id:
                raise LeaseError(409, "stale lease")
            if action_type == "snooze":
                session.governor["snooze_until"] = ts + 600
                session.governor["escalated_at"] = None
            elif action_type == "dnd_on":
                session.governor["dnd"] = True
                session.governor["escalated_at"] = None
            elif action_type == "dnd_off":
                session.governor["dnd"] = False
            elif action_type == "ack":
                session.governor["escalated_at"] = None
                session.governor["backoff_stage"] = 0
            elif action_type == "break_start":
                session.state = "break"
                session.away_since = None
            elif action_type == "break_end":
                session.state = "monitoring" if session.last_face_present else "away"
                if session.state == "away":
                    session.away_since = ts
                    session.exposure_reset_done = False
            else:
                raise LeaseError(422, "unknown action")
            return session

    def get_rules(self, device_token: str) -> dict[str, Any]:
        with self._lock:
            return dict(self._rules.get(device_token) or DEFAULT_RULES)

    def put_rules(self, device_token: str, rules: dict[str, Any]) -> None:
        with self._lock:
            merged = dict(self._rules.get(device_token) or DEFAULT_RULES)
            merged.update(rules)
            self._rules[device_token] = merged

    def purge_readings(self, before_ts: float) -> int:
        removed = 0
        with self._lock:
            for session in self._by_id.values():
                keep = [r for r in session.readings if r.ts >= before_ts]
                removed += len(session.readings) - len(keep)
                session.readings = keep
        return removed

    def tick_all(self, now: float | None = None) -> None:
        ts = self._now(now)
        with self._lock:
            for session in list(self._by_id.values()):
                if session.state == "ended":
                    continue
                prev = session.state
                tick(session, ts)
                if session.state == "ended" and prev != "ended":
                    if self._active_token.get(session.device_token) == session.id:
                        self._active_token.pop(session.device_token, None)
