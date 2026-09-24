from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from constants import (
    AWAY_CLOSE_SESSION_SEC,
    AWAY_RESET_EXPOSURE_SEC,
    FACE_LOST_TO_AWAY_SEC,
    GRACE_SEC,
    HEARTBEAT_INTERVAL_SEC,
    HEARTBEAT_TIMEOUT_SEC,
    OWNER_LIVE_TIMEOUT_SEC,
)


def empty_governor() -> dict[str, Any]:
    return {
        "dnd": False,
        "snooze_until": None,
        "escalated_at": None,
        "backoff_stage": 0,
        "last_alert_at": None,
        "break_suggested": False,
    }


@dataclass
class Reading:
    ts: float
    pitch: float | None
    yaw: float | None
    roll: float | None
    distance_cm: float | None
    ear: float | None
    blink_count: int
    face_present: bool
    flags: list[str]


@dataclass
class Session:
    id: str
    device_token: str
    state: str
    started_at: float
    grace_sec: int = GRACE_SEC
    lease_generation: int = 1
    owner_tab_id: str | None = None
    last_seen: float = 0.0
    last_face_present: bool = False
    face_lost_since: float | None = None
    away_since: float | None = None
    exposure_reset_done: bool = False
    exposure_sec: float = 0.0
    governor: dict[str, Any] = field(default_factory=empty_governor)
    readings: list[Reading] = field(default_factory=list)


def owner_live(session: Session, now: float) -> bool:
    if session.state == "ended" or session.owner_tab_id is None:
        return False
    return (now - session.last_seen) < OWNER_LIVE_TIMEOUT_SEC


def apply_grace(session: Session, now: float) -> None:
    if session.state == "calibrating" and (now - session.started_at) >= session.grace_sec:
        session.state = "monitoring"


def _enter_away(session: Session, now: float) -> None:
    if session.state not in ("calibrating", "monitoring"):
        return
    session.state = "away"
    session.away_since = now
    session.exposure_reset_done = False


def tick(session: Session, now: float) -> None:
    if session.state == "ended":
        return
    apply_grace(session, now)

    if session.state in ("calibrating", "monitoring"):
        no_hb = (now - session.last_seen) >= HEARTBEAT_TIMEOUT_SEC
        face_lost = (
            not session.last_face_present
            and session.face_lost_since is not None
            and (now - session.face_lost_since) >= FACE_LOST_TO_AWAY_SEC
        )
        if no_hb or face_lost:
            _enter_away(session, now)

    if session.state == "away" and session.away_since is not None:
        away_dur = now - session.away_since
        if away_dur >= AWAY_RESET_EXPOSURE_SEC and not session.exposure_reset_done:
            session.exposure_sec = 0.0
            session.exposure_reset_done = True
        if away_dur >= AWAY_CLOSE_SESSION_SEC:
            session.state = "ended"
            session.owner_tab_id = None


def on_face(session: Session, face_present: bool, now: float) -> None:
    session.last_face_present = face_present
    if face_present:
        session.face_lost_since = None
        if session.state == "away":
            session.state = "monitoring"
            session.away_since = None
    elif session.face_lost_since is None:
        session.face_lost_since = now


def accrue_exposure(session: Session, face_present: bool) -> None:
    if session.state == "monitoring" and face_present:
        session.exposure_sec += HEARTBEAT_INTERVAL_SEC


def merge_governor(session: Session, patch: dict[str, Any] | None) -> None:
    if not patch:
        return
    allowed = {
        "dnd",
        "snooze_until",
        "escalated_at",
        "backoff_stage",
        "last_alert_at",
        "break_suggested",
    }
    for key, value in patch.items():
        if key in allowed:
            session.governor[key] = value
