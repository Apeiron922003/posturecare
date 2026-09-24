import {
  CALIBRATION_DISTANCE_DEFAULT_CM,
  CALIBRATION_DISTANCE_MAX_CM,
  CALIBRATION_DISTANCE_MIN_CM,
  DISTANCE_K0,
} from "../signals/constants";
import type { Pose } from "../signals/pose";

const POSE_KEY = "posturecare.pose_reference";
const DIST_KEY = "posturecare.distance_cal";

export type DistanceCal = { K: number; width: number; height: number; user_calibrated: boolean };

export function loadPose(): { pose: Pose; user_calibrated: boolean } | null {
  const raw = localStorage.getItem(POSE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { pose: Pose; user_calibrated: boolean };
  } catch {
    return null;
  }
}

export function savePose(pose: Pose, userCalibrated: boolean): void {
  localStorage.setItem(POSE_KEY, JSON.stringify({ pose, user_calibrated: userCalibrated }));
}

export function loadDistance(): DistanceCal {
  const raw = localStorage.getItem(DIST_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DistanceCal;
    } catch {
      /* fallthrough */
    }
  }
  return { K: DISTANCE_K0, width: 0, height: 0, user_calibrated: false };
}

export function saveDistance(cal: DistanceCal): void {
  localStorage.setItem(DIST_KEY, JSON.stringify(cal));
}

export function computeK(knownCm: number, ipd: number): number {
  if (knownCm < CALIBRATION_DISTANCE_MIN_CM || knownCm > CALIBRATION_DISTANCE_MAX_CM) {
    throw new Error("distance out of range");
  }
  if (ipd <= 0) throw new Error("no eyes");
  return knownCm * ipd;
}

export function defaultKnownCm(): number {
  return CALIBRATION_DISTANCE_DEFAULT_CM;
}

export function resolutionMismatch(cal: DistanceCal, width: number, height: number): boolean {
  if (!cal.user_calibrated || !cal.width || !cal.height) return false;
  return cal.width !== width || cal.height !== height;
}
