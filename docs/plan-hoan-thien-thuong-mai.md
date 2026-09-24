# Kế hoạch hoàn thiện & thương mại hoá — PostureCare V0-web → V1

**Ngày lập:** 2026-09-24 · **Trạng thái:** Mục 7 đã chốt (2026-09-24). Giai đoạn A: code xong, chờ đo tay (A1). Giai đoạn B: phần code xong, chờ Supabase + đo tay (xem §9).
Tài liệu này là kế hoạch làm việc, **không** thay SRS. Mỗi hạng mục đụng tới hành vi phải được ghi ngược vào
`dac-ta-posturecare-camera.md` (ID mới ở §17.4 hoặc `Q-nn` ở §16) trước khi merge — SRS vẫn thắng.

## 0. Hiện trạng đã kiểm (fact, 2026-09-24)

| Hạng mục | Hiện trạng | Nguồn kiểm |
|---|---|---|
| Deploy | Web: Cloudflare Pages (`posturecare-web.pages.dev`, 200). API: Fly `posturecare-api`, `/api/health` → `{"ok":true}` | curl |
| Lưu trữ production | **In-memory**: Fly secrets chỉ có `CORS_ORIGINS`, không có `DATABASE_URL`; `fly postgres list` rỗng → mọi restart/deploy mất session, rules, report | `fly secrets list` |
| Test | web 19/19, api 9/9 pass; `App.tsx` (692 dòng) không có test | vitest, pytest |
| Vòng xử lý camera | `requestAnimationFrame` (`App.tsx:231`) → trình duyệt dừng khi tab bị ẩn/minimize | đọc code |
| Heartbeat | `setInterval` 2 s; `OWNER_LIVE_TIMEOUT_SEC = 6` → nếu timer bị throttle khi ẩn tab, server có thể coi leader chết | `constants.py` |
| Cảnh báo tư thế | Toast + TTS trong trang; `Notification` chỉ dùng ở Focus Hub | đọc code |
| Nhạc nền | Player YouTube ẩn 1×1 (`focus/youtube.ts`) | đọc code |
| FPS / độ chính xác | Chưa đo (`WEB-004`, `Q-05`) | SRS |

---

## Giai đoạn A — Sửa lỗi lõi: theo dõi khi tab ẩn (ưu tiên cao nhất)

**Vấn đề:** người dùng làm việc ở cửa sổ khác → không phát hiện, không cảnh báo. Đây là use case chính.

| # | Việc | File | Ghi chú |
|---|---|---|---|
| A1 | **Đo trước**: log FPS + khoảng cách heartbeat khi tab ẩn / minimize / cửa sổ khác che, trên Chrome, Edge, Firefox, Safari | `App.tsx` (debug panel) | Không suy diễn hành vi throttle — ghi số đo thật vào `Q-15` |
| A2 | Tách vòng lặp: khi `document.hidden` chuyển sang `requestVideoFrameCallback` hoặc timer chạy trong **Worker** (Worker timer không bị throttle mạnh như main thread); giảm tần suất suy luận khi ẩn (vd 2–5 fps là đủ cho hold 15 s/60 s) | `capture/loop.ts` (mới), `App.tsx` | Giữ nguyên hold/threshold §4 impl — chỉ đổi tần suất lấy mẫu. Detector dùng `now` thật nên hold vẫn đúng |
| A3 | Heartbeat gửi từ Worker hoặc dùng cùng tick với A2, để không bị throttle | `api/client.ts`, `App.tsx` | Không đổi `OWNER_LIVE_TIMEOUT_SEC` trừ khi A1 chứng minh cần |
| A4 | Khi tab ẩn: governor `alert`/`escalate` → **system notification** (`Notification` API), `notice` giữ toast-only đúng spec. Xin quyền lúc bấm Start (có user gesture) | `governor/`, `session/notify.ts` (mới) | Một câu hành động, không claim y tế (`BRULE-008`) |
| A5 | Tuỳ chọn: nút "Mở cửa sổ nổi" (Picture-in-Picture / Document PiP trên Chrome) hiển thị HUD severity nhỏ | `overlay/PipHud.tsx` | Document PiP chỉ Chromium — trình duyệt khác ẩn nút |
| A6 | PWA: `manifest.webmanifest` + service worker tối thiểu để cài như app | `apps/web/public/` | Không cache model/WASM sai phiên bản |

