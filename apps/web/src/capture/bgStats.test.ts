import { describe, expect, it } from "vitest";
import { BgMonitor } from "./bgStats";

describe("BgMonitor", () => {
  it("ignores ticks while visible", () => {
    const m = new BgMonitor();
    m.tick(0, 0);
    m.heartbeat(0);
    expect(m.summary(10).ticks).toBe(0);
  });

  it("summarises one hidden stretch: gaps, stale frames, heartbeat gaps", () => {
    const m = new BgMonitor();
    expect(m.setHidden(true, 1000)).toBeNull();
    m.tick(1000, 1.0);
    m.tick(1200, 1.2);
    m.tick(2200, 1.2); // same video time → stale
    m.heartbeat(1000);
    m.heartbeat(3000);
    m.heartbeat(9000);
    const s = m.setHidden(false, 10000)!;
    expect(s).toEqual({
      hidden_ms: 9000,
      ticks: 3,
      gap_avg_ms: 600,
      gap_max_ms: 1000,
      stale_frames: 1,
      heartbeats: 3,
      hb_gap_max_ms: 6000,
    });
  });

  it("resets counters on the next hide", () => {
    const m = new BgMonitor();
    m.setHidden(true, 0);
    m.tick(0, 0);
    m.tick(100, 0.1);
    m.setHidden(false, 200);
    m.setHidden(true, 300);
    const s = m.setHidden(false, 400)!;
    expect(s.ticks).toBe(0);
    expect(s.gap_avg_ms).toBeNull();
  });
});
