import type { GovernorEvent } from "../governor";

/** WEB-010: OS notification only for alert/escalate, only while the tab is hidden.
 *  `notice` stays toast-only (FR-009); TTS events are voice, not a second popup. */
export function wantsSystemNotify(ev: GovernorEvent, hidden: boolean): boolean {
  if (!hidden || ev.kind === "tts") return false;
  return ev.level === "alert" || ev.level === "escalated";
}

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

export function notifyPermission(): NotifyPermission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** Must be called from a user gesture. */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function systemNotify(ev: GovernorEvent): void {
  if (notifyPermission() !== "granted") return;
  try {
    const n = new Notification("PostureCare", {
      body: ev.text,
      icon: "/icon.svg",
      // One slot: a newer alert replaces the old one instead of stacking.
      tag: "posturecare-governor",
      renotify: true,
      requireInteraction: ev.level === "escalated",
    } as NotificationOptions);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* blocked/unsupported — in-page toast + TTS still fire */
  }
}
