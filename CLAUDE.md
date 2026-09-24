# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## What this repository is

PostureCare Camera **V0-web**: a webcam posture/distance monitor. Specs remain the source of
truth; `apps/` is the implementation.

- `dac-ta-posturecare-camera.md` — SRS + use cases. When spec and code disagree on thresholds/UC,
  **the SRS wins**.
- `impl-posturecare-web.md` — technical plan for the browser surface (§17). Load-bearing: **exclusive
  takeover** (one leader tab holds the camera; away/idle timers run **server-side** off heartbeat).
- `apps/web` — React + Vite + TypeScript (capture, signals, detectors, governor, UI).
- `apps/api` — FastAPI session/lease/rules/report. Default **in-memory** store (one process). Set
  `DATABASE_URL` to use Postgres (`apps/api/pg_store.py`). `docker-compose.yml` starts Postgres 16.

The original desktop Python stack (`tracking_AI/`) is **not** in this directory. Pose here is a
behavioural equivalent via FaceLandmarker matrices, not a 1:1 solvePnP port. Do not invent MAE/FPS
claims (`Q-05`, `WEB-004`).

## Commands

HTTPS or `localhost` required for `getUserMedia` (`WEB-001`). Vite proxies `/api` → `:8000`.

```bash
npm install                          # also installs apps/web; downloads FaceLandmarker .task + copies WASM
python3 -m venv .venv && .venv/bin/pip install -r apps/api/requirements.txt   # needs python3-venv

npm run dev                          # API :8000 + web :5173
npm run test --prefix apps/web       # vitest (signals / detectors / governor)
cd apps/api && ../../.venv/bin/python -m pytest -q    # after venv exists
```

`npm run dev:api` expects `python3 -m uvicorn`. After creating `.venv`, either activate it or run
`.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000` from `apps/api`. **Do not** start
uvicorn with `--workers > 1` while using the in-memory store.

Postgres (optional, Giai đoạn 4):

```bash
docker compose up -d postgres
DATABASE_URL=postgresql+psycopg://posturecare:posturecare@127.0.0.1:5432/posturecare npm run dev:api
```

CORS allowlist: `CORS_ORIGINS` (default `http://localhost:5173`).

Schema changes go through Alembic (`apps/api/migrations/`); `PostgresStore` runs `upgrade head` on
startup, so add a new revision instead of editing `models.py` alone. `DATABASE_URL` may be a raw
Supabase URI (`db.py` pins psycopg 3 and handles the pooler). Optional `SENTRY_DSN` (no PII/bodies).
Rate limiter (`ratelimit.py`) and the retention sweep are in-process — another reason for one worker.

## Architecture (do not quietly undo)

- Header `X-Device-Token` on every API call. Rules are per token, never global.
- `POST /sessions/start` does not claim an orphan lease. Client auto-`POST /takeover` when
  `owner_live` is false; follower UI only when `owner_live` is true. Camera only if
  `you_are_leader`.
- Heartbeat every 2s includes `governor_state`. `409` → release camera. Network errors retry, do not
  release. Grace `calibrating` → `monitoring` is **server-side** after 20s.
- Away timers do not run during `break`. Stop is allowed from any tab with the same device token.

---

The rest of this file is the SRS ID network (still required when editing specs).

The implementation the SRS describes lives in a separate codebase (the doc cites `tracking_AI/`,
`dashboard/gPBL/`, `rules.json`, `README.md`, `UPDATE.md`) that is **not present in this directory**.
When a statement needs code-level verification, say it is unverified rather than assuming — the doc's
own rule is *"Không suy diễn"* (no inference beyond evidence).

## Document conventions (the real structure to respect)

The document is a cross-referenced requirements network, not prose. Everything is tables, and every row
carries an ID. Editing one row usually means updating its neighbours.

ID namespaces and their layering (each layer traces up to the one above):

| Prefix | Section | Meaning |
|---|---|---|
| `SH-nn` | §2 | Stakeholder |
| `A-`/`D-`/`C-nn` | §3 | Assumption / dependency / constraint |
| `BR-nnn` | §4 | Business requirement |
| `UR-nnn` | §5 | User requirement (cites a `BR`) |
| `FR-nnn` | §6 | Functional requirement (cites a `UC`) |
| `UC-nn` | §7 | Use case (cites `BR`/`UR`/`FR`/`BRULE`/`DATA`) |
| `DATA-nnn` | §8 | Data entity |
| `INT-nnn` | §9 | Interface |
| `NFR-nnn` | §10 | Non-functional requirement |
| `BRULE-nnn` | §11 | Business rule, with its enforcement point named in code terms |
| `Q-nn` | §16 | Open question or recorded decision |
| `WEB-nnn` | §17 | V0-web-specific requirement/constraint (capture, storage, identity — browser deltas from desktop) |

Rules when editing:

- **IDs are stable and never renumbered or reused.** Dropped items keep their ID with a "Won't" note —
  see `FR-015/016` and `UC-10/11/15`.
