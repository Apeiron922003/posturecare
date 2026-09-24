from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from constants import MAX_ID_LEN, MAX_READINGS_PER_BATCH


class TabBody(BaseModel):
    tab_id: str = Field(min_length=1, max_length=MAX_ID_LEN)


class HeartbeatBody(BaseModel):
    tab_id: str = Field(min_length=1, max_length=MAX_ID_LEN)
    lease_generation: int
    face_present: bool
    governor_state: dict[str, Any] | None = None


class ActionBody(BaseModel):
    tab_id: str = Field(min_length=1, max_length=MAX_ID_LEN)
    lease_generation: int
    type: Literal["snooze", "dnd_on", "dnd_off", "ack", "break_start", "break_end"]


class ReadingItem(BaseModel):
    ts: float
    pitch: float | None = None
    yaw: float | None = None
    roll: float | None = None
    distance_cm: float | None = None
    ear: float | None = None
    blink_count: int = 0
    face_present: bool
    flags: list[str] = Field(default_factory=list)


class ReadingsBody(BaseModel):
    readings: list[ReadingItem] = Field(max_length=MAX_READINGS_PER_BATCH)


class RulesBody(BaseModel):
    rules: dict[str, Any]


class SessionView(BaseModel):
    session_id: str | None = None
    state: str
    grace_sec: int | None = None
    owner_live: bool
    lease_generation: int
    exposure_sec: float | None = None
    governor_state: dict[str, Any] | None = None
    you_are_leader: bool | None = None
