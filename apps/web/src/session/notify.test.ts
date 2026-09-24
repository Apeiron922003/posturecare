import { describe, expect, it } from "vitest";
import { wantsSystemNotify } from "./notify";

describe("wantsSystemNotify (WEB-010)", () => {
  it("never while the tab is visible — the in-page toast is enough", () => {
    expect(wantsSystemNotify({ kind: "toast", text: "x", level: "alert" }, false)).toBe(false);
  });

  it("alert and escalate reach the OS when hidden", () => {
    expect(wantsSystemNotify({ kind: "toast", text: "x", level: "alert" }, true)).toBe(true);
    expect(wantsSystemNotify({ kind: "escalate", text: "x", level: "escalated" }, true)).toBe(true);
  });

  it("notice stays toast-only; tts is not duplicated as a popup", () => {
    expect(wantsSystemNotify({ kind: "toast", text: "x", level: "notice" }, true)).toBe(false);
    expect(wantsSystemNotify({ kind: "tts", text: "x", level: "alert" }, true)).toBe(false);
  });
});
