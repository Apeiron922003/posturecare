# Tài liệu triển khai — PostureCare Camera Web (V0-web)

**Đối tượng đọc:** agent/kỹ sư thực thi code. Tài liệu này là **kế hoạch kỹ thuật**, không phải SRS —
mọi quyết định nghiệp vụ, ngưỡng, hold, và bất biến privacy đã chốt ở
`dac-ta-posturecare-camera.md`, đặc biệt **mục 17 (Triển khai Web)** và **Phụ lục A**. Khi tài liệu này
và SRS mâu thuẫn, **SRS thắng** — sửa tài liệu này, không sửa ngược ngưỡng nghiệp vụ.

Không có codebase Python nguồn (`tracking_AI/`) trong repo này để đối chiếu — mọi hằng số dưới đây lấy
từ SRS mục 1.2 và Phụ lục A. Nếu về sau có quyền truy cập `tracking_AI/`, đối chiếu lại công thức
solvePnP/EMA trước khi coi các con số dưới đây là cuối cùng.

---

## 0. Việc KHÔNG làm (giữ đúng phạm vi V0-web)

- Không xử lý video ở server (đã loại ở SRS §17.1 — vi phạm `BR-005`/`C-02`).
- Không gọi LLM ở bất kỳ đường nóng nào (`BRULE-009`, `D-04` tắt).
- Không dựng lại UI/luồng ESP32, LDR, ultrasonic, LED/GPIO (`INT-006` không dùng).
- Không làm tài khoản/đăng nhập thật (đó là V1) — chỉ `device_token` ẩn danh (`WEB-007`).
- Không bịa số đo hiệu năng/độ chính xác (`WEB-004`, `Q-05`, `Q-11`, `Q-12`) — đo thật rồi mới công bố;
  **không** tự hạ model cho Safari trước khi có số đo.
- Không đồng bộ calibration đa thiết bị (`Q-13` — chốt tạm là không làm ở V0-web).
- Không có endpoint calibration server-side — calibration chỉ sống ở `localStorage` (`WEB-006`).
- Không cho `PUT /api/rules` sửa ngưỡng toàn cục — mọi rules đều scope theo `device_token` (§5).
- Không để hai tab cùng `getUserMedia` một lúc — exclusive takeover (§6).
- Không bật `too_long` song song với gợi ý nghỉ (`BRULE-006`), không bịa lux (`A-03`/`BRULE-010`).

---

## 1. Quyết định đã chốt cho V0-web (không mở lại trừ khi có lý do mới)

| Hạng mục | Quyết định | Vì sao |
|---|---|---|
| Tab 2 / `UC-13` | **Exclusive takeover.** Một tab duy nhất ("leader") giữ camera + chạy pipeline. Tab thứ hai **không** gọi `getUserMedia`, không chạy HUD live; chỉ hiện "phiên đang chạy ở tab khác" + nút **Takeover**. | Hai tab cùng mở webcam vừa lãng phí vừa làm hai bộ governor cãi nhau (toast/TTS trùng). Khớp tinh thần `BRULE-001` (một phiên/thiết bị) nhưng thực thi rõ ràng hơn desktop. |
| Backend | **FastAPI + PostgreSQL.** Giai đoạn 1–3 chạy **in-memory** (không cần DB thật để test UC-01, UC-13, session state); Giai đoạn 4 thay bằng Postgres, **không đổi hợp đồng API**. | Cho phép code phần khó (heartbeat/lease/governor) sớm mà không bị chặn bởi hạ tầng DB. |
| Ngôn ngữ | **Song ngữ vi/en.** Toggle lưu `localStorage`, mặc định `vi`. `MOCK_SPOKEN` có bản dịch riêng cho từng ngôn ngữ, không dịch máy runtime. Flag, state, path API giữ nguyên tiếng Anh (`too_close`, `monitoring`, `/api/sessions/start`). | Bản public tiếp cận người dùng ngoài lớp học; giữ mã/flag tiếng Anh để không phá vỡ hợp đồng dữ liệu. |
| `UC-14` | **Đủ với:** UI settings (đổi ngưỡng) + `GET`/`PUT /api/rules` — nhưng rules **scope theo `device_token`** (§5), không có admin global ở V0-web. | Không cần thêm gì hơn để thoả `FR-017`; global rules trên backend public không có auth sẽ là lỗ hổng (bất kỳ ai đổi ngưỡng của mọi người). |

Cũng không đụng (đã chốt ở bản trước, nhắc lại cho rõ): không upload frame, không LLM, không ESP32,
không account thật, calibration chỉ `localStorage`, hằng số §4 giữ nguyên giá trị.

---

## 2. Ngăn xếp công nghệ

| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| Client framework | React + Vite + TypeScript | TS bắt buộc — nhiều hằng số/ngưỡng số học, kiểu sai dễ gây lỗi ngưỡng |
| Face/pose inference | `@mediapipe/tasks-vision` (`FaceLandmarker`, WASM, `outputFacialTransformationMatrixes: true`, `numFaces: 1`) | Bản Web chính thức của MediaPipe; dùng transformation matrix thay vì port `solvePnP` — xem §4 ghi chú pose. `numFaces: 1` bắt buộc (`NFR-002` — một mặt). Self-host WASM + file `.task` trong `public/` (không load từ CDN Google) — tránh phụ thuộc mạng ngoài trên hot path và tránh vỡ khi CDN đổi version. |
| State/logic thuần | TypeScript module thuần (không phụ thuộc React) cho: signal calculation, detector, governor | Để dễ unit test độc lập với UI, và để dễ đối chiếu 1:1 với công thức SRS |
| i18n | `i18next` + `react-i18next`, hoặc dict JSON tự quản nếu muốn tối giản | Không bắt buộc thư viện cụ thể; yêu cầu là 2 file dịch `vi.json`/`en.json`, không dịch runtime |
| TTS | Web Speech API (`speechSynthesis`) | Không cần server audio; chọn giọng theo ngôn ngữ đang chọn. Trình duyệt chặn `speechSynthesis` trước khi có user gesture — unlock (gọi `speechSynthesis.speak("")` hoặc tương đương) ngay ở nút "Continue" của wizard, không đợi tới lần đầu governor cần nói. |
| Backend | FastAPI (Python), giữ hình dạng API §5 | Giai đoạn 1–3: in-memory store; Giai đoạn 4: Postgres — xem §1. **Bắt buộc chạy 1 process** (`uvicorn` không `--workers > 1`) khi còn in-memory — nhiều worker = nhiều store riêng, lease/session sẽ không nhất quán giữa các worker. Vite dev proxy `/api` → backend, tránh CORS lúc dev. |
| DB (Giai đoạn 4+) | PostgreSQL | Thay in-memory vì nhiều phiên/nhiều user, cần sống sót qua restart |
| Hosting frontend | Cloudflare Pages / Vercel / Netlify (static + WASM, HTTPS mặc định) | Bắt buộc HTTPS — `WEB-001` |
| Hosting backend | Fly.io / Railway / Render | Chọn nơi có Postgres managed đi kèm; cấu hình CORS allowlist đúng origin frontend, không `*` |

---

## 3. Cấu trúc thư mục đề xuất

```
posturecare-web/
├── apps/
│   ├── web/                          # frontend React+Vite
│   │   ├── src/
│   │   │   ├── capture/              # getUserMedia + FaceLandmarker + enumerateDevices (camera picker)
│   │   │   ├── signals/              # pose/distance/EAR-blink từ landmark thô — thuần TS, có unit test
│   │   │   ├── detectors/            # flag rules + hold — port từ SRS §1.2 + Phụ lục A
│   │   │   ├── governor/             # notice/alert/escalate — chạy CHỈ ở tab leader (§6, §7)
│   │   │   ├── session/              # session state machine client-side + heartbeat sender
│   │   │   ├── calibration/          # localStorage read/write — WEB-006, khoá theo resolution (§4)
│   │   │   ├── api/                  # client cho backend REST — start/heartbeat/takeover/readings/actions/rules
│   │   │   ├── i18n/                 # vi.json, en.json, hook đổi ngôn ngữ
│   │   │   ├── ui/                   # wizard, dashboard, HUD, toast, report, "phiên ở tab khác" + Takeover
│   │   │   └── overlay/              # canvas vẽ landmark — thay MJPEG
│   │   └── vite.config.ts
│   └── api/                          # backend FastAPI
│       ├── main.py
│       ├── routers/ (sessions.py — start/stop/heartbeat/takeover/readings/actions, rules.py, reports.py)
│       ├── store.py                  # Giai đoạn 1–3: in-memory dict theo session_id/device_token
│       ├── models.py                 # Giai đoạn 4: ORM Postgres — Session, Reading, Rules(device_token)
│       └── session_sm.py             # away/idle/close timers chạy PHÍA SERVER dựa trên heartbeat (§6)
└── impl-posturecare-web.md           # tài liệu này
```

Không tách `packages/posture-core` ở các giai đoạn đầu — chỉ cân nhắc nếu sau này có thêm client khác.

---

## 4. Hằng số và công thức bắt buộc giữ nguyên

Nguồn: `dac-ta-posturecare-camera.md` mục 1.2 và Phụ lục A. Đây là giá trị, không phải cách tính — cách
tính (pose, blink) có ghi chú riêng ngay dưới bảng vì không có `tracking_AI/` để port 1:1.

