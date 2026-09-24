from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException

from deps import device_token_header, get_store, raise_lease, session_view
from schemas import ActionBody, HeartbeatBody, ReadingsBody, TabBody
from session_sm import Reading
from store import LeaseError, Store

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("/start")
def start_session(body: TabBody, store: Store = Depends(get_store), token: str = Depends(device_token_header)):
    session = store.start(token, body.tab_id)
    now = time.time()
    from session_sm import apply_grace, owner_live, tick

    tick(session, now)
    apply_grace(session, now)
    you = session.owner_tab_id == body.tab_id
    return session_view(session, now, include_id=True, you_are_leader=you) | {
        "session_id": session.id,
        "owner_live": owner_live(session, now),
    }


@router.get("/{session_id}")
def get_session(session_id: str, store: Store = Depends(get_store), token: str = Depends(device_token_header)):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    if session.device_token != token:
        raise HTTPException(status_code=403, detail="forbidden")
    now = time.time()
    from session_sm import tick

    tick(session, now)
    return session_view(session, now, include_id=True)


@router.post("/{session_id}/takeover")
def takeover(
    session_id: str,
    body: TabBody,
    store: Store = Depends(get_store),
    token: str = Depends(device_token_header),
):
    try:
        session, you = store.takeover(session_id, token, body.tab_id)
    except LeaseError as err:
        raise_lease(err)
    now = time.time()
    return session_view(session, now, include_id=True, you_are_leader=you)


@router.post("/{session_id}/heartbeat")
def heartbeat(
    session_id: str,
    body: HeartbeatBody,
    store: Store = Depends(get_store),
    token: str = Depends(device_token_header),
):
    try:
        session = store.heartbeat(
            session_id,
            token,
            body.tab_id,
            body.lease_generation,
            body.face_present,
            body.governor_state,
        )
    except LeaseError as err:
        raise_lease(err)
    return session_view(session, time.time(), include_id=True)


@router.post("/{session_id}/stop")
def stop_session(
    session_id: str,
    body: TabBody,
    store: Store = Depends(get_store),
    token: str = Depends(device_token_header),
):
    try:
        session = store.stop(session_id, token)
    except LeaseError as err:
        raise_lease(err)
    return {"state": session.state}


@router.post("/{session_id}/readings", status_code=204)
def post_readings(
    session_id: str,
    body: ReadingsBody,
    store: Store = Depends(get_store),
    token: str = Depends(device_token_header),
):
    items = [
        Reading(
            ts=item.ts,
            pitch=item.pitch,
            yaw=item.yaw,
            roll=item.roll,
            distance_cm=item.distance_cm,
            ear=item.ear,
            blink_count=item.blink_count,
            face_present=item.face_present,
            flags=list(item.flags),
        )
        for item in body.readings
    ]
    try:
        store.add_readings(session_id, token, items)
    except LeaseError as err:
        raise_lease(err)
    return None


@router.post("/{session_id}/actions")
def post_action(
    session_id: str,
    body: ActionBody,
    store: Store = Depends(get_store),
    token: str = Depends(device_token_header),
):
    try:
        session = store.action(session_id, token, body.tab_id, body.lease_generation, body.type)
    except LeaseError as err:
        raise_lease(err)
    return {"governor_state": dict(session.governor), "state": session.state}
