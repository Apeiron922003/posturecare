from __future__ import annotations

from typing import Any

from fastapi import Header, HTTPException, Request

from constants import MAX_ID_LEN
from session_sm import Session
from store import LeaseError, Store


def device_token_header(x_device_token: str | None = Header(default=None, alias="X-Device-Token")) -> str:
    if not x_device_token or not x_device_token.strip():
        raise HTTPException(status_code=401, detail="X-Device-Token required")
    token = x_device_token.strip()
    if len(token) > MAX_ID_LEN:
        raise HTTPException(status_code=400, detail="X-Device-Token too long")
    return token


def get_store(request: Request) -> Store:
    return request.app.state.store


def session_view(session: Session, now: float, *, include_id: bool = False, you_are_leader: bool | None = None) -> dict[str, Any]:
    from session_sm import owner_live

    body: dict[str, Any] = {
        "state": session.state,
        "owner_live": owner_live(session, now),
        "lease_generation": session.lease_generation,
        "exposure_sec": session.exposure_sec,
        "governor_state": dict(session.governor),
        "grace_sec": session.grace_sec,
    }
    if include_id:
        body["session_id"] = session.id
    if you_are_leader is not None:
        body["you_are_leader"] = you_are_leader
    return body


def raise_lease(err: LeaseError) -> None:
    raise HTTPException(status_code=err.status, detail=err.detail)
