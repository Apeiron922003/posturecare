import { describe, expect, it } from "vitest";
import { emaDistance } from "./distance";
import { poseFromDetection, relativePose } from "./pose";

describe("emaDistance", () => {
  it("does not blend null with zero", () => {
    expect(emaDistance(null, 40)).toBeNull();
    expect(emaDistance(50, null)).toBe(50);
    expect(emaDistance(80, 40)).toBe(0.75 * 80 + 0.25 * 40);
  });
});

describe("relative pose", () => {
  it("zeros after calibration reference", () => {
    const r = { pitch: 10, yaw: 4, roll: -2 };
    expect(relativePose(r, r)).toEqual({ pitch: 0, yaw: 0, roll: 0 });
  });
});

describe("poseFromDetection null without face", () => {
  it("returns null", () => {
    expect(poseFromDetection(undefined, undefined, 1280, 720, null)).toBeNull();
  });
});
