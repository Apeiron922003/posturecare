import { describe, expect, it } from "vitest";
import {
  applyPreset,
  initialTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startBreakFromGovernor,
  startTimer,
  tick,
} from "./timer";

describe("timer", () => {
  it("Start Focus then auto-transitions to Break at zero", () => {
    let s = startTimer(initialTimer(25, 5));
    expect(s.mode).toBe("focus");
    expect(s.remainingSec).toBe(25 * 60);
    const r = tick(s, 25 * 60);
    expect(r.events).toEqual(["focus_complete"]);
    expect(r.state.mode).toBe("break");
    expect(r.state.remainingSec).toBe(5 * 60);
    expect(r.state.sessionsCompleted).toBe(1);
  });

  it("Break completes back to idle", () => {
    let s = startTimer({ ...initialTimer(25, 5), pendingKind: "break" });
    const r = tick(s, 5 * 60);
    expect(r.events).toEqual(["break_complete"]);
    expect(r.state.mode).toBe("idle");
  });

  it("pause then resume preserves remainingSec, does not jump", () => {
    let s = startTimer(initialTimer(25, 5));
    s = tick(s, 15 * 60).state; // 10:00 left
    expect(s.remainingSec).toBe(10 * 60);
    s = pauseTimer(s);
    const ticked = tick(s, 60); // paused: tick must not advance
    expect(ticked.state.remainingSec).toBe(10 * 60);
    s = resumeTimer(ticked.state);
    s = tick(s, 60).state;
    expect(s.remainingSec).toBe(9 * 60);
  });

  it("preset while running only applies to the next Start (E1)", () => {
    let s = startTimer(initialTimer(25, 5));
    const before = s.remainingSec;
    s = applyPreset(s, "focus", 50);
    expect(s.remainingSec).toBe(before);
    expect(s.focusMinutes).toBe(50);
  });

  it("preset while idle updates the displayed countdown immediately", () => {
    const s = applyPreset(initialTimer(25, 5), "break", 15);
    expect(s.remainingSec).toBe(15 * 60);
    expect(s.pendingKind).toBe("break");
  });

  it("reset reports wasBreak so the caller can sync the tracking session", () => {
    let s = startTimer({ ...initialTimer(25, 5), pendingKind: "break" });
    const { state, wasBreak } = resetTimer(s);
    expect(wasBreak).toBe(true);
    expect(state.mode).toBe("idle");
  });

  it("governor break never cuts off a running Focus (BRULE-F002)", () => {
    const running = startTimer(initialTimer(25, 5));
    const untouched = startBreakFromGovernor(running);
    expect(untouched).toBe(running);
  });

  it("governor break starts the Pomodoro break only when idle", () => {
    const idle = initialTimer(25, 5);
    const started = startBreakFromGovernor(idle);
    expect(started.mode).toBe("break");
    expect(started.running).toBe(true);
  });
});
