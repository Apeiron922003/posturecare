from __future__ import annotations

import math
import time

from fastapi import APIRouter, Depends, HTTPException

from constants import REPORT_BUCKET_SEC, REPORT_WINDOW_SEC
from deps import device_token_header, get_store
from store import Store

router = APIRouter(prefix="/api/sessions", tags=["reports"])


@router.get("/{session_id}/report")
def session_report(
    session_id: str,
    store: Store = Depends(get_store),
    token: str = Depends(device_token_header),
):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    if session.device_token != token:
        raise HTTPException(status_code=403, detail="forbidden")

    now = time.time()
    window_start = now - REPORT_WINDOW_SEC
    flag_dur: dict[str, float] = {}
    blink_count = 0
    buckets: dict[int, dict[str, float | int]] = {}

    prev_ts = None
    for reading in session.readings:
        if reading.ts < window_start:
            continue
        blink_count += reading.blink_count
        dt = 0.0 if prev_ts is None else max(0.0, reading.ts - prev_ts)
        prev_ts = reading.ts
        for flag in reading.flags:
            flag_dur[flag] = flag_dur.get(flag, 0.0) + dt
        idx = int(math.floor((reading.ts - window_start) / REPORT_BUCKET_SEC))
        bucket = buckets.setdefault(idx, {"t": window_start + idx * REPORT_BUCKET_SEC, "n": 0, "flags": 0})
        bucket["n"] = int(bucket["n"]) + 1
        bucket["flags"] = int(bucket["flags"]) + len(reading.flags)

    timeline = [buckets[i] for i in sorted(buckets)]
    return {
        "session_id": session.id,
        "state": session.state,
        "exposure_sec": session.exposure_sec,
        "flag_durations_sec": flag_dur,
        "blink_count": blink_count,
        "timeline_window_sec": REPORT_WINDOW_SEC,
        "timeline_bucket_sec": REPORT_BUCKET_SEC,
        "timeline": timeline,
    }
