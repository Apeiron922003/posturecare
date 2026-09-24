export const POSE_LANDMARKS = {
  nose: 1,
  chin: 152,
  rightEyeOuter: 33,
  leftEyeOuter: 263,
  mouthRight: 61,
  mouthLeft: 291,
};
export const EAR_RIGHT = [33, 159, 158, 133, 153, 145] as const;
export const EAR_LEFT = [362, 380, 374, 263, 386, 385] as const;

export const PITCH_THRESHOLD_DEG = 5;
export const YAW_THRESHOLD_DEG = 20;
export const ROLL_THRESHOLD_DEG = 15;
/** Flip if debug: looking down does not raise head_too_low. Only this axis. */
export const PITCH_SIGN = -1;

export const DISTANCE_NEAR_CM = 50;
export const DISTANCE_FAR_CM = 70;
export const DISTANCE_CRITICAL_CM = 30;
export const DISTANCE_EMA_ALPHA_NEW = 0.75;
export const DISTANCE_EMA_ALPHA_OLD = 0.25;
export const DISTANCE_K0 = 4200;
export const CALIBRATION_DISTANCE_MIN_CM = 10;
export const CALIBRATION_DISTANCE_MAX_CM = 200;
export const CALIBRATION_DISTANCE_DEFAULT_CM = 50;
export const CAPTURE_RESOLUTION = { width: 1280, height: 720 };

export const EAR_BLINK_THRESHOLD = 0.294;
export const EAR_BLINK_MIN_DURATION_MS = 100;
export const LOW_BLINK_RATE_PER_MIN = 6;
export const BLINK_WINDOW_SEC = 60;

export const HOLD_DANGER_SEC = 15;
export const HOLD_NOTICE_SEC = 60;
export const HOLD_TOO_CLOSE_SEC = 60;
export const HOLD_FACE_LOST_RESET_MS = 250;
export const ALERT_MIN_NOTICE_FLAGS = 2;

export const GRACE_SEC = 20;
export const ALERT_BACKOFF_FIRST_SEC = 60;
export const ALERT_BACKOFF_SECOND_SEC = 180;
export const ESCALATE_AFTER_SEC = 300;
export const SNOOZE_SEC = 600;

export const HEARTBEAT_INTERVAL_SEC = 2;
export const OWNER_LIVE_TIMEOUT_SEC = 6;

export const SIT_SUGGEST_BREAK_MIN = 20;
export const SIT_SUGGEST_BREAK_DEMO_MIN = 3;

export const DANGER_FLAGS = [
  "critically_close",
  "head_too_low",
  "head_too_high",
  "head_tilted",
] as const;
export const NOTICE_FLAGS = ["too_far", "head_turned", "low_blink_rate"] as const;
