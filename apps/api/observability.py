from __future__ import annotations

import os
from typing import Any

SCRUB_HEADERS = {"x-device-token", "cookie", "authorization", "x-posturecare-client-ip"}


def _scrub(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any]:
    req = event.get("request") or {}
    headers = req.get("headers") or {}
    for k in list(headers):
        if k.lower() in SCRUB_HEADERS:
            headers[k] = "[scrubbed]"
    # Readings (angles, cm, EAR) are personal data; never ship request bodies.
    req.pop("data", None)
    req.pop("cookies", None)
    event.pop("user", None)
    return event


def init_sentry() -> bool:
    """B5: error reporting only when SENTRY_DSN is set. No PII, no bodies, no tracing."""
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        send_default_pii=False,
        max_request_body_size="never",
        traces_sample_rate=0.0,
        before_send=_scrub,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
    )
    return True
