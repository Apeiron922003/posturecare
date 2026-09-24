import {
  DISTANCE_CRITICAL_CM,
  DISTANCE_FAR_CM,
  DISTANCE_NEAR_CM,
  HOLD_DANGER_SEC,
  HOLD_FACE_LOST_RESET_MS,
  HOLD_NOTICE_SEC,
  HOLD_TOO_CLOSE_SEC,
  LOW_BLINK_RATE_PER_MIN,
  PITCH_THRESHOLD_DEG,
  ROLL_THRESHOLD_DEG,
  YAW_THRESHOLD_DEG,
} from "../signals/constants";
import type { Signals } from "../signals";

export type Rules = {
  pitch_threshold_deg: number;
  yaw_threshold_deg: number;
  roll_threshold_deg: number;
  distance_near_cm: number;
  distance_far_cm: number;
  distance_critical_cm: number;
  hold_danger_sec: number;
  hold_notice_sec: number;
  hold_too_close_sec: number;
  low_blink_rate_per_min: number;
  sit_suggest_break_min: number;
  demo_mode: boolean;
};

export const defaultRules = (): Rules => ({
  pitch_threshold_deg: PITCH_THRESHOLD_DEG,
  yaw_threshold_deg: YAW_THRESHOLD_DEG,
  roll_threshold_deg: ROLL_THRESHOLD_DEG,
  distance_near_cm: DISTANCE_NEAR_CM,
  distance_far_cm: DISTANCE_FAR_CM,
  distance_critical_cm: DISTANCE_CRITICAL_CM,
  hold_danger_sec: HOLD_DANGER_SEC,
  hold_notice_sec: HOLD_NOTICE_SEC,
  hold_too_close_sec: HOLD_TOO_CLOSE_SEC,
  low_blink_rate_per_min: LOW_BLINK_RATE_PER_MIN,
  sit_suggest_break_min: 20,
  demo_mode: false,
});

export type AtomicFlags = Record<string, boolean>;

export function atomicFlags(s: Signals, rules: Rules): AtomicFlags {
  const out: AtomicFlags = {
    critically_close: false,
    too_close: false,
    too_far: false,
    head_too_low: false,
    head_too_high: false,
    head_tilted: false,
    head_turned: false,
    low_blink_rate: false,
  };
  if (!s.face_present) return out;
  if (s.distance_cm !== null) {
    if (s.distance_cm < rules.distance_critical_cm) {
      out.critically_close = true;
      out.too_close = true;
    } else if (s.distance_cm < rules.distance_near_cm) {
      out.too_close = true;
    } else if (s.distance_cm > rules.distance_far_cm) {
      out.too_far = true;
    }
  }
  if (s.pitch !== null) {
    if (s.pitch > rules.pitch_threshold_deg) out.head_too_low = true;
    if (s.pitch < -rules.pitch_threshold_deg) out.head_too_high = true;
  }
  if (s.roll !== null && Math.abs(s.roll) > rules.roll_threshold_deg) out.head_tilted = true;
  if (s.yaw !== null && Math.abs(s.yaw) > rules.yaw_threshold_deg) out.head_turned = true;
  if (s.blink_rate < rules.low_blink_rate_per_min) out.low_blink_rate = true;
  return out;
}

const HOLD_FOR: Record<string, keyof Rules> = {
  critically_close: "hold_danger_sec",
  too_close: "hold_too_close_sec",
  too_far: "hold_notice_sec",
  head_too_low: "hold_danger_sec",
  head_too_high: "hold_danger_sec",
  head_tilted: "hold_danger_sec",
  head_turned: "hold_notice_sec",
  low_blink_rate: "hold_notice_sec",
};

export class HoldTracker {
  private started: Record<string, number | null> = {};
  private qualified = new Set<string>();
  private lostSince: number | null = null;

  resetHolds(): void {
    this.started = {};
    this.qualified.clear();
  }

  update(facePresent: boolean, atomic: AtomicFlags, rules: Rules, nowMs: number): string[] {
    if (!facePresent) {
      if (this.lostSince === null) this.lostSince = nowMs;
      if (nowMs - this.lostSince >= HOLD_FACE_LOST_RESET_MS) this.resetHolds();
      return [...this.qualified];
    }
    this.lostSince = null;
    for (const flag of Object.keys(HOLD_FOR)) {
      const on = atomic[flag];
      const key = HOLD_FOR[flag];
      const need = (rules[key] as number) * 1000;
      if (on) {
        if (this.started[flag] == null) this.started[flag] = nowMs;
        if (nowMs - (this.started[flag] as number) >= need) this.qualified.add(flag);
      } else {
        this.started[flag] = null;
        this.qualified.delete(flag);
      }
    }
    return [...this.qualified];
  }
}