**Spec cần thêm:** `WEB-009` (tiếp tục theo dõi khi tab ẩn), `WEB-010` (kênh system notification cho `alert`), `Q-15` (kết quả đo throttle).
**Nghiệm thu:** ngồi quá gần 60 s trong khi đang gõ ở cửa sổ khác → nhận đúng 1 system notification; server không nhảy sang `away` khi mặt vẫn có trước camera.

## Giai đoạn B — Ổn định production (Giai đoạn 5 của impl + hạ tầng)

| # | Việc | Ghi chú |
|---|---|---|
| B1 | Tạo project **Supabase** (region Singapore, gần Fly `sin`), set `DATABASE_URL` bằng `fly secrets set` | Đã chốt Supabase (mục 7). Code `pg_store.py` đã có |
| B2 | Migration có version (Alembic) thay vì tạo bảng ngầm; backup định kỳ | |
| B3 | Kiểm `UC-12`/`WEB-002`/`WEB-003`: từ chối quyền, không camera, camera bận, model tải lỗi/chậm — test tay theo checklist, ghi kết quả | Code đã có nhánh lỗi cơ bản, cần xác nhận trên từng trình duyệt |
| B4 | Đo FPS thật (`WEB-004`, `Q-11/Q-12`) trên 3 máy (yếu/trung/khá) × Chrome/Safari; ghi bảng số vào SRS | **Không** công bố số trước khi đo |
| B5 | Monitoring: Sentry (frontend + API) không gửi frame/landmark; uptime check | Kiểm payload lỗi không chứa dữ liệu camera (`NFR-001`) |
| B6 | Rate limit theo `X-Device-Token`/IP cho `POST /readings` và `/sessions/start` | Backend public, chống spam |
| B7 | Test cho `App.tsx`: tách logic vòng lặp/leader ra hook thuần (`useLeaderSession`, `useCaptureLoop`) rồi test bằng vitest | Refactor không đổi hành vi |
| B8 | Bỏ player YouTube ẩn → thay bằng file âm thanh tự host có license (CC0) hoặc để người dùng tự mở nhạc | Cần tự đọc lại ToS YouTube; không thu phí khi còn player ẩn |

## Giai đoạn C — Pháp lý & đo lường (trước khi mời người dùng thật)

| # | Việc | Ghi chú |
|---|---|---|
| C1 | Trang **Chính sách riêng tư**: xử lý ảnh chỉ trong trình duyệt, không upload frame, liệt kê chính xác số liệu gửi server (`readings`: góc, cm, EAR, flags) | Việt Nam: Nghị định 13/2023 về dữ liệu cá nhân — nên hỏi người có chuyên môn pháp lý |
| C2 | **Điều khoản sử dụng** + tuyên bố "không phải thiết bị y tế" | `BR-004`, `C-01` |
| C3 | Landing page: mô tả lợi ích ở mức thói quen/ergonomic, không số ±cm, không claim y tế | `NFR-007` |
| C4 | Analytics không hình ảnh (Plausible/PostHog tự host): mở trang, bắt đầu phiên, độ dài phiên, số alert, quay lại D1/D7 | Không gửi landmark/signal thô lên analytics |
| C5 | Kênh phản hồi trong app (form ngắn sau Stop) | |

## Giai đoạn D — Kiểm chứng nhu cầu (trước khi xây thanh toán)

| # | Việc | Tiêu chí dừng/đi tiếp |
|---|---|---|
| D1 | Phân khúc: **người dùng cá nhân** làm việc lâu với máy tính (đã chốt, mục 7) | — |
| D2 | Pilot 10–20 người, 2 tuần, bản hiện tại + A/B/C | Đo D7 retention, số phiên/tuần |
| D3 | Phỏng vấn giá: sẵn sàng trả bao nhiêu, cho tính năng nào (lịch sử? dashboard phụ huynh? báo cáo lớp?) | Có ≥ 30% người pilot nói "sẽ trả" với một mức giá cụ thể → sang E |

## Giai đoạn E — V1: Identity + lịch sử (cơ sở để thu phí)

Đây là V1 theo SRS (`BR-007`, §14) — phải cập nhật SRS lên phạm vi V1 trước khi code.

