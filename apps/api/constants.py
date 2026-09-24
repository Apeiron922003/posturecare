GRACE_SEC = 20
HEARTBEAT_INTERVAL_SEC = 2
OWNER_LIVE_TIMEOUT_SEC = 6
HEARTBEAT_TIMEOUT_SEC = 30
FACE_LOST_TO_AWAY_SEC = 30
AWAY_RESET_EXPOSURE_SEC = 180
AWAY_CLOSE_SESSION_SEC = 900
SNOOZE_SEC = 600

DEFAULT_RULES = {
    "pitch_threshold_deg": 5,
    "yaw_threshold_deg": 20,
    "roll_threshold_deg": 15,
    "distance_near_cm": 50,
    "distance_far_cm": 70,
    "distance_critical_cm": 30,
    "hold_danger_sec": 15,
    "hold_notice_sec": 60,
    "hold_too_close_sec": 60,
    "low_blink_rate_per_min": 6,
    "sit_suggest_break_min": 20,
    "demo_mode": False,
}

RULE_BOUNDS = {
    "pitch_threshold_deg": (1, 30),
    "yaw_threshold_deg": (5, 60),
    "roll_threshold_deg": (5, 45),
    "distance_near_cm": (20, 100),
    "distance_far_cm": (50, 150),
    "distance_critical_cm": (10, 100),
    "hold_danger_sec": (3, 120),
    "hold_notice_sec": (10, 300),
    "hold_too_close_sec": (10, 300),
    "low_blink_rate_per_min": (1, 20),
    "sit_suggest_break_min": (5, 120),
}

ACTIVE_STATES = ("calibrating", "monitoring", "away", "break")
REPORT_WINDOW_SEC = 600
REPORT_BUCKET_SEC = 10

# Raw readings are kept 30 days, then deleted (decision 2026-09-24, plan §7).
READINGS_RETENTION_SEC = 30 * 24 * 3600
RETENTION_SWEEP_SEC = 3600

# Abuse limits for the public API (B6). A normal leader tab sends ~30 heartbeats +
# ~40 readings batches per minute; the per-token cap leaves headroom for takeovers.
RATE_LIMIT_WINDOW_SEC = 60
RATE_LIMIT_PER_TOKEN = 300
RATE_LIMIT_START_PER_CLIENT = 30
MAX_READINGS_PER_BATCH = 50
MAX_ID_LEN = 128
