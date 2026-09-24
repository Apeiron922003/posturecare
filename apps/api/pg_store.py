from __future__ import annotations

import os
from typing import Any

from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session as DbSession, sessionmaker

from constants import ACTIVE_STATES, DEFAULT_RULES, GRACE_SEC
from db import engine_kwargs, normalize_database_url
from migrate import upgrade_to_head
from models import ReadingRow, RulesRow, SessionRow
from session_sm import (
    Reading,
    Session,
    accrue_exposure,
    empty_governor,
    merge_governor,
    on_face,
    tick,
)
from store import LeaseError


def _row_to_session(row: SessionRow, readings: list[Reading] | None = None) -> Session:
    return Session(
        id=row.id,
        device_token=row.device_token,
        state=row.state,
        started_at=row.started_at,
        grace_sec=row.grace_sec,
        lease_generation=row.lease_generation,
        owner_tab_id=row.owner_tab_id,
        last_seen=row.last_seen,
        last_face_present=row.last_face_present,
        face_lost_since=row.face_lost_since,
        away_since=row.away_since,
        exposure_reset_done=row.exposure_reset_done,
        exposure_sec=row.exposure_sec,
        governor=dict(row.governor or empty_governor()),
        readings=readings or [],
    )


def _apply_session(row: SessionRow, session: Session) -> None:
    row.state = session.state
    row.lease_generation = session.lease_generation
    row.owner_tab_id = session.owner_tab_id
    row.last_seen = session.last_seen
    row.last_face_present = session.last_face_present
    row.face_lost_since = session.face_lost_since
    row.away_since = session.away_since
    row.exposure_reset_done = session.exposure_reset_done
    row.exposure_sec = session.exposure_sec
    row.governor = dict(session.governor)


