// Q-15: measure what the browser actually does to capture + heartbeat while the tab
// is hidden, instead of assuming. Numbers are per hidden stretch, reset on hide.

export type BgSummary = {
  hidden_ms: number;
  ticks: number;
  gap_avg_ms: number | null;
  gap_max_ms: number | null;
  stale_frames: number;
  heartbeats: number;
  hb_gap_max_ms: number | null;
};

export class BgMonitor {
  private hiddenSince: number | null = null;
  private lastEnd = 0;
  private ticks = 0;
  private lastTick: number | null = null;
  private gapSum = 0;
  private gapMax = 0;
  private stale = 0;
  private lastVideoTime: number | null = null;
  private hb = 0;
  private lastHb: number | null = null;
  private hbGapMax = 0;

  setHidden(hidden: boolean, now: number): BgSummary | null {
    if (hidden && this.hiddenSince === null) {
      this.hiddenSince = now;
      this.ticks = this.gapSum = this.gapMax = this.stale = this.hb = this.hbGapMax = 0;
      this.lastTick = this.lastHb = this.lastVideoTime = null;
      return null;
    }
    if (!hidden && this.hiddenSince !== null) {
      this.lastEnd = now;
      const s = this.summary(now);
      this.hiddenSince = null;
      return s;
    }
    return null;
  }

  tick(now: number, videoTime: number | null): void {
    if (this.hiddenSince === null) return;
    this.ticks += 1;
    if (this.lastTick !== null) {
      const gap = now - this.lastTick;
      this.gapSum += gap;
      this.gapMax = Math.max(this.gapMax, gap);
    }
    this.lastTick = now;
    if (videoTime !== null && this.lastVideoTime !== null && videoTime === this.lastVideoTime) this.stale += 1;
    this.lastVideoTime = videoTime;
  }

  heartbeat(now: number): void {
    if (this.hiddenSince === null) return;
    this.hb += 1;
    if (this.lastHb !== null) this.hbGapMax = Math.max(this.hbGapMax, now - this.lastHb);
    this.lastHb = now;
  }

  summary(now: number): BgSummary {
    const since = this.hiddenSince;
    return {
      hidden_ms: since === null ? 0 : Math.round(now - since),
      ticks: this.ticks,
      gap_avg_ms: this.ticks > 1 ? Math.round(this.gapSum / (this.ticks - 1)) : null,
      gap_max_ms: this.ticks > 1 ? Math.round(this.gapMax) : null,
      stale_frames: this.stale,
      heartbeats: this.hb,
      hb_gap_max_ms: this.hb > 1 ? Math.round(this.hbGapMax) : null,
    };
  }
}
