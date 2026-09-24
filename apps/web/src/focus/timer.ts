export type FocusMode = "idle" | "focus" | "break";
export type PendingKind = "focus" | "break";
export type TimerEvent = "focus_complete" | "break_complete";

export type TimerState = {
  mode: FocusMode;
  running: boolean;
  remainingSec: number;
  focusMinutes: number;
  breakMinutes: number;
  pendingKind: PendingKind;
  sessionsCompleted: number;
};

export function initialTimer(focusMinutes: number, breakMinutes: number): TimerState {
  return {
    mode: "idle",
    running: false,
    remainingSec: 0,
    focusMinutes,
    breakMinutes,
    pendingKind: "focus",
    sessionsCompleted: 0,
  };
}

export function startTimer(state: TimerState): TimerState {
  const minutes = state.pendingKind === "focus" ? state.focusMinutes : state.breakMinutes;
  return { ...state, mode: state.pendingKind, running: true, remainingSec: minutes * 60 };
}

/** UC-F04: governor-triggered break. No-op unless the timer is idle (never cuts off a running Focus). */
export function startBreakFromGovernor(state: TimerState): TimerState {
  if (state.mode !== "idle") return state;
  return { ...state, mode: "break", running: true, remainingSec: state.breakMinutes * 60, pendingKind: "focus" };
}

export function pauseTimer(state: TimerState): TimerState {
  if (state.mode === "idle") return state;
  return { ...state, running: false };
}

export function resumeTimer(state: TimerState): TimerState {
  if (state.mode === "idle") return state;
  return { ...state, running: true };
}

export function resetTimer(state: TimerState): { state: TimerState; wasBreak: boolean } {
  return {
    state: { ...state, mode: "idle", running: false, remainingSec: 0, pendingKind: "focus" },
    wasBreak: state.mode === "break",
  };
}

/** E1 (UC-F02): applying a preset while running only affects the next Start. */
export function applyPreset(state: TimerState, kind: PendingKind, minutes: number): TimerState {
  const next = kind === "focus" ? { ...state, focusMinutes: minutes } : { ...state, breakMinutes: minutes };
  next.pendingKind = kind;
  if (state.mode === "idle") next.remainingSec = minutes * 60;
  return next;
}

export function tick(state: TimerState, deltaSec: number): { state: TimerState; events: TimerEvent[] } {
  if (state.mode === "idle" || !state.running) return { state, events: [] };
  const remaining = state.remainingSec - deltaSec;
  if (remaining > 0) return { state: { ...state, remainingSec: remaining }, events: [] };
  if (state.mode === "focus") {
    return {
      state: {
        ...state,
        mode: "break",
        running: true,
        remainingSec: state.breakMinutes * 60,
        pendingKind: "focus",
        sessionsCompleted: state.sessionsCompleted + 1,
      },
      events: ["focus_complete"],
    };
  }
  return {
    state: { ...state, mode: "idle", running: false, remainingSec: 0, pendingKind: "focus" },
    events: ["break_complete"],
  };
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