```ts
// signals/constants.ts
export const POSE_LANDMARKS = { nose: 1, chin: 152, rightEyeOuter: 33, leftEyeOuter: 263, mouthRight: 61, mouthLeft: 291 };
export const EAR_RIGHT = [33, 159, 158, 133, 153, 145];
export const EAR_LEFT = [362, 380, 374, 263, 386, 385];

export const PITCH_THRESHOLD_DEG = 5;      // ±5°
export const YAW_THRESHOLD_DEG = 20;       // |yaw| > 20°
export const ROLL_THRESHOLD_DEG = 15;      // |roll| > 15°

export const DISTANCE_NEAR_CM = 50;        // too_close < 50 cm
export const DISTANCE_FAR_CM = 70;         // too_far > 70 cm
export const DISTANCE_CRITICAL_CM = 30;    // critically_close < 30 cm
export const DISTANCE_EMA_ALPHA_NEW = 0.75;
export const DISTANCE_EMA_ALPHA_OLD = 0.25;
export const DISTANCE_K0 = 4200;           // default trước calibrate, phụ thuộc resolution — xem ghi chú
export const CALIBRATION_DISTANCE_MIN_CM = 10;
export const CALIBRATION_DISTANCE_MAX_CM = 200;
export const CALIBRATION_DISTANCE_DEFAULT_CM = 50;
export const CAPTURE_RESOLUTION = { width: 1280, height: 720 }; // getUserMedia ideal — khoá cùng resolution với K0

export const EAR_BLINK_THRESHOLD = 0.294;
export const EAR_BLINK_MIN_DURATION_MS = 100; // tương đương 3 khung @ 30 FPS — xem ghi chú blink
export const LOW_BLINK_RATE_PER_MIN = 6;      // < 6 lần/phút trong cửa sổ 60 s
export const BLINK_WINDOW_SEC = 60;

// Hold trước khi flag "qualified" (BRULE-007)
export const HOLD_DANGER_SEC = 15;         // pitch/roll/head_too_low/high/tilted, critically_close
export const HOLD_NOTICE_SEC = 60;         // too_far, head_turned, low_blink_rate
export const HOLD_TOO_CLOSE_SEC = 60;      // too_close (không phải critically_close)
export const HOLD_FACE_LOST_RESET_MS = 250; // không mặt liên tục ≥ 250 ms mới reset hold — không 1 frame rớt
export const ALERT_MIN_NOTICE_FLAGS = 2;   // >= 2 flag notice cùng lúc cũng vào alert — xem §7 governor

// Governor (FR-009)
export const GRACE_SEC = 20;               // calibrating, không bắn cảnh báo (BRULE-003)
export const ALERT_BACKOFF_FIRST_SEC = 60;
export const ALERT_BACKOFF_SECOND_SEC = 180;
export const ESCALATE_AFTER_SEC = 300;
export const SNOOZE_SEC = 600;

// Session/away (FR-008, UC-08) — chạy PHÍA SERVER, xem §6
export const HEARTBEAT_INTERVAL_SEC = 2;
export const OWNER_LIVE_TIMEOUT_SEC = 6;      // ~3x interval — "leader còn sống" cho start/GET/UI badge
export const HEARTBEAT_TIMEOUT_SEC = 30;      // không heartbeat >= 30s = away/mất leader cho session_sm (KHÁC owner_live — xem §6)
export const FACE_LOST_TO_AWAY_SEC = 30;
export const AWAY_RESET_EXPOSURE_SEC = 180;
export const AWAY_CLOSE_SESSION_SEC = 900;

// Break suggestion (UC-07, BRULE-006 — KHÔNG bật flag too_long song song)
export const SIT_SUGGEST_BREAK_MIN = 20;
export const SIT_SUGGEST_BREAK_DEMO_MIN = 3;
```

**Công thức EMA khoảng cách (bắt buộc, tránh `EMA(0)` khi mất mặt — `BRULE-005`):**

```ts
// ema hiện tại = null khi chưa có mẫu nào, hoặc khi mẫu trước đó face_present === false
distance_ema =
  (ema_prev === null || raw === null)
    ? raw                                               // mẫu đầu, hoặc mặt vừa mất/vừa xuất hiện lại — KHÔNG trộn null/stale
    : DISTANCE_EMA_ALPHA_NEW * raw + DISTANCE_EMA_ALPHA_OLD * ema_prev;
```

Không được dùng `ema_prev` từ trước khi mất mặt để blend lại khi mặt quay lại — reset về `raw` thuần, coi
như mẫu đầu của một chuỗi mới. `distance_cm = null` khi `face_present === false`, không bao giờ `0`.

**`IPD_px` phải đo trên kích thước frame thực, không phải `CAPTURE_RESOLUTION` lý tưởng:** `getUserMedia`
không đảm bảo trình duyệt cấp đúng độ phân giải `ideal` đã xin. Tính `IPD_px` từ landmark 33–263 trên
`video.videoWidth`/`video.videoHeight` **thực tế** tại thời điểm chạy, không hardcode 1280×720. Lưu
calibration dưới dạng `{K, width, height}` (không chỉ `K`); nếu resolution đang chạy lệch so với
`{width, height}` đã lưu, hiện gợi ý "calibrate lại khoảng cách" thay vì âm thầm dùng `K` cũ trên
resolution khác (nối tiếp ghi chú resolution ở trên).

**Bất biến khi code (`BRULE-005` — null ≠ 0):** mọi hàm tính signal trả `null`/`undefined` khi
`face_present === false`, không bao giờ trả `0`. Không detector nào coi `null` là "quá gần" hay "góc 0°".

