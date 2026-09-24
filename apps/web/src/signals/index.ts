import type { Pose } from "./pose";

export type Signals = {
  face_present: boolean;
  pitch: number | null;
  yaw: number | null;
  roll: number | null;
  distance_cm: number | null;
  ear: number | null;
  blink_count: number;
  blink_rate: number;
};

export function emptySignals(): Signals {
  return {
    face_present: false,
    pitch: null,
    yaw: null,
    roll: null,
    distance_cm: null,
    ear: null,
    blink_count: 0,
    blink_rate: 0,
  };
}

export function withPose(base: Signals, pose: Pose | null): Signals {
  if (!pose) {
    return { ...base, pitch: null, yaw: null, roll: null };
  }
  return { ...base, pitch: pose.pitch, yaw: pose.yaw, roll: pose.roll };
}
