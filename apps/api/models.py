from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, Boolean, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class SessionRow(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        UniqueConstraint("id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    device_token: Mapped[str] = mapped_column(String, index=True)
    state: Mapped[str] = mapped_column(String, index=True)
    started_at: Mapped[float] = mapped_column(Float)
    grace_sec: Mapped[int] = mapped_column(Integer, default=20)
    lease_generation: Mapped[int] = mapped_column(Integer, default=1)
    owner_tab_id: Mapped[str | None] = mapped_column(String, nullable=True)
    last_seen: Mapped[float] = mapped_column(Float, default=0)
    last_face_present: Mapped[bool] = mapped_column(Boolean, default=False)
    face_lost_since: Mapped[float | None] = mapped_column(Float, nullable=True)
    away_since: Mapped[float | None] = mapped_column(Float, nullable=True)
    exposure_reset_done: Mapped[bool] = mapped_column(Boolean, default=False)
    exposure_sec: Mapped[float] = mapped_column(Float, default=0)
    governor: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class ReadingRow(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    ts: Mapped[float] = mapped_column(Float, index=True)
    pitch: Mapped[float | None] = mapped_column(Float, nullable=True)
    yaw: Mapped[float | None] = mapped_column(Float, nullable=True)
    roll: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    ear: Mapped[float | None] = mapped_column(Float, nullable=True)
    blink_count: Mapped[int] = mapped_column(Integer, default=0)
    face_present: Mapped[bool] = mapped_column(Boolean, default=False)
    flags: Mapped[list[str]] = mapped_column(JSON, default=list)


class RulesRow(Base):
    __tablename__ = "device_rules"

    device_token: Mapped[str] = mapped_column(String, primary_key=True)
    rules: Mapped[dict[str, Any]] = mapped_column(JSON)