**Ghi chú pose (không có `tracking_AI/` để port `solvePnP` mù):** dùng
`FaceLandmarker.outputFacialTransformationMatrixes` để lấy pitch/yaw/raw-roll, rồi tính **tương đối** so
với `pose_reference` đã lưu lúc calibrate (`UC-02`) — đúng khớp acceptance UC-04 ("cúi > 5° đủ hold →
`head_too_low`"). **Roll** tính lại bằng `atan2` trên đường nối hai mắt trừ reference, đúng công thức
SRS §1.2, không chỉ lấy roll thô từ matrix (matrix roll có thể lệch quy ước trục so với desktop). Đây là
**tương đương hành vi**, không phải port 1:1 — ghi rõ điều này trong comment code, không bịa số MAE (`Q-05`).

**Ghi chú resolution:** `K0 = 4200` là giá trị tham chiếu ở một resolution nhất định. Khoá capture ở
`CAPTURE_RESOLUTION` (1280×720). Sau `UC-03`, `K` tính lại từ đúng resolution đang chạy nên tự đúng.
Nếu người dùng đổi camera/resolution giữa chừng: gợi ý calibrate lại, **không** âm thầm dùng `K` cũ.

**Ghi chú blink:** "3 frame liên tiếp dưới ngưỡng" phụ thuộc FPS thực tế của thiết bị (SRS §13 đã cảnh
báo), nên quy đổi sang thời gian: EAR liên tục dưới `EAR_BLINK_THRESHOLD` trong tối thiểu
`EAR_BLINK_MIN_DURATION_MS` (≈3 frame @ 30 FPS) tính là một lần chớp. Hold `low_blink_rate` vẫn 60 s,
không đổi.

**`critically_close` ⊂ `too_close`:** detector emit **cả hai** khi `distance_cm < 30`; hai flag qualify
độc lập theo hold riêng (15 s vs 60 s). Governor luôn ưu tiên mức cao hơn: nếu cả hai đã qualified,
`critically_close` thắng (đúng alert, không hạ xuống mức `too_close`).

**Hold khi mất mặt:** reset atomic hold chỉ khi `face_present === false` **liên tục ≥ `HOLD_FACE_LOST_RESET_MS`
(250 ms)** — một frame MediaPipe rớt/`null` tạm không được xoá 14 s hold đã tích. Khi takeover: hold
**luôn** reset về 0 ở client mới; `governor_json` (dnd/snooze/escalated/backoff) thì hydrate từ server.

---

## 5. Hợp đồng API backend (`WEB-008`, tương đương `INT-001`)

Tất cả request mang `device_token` (string, sinh client-side lần đầu, lưu `localStorage` — `WEB-007`) qua
header chung **`X-Device-Token`**. Không dùng query string cho token (kể cả `GET /api/rules`). Không
endpoint nào nhận ảnh/frame. Không có endpoint calibration (xem §0).

**Authz trên mọi route (kể cả `stop`/`readings`/`report`/`actions`/`rules`):** server kiểm `X-Device-Token`
gửi lên có **sở hữu** `session_id` trong URL không (tức `session.device_token == header`), không chỉ tin
`tab_id` trong body. `tab_id` chỉ dùng để phân biệt tab nào đang là leader trong phạm vi một
`device_token`, không phải để xác thực quyền truy cập phiên.

| Method | Path | Body / Query | Trả về | Ghi chú |
|---|---|---|---|---|
| `POST` | `/api/sessions/start` | `{tab_id}` (+ header) | `{session_id, state, grace_sec, owner_live, lease_generation}` | **Một đường atomic duy nhất, không đua:** (a) chưa có session cho `device_token` → tạo mới, caller thành leader, `lease_generation = 1`. (b) session đang `ACTIVE` (không `ended`) **và** leader còn sống (`owner_live: true`) → trả session cũ, **không đổi lease**, client **không** mở camera. (c) session `ACTIVE` nhưng leader chết (`owner_live: false`) → `start` **không tự claim lease** — trả session cũ với `owner_live: false`; client **tự** `POST /takeover` (reclaim orphan), **không** hiện UI "phiên ở tab khác". Chống đua 2 request `start` cùng lúc: in-memory lock theo `device_token`; Postgres unique partial index `(device_token) WHERE state IN ('calibrating','monitoring','away','break')`. |
| `GET` | `/api/sessions/{id}` | — (header) | `{state, owner_live, lease_generation, exposure_sec, governor_state}` | Tab không-leader poll cái này (không heartbeat) khi `owner_live: true`. Cùng shape với heartbeat. |
| `POST` | `/api/sessions/{id}/takeover` | `{tab_id}` (+ header) | `{lease_generation, governor_state, you_are_leader}` | **Chỗ duy nhất** tăng `lease_generation`. Atomic cùng lock `device_token` như `start`. Winner: `you_are_leader: true`. Loser (đua) : `you_are_leader: false` → **không** `getUserMedia`. Session `ended` → `409`/`404`. Idempotent nếu caller đã là owner hiện hành (không tăng generation). |
| `POST` | `/api/sessions/{id}/heartbeat` | `{tab_id, lease_generation, face_present, governor_state?}` (+ header) | **Cùng shape với `GET`**: `{state, owner_live, lease_generation, exposure_sec, governor_state}`, hoặc `409` nếu generation cũ | Leader gửi `governor_state` (merge vào `governor_json`: `escalated_at`, `backoff_stage`, `last_alert_at`, `break_suggested`, dnd/snooze). Không còn `204` câm. `409` → nhả camera. Lỗi mạng ≠ `409` — retry, không nhả (§6). Leader **vẫn heartbeat** khi session `break`/`away` nếu tab còn mở. |
| `POST` | `/api/sessions/{id}/stop` | `{tab_id}` (+ header) | `{state: "ended"}` | `BRULE-002`. **Bất kỳ tab nào cùng `device_token`** được stop, kể cả không-leader. Server `ended` + hủy lease; leader cũ thấy `ended` ở heartbeat/GET rồi nhả camera. |
| `POST` | `/api/sessions/{id}/readings` | mảng `{ts, pitch, yaw, roll, distance_cm, ear, blink_count, face_present, flags: string[]}` (+ header) | `204` | `flags` là flag **đã qualified**. Chỉ ghi khi `calibrating`/`monitoring` |
| `POST` | `/api/sessions/{id}/actions` | `{type: "snooze"\|"dnd_on"\|"dnd_off"\|"ack"\|"break_start"\|"break_end", lease_generation}` (+ header) | `{governor_state}` | `UC-06`, `UC-07`. Chỉ **leader hiện hành** (`lease_generation` khớp). Tab 2 không snooze/DND/ack — phải takeover trước. Escalate/backoff **không** đi qua `/actions` — đi heartbeat `governor_state`. |
| `GET` | `/api/rules` | — (header) | JSON rules **của riêng token đó** (mặc định = hằng số §4 nếu chưa `PUT`, hoặc đọc DB lỗi — `FR-017`) | `UC-14`. Không query `device_token`. Không rules global. |
| `PUT` | `/api/rules` | `{rules: {...}}` (+ header) | `204` hoặc `422` nếu vi phạm schema | Chỉ ghi rules của `device_token` trong header. Leader áp ở tick kế. |
| `GET` | `/api/sessions/{id}/report` | — (header) | stats + timeline **10 phút**, bucket 10 s (`FR-014`) | Không LLM. Stats tối thiểu: `exposure_sec`, tổng thời lượng từng flag qualified, `blink_count` — không KPI y khoa (`C-01`). |

**Định nghĩa `owner_live` (khác `HEARTBEAT_TIMEOUT_SEC`):** `owner_live = (now - last_seen) < OWNER_LIVE_TIMEOUT_SEC`
(6 s ≈ 3 lần nhịp heartbeat 2 s) — dùng cho `start`/`GET`/badge UI. **Không** dùng chung ngưỡng 30 s của
`session_sm` (away/idle, §6).

**Client sau `start`:** `owner_live: true` → UI follower (badge + Takeover, không camera). `owner_live: false`
→ tự `POST /takeover` (reclaim orphan), không hiện "phiên ở tab khác". Chỉ mở `getUserMedia` khi
`you_are_leader: true`.

### 5.1 Schema `PUT /api/rules` (UC-14) — whitelist **subset V0-web**

Đây là subset của UC-14 desktop (pose, distance, blink, sit, demo). **Không** expose grace / snooze /
escalate / backoff qua settings V0-web — những hằng đó giữ giá trị §4.

`rules` chỉ chứa khoá whitelist (khoá lạ → bỏ qua hoặc `422`). Bất biến: `distance_near_cm < distance_far_cm`
và `distance_critical_cm <= distance_near_cm`.

| Khoá rules | Ứng với hằng số | Min | Max |
|---|---|---|---|
| `pitch_threshold_deg` | `PITCH_THRESHOLD_DEG` | 1 | 30 |
| `yaw_threshold_deg` | `YAW_THRESHOLD_DEG` | 5 | 60 |
| `roll_threshold_deg` | `ROLL_THRESHOLD_DEG` | 5 | 45 |
| `distance_near_cm` | `DISTANCE_NEAR_CM` | 20 | 100 |
| `distance_far_cm` | `DISTANCE_FAR_CM` | 50 | 150 |
| `distance_critical_cm` | `DISTANCE_CRITICAL_CM` | 10 | `distance_near_cm` |
| `hold_danger_sec` | `HOLD_DANGER_SEC` | 3 | 120 |
| `hold_notice_sec` | `HOLD_NOTICE_SEC` | 10 | 300 |
| `hold_too_close_sec` | `HOLD_TOO_CLOSE_SEC` | 10 | 300 |
| `low_blink_rate_per_min` | `LOW_BLINK_RATE_PER_MIN` | 1 | 20 |
| `sit_suggest_break_min` | `SIT_SUGGEST_BREAK_MIN` | 5 | 120 |
| `demo_mode` | — | — | boolean |

Khi `demo_mode = true`, client dùng `SIT_SUGGEST_BREAK_DEMO_MIN` (3 phút) thay `sit_suggest_break_min`.

`break_suggested` (một lần/phiên — `BRULE-006`) lưu trên **session** trong `governor_json`, không chỉ React.

---

## 6. Sở hữu phiên: leader, heartbeat, lease (khoá đứng UC-08 + UC-13 trên web)

Desktop có process tracking sống độc lập với tab trình duyệt, nên away/idle luôn chạy được kể cả khi
không ai nhìn dashboard. Web + exclusive takeover thì ngược lại: nếu đóng tab leader mà không có cơ chế
gì, backend vẫn thấy session `ACTIVE` mãi (phiên ma) — tab mới attach vào sẽ không biết leader đã chết,
và đồng hồ away/idle (vốn cần tick liên tục) không có ai chạy.

**Cơ chế:**

1. Leader gửi `POST /heartbeat` mỗi `HEARTBEAT_INTERVAL_SEC` (2 s), kèm `tab_id` + `lease_generation`
   + `face_present` + `governor_state` (merge). **Vẫn gửi** khi state là `break` hoặc `away` nếu tab còn mở
   — nếu không, sau 6 s `owner_live` thành false dù người dùng đang nghỉ.
2. Server lưu `last_seen` mỗi lần heartbeat hợp lệ. Đây là nguồn sự thật cho away/idle — **không** dựa
   vào đồng hồ phía client.
3. **Grace:** hết `GRACE_SEC` kể từ `start`, nếu server còn `calibrating` → `monitoring`. Client **không**
   đếm grace riêng — chỉ theo `state` trên heartbeat/GET (`BRULE-003`).
4. Server chạy state machine away/idle dựa trên `last_seen` và `face_present`:
   - Không heartbeat ≥ `HEARTBEAT_TIMEOUT_SEC` (30 s) **hoặc** `face_present: false` liên tục ≥
     `FACE_LOST_TO_AWAY_SEC` (30 s) → `away`, **chỉ khi** state là `calibrating` hoặc `monitoring`
     (`UC-08`). Ở `break`, timeout/mất mặt **không** đẩy sang `away` — giữ `break` đến `break_end` hoặc
     `stop` (`UC-07`/`FR-010`).
   - `break_end` → `monitoring` nếu heartbeat gần nhất `face_present: true`, ngược lại → `away`.
   - `away` ≥ `AWAY_RESET_EXPOSURE_SEC` (180 s) → reset `exposure_sec`.
   - `away` ≥ `AWAY_CLOSE_SESSION_SEC` (900 s) → `ended`, giải phóng lease.
   - Từ `away`, heartbeat `face_present: true` (trước khi đóng) → `monitoring` (UC-08 về trước 3 phút
     giữ phút ngồi; ≥ 3 phút đã reset exposure).
   - **`exposure_sec`:** mỗi heartbeat hợp lệ, nếu `state === monitoring` ∧ `face_present` → cộng
     `HEARTBEAT_INTERVAL_SEC`. Không cộng khi calibrating/away/break (`BRULE-004`).
5. **Takeover (atomic, cùng lock `device_token`):** `POST /takeover` → tăng `lease_generation` (trừ khi
   caller đã là owner — idempotent). Trả `{lease_generation, governor_state, you_are_leader}`. Chỉ
   `you_are_leader: true` được mở camera. Leader mới **hydrate** `governor_json` (dnd, snooze_until,
   escalated, backoff) rồi tick tiếp; **hold client reset 0**. Tab cũ nhận `409` → nhả track, UI "đã bị
   takeover". `ended` → 409/404.
6. Tab không-leader (`owner_live: true`): poll `GET /api/sessions/{id}`, badge + Takeover. Không camera,
   không pipeline, **không** Snooze/DND/Ack — `POST /actions` từ không-leader bị từ chối. Muốn thao tác
   → takeover trước. Tab vừa `start` mà `owner_live: false` → tự takeover (reclaim), không hiện "tab khác".

**Phân biệt mất mạng tạm thời với `409`:** chỉ nhả camera khi nhận **`409` tường minh** hoặc GET/heartbeat
báo `lease_generation` khác. Lỗi mạng/timeout → retry, không nhả.

**Nơi state sống:**

| Chạy ở đâu | Thứ gì |
|---|---|
| Tab leader (client) | Capture → signals → detectors → qualify flag → toast/TTS/HUD (`NFR-003`) |
| Backend session (server) | `state`, `exposure_sec`, `governor_json`, `lease_generation`, `owner_tab_id`, `last_seen`, readings, rules theo token |

**Tab ẩn ≠ away:** leader ẩn vẫn heartbeat + TTS (`Q-04`). Tick governor/heartbeat bằng `setInterval` nếu
RAF bị throttle. Away chỉ do `face_present` hoặc mất heartbeat.

---

## 7. Luồng xử lý (leader vs tab không-leader)

**Tab leader:**

1. **Capture**: `enumerateDevices()` cho camera picker (`Q-09`), mặc định camera user-facing đầu tiên;
   `getUserMedia({video: CAPTURE_RESOLUTION})`. Từ chối/không có camera → `WEB-002`, hiện hướng dẫn,
   không tự chuyển `monitoring`.
2. **Inference**: `FaceLandmarker.detectForVideo()` mỗi frame → landmark + transformation matrix. Model
   load thất bại/chậm → `WEB-003`, không giả lập landmark.
3. **Signals** (`signals/`): pitch/yaw/roll tương đối so với `pose_reference` (xem ghi chú §4),
   `distance_cm` (EMA theo `K`, đúng resolution), `ear`, `blink` theo thời gian. Trả `null` khi không có mặt.
4. **Detectors** (`detectors/`): áp ngưỡng §4 → flag atomic → giữ hold → "qualified". Đúng Phụ lục A:
   `critically_close`, `too_close`, `too_far`, `head_too_low/high/tilted`, `head_turned`, `low_blink_rate`.
   Không có `too_dark`/`too_bright` (`A-03`). Không có `too_long` song song (`BRULE-006`) — chỉ sự kiện
   "suggest break" một lần/phiên.
5. **Session state (client)**: đếm `exposure_sec` cục bộ để cập nhật UI mượt, nhưng **giá trị chốt** để
   quyết định away/đóng phiên là ở server (§6) — client không tự đóng phiên vì lệch đồng hồ.
6. **Governor** (`governor/`): nhận flag qualified, quyết định `notice`/`alert`/`escalate`:
   - vào `alert` khi: một flag *danger* (hold 15 s) qualified, **hoặc** `too_close` giữ đủ 60 s, **hoặc**
     ≥ `ALERT_MIN_NOTICE_FLAGS` (2) flag *notice* cùng qualified một lúc (đúng `UC-05` bước 2).
   - `critically_close` thắng `too_close` khi cả hai qualified (§4).
   - không bắn khi `calibrating`/DND/snooze (`BRULE-003`). Im khi server `away`/`ended`/`break`.
   - câu thoại luôn từ `MOCK_SPOKEN` tĩnh: một câu hành động cho mỗi flag (không chẩn đoán — `NFR-007`/
     `C-01`/`BR-004`), hai file `mock_spoken.vi.json`/`mock_spoken.en.json`, không dịch máy, không API AI.
   - hành động user (snooze/dnd/ack/break) → `POST /actions` kèm `lease_generation`.
   - escalate/backoff/`break_suggested` đồng bộ qua heartbeat `governor_state`, **không** qua `/actions`.
7. **UI**: HUD (normal/alert/escalated — `FR-011`), toast, overlay canvas, nút Snooze/DND/Ack/Break,
   toggle ngôn ngữ.
8. **Heartbeat**: mỗi 2 s; áp `state`/`lease_generation` trả về. `409` → nhả camera; lỗi mạng → retry.
9. **Telemetry**: batch `POST /readings` 1–2 s hoặc khi flag đổi, flag **đã qualified**.

**Tab không-leader:** poll GET, không heartbeat, không camera, không pipeline. `owner_live: true` →
"phiên đang chạy ở tab khác" + Takeover. Sau `start` mà `owner_live: false` → tự takeover rồi thành
leader từ bước 1. Chỉ `getUserMedia` khi `you_are_leader: true`.

---

## 8. Ánh xạ Use Case → việc cần code

| UC | Việc cần code | File/module |
|---|---|---|
| UC-01 | Wizard 4 bước, camera picker, mặc định webcam user-facing, `POST /sessions/start` | `ui/wizard/`, `capture/` |
| UC-02 | Nút Calibrate pose: lưu `pose_reference = {pitch, yaw, roll}` (giá trị đã tính, không phải landmark thô) tại thời điểm bấm Calibrate + cờ `user_calibrated: true`, vào `localStorage`. Frame đầu tiên có thể auto-zero để HUD không lệch trước khi user calibrate, nhưng auto-zero đó **không** được set `user_calibrated`. Debug panel Giai đoạn 2: nếu test cúi người mà detector không lên `head_too_low`, dấu pitch từ transformation matrix có thể ngược quy ước desktop — chỉ đảo dấu **một trục pitch**, không đụng yaw/roll khi phát hiện điều này. | `calibration/pose.ts` |
| UC-03 | Nút Calibrate distance (10–200cm, mặc định 50), tính `K` theo `video.videoWidth`/`video.videoHeight` **thực**, lưu `{K, width, height}` | `calibration/distance.ts` |
| UC-04 | Vòng lặp signals→detectors→governor mỗi frame (chỉ ở leader), cập nhật HUD | `signals/`, `detectors/`, `ui/dashboard/` |
| UC-05 | Governor bắn toast/TTS theo severity, điều kiện vào alert (§7 bước 6), backoff | `governor/` |
| UC-06 | Nút Snooze/DND/Ack → `POST /actions` + `lease_generation`; leader mới hydrate `governor_json` | `ui/controls/`, `api/actions.ts` |
| UC-07 | Gợi ý nghỉ ở `SIT_SUGGEST_BREAK_MIN`, chuyển state `break` qua `POST /actions` | `session/breakSuggestion.ts` |
| UC-08 | Đồng hồ away/idle chạy **ở server** dựa trên heartbeat (§6), không phải client | `apps/api/session_sm.py` |
| UC-09 | Stop → `POST /stop` (mọi tab cùng `device_token`), tắt track nếu đang leader, mở report `GET /report` | `ui/report/` |
| UC-12 | Bắt lỗi `NotAllowedError`/`NotFoundError` từ `getUserMedia`, hướng dẫn cấp quyền trình duyệt | `capture/errors.ts` |
| UC-13 | **Exclusive takeover** (§6): `owner_live` → badge + Takeover; orphan → auto-reclaim; `you_are_leader` | `ui/takeover/`, `apps/api/routers/sessions.py` |
| UC-14 | UI settings + `GET`/`PUT /api/rules` **scope theo `device_token`**, header, whitelist subset | `ui/settings/`, `api/rules.ts`, `apps/api/routers/rules.py` |

UC-10, UC-11, UC-15: **không code** (Won't V0, giữ nguyên ở bản web).

---

## 9. Kế hoạch triển khai theo giai đoạn

**Giai đoạn 1 — Skeleton API (in-memory) + Capture + Calibrate**
(nghiệm thu: UC-01, UC-02, UC-03; scaffold cho UC-13/UC-08)
- `apps/web` (Vite/React/TS) + `apps/api` (FastAPI, store in-memory theo `session_id`/`device_token`) dựng
  song song ngay từ đầu — **không** dùng mock API (MSW) giả, gọi backend thật dù chưa có Postgres.
- `POST /sessions/start`, `/heartbeat`, `/takeover`, `/stop` và `GET /sessions/{id}` có **skeleton** hoạt
  động. Lease-claim atomic, `you_are_leader`, auto-reclaim khi `owner_live: false`, grace `calibrating`
  → `monitoring` trên server, authz `X-Device-Token` — tất cả từ giai đoạn này.
- `FaceLandmarker` tích hợp, overlay canvas cơ bản, wizard Camera→Preview→Calibrate, `pose_reference`/`K`
  lưu `localStorage` (`{K, width, height}`).
- Tiêu chí: overlay + calibrate góc ≈ 0°; tab 2 không cam; Takeover → tab 1 dừng; đóng hết tab rồi mở lại
  tự reclaim, không kẹt UI "tab khác".

**Giai đoạn 2 — Signals + Detectors + Session state machine (server-side away)**
(nghiệm thu: UC-04, UC-08)
- Port công thức §4 vào `signals/`, unit test đối chiếu vài ca góc/khoảng cách biết trước.
- `session_sm.py` chạy away/idle dựa trên `last_seen` từ heartbeat (§6), cộng `exposure_sec` đúng
  `BRULE-004`.
- Tiêu chí: giữ tư thế xấu đủ hold → flag "qualified" (debug panel); đóng tab leader 35 s rồi mở tab mới
  takeover → state đúng `monitoring`/`away` theo đồng hồ server, không reset phút ngồi sai.

**Giai đoạn 3 — Governor + HUD/TTS + i18n + Snooze/DND/Ack/Break**
(nghiệm thu: UC-05, UC-06, UC-07)
- Điều kiện vào `alert` đầy đủ (danger 15s / too_close 60s / ≥2 notice — §7 bước 6), backoff, escalate+ack.
- `POST /actions` cho user; escalate/backoff qua heartbeat `governor_state`. Test takeover giữa `alert`/DND.
- i18n vi/en, `MOCK_SPOKEN` hai bản, toggle ngôn ngữ, TTS chọn giọng theo ngôn ngữ.
- Tiêu chí: giữ `too_close` đủ hold → đúng một toast + TTS; DND bật → im lặng cùng điều kiện; restart
  giữa phiên (mô phỏng bằng takeover) → snooze/DND/cooldown còn nguyên.

**Giai đoạn 4 — Postgres + Report + UC-14 settings theo token**
(nghiệm thu: UC-09, UC-14)
- Thay in-memory store bằng Postgres, giữ nguyên hợp đồng API §5.
- Report tính từ dữ liệu đã lưu, không gọi LLM.
- `GET`/`PUT /api/rules` scope theo `device_token`, UI settings đổi ngưỡng chỉ ảnh hưởng chính token đó.
- Hosting: frontend static HTTPS, backend + Postgres managed, CORS allowlist đúng origin frontend.
- Tiêu chí: Stop → report có số liệu đúng phiên; đổi rules ở token A không ảnh hưởng token B.

**Giai đoạn 5 — Lỗi quyền, model fail, đo hiệu năng thật**
(nghiệm thu: UC-12, `WEB-002/003/004`, `Q-11`/`Q-12`)
- Xử lý từ chối quyền/không có camera, model load fail.
- Đo FPS thực tế trên máy tầm trung/thấp và trên Safari **trước khi** công bố hay đổi hành vi model —
  nếu FPS thấp trên Safari, chỉ cảnh báo người dùng, không tự hạ chất lượng model khi chưa có số đo.

Mỗi giai đoạn review đối chiếu ngược ID trong SRS trước khi merge — không tự thêm hành vi ngoài UC/FR
đã liệt kê ở đây và ở `dac-ta-posturecare-camera.md`.

---

## 10. Việc không tự quyết khi code (hỏi lại nếu phát sinh, đừng tự chốt)

- Bịa FPS, ±cm, độ chính xác pose (`WEB-004`, `Q-05`).
- Hạ chất lượng model cho Safari trước khi đo (`Q-11`/`Q-12`).
- Đưa `too_long` / lux / LLM / frame ảnh lên mạng.
- Làm `PUT /api/rules` toàn cục hoặc bỏ scope theo `device_token`.
- Cho hai tab cùng capture cùng lúc.
- Đổi ngôn ngữ mặc định khỏi `vi`, hoặc dịch máy `MOCK_SPOKEN` thay vì bản dịch cố định.