| # | Việc | Ghi chú |
|---|---|---|
| E1 | Đăng nhập Google + magic link email; liên kết `device_token` cũ vào `user_id` (không mất dữ liệu cũ) | `DATA-001` thêm `user_id` như SRS đã dự kiến |
| E2 | Lịch sử nhiều ngày: tổng hợp theo ngày (phút `monitoring`, phút trong khoảng 50–70 cm, số alert theo flag, số lần nghỉ) — lưu bảng aggregate, không lưu readings thô vĩnh viễn | Readings thô giữ 30 ngày (đã chốt) |
| E3 | Báo cáo tuần (trang + email tuỳ chọn) | Câu chữ ergonomic, không y tế |
| E4 | Đồng bộ rules/calibration/Pomodoro theo `user_id` | `dac-ta-focus-pomodoro.md` V1 |
| E5 | Xoá tài khoản + xuất dữ liệu | Bắt buộc về quyền riêng tư |

## Giai đoạn F — Thu phí (chỉ khi D đạt)

Tuỳ phân khúc chốt ở D1:

| Mô hình | Cần xây thêm |
|---|---|
| B2C freemium | Free: theo dõi + report phiên. Pro: lịch sử, báo cáo tuần, rules tuỳ chỉnh, Focus Hub đầy đủ. Thanh toán: PayOS/VNPay (VN) hoặc Stripe/Paddle (quốc tế) + webhook → cột `plan` trên user |
| Phụ huynh / trường | Tài khoản "người giám sát" liên kết nhiều thiết bị con; dashboard tổng hợp; **đồng ý rõ ràng** của phụ huynh; không bao giờ xem camera từ xa. Bán theo gia đình hoặc theo lớp |
| Doanh nghiệp | Tổ chức + mời thành viên; báo cáo **tổng hợp ẩn danh** (không xem từng người); hoá đơn theo số người |

Quảng cáo (V2 trong SRS): **không khuyến nghị** — giảm lòng tin với app bật camera, doanh thu thấp.

---

## 6. Thứ tự & ước lượng thô (1 người làm)

| Giai đoạn | Ước lượng | Phụ thuộc |
|---|---|---|
| A | 1–1.5 tuần | — |
| B | 1–1.5 tuần | — |
| C | 3–5 ngày | B5 |
| D | 2–3 tuần (song song việc nhỏ) | A, B, C |
| E | 2–3 tuần | D đạt |
| F | 1–2 tuần | E |

Ước lượng là phỏng đoán ban đầu, chưa dựa trên số đo tốc độ làm thực tế.

## 7. Quyết định đã chốt (2026-09-24)

| # | Câu hỏi | Quyết định | Ảnh hưởng |
|---|---|---|---|
| 1 | Phân khúc đầu tiên | **Người dùng cá nhân (B2C)** | Giai đoạn D pilot với người làm việc máy tính; F theo mô hình freemium |
| 2 | Postgres | **Supabase** | B1: dùng connection string Supabase (pooler, `sslmode=require`) cho `DATABASE_URL`; E1 có thể dùng Supabase Auth |
| 3 | Nhạc nền | **Giữ** | B8 đổi thành: thay player YouTube ẩn bằng nguồn nhạc hợp lệ (file CC0 tự host, hoặc player YouTube **hiển thị** đúng ToS) — không bỏ tính năng |
| 4 | Giữ readings thô | **30 ngày**, sau đó chỉ giữ aggregate theo ngày | E2 + job xoá định kỳ |
| 5 | Thanh toán | **Quốc tế** (Stripe hoặc Paddle; Paddle lo VAT/thuế) | F. UX phải **ít phụ thuộc chữ**: màu + ký hiệu + số, chữ chỉ bổ trợ — áp dụng cho HUD, cửa sổ nổi, onboarding, báo cáo |

## 8. Nhật ký giai đoạn A (2026-09-24)