class PostgresStore:
    def __init__(self, url: str) -> None:
        url = normalize_database_url(url)
        self.engine = create_engine(url, **engine_kwargs(url))
        upgrade_to_head(self.engine)
        self._session = sessionmaker(bind=self.engine, expire_on_commit=False)

    def _db(self) -> DbSession:
        return self._session()

    def _load_readings(self, db: DbSession, session_id: str) -> list[Reading]:
        rows = db.scalars(select(ReadingRow).where(ReadingRow.session_id == session_id).order_by(ReadingRow.ts)).all()
        return [
            Reading(
                ts=r.ts,
                pitch=r.pitch,
                yaw=r.yaw,
                roll=r.roll,
                distance_cm=r.distance_cm,
                ear=r.ear,
                blink_count=r.blink_count,
                face_present=r.face_present,
                flags=list(r.flags or []),
            )
            for r in rows
        ]

    def get(self, session_id: str) -> Session | None:
        with self._db() as db:
            row = db.get(SessionRow, session_id)
            if row is None:
                return None
            return _row_to_session(row, self._load_readings(db, session_id))

    def get_active(self, device_token: str) -> Session | None:
        with self._db() as db:
            row = db.scalar(
                select(SessionRow).where(
                    SessionRow.device_token == device_token,
                    SessionRow.state.in_(ACTIVE_STATES),
                )
            )
            if row is None:
                return None
            return _row_to_session(row)

    def start(self, device_token: str, tab_id: str, now: float | None = None) -> Session:
        import time
        import uuid

        ts = time.time() if now is None else now
        with self._db() as db:
            row = db.scalar(
                select(SessionRow).where(
                    SessionRow.device_token == device_token,
                    SessionRow.state.in_(ACTIVE_STATES),
                )
            )
            if row is not None:
                session = _row_to_session(row)
                tick(session, ts)
                _apply_session(row, session)
                db.commit()
                if session.state in ACTIVE_STATES:
                    return session
            session = Session(
                id=str(uuid.uuid4()),
                device_token=device_token,
                state="calibrating",
                started_at=ts,
                grace_sec=GRACE_SEC,
                lease_generation=1,
                owner_tab_id=tab_id,
                last_seen=ts,
                governor=empty_governor(),
            )
            db.add(
                SessionRow(
                    id=session.id,
                    device_token=device_token,
                    state=session.state,
                    started_at=ts,
                    grace_sec=GRACE_SEC,
                    lease_generation=1,
                    owner_tab_id=tab_id,
                    last_seen=ts,
                    last_face_present=False,
                    governor=empty_governor(),
                )
            )
            db.commit()
            return session

    def _require(self, db: DbSession, session_id: str, device_token: str) -> SessionRow:
        row = db.get(SessionRow, session_id)
        if row is None:
            raise LeaseError(404, "session not found")
        if row.device_token != device_token:
            raise LeaseError(403, "device_token does not own session")
        return row

    def takeover(self, session_id: str, device_token: str, tab_id: str, now: float | None = None) -> tuple[Session, bool]:
        import time

        ts = time.time() if now is None else now
        with self._db() as db:
            row = self._require(db, session_id, device_token)
            session = _row_to_session(row)
            tick(session, ts)
            if session.state == "ended":
                _apply_session(row, session)
                db.commit()
                raise LeaseError(409, "session ended")
            if session.owner_tab_id == tab_id:
                session.last_seen = ts
            else:
                session.lease_generation += 1
                session.owner_tab_id = tab_id
                session.last_seen = ts
            _apply_session(row, session)
            db.commit()
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
        import time

        ts = time.time() if now is None else now
        with self._db() as db:
            row = self._require(db, session_id, device_token)
            session = _row_to_session(row)
            if session.state == "ended":
                raise LeaseError(409, "session ended")
            if session.lease_generation != lease_generation or session.owner_tab_id != tab_id:
                raise LeaseError(409, "stale lease")
            merge_governor(session, governor_state)
            session.last_seen = ts
            on_face(session, face_present, ts)
            tick(session, ts)
            accrue_exposure(session, face_present)
            _apply_session(row, session)
            db.commit()
            return session

    def stop(self, session_id: str, device_token: str) -> Session:
        with self._db() as db:
            row = self._require(db, session_id, device_token)
            session = _row_to_session(row)
            session.state = "ended"
            session.owner_tab_id = None
            _apply_session(row, session)
            db.commit()
            return session

    def add_readings(self, session_id: str, device_token: str, items: list[Reading]) -> None:
        with self._db() as db:
            row = self._require(db, session_id, device_token)
            if row.state not in ("calibrating", "monitoring"):
                return
            for item in items:
                db.add(
                    ReadingRow(
                        session_id=session_id,
                        ts=item.ts,
                        pitch=item.pitch,
                        yaw=item.yaw,
                        roll=item.roll,
                        distance_cm=item.distance_cm,
                        ear=item.ear,
                        blink_count=item.blink_count,
                        face_present=item.face_present,
                        flags=item.flags,
                    )
                )
            db.commit()

    def action(
        self,
        session_id: str,
        device_token: str,
        tab_id: str,
        lease_generation: int,
        action_type: str,
        now: float | None = None,
    ) -> Session:
        import time

        ts = time.time() if now is None else now
        with self._db() as db:
            row = self._require(db, session_id, device_token)
            session = _row_to_session(row)
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
            _apply_session(row, session)
            db.commit()
            return session

    def get_rules(self, device_token: str) -> dict[str, Any]:
        with self._db() as db:
            row = db.get(RulesRow, device_token)
            if row is None:
                return dict(DEFAULT_RULES)
            return dict(row.rules)

    def put_rules(self, device_token: str, rules: dict[str, Any]) -> None:
        with self._db() as db:
            row = db.get(RulesRow, device_token)
            merged = dict(DEFAULT_RULES)
            if row is not None:
                merged.update(row.rules or {})
                merged.update(rules)
                row.rules = merged
            else:
                merged.update(rules)
                db.add(RulesRow(device_token=device_token, rules=merged))
            db.commit()

    def purge_readings(self, before_ts: float) -> int:
        with self._db() as db:
            result = db.execute(delete(ReadingRow).where(ReadingRow.ts < before_ts))
            db.commit()
            return result.rowcount or 0

    def tick_all(self, now: float | None = None) -> None:
        import time

        ts = time.time() if now is None else now
        with self._db() as db:
            rows = db.scalars(select(SessionRow).where(SessionRow.state != "ended")).all()
            for row in rows:
                session = _row_to_session(row)
                tick(session, ts)
                _apply_session(row, session)
            db.commit()

