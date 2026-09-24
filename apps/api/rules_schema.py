from __future__ import annotations

from typing import Any

from constants import DEFAULT_RULES, RULE_BOUNDS


class RulesError(ValueError):
    pass


def validate_rules(payload: dict[str, Any]) -> dict[str, Any]:
    unknown = [k for k in payload if k not in DEFAULT_RULES]
    if unknown:
        raise RulesError(f"unknown keys: {unknown}")
    out: dict[str, Any] = {}
    for key, value in payload.items():
        if key == "demo_mode":
            if not isinstance(value, bool):
                raise RulesError("demo_mode must be boolean")
            out[key] = value
            continue
        if key not in RULE_BOUNDS:
            continue
        lo, hi = RULE_BOUNDS[key]
        try:
            num = float(value)
        except (TypeError, ValueError) as exc:
            raise RulesError(f"{key} must be numeric") from exc
        if num < lo or num > hi:
            raise RulesError(f"{key} out of bounds [{lo}, {hi}]")
        out[key] = int(num) if key.endswith("_min") or key.endswith("_sec") or key.endswith("_cm") or key.endswith("_deg") or key.endswith("_per_min") else num
        if key in (
            "pitch_threshold_deg",
            "yaw_threshold_deg",
            "roll_threshold_deg",
            "distance_near_cm",
            "distance_far_cm",
            "distance_critical_cm",
            "hold_danger_sec",
            "hold_notice_sec",
            "hold_too_close_sec",
            "low_blink_rate_per_min",
            "sit_suggest_break_min",
        ):
            out[key] = int(num) if float(num).is_integer() else num
    merged = {**DEFAULT_RULES, **out}
    if merged["distance_near_cm"] >= merged["distance_far_cm"]:
        raise RulesError("distance_near_cm must be < distance_far_cm")
    if merged["distance_critical_cm"] > merged["distance_near_cm"]:
        raise RulesError("distance_critical_cm must be <= distance_near_cm")
    return out