| # | Trạng thái | Chi tiết |
|---|---|---|
| A1 | Công cụ đo xong, **chưa có số đo camera thật** | `capture/bgStats.ts`; debug panel hiện dòng `bg:` và `console.info("[PostureCare][bg]")` mỗi lần tab ẩn → hiện lại. Quan sát sơ bộ (Chrome, tab ẩn, không camera): worker 100 ms giữ đúng nhịp, `setTimeout(1000)` main thread mất ~1250 ms. Ghi số thật vào `Q-15` |
| A2 | Xong | `capture/loop.ts` + `capture/ticker(.worker).ts`: rAF khi hiện, worker 200 ms khi ẩn; không vẽ overlay khi ẩn; tự `play()` lại video nếu bị pause |
| A3 | Xong | Heartbeat chạy bằng worker ticker (`App.tsx`) |
| A4 | Xong | `session/notify.ts`: xin quyền khi bấm Start camera; `alert`/`escalate` → system notification khi ẩn; báo nếu bị chặn. `WEB-010` |
| A5 | Xong (Chromium) | `overlay/PipHud.tsx`: nút “⧉ Cửa sổ nổi” ở tab Giám sát; vòng màu + cm + ký hiệu hướng chỉnh, nút ✓ khi escalate. `WEB-011` |
| A6 | Xong | `public/manifest.webmanifest`, icon 192/512/svg, `sw.js` không cache (chỉ để cài được), đăng ký chỉ ở bản prod |

**Checklist đo tay A1 (cần người ngồi trước camera):** mỗi trình duyệt — (a) ẩn tab 1 phút, (b) minimize cửa sổ 1 phút, (c) ẩn > 6 phút, (d) ngồi quá gần 60 s khi tab ẩn → có đúng 1 system notification, (e) server không sang `away` khi mặt vẫn có. Ghi dòng `bg:` sau mỗi lần.

## 9. Nhật ký giai đoạn B (2026-09-24)

| # | Trạng thái | Chi tiết |
|---|---|---|
| B1 | **Xong, đang chạy production** (2026-09-24) — Fly `DATABASE_URL` → Supabase (kết nối trực tiếp `db.<ref>.supabase.co:5432`, IPv6). Mật khẩu có ký tự đặc biệt phải URL-encode (`@` → `%40`) | `apps/api/db.py`: nhận `postgres://`/`postgresql://` của Supabase, tự dùng driver psycopg 3; pooler `:6543` tắt prepared statements; host không phải local → `sslmode=require` |
| B2 | Xong, production ở revision `0003` (0002/0003 bật RLS cho mọi bảng `public` — Supabase mở `public` qua REST API cho anon key). Backup chưa kiểm | Alembic `apps/api/migrations/`, chạy tự động khi API khởi động (`migrate.py`); DB cũ tạo bằng `create_all` được stamp `0001`. Test trên SQLite (máy dev không có Docker). **Chưa chạy trên Postgres thật.** Backup: kiểm gói Supabase đang dùng có backup hằng ngày không |
| B3 | Code một phần, chờ test tay | Thêm lỗi camera bận (`NotReadableError` → hướng dẫn đóng Zoom/Meet/OBS) và thiếu HTTPS; lỗi lạ hiện tên lỗi thay vì chuỗi thô. Checklist tay: từ chối quyền / không camera / camera bận / model lỗi, trên từng trình duyệt |
| B4 | Chưa | Đo FPS thật — cần máy thật, không làm được từ đây |
| B5 | Backend xong (tắt mặc định) | `observability.py`: bật khi có `SENTRY_DSN`; không PII, không body request, che `X-Device-Token`. Frontend chưa (thêm khi có DSN, cần cân nhắc +~30 KB bundle) |
| B6 | Xong | `ratelimit.py` (`WEB-013`) + giới hạn độ dài input; Pages proxy chuyển IP người dùng qua `X-PostureCare-Client-IP` |
| B7 | Chưa | Tách `App.tsx` thành hook — để sau khi A1/B3 test tay xong, tránh refactor lúc chưa có đường test |
| B8 | Xong | Player YouTube thành khung hiển thị góc dưới trái có control; SRS Focus `FR-F012`/UC-F06 đã cập nhật |
| Retention | Xong | `WEB-012`: xoá readings > 30 ngày, quét mỗi giờ trong vòng tick |

**Để bật Postgres production (bạn tự chạy, để connection string không đi qua chat):**
1. Supabase → New project, region **Southeast Asia (Singapore)**.
2. Project Settings → Database → Connection string → chọn **Session pooler** hoặc **Transaction pooler** (URI).
3. `fly secrets set DATABASE_URL='postgresql://...' -a posturecare-api` (Fly tự redeploy). API tự tạo bảng khi khởi động.
4. Deploy code mới: `cd apps/api && fly deploy`; web: `cd apps/web && npm run build && npx wrangler pages deploy dist`.
5. Kiểm: `curl https://posturecare-api.fly.dev/api/health`, rồi `fly logs -a posturecare-api` không có lỗi migration.
