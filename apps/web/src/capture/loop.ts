import { every } from "./ticker";

/** Sampling period while the tab is hidden. Holds are wall-clock based (15 s / 60 s),
 *  so a lower rate does not change when a flag qualifies — only CPU cost. */
export const HIDDEN_TICK_MS = 200;

/** Visible: one tick per animation frame. Hidden: worker-driven ticks (rAF is paused). */
export function startFrameLoop(tick: () => void): () => void {
  let raf = 0;
  let stopTimer: (() => void) | null = null;
  let stopped = false;

  const onRaf = () => {
    if (stopped) return;
    raf = requestAnimationFrame(onRaf);
    tick();
  };
  const apply = () => {
    cancelAnimationFrame(raf);
    stopTimer?.();
    stopTimer = null;
    if (stopped) return;
    if (document.hidden) stopTimer = every(HIDDEN_TICK_MS, tick);
    else raf = requestAnimationFrame(onRaf);
  };

  document.addEventListener("visibilitychange", apply);
  apply();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", apply);
    cancelAnimationFrame(raf);
    stopTimer?.();
  };
}
