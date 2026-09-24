import {
  DISTANCE_EMA_ALPHA_NEW,
  DISTANCE_EMA_ALPHA_OLD,
  DISTANCE_K0,
  POSE_LANDMARKS,
} from "./constants";
import type { Landmark } from "./pose";

export function ipdPx(landmarks: Landmark[], width: number, height: number): number | null {
  const l = landmarks[POSE_LANDMARKS.leftEyeOuter];
  const r = landmarks[POSE_LANDMARKS.rightEyeOuter];
  if (!l || !r) return null;
  const dx = (l.x - r.x) * width;
  const dy = (l.y - r.y) * height;
  const d = Math.hypot(dx, dy);
  return d > 0 ? d : null;
}

export function distanceFromIpd(ipd: number | null, k: number): number | null {
  if (ipd === null || ipd <= 0) return null;
  return k / ipd;
}

/** Null ≠ 0: missing face or missing previous sample does not blend with 0. */
export function emaDistance(raw: number | null, prev: number | null): number | null {
  if (prev === null || raw === null) return raw;
  return DISTANCE_EMA_ALPHA_NEW * raw + DISTANCE_EMA_ALPHA_OLD * prev;
}

export function defaultK(): number {
  return DISTANCE_K0;
}
