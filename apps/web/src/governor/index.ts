import {
  ALERT_BACKOFF_FIRST_SEC,
  ALERT_BACKOFF_SECOND_SEC,
  ALERT_MIN_NOTICE_FLAGS,
  DANGER_FLAGS,
  ESCALATE_AFTER_SEC,
  NOTICE_FLAGS,
} from "../signals/constants";
import viSpoken from "./mock_spoken.vi.json";
import enSpoken from "./mock_spoken.en.json";

export type HudLevel = "normal" | "notice" | "alert" | "escalated";

export type GovernorSnapshot = {
  dnd: boolean;
  snooze_until: number | null;
  escalated_at: number | null;
  backoff_stage: number;
  last_alert_at: number | null;
  break_suggested: boolean;
};

export type GovernorEvent = {
  kind: "toast" | "tts" | "escalate";
  text: string;
  level: HudLevel;
};

export function spoken(lang: "vi" | "en", key: string): string {
  const table = lang === "en" ? enSpoken : viSpoken;
  return (table as Record<string, string>)[key] ?? key;
}

export function pickPhrase(lang: "vi" | "en", flags: string[]): string {
  const order = [
    "critically_close",
    "too_close",
    "head_too_low",
    "head_too_high",
    "head_tilted",
    "head_turned",
    "too_far",
    "low_blink_rate",
  ];
  const key = order.find((f) => flags.includes(f));
  return spoken(lang, key ?? "too_close");
}

export function classify(flags: string[]): HudLevel {
  const danger = flags.filter((f) => (DANGER_FLAGS as readonly string[]).includes(f));
  const notice = flags.filter((f) => (NOTICE_FLAGS as readonly string[]).includes(f));
  if (danger.length || flags.includes("too_close") || notice.length >= ALERT_MIN_NOTICE_FLAGS) {
    return "alert";
  }
  if (notice.length) return "notice";
  return "normal";
}

export function tickGovernor(opts: {
  flags: string[];
  sessionState: string;
  nowSec: number;
  snap: GovernorSnapshot;
  lang: "vi" | "en";
  voiceOn: boolean;
}): { snap: GovernorSnapshot; level: HudLevel; events: GovernorEvent[] } {
  const { flags, sessionState, nowSec, lang, voiceOn } = opts;
  const snap = { ...opts.snap };
  const events: GovernorEvent[] = [];
  if (
    sessionState !== "monitoring" ||
    snap.dnd ||
    (snap.snooze_until != null && nowSec < snap.snooze_until)
  ) {
    return { snap, level: snap.escalated_at ? "escalated" : "normal", events };
  }
  let level = classify(flags);
  if (level === "normal") {
    snap.escalated_at = null;
    return { snap, level, events };
  }
  if (level === "alert") {
    if (snap.escalated_at == null) {
      // start / continue alert clock via last_alert_at
    }
    const started = snap.last_alert_at ?? nowSec;
    if (snap.last_alert_at == null) snap.last_alert_at = nowSec;
    if (nowSec - started >= ESCALATE_AFTER_SEC) {
      if (snap.escalated_at == null) {
        snap.escalated_at = nowSec;
        events.push({ kind: "escalate", text: spoken(lang, "escalate"), level: "escalated" });
      }
      level = "escalated";
    }
    const backoff = snap.backoff_stage === 0 ? 0 : snap.backoff_stage === 1 ? ALERT_BACKOFF_FIRST_SEC : ALERT_BACKOFF_SECOND_SEC;
    const due = snap.last_alert_at == null || nowSec - snap.last_alert_at >= backoff || events.some((e) => e.kind === "escalate");
    if (due && level !== "escalated") {
      const text = pickPhrase(lang, flags);
      events.push({ kind: "toast", text, level: "alert" });
      if (voiceOn) events.push({ kind: "tts", text, level: "alert" });
      snap.last_alert_at = nowSec;
      snap.backoff_stage = Math.min(2, snap.backoff_stage + 1);
    } else if (due && level === "escalated") {
      const text = spoken(lang, "escalate");
      events.push({ kind: "toast", text, level: "escalated" });
    }
  } else {
    snap.last_alert_at = snap.last_alert_at ?? nowSec;
    if (snap.backoff_stage === 0) {
      const text = pickPhrase(lang, flags);
      events.push({ kind: "toast", text, level: "notice" });
      snap.backoff_stage = 1;
      snap.last_alert_at = nowSec;
    }
  }
  return { snap, level, events };
}

export function emptyGovernor(): GovernorSnapshot {
  return {
    dnd: false,
    snooze_until: null,
    escalated_at: null,
    backoff_stage: 0,
    last_alert_at: null,
    break_suggested: false,
  };
}
