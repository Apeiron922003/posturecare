import {
  BLINK_WINDOW_SEC,
  EAR_BLINK_MIN_DURATION_MS,
  EAR_BLINK_THRESHOLD,
  EAR_LEFT,
  EAR_RIGHT,
} from "./constants";
import type { Landmark } from "./pose";

function ear(landmarks: Landmark[], idx: readonly number[]): number | null {
  const pts = idx.map((i) => landmarks[i]);
  if (pts.some((p) => !p)) return null;
  const [p1, p2, p3, p4, p5, p6] = pts as Landmark[];
  const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  if (h <= 0) return null;
  return (v1 + v2) / (2 * h);
}

export function meanEar(landmarks: Landmark[]): number | null {
  const a = ear(landmarks, EAR_RIGHT);
  const b = ear(landmarks, EAR_LEFT);
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return (a + b) / 2;
}

export class BlinkTracker {
  private belowSince: number | null = null;
  private open = true;
  count = 0;
  private stamps: number[] = [];

  update(earValue: number | null, nowMs: number): void {
    if (earValue === null) {
      this.belowSince = null;
      this.open = true;
      return;
    }
    if (earValue < EAR_BLINK_THRESHOLD) {
      if (this.belowSince === null) this.belowSince = nowMs;
      if (this.open && nowMs - this.belowSince >= EAR_BLINK_MIN_DURATION_MS) {
        this.open = false;
        this.count += 1;
        this.stamps.push(nowMs);
      }
    } else {
      this.belowSince = null;
      this.open = true;
    }
    const cut = nowMs - BLINK_WINDOW_SEC * 1000;
    this.stamps = this.stamps.filter((t) => t >= cut);
  }

  ratePerMin(nowMs: number): number {
    const cut = nowMs - BLINK_WINDOW_SEC * 1000;
    return this.stamps.filter((t) => t >= cut).length;
  }
}