- The use-case list at the top of the file anchors to headings; heading text and anchor must stay in sync.
- Each `UC` follows a fixed shape: an attribute table, then **Luồng sự kiện chính** (`Bước | Tác nhân | Hệ thống`),
  then **Luồng thay thế** (`A1`, `A2`, …), **Luồng ngoại lệ** (`E1`, `E2`, …), then Given/when/then
  **Tiêu chí chấp nhận**. Keep that order and those headings.
- §12 (traceability matrix) and **Phụ lục A** (flag → signal → hold → severity) are derived views. Any change
  to a threshold, hold, or severity must be reflected in §1.2, §6, §11, §12 and Phụ lục A together.
- Write in Vietnamese, matching the existing register. Signal names, flags, states, and API paths stay in
  English/code form (`too_close`, `monitoring`, `POST /tracking/start`).
- **Never fabricate measurements.** MAE for IPD/pose is explicitly unmeasured (`Q-05`), `eval/` still holds mock
  data, and lux must not be derived from pixels (`BRULE-010`, `Q-01`). Do not add a "±X cm" figure anywhere.
- **Never add medical claims.** `BR-004`, `C-01`, `BRULE-008`, `NFR-007`: ergonomic conditions only, one
  actionable sentence per prompt.

## Release scoping

`V0` is the only release being specified. Keep `V1` (lightweight identity) and `V2` (survey, ads) as
forward-looking notes — do not fold them into V0 flows. Explicitly out of V0: ESP32 firmware, LDR/lux,
ultrasonic, LED/GPIO, accounts, OpenRouter/LLM on any hot path, frame upload, mandatory Firebase.
LLM calls are off in V0, so governor speech is always the canned `MOCK_SPOKEN` and the session report is
printed from stored SQLite data (`BRULE-009`).

`V0` has two **deployment surfaces**, not two releases: `V0-desktop` (§1–16, the architecture below) and
`V0-web` (§17), added to let the product run publicly in a browser instead of as a local Python install.
They share every `BR`/`UR`/`UC`/`BRULE` and the privacy invariants — only where capture/CV runs and where
the backend is hosted differs. See §17.3 in the SRS for the exact ID-by-ID mapping of what changes
(`INT-005` camera source, `INT-002` overlay channel, `A-05`/`DATA-003` identity and calibration storage,
`D-01`/`D-02`/`NFR-004` runtime dependencies). Web-only requirements live under the `WEB-nnn` prefix in
§17.4; don't confuse them with the desktop `FR-nnn` series, which V0-web still honors in spirit but not
in mechanism (e.g. `FR-006` capture still applies, but via `getUserMedia` instead of OpenCV).

## Specified architecture (needed to review any change coherently)

```
OS webcam (OpenCV, index "0")
  → tracking subprocess (MediaPipe Face Mesh, solvePnP)      # spawned by backend, holds the device
  → FastAPI backend :8080  (REST /api/*, session + governor) → SQLite
  → dashboard at localhost:8080/dashboard  (polls, currently 10 s — Q-07)
  + MJPEG overlay on :8089–8091, loopback only (frames never persisted or uploaded)
```

Four-step wizard: Camera → Preview → Calibrate → Dashboard, **defaulting to webcam, never ESP32**.

Session state machine (`FR-008`): `idle → calibrating → monitoring → away | break → ended`.
- `calibrating` = ~20 s grace, UI label `STARTING`; no alerts fire during it (`BRULE-003`).
- face lost > 30 s → `away`; away ≥ 3 min resets `exposure_sec`; away ≥ 15 min closes the session.
- exposure accrues only in `monitoring` with a face present (`BRULE-004`).
- one open session per `device_id`; a second tab **attaches** to it rather than creating a new
  `session_id` (`BRULE-001`, `UC-13`). Stop Stream == Stop Session, and releases the camera (`BRULE-002`).

Signal pipeline: CV reading → detectors emit atomic flags → a flag becomes *qualified* only after its hold
elapses → governor decides notice / alert / escalate. `notice` is toast-only; `alert` adds TTS; repeats back
off 60 s then 180 s; alert ≥ 300 s escalates and demands ack. Snooze is 600 s; DND and snooze persist with
the session across a backend restart. HUD severity replaces the LED — no GPIO in V0.

Load-bearing constants (keep consistent everywhere): pitch ±5°, |yaw| 20°, |roll| 15°; distance band
50–70 cm with < 30 cm critical; `distance_cm = K / IPD_px`, EMA 0.75/0.25, `K0 = 4200`, calibration accepts
10–200 cm (default 50); blink = 3 frames under EAR 0.294, alert under 6 blinks/min over a 60 s window;
holds 15 s (danger) / 60 s (notice, `too_close`); sit-too-long suggestion at 20 min (demo 3 min).
MediaPipe landmarks: pose `1, 152, 33, 263, 61, 291`; EAR right `[33,159,158,133,153,145]`,
left `[362,380,374,263,386,385]`.

Two invariants that recur across sections and are easy to break:
- **Null ≠ 0** (`BRULE-005`, `FR-006`, `DATA-002`): a missing face yields `face_present = false` / `NO_FACE`,
  never 0 cm or 0°, and must never read as "too close".
- **`too_long` is disabled** (`BRULE-006`): prolonged sitting produces a once-per-session break suggestion,
  not a parallel flag.
