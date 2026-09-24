import { PITCH_SIGN, POSE_LANDMARKS } from "./constants";

export type Landmark = { x: number; y: number; z?: number };
export type Pose = { pitch: number; yaw: number; roll: number };

const RAD2DEG = 180 / Math.PI;

/** Euler from FaceLandmarker 4x4 column-major matrix. Behavioural equivalent, not solvePnP 1:1. */
export function eulerFromMatrix(m: ArrayLike<number>): Pose {
  const r00 = m[0];
  const r10 = m[1];
  const r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];
  const pitch = Math.atan2(-r20, Math.hypot(r21, r22)) * RAD2DEG * PITCH_SIGN;
  const yaw = Math.atan2(r10, r00) * RAD2DEG;
  const rollMat = Math.atan2(m[4], m[5]) * RAD2DEG;
  return { pitch, yaw, roll: rollMat };
}

export function rollFromEyes(landmarks: Landmark[], width: number, height: number): number {
  const l = landmarks[POSE_LANDMARKS.leftEyeOuter];
  const r = landmarks[POSE_LANDMARKS.rightEyeOuter];
  if (!l || !r) return 0;
  return Math.atan2((r.y - l.y) * height, (r.x - l.x) * width) * RAD2DEG;
}

export function relativePose(current: Pose, reference: Pose | null): Pose {
  if (!reference) return { ...current };
  return {
    pitch: current.pitch - reference.pitch,
    yaw: current.yaw - reference.yaw,
    roll: current.roll - reference.roll,
  };
}

export function poseFromDetection(
  landmarks: Landmark[] | undefined,
  matrix: ArrayLike<number> | undefined,
  width: number,
  height: number,
  reference: Pose | null,
): Pose | null {
  if (!landmarks || !matrix) return null;
  const raw = eulerFromMatrix(matrix);
  raw.roll = rollFromEyes(landmarks, width, height);
  return relativePose(raw, reference);
}
