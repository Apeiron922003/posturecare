import { SIT_SUGGEST_BREAK_DEMO_MIN } from "../signals/constants";
import type { Rules } from "../detectors";

export function shouldSuggestBreak(exposureSec: number, rules: Rules, already: boolean): boolean {
  if (already) return false;
  const min = rules.demo_mode ? SIT_SUGGEST_BREAK_DEMO_MIN : rules.sit_suggest_break_min;
  return exposureSec >= min * 60;
}
