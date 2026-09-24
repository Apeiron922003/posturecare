import { describe, expect, it } from "vitest";
import { HoldTracker, atomicFlags, defaultRules } from "./index";
import { emptySignals } from "../signals";

describe("atomicFlags", () => {
  const rules = defaultRules();
  it("does not treat null as too close", () => {
    const s = emptySignals();
    s.face_present = false;
    s.distance_cm = null;
    const f = atomicFlags(s, rules);
    expect(f.too_close).toBe(false);
    expect(f.critically_close).toBe(false);
  });
  it("emits both close flags under 30cm", () => {
    const s = emptySignals();
    s.face_present = true;
    s.distance_cm = 25;
    const f = atomicFlags(s, rules);
    expect(f.critically_close).toBe(true);
    expect(f.too_close).toBe(true);
  });
  it("maps positive pitch to head_too_low", () => {
    const s = emptySignals();
    s.face_present = true;
    s.pitch = 8;
    expect(atomicFlags(s, rules).head_too_low).toBe(true);
  });
});

describe("HoldTracker", () => {
  it("qualifies after hold seconds", () => {
    const h = new HoldTracker();
    const rules = defaultRules();
    const atomic = { ...atomicFlags(emptySignals(), rules), head_too_low: true };
    expect(h.update(true, atomic, rules, 0)).toEqual([]);
    expect(h.update(true, atomic, rules, 14_000)).toEqual([]);
    expect(h.update(true, atomic, rules, 15_000)).toContain("head_too_low");
  });
  it("does not reset hold on a 100ms dropout", () => {
    const h = new HoldTracker();
    const rules = defaultRules();
    const on = { ...atomicFlags(emptySignals(), rules), too_far: true };
    h.update(true, on, rules, 0);
    h.update(false, atomicFlags(emptySignals(), rules), rules, 100);
    const q = h.update(true, on, rules, 200);
    expect(q).not.toContain("too_far");
    expect(h.update(true, on, rules, 60_000)).toContain("too_far");
  });
});
