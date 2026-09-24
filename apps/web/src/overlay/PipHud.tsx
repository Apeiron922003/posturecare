import { spoken, type HudLevel } from "../governor";
import type { Lang } from "../i18n";

// WEB-011: floating always-on-top HUD (Document Picture-in-Picture, Chromium only).
// Shows severity by colour + corrective glyph so it reads without words; the
// spoken phrase is the tooltip. Severity only — never video, never the face.

type DocPip = { requestWindow(opts: { width: number; height: number }): Promise<Window> };

function docPip(): DocPip | null {
  return (window as unknown as { documentPictureInPicture?: DocPip }).documentPictureInPicture ?? null;
}

export function pipSupported(): boolean {
  return docPip() !== null;
}

const PIP_CSS = `
  body { margin: 0; background: #0f1419; color: #e7eef6; font-family: "Segoe UI", system-ui, sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh; }
  .pip { display: flex; gap: 14px; align-items: center; padding: 10px; }
  .ring { width: 92px; height: 92px; border-radius: 50%; border: 8px solid var(--c); box-sizing: border-box;
          display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .ring b { font-size: 28px; line-height: 1; }
  .ring small { font-size: 11px; opacity: .7; }
  .glyphs { display: flex; flex-wrap: wrap; gap: 6px; max-width: 110px; font-size: 26px; }
  .glyphs span { color: var(--c); }
  button { font: inherit; font-size: 22px; background: #0d9488; color: #fff; border: 0; border-radius: 10px;
           padding: 4px 16px; cursor: pointer; }
`;

export async function openPipWindow(): Promise<Window | null> {
  const api = docPip();
  if (!api) return null;
  const w = await api.requestWindow({ width: 260, height: 140 });
  const style = w.document.createElement("style");
  style.textContent = PIP_CSS;
  w.document.head.append(style);
  w.document.title = "PostureCare";
  return w;
}

const LEVEL_COLOR: Record<HudLevel, string> = {
  normal: "#14b8a6",
  notice: "#eab308",
  alert: "#ef4444",
  escalated: "#e11d48",
};

/** Glyph = the direction to correct, not the problem. */
const FLAG_GLYPH: Record<string, string> = {
  critically_close: "↔",
  too_close: "↔",
  too_far: "→←",
  head_too_low: "↑",
  head_too_high: "↓",
  head_tilted: "⟲",
  head_turned: "↺",
  low_blink_rate: "◉",
};

const STATE_GLYPH: Record<string, string> = {
  calibrating: "…",
  away: "⏸",
  break: "⏸",
  ended: "■",
};

export function PipHud(props: {
  level: HudLevel;
  state: string;
  facePresent: boolean;
  distanceCm: number | null;
  flags: string[];
  lang: Lang;
  onAck: () => void;
}) {
  const { level, state, facePresent, distanceCm, flags, lang, onAck } = props;
  const color = facePresent ? LEVEL_COLOR[level] : "#475569";
  // Null ≠ 0 (BRULE-005): no face shows a dash, never "0 cm".
  const cm = facePresent && distanceCm != null ? Math.round(distanceCm) : null;
  const glyphs = [...new Set(flags.map((f) => FLAG_GLYPH[f]).filter(Boolean))];
  const stateGlyph = STATE_GLYPH[state];
  return (
    <div className="pip" style={{ ["--c" as string]: color }}>
      <div className="ring">
        <b>{stateGlyph ?? cm ?? "—"}</b>
        {stateGlyph == null && cm != null && <small>cm</small>}
      </div>
      {level === "escalated" ? (
        <button onClick={onAck} title={spoken(lang, "escalate")}>
          ✓
        </button>
      ) : (
        <div className="glyphs">
          {glyphs.length === 0 && facePresent && stateGlyph == null && <span>✓</span>}
          {flags
            .filter((f) => FLAG_GLYPH[f])
            .filter((f, i, arr) => arr.findIndex((g) => FLAG_GLYPH[g] === FLAG_GLYPH[f]) === i)
            .map((f) => (
              <span key={f} title={spoken(lang, f)}>
                {FLAG_GLYPH[f]}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
