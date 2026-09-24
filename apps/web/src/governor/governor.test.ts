import { describe, expect, it } from "vitest";
import { classify, emptyGovernor, tickGovernor } from "./index";

describe("classify", () => {
  it("two notice flags become alert", () => {
    expect(classify(["too_far", "head_turned"])).toBe("alert");
    expect(classify(["too_far"])).toBe("notice");
    expect(classify(["too_close"])).toBe("alert");
    expect(classify(["head_too_low"])).toBe("alert");
  });
});

describe("tickGovernor", () => {
  it("stays silent while calibrating or DND", () => {
    const snap = emptyGovernor();
    const a = tickGovernor({
      flags: ["too_close"],
      sessionState: "calibrating",
      nowSec: 100,
      snap,
      lang: "vi",
      voiceOn: true,
    });
    expect(a.events).toEqual([]);
    snap.dnd = true;
    const b = tickGovernor({
      flags: ["too_close"],
      sessionState: "monitoring",
      nowSec: 100,
      snap,
      lang: "vi",
      voiceOn: true,
    });
    expect(b.events).toEqual([]);
  });
  it("fires one alert toast the first time", () => {
    const r = tickGovernor({
      flags: ["too_close"],
      sessionState: "monitoring",
      nowSec: 50,
      snap: emptyGovernor(),
      lang: "vi",
      voiceOn: true,
    });
    expect(r.events.some((e) => e.kind === "toast")).toBe(true);
    expect(r.events.some((e) => e.kind === "tts")).toBe(true);
  });
});
