# Đặc tả yêu cầu phần mềm (SRS)

**Sản phẩm:** Focus Hub & Pomodoro (tab "⏱️ Focus Hub" trong PostureCare Dashboard)
**Phiên bản tài liệu:** 0.1 — trình bày theo mẫu SRS + đặc tả use case (hạng mục / luồng tác nhân–hệ thống), **ngang hàng** với `dac-ta-posturecare-camera.md`
**Ngày:** 2026-09-15
**Phạm vi release:** **V0** (đã có trong code, chạy độc lập phía trình duyệt). Đồng bộ hai chiều với phiên theo dõi tư thế chỉ ở mức tín hiệu `break` start/end.
**Nguồn:** codebase (`dashboard/gPBL/backend/static/focus.js`, `index.html`, `app.js`, `routers/api.py`, `session_manager.py`), `UPDATE.md`

| Hạng mục | Nội dung |
|---|---|
| Loại tài liệu | SRS / đặc tả nghiệp vụ + use case |
| Fact / giả định / quyết định / mở | Tách trong mục 3 và 16 |
| Không suy diễn | Không có thống kê Pomodoro nào được lưu ở backend — xác nhận bằng grep, không đoán |
| Quan hệ với tài liệu khác | Đọc cùng `dac-ta-posturecare-camera.md`; UC-07 (Nghỉ giữa phiên) và BRULE-004/006 của tài liệu đó là điểm nối trực tiếp với tài liệu này |

---

## Danh sách use case (V0)

| Mã | Tên | Tác nhân chính | Ưu tiên |
|---|---|---|---|
| [UC-F01](#uc-f01--bắt-đầuchạy-phiên-pomodoro) | Bắt đầu/chạy phiên Pomodoro | Người dùng | Must |
| [UC-F02](#uc-f02--tạm-dừng-đặt-lại-và-chọn-preset) | Tạm dừng, đặt lại, chọn preset | Người dùng | Must |
| [UC-F03](#uc-f03--đồng-bộ-nghỉ-pomodoro-với-phiên-theo-dõi) | Đồng bộ nghỉ Pomodoro với phiên theo dõi | Người dùng, Hệ thống | Must |
| [UC-F04](#uc-f04--governor-gợi-ý-nghỉ-tự-khởi-động-pomodoro) | Governor gợi ý nghỉ tự khởi động Pomodoro | Hệ thống | Should |
| [UC-F05](#uc-f05--quản-lý-task-và-đếm-pomodoro-hoàn-thành) | Quản lý task và đếm Pomodoro hoàn thành | Người dùng | Should |
| [UC-F06](#uc-f06--âm-thanh-nền-và-nhạc-tùy-chỉnh) | Âm thanh nền và nhạc tùy chỉnh | Người dùng | Should |
| [UC-F07](#uc-f07--nhắc-bằng-giọng-nói-và-chuông-báo) | Nhắc bằng giọng nói và chuông báo | Người dùng | Should |
| [UC-F08](#uc-f08--đổi-giao-diện-nền-theme) | Đổi giao diện nền (theme) | Người dùng | Could |
| [UC-F09](#uc-f09--calibrate-tư-thế-0-từ-focus-hub) | Calibrate tư thế 0° từ Focus Hub | Người dùng | Must |
| [UC-F10](#uc-f10--cấu-hình-cooldown-gọi-ai) | Cấu hình cooldown gọi AI | Người dùng | Should |

---

## 1. Mục đích và phạm vi

| Hạng mục | Nội dung |
|---|---|
| Mục tiêu nghiệp vụ | Cho người dùng một vòng làm việc/nghỉ kiểu Pomodoro ngay trong dashboard đang theo dõi tư thế, để "nghỉ" của Pomodoro và "nghỉ" của phiên theo dõi là cùng một khái niệm, không phải hai đồng hồ lệch nhau. |
| Ý tưởng một câu | Hẹn giờ Focus/Break chạy ở trình duyệt → khi Break bắt đầu/kết thúc, báo cho backend để phiên theo dõi chuyển state `break`/`monitoring` theo. |
| Ranh giới sản phẩm V0 | Toàn bộ vòng lặp đếm giờ, task, âm thanh, giọng đọc, theme chạy **hoàn toàn phía client**, lưu `localStorage`. Backend chỉ nhận 2 tín hiệu: bắt đầu nghỉ / kết thúc nghỉ. |
| Trong phạm vi V0 | Đếm Focus/Break, preset thời lượng, task list gắn 🍅, âm thanh nền (file thật + tổng hợp Web Audio), nhạc YouTube, chuông báo, TTS nhắc, theme nền, đồng bộ break 2 chiều với session, calibrate tư thế nhanh, cấu hình cooldown gọi AI. |
| Ngoài phạm vi V0 | Lưu Pomodoro theo tài khoản/thiết bị ở server; đưa số liệu Pomodoro vào Session Report; đồng bộ nhiều tab/nhiều máy; lịch sử Pomodoro dài hạn; thống kê năng suất. |
| V1 (sau, đề xuất) | Lưu `pc_settings`/`pc_tasks` xuống server theo `session_id` hoặc `user_id` (cần identity V1 của tài liệu posturecare-camera); đưa `sessionsCompleted` vào Session Report. |
| Không dùng làm KPI | "Số Pomodoro hoàn thành" không phải thước đo năng suất đã kiểm chứng — chỉ là bộ đếm hiển thị cho người dùng tự thấy tiến độ. |

**Acceptance bản V0:** mở tab Focus Hub thấy đồng hồ 25:00 sẵn sàng chạy; Start chạy đếm ngược thật; hết giờ Focus tự chuyển Break và phát âm báo; Start/End Break gọi API `session/break`; đổi preset đổi được thời lượng khi đang idle; refresh trang không mất `settings`/`tasks` (đọc lại từ `localStorage`); tắt hẳn trình duyệt giữa phiên rồi mở lại vẫn giữ được task list và số Pomodoro đã hoàn thành (vì lưu client, không phụ thuộc `session_id`).

### 1.1 Định nghĩa

| Thuật ngữ | Nghĩa |
|---|---|
| Phiên Pomodoro | Vòng đếm Focus→Break chạy trên `focusTimer` (biến JS), không có ID, không gửi lên server ngoài tín hiệu break. |
| Phiên theo dõi (tracking session) | Đối tượng `session_id` phía backend, đặc tả đầy đủ ở `dac-ta-posturecare-camera.md`. Focus Hub chỉ tác động state `monitoring ⇄ break` của phiên này. |
| Đồng bộ nghỉ (break sync) | `POST /api/session/break` khi Break bắt đầu, `POST /api/session/break/end` khi Break kết thúc/Reset. Một chiều gọi từ Focus Hub → session; **không có chiều ngược lại tự động** trừ khi governor gợi ý (UC-F04). |
| Pending kind | Trạng thái `focusTimer.pendingKind` (`focus` \| `break`) quyết định Start tiếp theo chạy Focus hay Break, chọn qua preset hoặc mặc định `focus`. |
| Ambient sound | Âm thanh nền: phát file có sẵn (`GET /api/sounds`) hoặc tổng hợp bằng Web Audio (`rain`/`ocean`/`breeze`/`white` không có file). |
| Task | Bản ghi việc cần làm lưu `localStorage` (`pc_tasks`), có bộ đếm 🍅 riêng, không liên quan `session_id`. |

### 1.2 Tham số mặc định và bền vững hóa (đã có trong code)

| Tham số | Giá trị mặc định | Khoảng cho phép (UI) | Lưu ở đâu |
|---|---|---|---|
| Focus length | 25 phút (hoặc `insight_window_minutes` từ `/api/rules` nếu người dùng **chưa từng** lưu settings) | 5–60 phút, bước 5 | `localStorage.pc_settings` |
| Break length | 5 phút | 1–30 phút, bước 1 | như trên |
| Preset nhanh | 25m Focus, 50m Deep Work, 5m Break, 15m Rest | cố định 4 nút | UI, ghi đè vào `focusMinutes`/`breakMinutes` |
| Ambient volume | 0.5 | 0–100% | `localStorage.pc_settings` |
| Alarm volume | 0.6 | 0–100% | như trên |
| Voice (TTS) volume | 0.8, mặc định **tắt** | 0–100% | như trên |
| YouTube volume | 0.5 | 0–100% | như trên |
| Theme nền | `slate` (slate / midnight / forest / sunset / ocean) | 5 lựa chọn cố định | như trên |
| Task đang chọn | không có | — | `localStorage.pc_active_task_id` |
| Cooldown Get Advice (AI) | 60 s | 10–300 s | server `rules.json` qua `PUT /api/settings/cooldowns` |
| Cooldown Insight (AI) | 60 s | 10–300 s | như trên |

`hadSavedSettings` (đọc trước khi ghi mặc định) đảm bảo backend chỉ được set `focusMinutes` ban đầu **một lần duy nhất**, lần đầu người dùng mở app — sau khi người dùng tự lưu settings, lựa chọn của họ luôn thắng (`focus.js:706-720`).

---

## 2. Stakeholders và người dùng

| ID | Nhóm | Mục tiêu | Trách nhiệm | Quan ngại |
|---|---|---|---|---|
| SH-F01 | Người dùng cuối | Làm việc theo nhịp Pomodoro, nghỉ đúng lúc | Bấm Start/Pause, chọn preset, thêm task | Đồng hồ Pomodoro và nhắc tư thế đá nhau, âm thanh gây phiền |
| SH-F02 | Demo / giảng viên | Cho thấy nghỉ Pomodoro = nghỉ phiên tư thế | Bấm Start break từ toast governor | Hai đồng hồ không khớp khi demo |
| SH-F03 | Phát triển | Giữ Focus Hub độc lập, không phá vỡ session_manager | Chỉ gọi 2 endpoint break start/end | Debug logging còn sót trong code sản phẩm (mục 13) |

---

## 3. Giả định, phụ thuộc, ràng buộc

| ID | Loại | Phát biểu | Tác động | Trạng thái |
|---|---|---|---|---|
| A-F01 | Giả định | Người dùng dùng một trình duyệt, một máy cho một "vòng Pomodoro" | `localStorage` không đồng bộ đa thiết bị/đa trình duyệt | **Chốt V0** |
| A-F02 | Giả định | `focusTimer` không có ID riêng, không map 1-1 với `session_id` | Đóng tracking session không tự dừng/</br>reset Pomodoro | Fact từ code |
| A-F03 | Giả định | Governor chỉ **gợi ý** Start break qua toast, không tự bắt đồng hồ Pomodoro chạy nếu Pomodoro đang chạy dở Focus | Không cắt ngang Focus đang chạy | Fact (`handleGovernorAction`, chỉ tác động khi `focusTimer.mode === "idle"`) |
| D-F01 | Phụ thuộc | `Notification`, `AudioContext`, `speechSynthesis`, YouTube IFrame API | Trình duyệt cũ/chặn quyền → tính năng tương ứng im lặng rớt, không crash | Ràng buộc |
| D-F02 | Phụ thuộc | `GET /api/sounds` đọc thư mục `backend/static/sounds/` | Thêm/xoá file mp3 = thêm/xoá tuỳ chọn, không cần sửa code | Fact |
| D-F03 | Phụ thuộc | Autoplay YouTube/audio cần cử chỉ người dùng (click Start/Play) | Nếu gọi ngoài click handler sẽ bị trình duyệt chặn | Ràng buộc trình duyệt |
| C-F01 | Ràng buộc | Không lưu Pomodoro/task ở backend | Đổi máy/xoá site data = mất hết task, số 🍅 | Giữ ở V0, ghi rõ cho người dùng |
| C-F02 | Ràng buộc | Chỉ một nguồn âm thanh phát cùng lúc (ambient **hoặc** YouTube) | Bật cái này tắt cái kia | Giữ, đã code trong `playSelectedAmbient`/`playYoutubeUrl` |

---

## 4. Yêu cầu nghiệp vụ

| ID | Yêu cầu | Lý do | Ưu tiên | Release | Bằng chứng chấp nhận |
|---|---|---|---|---|---|
| BR-F001 | Có đồng hồ Pomodoro Focus/Break ngay trong dashboard đang theo dõi tư thế | Không cần app Pomodoro rời | Must | V0 | Tab Focus Hub chạy đếm thật |
| BR-F002 | Nghỉ Pomodoro và nghỉ phiên theo dõi phải là **cùng một trạng thái** phía backend | Tránh báo cáo/exposure sai khi user đang nghỉ Pomodoro mà hệ thống vẫn tính đang ngồi | Must | V0 | `session.state === "break"` khi Break đang chạy |
| BR-F003 | Gợi ý nghỉ từ governor (ngồi lâu) có thể khởi động luôn Pomodoro break | Một hành động, hai lợi ích | Should | V0 | Bấm "Start break" trên toast chạy đếm ngược Pomodoro |
| BR-F004 | Người dùng theo dõi việc đang làm và số Pomodoro đã hoàn thành cho từng việc | Gắn context công việc vào phiên tập trung | Should | V0 | Task list + đếm 🍅 mỗi task |
| BR-F005 | Không ép âm thanh/giọng đọc — mặc định tắt hoặc âm lượng vừa phải | Tránh làm phiền, giữ quyền chọn | Must | V0 | `voiceEnabled=false` mặc định; mọi âm lượng có thể kéo về 0 |
| BR-F006 | Không tốn thêm chi phí AI vì Focus Hub | Focus Hub không tự gọi LLM | Must | V0 | Không có lời gọi OpenRouter nào từ `focus.js` |

---

## 5. Yêu cầu người dùng

| ID | Actor | Nhu cầu | Giá trị | Ưu tiên | BR |
|---|---|---|---|---|---|
| UR-F001 | Người dùng | Bấm Start là chạy đếm ngược Focus ngay | Không cấu hình trước khi dùng | Must | BR-F001 |
| UR-F002 | Người dùng | Chọn nhanh 25/50/5/15 phút | Không phải kéo thanh trượt mỗi lần | Should | BR-F001 |
| UR-F003 | Người dùng | Nghỉ Pomodoro thì hệ thống theo dõi tư thế cũng biết là đang nghỉ | Không bị nhắc tư thế trong lúc nghỉ, không cộng "ngồi lâu" | Must | BR-F002 |
| UR-F004 | Người dùng | Governor báo "ngồi lâu, nên nghỉ" thì bấm một nút là nghỉ luôn cả hai bên | Đỡ thao tác kép | Should | BR-F003 |
| UR-F005 | Người dùng | Ghi việc đang làm, thấy đã hoàn thành bao nhiêu Pomodoro cho việc đó | Theo dõi tiến độ | Should | BR-F004 |
| UR-F006 | Người dùng | Bật nhạc nền / tiếng ồn trắng khi tập trung | Hỗ trợ tập trung | Could | — |
| UR-F007 | Người dùng | Nghe nhắc bằng giọng nói nếu muốn, tắt được | Không phụ thuộc nhìn màn hình | Could | BR-F005 |
| UR-F008 | Người dùng | Calibrate tư thế 0° ngay tại Focus Hub, không phải chuyển tab | Ít thao tác | Must | — |
| UR-F009 | Người demo | Chỉnh cooldown gọi AI khi demo nhiều lần liên tiếp | Tránh chờ cooldown mặc định khi demo | Should | BR-F006 |

---

## 6. Yêu cầu chức năng

Mẫu: *Hệ thống shall [hành vi] khi [trigger] nếu [tiền điều kiện].*

| ID | Tên | Phát biểu | Trigger | Ngoại lệ | Ưu tiên | UC |
|---|---|---|---|---|---|---|
| FR-F001 | Đếm Focus | Đếm ngược `focusMinutes` phút, hết giờ tự phát 2 tiếng báo, tăng `sessionsCompleted`, tăng 🍅 của task đang active, rồi tự chuyển sang Break | Start khi `pendingKind=focus` | Không có task active → chỉ tăng `sessionsCompleted`, không tăng 🍅 nào | Must | UC-F01 |
| FR-F002 | Đếm Break | Đếm ngược `breakMinutes` phút, hết giờ phát 1 tiếng báo, gọi `session/break/end`, về `idle` | Tự động sau Focus, hoặc Start khi `pendingKind=break` | — | Must | UC-F01, F03 |
| FR-F003 | Pause/Resume | Dừng/tiếp interval đếm mà không mất `remainingSec` | Bấm Pause khi đang chạy | Bấm khi `mode=idle` → không làm gì | Must | UC-F02 |
| FR-F004 | Reset | Về `idle`, `remainingSec=0`; nếu đang Break thì gọi `session/break/end` trước | Bấm Reset | — | Must | UC-F02 |
| FR-F005 | Preset | 4 nút set `focusMinutes` hoặc `breakMinutes` và `pendingKind` tương ứng; chỉ áp dụng hiển thị ngay nếu đang `idle` | Bấm preset | Đang chạy dở → giá trị mới chỉ dùng cho lượt Start kế tiếp | Must | UC-F02 |
| FR-F006 | Đồng bộ break vào session | Start Break gọi `POST /api/session/break`; kết thúc Break (hết giờ hoặc Reset) gọi `POST /api/session/break/end` | Vào/ra trạng thái Break | Request lỗi → Pomodoro vẫn chạy tiếp cục bộ, không rollback UI (best-effort, có try/catch) | Must | UC-F03 |
| FR-F007 | Governor → Pomodoro | Khi toast governor có nút "Start break" và `focusTimer.mode === "idle"`, bấm nút vừa gọi `session/break` vừa gọi `startBreak()` local | Governor gợi ý nghỉ (BRULE-006 của tài liệu posturecare-camera) | Nếu Pomodoro đang chạy Focus dở → chỉ đồng bộ session, **không** cắt ngang Focus | Should | UC-F04 |
| FR-F008 | Task CRUD | Thêm/sửa trạng thái done/xoá/chọn active task; task rỗng bị chặn submit | Form/click trong task list | — | Should | UC-F05 |
| FR-F009 | Đếm 🍅 theo task | Mỗi lần Focus hoàn thành cộng 1 vào `pomodoros` của task đang active | `onFocusComplete` | Không có active task → bỏ qua, không lỗi | Should | UC-F05 |
| FR-F010 | Danh sách âm thanh | Lấy danh sách file từ `GET /api/sounds`; nếu id không khớp file nào thì phát bằng tổng hợp Web Audio (`rain`/`ocean`/`breeze`/`white`) | Mở Focus Hub / mở Settings | `/api/sounds` lỗi → danh sách rỗng, vẫn còn "None" | Should | UC-F06 |
| FR-F011 | Một nguồn âm thanh | Bật ambient thì tắt YouTube và ngược lại | Chọn ambient hoặc Play YouTube | — | Should | UC-F06 |
| FR-F012 | Nhạc YouTube | Trích `videoId` từ link, phát qua IFrame API trong **khung player hiển thị** (góc dưới trái, có control của YouTube; ẩn khi Stop — không dùng player ẩn 1×1 vì trái chính sách API YouTube), chỉnh volume qua `setVolume` | Nhập link, bấm Play | Link không hợp lệ → thông báo lỗi, không phát | Should | UC-F06 |
| FR-F013 | Giọng nói nhắc | Đọc `spoken_line`/`toast` của advice khi `voiceEnabled=true`; không đọc chồng nếu đang nói | Advice mới kind alert/escalate | TTS không hỗ trợ / bị tắt → im lặng, không lỗi | Should | UC-F07 |
| FR-F014 | Chuông báo | Phát tone ngắn qua Web Audio khi Focus/Break hoàn thành, âm lượng theo `alarmVolume` | Hết giờ đếm | `alarmVolume=0` → không phát | Should | UC-F01 |
| FR-F015 | Thông báo trình duyệt | Xin quyền `Notification` khi Start lần đầu; bắn notify khi hoàn thành Focus/Break | Start Focus/Break lần đầu | Quyền bị từ chối → không notify, không chặn timer | Could | UC-F01 |
| FR-F016 | Theme nền | Đổi `data-focus-theme` trên `<html>` theo lựa chọn | Bấm swatch theme | — | Could | UC-F08 |
| FR-F017 | Calibrate nhanh | Nút Calibrate trong Focus Hub gọi cùng API calibrate tư thế 0° như UC-02 (tài liệu posturecare-camera) | Bấm 🎯 Calibrate | Không có mặt → như E1 của UC-02 | Must | UC-F09 |
| FR-F018 | Cooldown AI | Cho chỉnh `analyze_cooldown_sec`/`insight_cooldown_sec` (10–300s), lưu vào `rules.json` qua `PUT /api/settings/cooldowns`, áp dụng ngay cho Get Advice/Insight | Kéo thanh trong Settings | Ngoài khoảng → 422 validation lỗi | Should | UC-F10 |
| FR-F019 | Mặc định Focus theo rules | Nếu người dùng **chưa từng lưu** settings, lấy `insight_window_minutes` từ `/api/rules` làm `focusMinutes` mặc định | Lần tải trang đầu tiên, sau khi `/api/rules` trả về | Đã từng lưu settings → bỏ qua, giữ lựa chọn cũ | Should | UC-F01 |

---

## 7. Đặc tả use case

Quy ước luồng: **Bước** | **Tác nhân** | **Hệ thống**.
A = luồng thay thế; E = ngoại lệ.

### UC-F01 — Bắt đầu/chạy phiên Pomodoro

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F01 |
| Tên | Bắt đầu/chạy phiên Pomodoro |
| Tác nhân chính | Người dùng |
| Mô tả tóm tắt | Người dùng bấm Start, đồng hồ đếm ngược Focus chạy; hết giờ tự chuyển Break, hết Break quay lại `idle`. |
| Sự kiện kích hoạt | Bấm "▶ Start Focus" (hoặc "▶ Start Break" nếu `pendingKind=break`) |
| Điều kiện tiên quyết | Tab Focus Hub đã tải (`initFocusUI()` chạy xong) |
| Đảm bảo thành công | `focusTimer.mode` chuyển đúng chuỗi `focus → break → idle`; UI đếm ngược đúng `focusMinutes`/`breakMinutes` |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-F001, FR-F001, FR-F002, FR-F014, FR-F015, FR-F019 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Bấm Start | Xin quyền Notification; nếu có ambient sound đã chọn thì phát; disable nút Start, enable Pause/Reset |
| 2 | — | Đặt `mode=focus`, `remainingSec=focusMinutes×60`, chạy `setInterval` 1 giây |
| 3 | Chờ | Mỗi giây cập nhật vòng tiến độ + số đếm `mm:ss` |
| 4 | — | Hết giờ: `sessionsCompleted++`, tăng 🍅 task active, phát 2 tiếng báo, notify "Time for a break", tự gọi `startBreak()` |
| 5 | — | `mode=break`, đếm ngược `breakMinutes`, đồng thời `POST /api/session/break` (UC-F03) |
| 6 | Chờ hết Break | Phát 1 tiếng báo, notify "Ready for another focus session?", `POST /api/session/break/end`, về `idle` |

**Tiêu chí chấp nhận**

- Given `focusMinutes=25`, when Start, then đồng hồ hiển thị đếm từ `25:00` xuống `00:00` thật (không giả lập tĩnh).
- Given Focus vừa hết giờ, when quan sát network, then có đúng một `POST /api/session/break` gửi đi cho lượt Break tiếp theo.

---

### UC-F02 — Tạm dừng, đặt lại, và chọn preset

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F02 |
| Tên | Tạm dừng, đặt lại, chọn preset |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Bấm Pause/Resume, Reset, hoặc một nút preset |
| Điều kiện tiên quyết | Focus Hub đã tải |
| Đảm bảo thành công | Pause giữ nguyên `remainingSec`; Reset về `idle` và đóng Break session nếu đang mở; preset đổi đúng thời lượng tương ứng |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-F002, FR-F003, FR-F004, FR-F005 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1a | Bấm Pause (đang chạy) | Dừng interval, giữ `remainingSec`, đổi nút thành "▶ Resume" |
| 1b | Bấm Resume | Chạy lại interval từ `remainingSec` hiện tại |
| 2 | Bấm Reset | Nếu `mode=break` → gọi `session/break/end`; dừng interval; về `idle`, `remainingSec=0` |
| 3 | Bấm preset (vd 50m Deep Work) | Ghi `focusMinutes=50` (hoặc `breakMinutes` nếu preset là break); nếu đang `idle` thì cập nhật hiển thị ngay |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 3 | Đang chạy dở một phiên | Giá trị preset chỉ áp dụng cho lượt Start kế tiếp, không cắt ngang phiên hiện tại | Phiên hiện tại chạy hết bình thường |

**Tiêu chí chấp nhận**

- Given đang Focus 10:00 còn lại, when Pause rồi Resume, then đồng hồ tiếp tục từ 10:00, không nhảy về giá trị khác.
- Given đang `idle`, when bấm preset "15m Rest", then nút Start đổi thành "▶ Start Break" và số hiển thị 15:00.

---

### UC-F03 — Đồng bộ nghỉ Pomodoro với phiên theo dõi

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F03 |
| Tên | Đồng bộ nghỉ Pomodoro với phiên theo dõi |
| Tác nhân chính | Hệ thống (Focus Hub → backend) |
| Tác nhân phụ | Người dùng |
| Mô tả tóm tắt | Break của Pomodoro và state `break` của phiên theo dõi tư thế là một; Focus Hub là phía chủ động gọi API. |
| Sự kiện kích hoạt | Break bắt đầu (tự động sau Focus, hoặc Start Break thủ công) / Break kết thúc (hết giờ hoặc Reset) |
| Điều kiện tiên quyết | Backend đang chạy; có (hoặc không có) phiên theo dõi ACTIVE — cả hai trường hợp đều không chặn Pomodoro |
| Đảm bảo thành công | `session.state = "break"` trong lúc Pomodoro Break; trở lại `monitoring` (nếu còn mặt) hoặc `away` sau khi Break kết thúc — theo `session_manager.leave_break()` |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-F003, FR-F006 |
| Quy tắc liên quan | BRULE-004, BRULE-006 (tài liệu posturecare-camera) |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Break bắt đầu | Focus Hub gọi `POST /api/session/break` |
| 2 | — | `session_manager.enter_break()`: cộng nốt exposure tới thời điểm này, chuyển state `break`, tắt LED, dừng đếm exposure |
| 3 | Break kết thúc | Focus Hub gọi `POST /api/session/break/end` |
| 4 | — | `session_manager.leave_break()`: nếu `face_present` → về `monitoring`, tiếp tục đếm exposure; nếu không → vào `away` |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 1, 3 | Không có phiên theo dõi nào ACTIVE (chưa Start camera) | API trả về snapshot session rỗng/idle; Pomodoro vẫn chạy | Không lỗi, chỉ là không có gì để đồng bộ |
| E2 | 1, 3 | Request mạng lỗi | `catch` nuốt lỗi, không rollback Pomodoro | Pomodoro tiếp tục chạy cục bộ, session có thể lệch trạng thái tới lần gọi kế tiếp thành công |

**Tiêu chí chấp nhận**

- Given phiên theo dõi đang `monitoring` và có mặt, when Pomodoro Break bắt đầu, then `session.state` đổi thành `break` và exposure ngừng cộng.
- Given Break kết thúc và người dùng vẫn ngồi trước camera, when kiểm tra session, then `state` trở lại `monitoring`, phút ngồi không bị reset về 0 (không đi qua nhánh away ≥ 3 phút).

---

### UC-F04 — Governor gợi ý nghỉ tự khởi động Pomodoro

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F04 |
| Tên | Governor gợi ý nghỉ tự khởi động Pomodoro |
| Tác nhân chính | Hệ thống (governor phía posture) |
| Tác nhân phụ | Người dùng (bấm nút trên toast) |
| Mô tả tóm tắt | Khi hệ thống theo dõi tư thế gợi ý nghỉ (ngồi đủ lâu — UC-07 của tài liệu posturecare-camera), nút "Start break" trên toast vừa đóng phiên theo dõi vừa khởi động luôn đồng hồ Pomodoro nếu nó đang rảnh. |
| Sự kiện kích hoạt | Toast governor có action `start_break`, người dùng bấm |
| Điều kiện tiên quyết | `focusTimer.mode === "idle"` |
| Đảm bảo thành công | Cả `session.state=break` và Pomodoro Break cùng chạy, cùng một hành động bấm |
| Ưu tiên | Should (V0) |
| Yêu cầu liên quan | UR-F004, FR-F007 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Toast "Nên nghỉ" xuất hiện | Governor đã qualify điều kiện ngồi lâu (BRULE-006) |
| 2 | Bấm "Start break" | Gọi `POST /api/session/break` |
| 3 | — | Nếu `focusTimer.mode === "idle"` thì gọi thêm `startBreak()` cục bộ (Pomodoro đếm ngược `breakMinutes` phút) |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 3 | Pomodoro đang chạy dở Focus/Break | Chỉ đồng bộ session, không đụng tới đồng hồ Pomodoro đang chạy | Hai đồng hồ tạm thời lệch nhau, không tự canh lại |

**Tiêu chí chấp nhận**

- Given Pomodoro đang `idle` và governor gợi ý nghỉ, when bấm "Start break" trên toast, then đồng hồ Focus Hub tự nhảy sang đếm ngược Break.

---

### UC-F05 — Quản lý task và đếm Pomodoro hoàn thành

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F05 |
| Tên | Quản lý task và đếm Pomodoro hoàn thành |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Thêm task / chọn active / tick done / xoá |
| Điều kiện tiên quyết | — |
| Đảm bảo thành công | Task list và số 🍅 mỗi task khớp `localStorage.pc_tasks`; task đang active hiển thị ở "Working on: …" |
| Ưu tiên | Should (V0) |
| Yêu cầu liên quan | UR-F005, FR-F008, FR-F009 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Nhập tên việc, submit | Tạo task mới (`id`, `text`, `done=false`, `pomodoros=0`); nếu chưa có active task thì set task này active |
| 2 | Bấm ▶ trên một task | `setActiveTask(id)`; nhãn "Working on: …" đổi theo |
| 3 | Tick checkbox | `task.done` đổi, không ảnh hưởng đến việc còn là active hay không |
| 4 | Bấm ✕ | Xoá task; nếu đang là active thì bỏ active (không tự chọn task khác) |
| 5 | Hoàn thành một Focus (UC-F01 bước 4) | 🍅 của task **đang active** +1 |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 1 | Nhập chuỗi rỗng | Chặn submit, không tạo task | Không đổi trạng thái |
| E2 | 5 | Không có active task | Bỏ qua tăng 🍅, `sessionsCompleted` tổng vẫn tăng | Không lỗi |

**Tiêu chí chấp nhận**

- Given task A đang active, when hoàn thành 1 Focus, then task A có `pomodoros = trước đó + 1`, các task khác không đổi.
- Given không có task nào, when hoàn thành 1 Focus, then `Total Sessions Completed` vẫn tăng dù không có 🍅 nào được cộng.

---

### UC-F06 — Âm thanh nền và nhạc tùy chỉnh

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F06 |
| Tên | Âm thanh nền và nhạc tùy chỉnh |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Chọn chip âm thanh, kéo âm lượng, hoặc dán link YouTube rồi Play |
| Đảm bảo thành công | Đúng một nguồn âm thanh phát tại một thời điểm; âm lượng theo thanh trượt |
| Ưu tiên | Should (V0) |
| Yêu cầu liên quan | UR-F006, FR-F010, FR-F011, FR-F012 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Mở Focus Hub | Gọi `GET /api/sounds`, dựng danh sách chip (Rain, Ocean Waves, Forest Breeze, White Noise, …) |
| 2 | Chọn một chip | Nếu có file thật khớp `id` → phát file (`<audio loop>`); nếu không (vd `ocean`/`rain`/`breeze` không có file) → phát tiếng tổng hợp Web Audio tương ứng |
| 3 | Kéo âm lượng | Cập nhật `ambientVolume`, áp cho audio file **hoặc** gain node tổng hợp, tuỳ cái nào đang chạy |
| 4 | Dán link YouTube, bấm Play | Dừng mọi ambient đang phát, tải YouTube IFrame API, hiện khung player nhỏ góc dưới trái và phát, set volume |
| 5 | Bấm chip "None" hoặc Stop YouTube | Dừng nguồn đang phát; khung player YouTube ẩn đi |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 4 | Link không trích được `videoId` (11 ký tự) | Hiện "Couldn't read a video ID from that link", không phát | Không đổi trạng thái phát |
| E2 | 4 | Video lỗi/bị hạn chế nhúng | `onError` hiện "Couldn't play that video" | Không phát |
| E3 | 2 | `/api/sounds` lỗi/không có file | `availableSounds=[]`; vẫn còn 4 tuỳ chọn tổng hợp qua chip cứng trong HTML | Không chặn tính năng |

**Tiêu chí chấp nhận**

- Given đang phát Rain, when bấm Play YouTube với link hợp lệ, then Rain dừng và YouTube phát.
- Given kéo thanh âm lượng trong lúc đang phát tiếng tổng hợp, then âm lượng đổi ngay không cần bấm lại chip.

---

### UC-F07 — Nhắc bằng giọng nói và chuông báo

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F07 |
| Tên | Nhắc bằng giọng nói và chuông báo |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Bật "Speak advice & insights aloud"; hoặc Focus/Break kết thúc |
| Đảm bảo thành công | TTS chỉ đọc khi bật, không chồng tiếng; chuông báo phát đúng lúc hết giờ |
| Ưu tiên | Should (V0) |
| Yêu cầu liên quan | UR-F007, FR-F013, FR-F014 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Bật toggle giọng nói | Đọc thử "Voice reminders enabled." để xác nhận có tiếng |
| 2 | Governor phát advice alert/escalate | Nếu `voiceEnabled` và không đang nói → đọc `spoken_line`/`toast` bằng giọng tiếng Anh có sẵn của trình duyệt |
| 3 | Focus/Break hết giờ | Phát 1–2 tiếng "beep" tần số cố định qua Web Audio oscillator, theo `alarmVolume` |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 2 | Trình duyệt chưa cho phép audio (chưa có cử chỉ người dùng) | Câu nói được xếp hàng (`queuedSpeech`), phát ngay khi có click/keydown đầu tiên | Không mất câu nhắc, chỉ trễ |
| E2 | 2 | Đang nói dở câu trước | Bỏ qua câu mới, không xếp chồng | Không lỗi |

**Tiêu chí chấp nhận**

- Given `voiceEnabled=false`, when có advice alert mới, then không có âm thanh giọng nói nào phát ra.
- Given hết giờ Focus, when quan sát, then có đúng 2 tiếng beep liên tiếp cách nhau ~350 ms.

---

### UC-F08 — Đổi giao diện nền (theme)

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F08 |
| Tên | Đổi giao diện nền (theme) |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Bấm một swatch theme trong Settings |
| Đảm bảo thành công | `<html data-focus-theme="...">` đổi ngay, lưu lại cho lần sau |
| Ưu tiên | Could (V0) |
| Yêu cầu liên quan | FR-F016 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Bấm swatch (vd "Midnight") | Set `data-focus-theme="midnight"`, highlight nút đã chọn, lưu settings |

**Tiêu chí chấp nhận**

- Given chọn theme "Forest", when tải lại trang, then theme vẫn là "Forest" (đọc lại từ `localStorage`).

---

### UC-F09 — Calibrate tư thế 0° từ Focus Hub

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F09 |
| Tên | Calibrate tư thế 0° từ Focus Hub |
| Tác nhân chính | Người dùng |
| Mô tả tóm tắt | Nút "🎯 Calibrate (0,0,0)" trong banner tư thế của Focus Hub gọi **cùng handler** với nút calibrate ở tab AI Telemetry (`triggerCalibrateHeadPose`) — không phải một tính năng riêng, chỉ là lối tắt UI. |
| Sự kiện kích hoạt | Bấm 🎯 Calibrate trong Focus Hub |
| Điều kiện tiên quyết | Giống UC-02 (tài liệu posturecare-camera): tracking live, `face_present=true` |
| Đảm bảo thành công | Giống hệt UC-02 |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | FR-F017 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Bấm 🎯 Calibrate trong Focus Hub | Gọi `triggerCalibrateHeadPose(focusCalibrateBtn)`, cùng luồng UC-02 |

**Luồng ngoại lệ**

Xem UC-02/E1 (tài liệu posturecare-camera) — không lặp lại ở đây để tránh hai nguồn sự thật.

**Tiêu chí chấp nhận**

- Given có mặt, when bấm Calibrate ở Focus Hub, then góc pitch/roll/yaw hiển thị ở banner Focus Hub và ở tab AI Telemetry cùng về gần 0° (vì cùng một `pose_reference`).

---

### UC-F10 — Cấu hình cooldown gọi AI

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-F10 |
| Tên | Cấu hình cooldown gọi AI |
| Tác nhân chính | Người dùng |
| Mô tả tóm tắt | Cho phép rút ngắn/kéo dài khoảng cách tối thiểu giữa hai lần gọi Get Advice hoặc Insight, phục vụ demo hoặc hạn chế chi phí. |
| Sự kiện kích hoạt | Kéo thanh trượt "Manual Get Advice cooldown" hoặc "Insight cooldown" trong Settings |
| Điều kiện tiên quyết | Backend đang chạy |
| Đảm bảo thành công | `rules.json` cập nhật; lần Get Advice/Insight kế tiếp áp cooldown mới ngay, không cần khởi động lại backend |
| Ưu tiên | Should (V0) |
| Yêu cầu liên quan | UR-F009, FR-F018 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Kéo thanh trượt (10–300 s) | Cập nhật số hiển thị ngay khi kéo (`input`) |
| 2 | Thả tay (`change`) | `PUT /api/settings/cooldowns` với cả hai giá trị hiện tại; hiện "Saving..." rồi "Saved"/"Couldn't save" |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 2 | Backend trả lỗi (vd validation ngoài 10–300) | Hiện "Couldn't save"; giá trị UI vẫn đổi (chưa rollback) | Lệch UI/server tới lần sửa kế tiếp |
| E2 | 2 | Mất kết nối | Hiện "Connection error" | Như E1 |

**Tiêu chí chấp nhận**

- Given kéo "Manual Get Advice cooldown" xuống 10s, when bấm Get Advice hai lần cách nhau 10s, then lần thứ hai không bị chặn cooldown.

---

## 8. Yêu cầu dữ liệu

| ID | Đối tượng | Trường | Lưu ở đâu | Vòng đời | Ghi chú |
|---|---|---|---|---|---|
| DATA-F001 | Settings | `focusMinutes, breakMinutes, ambientSound, ambientVolume, alarmVolume, voiceEnabled, voiceVolume, youtubeUrl, youtubeVolume, theme` | `localStorage.pc_settings` | Sống tới khi người dùng xoá site data | Không có ở backend, không theo `session_id` |
| DATA-F002 | Task | `id (uuid), text, done, pomodoros` | `localStorage.pc_tasks` | như trên | `text` chỉ escape HTML khi render, không giới hạn nội dung ngoài `maxlength=120` ở input |
| DATA-F003 | Active task | id của task đang chọn | `localStorage.pc_active_task_id` | như trên | Rời khỏi task bị xoá thì về "No task selected" |
| DATA-F004 | Cooldown rules | `analyze_cooldown_sec, insight_cooldown_sec` | `rules.json` (server) | Sống tới khi sửa lại | Dùng chung nguồn với governor Get Advice/Insight |
| DATA-F005 | Session break signal | không có payload, chỉ là 2 endpoint POST | Không lưu riêng — phản ánh vào `DATA-001 Session.state` của tài liệu posturecare-camera | Theo vòng đời phiên theo dõi | Đây là **điểm nối duy nhất** giữa hai tài liệu ở tầng dữ liệu |

**Không có trong V0:** thống kê Pomodoro trong Session Report (DATA-005 của tài liệu posturecare-camera không có trường nào cho `sessionsCompleted`/task — xác nhận bằng grep mã nguồn backend, không có file `.py` nào tham chiếu `pomodoro`/`sessionsCompleted`/`focusMinutes`).

---

## 9. Yêu cầu giao diện

| ID | Giao diện | Hướng | Kênh | Dữ liệu | Lỗi | V0 |
|---|---|---|---|---|---|---|
| INT-F001 | Focus Hub ↔ FastAPI (break sync) | Ra | REST `POST /api/session/break`, `POST /api/session/break/end` | Không payload | Best-effort, nuốt lỗi | Có |
| INT-F002 | Focus Hub ↔ FastAPI (âm thanh) | Vào | REST `GET /api/sounds` | `{sounds: [{id,label,file}]}` | Danh sách rỗng | Có |
| INT-F003 | Focus Hub ↔ FastAPI (cooldown) | Ra | REST `PUT /api/settings/cooldowns` | `{analyze_cooldown_sec, insight_cooldown_sec}` | 422 nếu ngoài 10–300 | Có |
| INT-F004 | Focus Hub ↔ FastAPI (calibrate) | Ra | Dùng chung endpoint calibrate của tài liệu posturecare-camera | — | Như UC-02 | Có |
| INT-F005 | Trình duyệt ↔ YouTube IFrame API | Ra | HTTPS `youtube.com/iframe_api` | videoId | Video lỗi/hạn chế | Có, phụ thuộc mạng ngoài |
| INT-F006 | Trình duyệt ↔ `localStorage` | 2 chiều | Web Storage API | Settings, tasks | Storage bị chặn (private mode) → tính năng chạy nhưng không nhớ | Có |
| INT-F007 | Debug log (dev-only, xem mục 13) | Ra | `fetch 127.0.0.1:7881/ingest/...` + `POST /api/debug-client-log` | Payload hypothesis/log tuỳ biến | Nuốt lỗi | **Cần dọn trước khi release** |

---

## 10. Yêu cầu phi chức năng

Mẫu: *Dưới [điều kiện], hệ thống shall [hành vi] trong/tại [ngưỡng], đo bằng [cách].*

| ID | Thuộc tính | Kịch bản | Yêu cầu + metric | Ưu tiên | Kiểm chứng | Rủi nếu thiếu |
|---|---|---|---|---|---|---|
| NFR-F001 | Độ tin cậy | Mọi audio/TTS/Notification API lỗi hoặc bị chặn | Không throw ra ngoài, không làm dừng `setInterval` đếm giờ | Must | Tắt quyền Notification, thử Start | Đồng hồ Pomodoro treo |
| NFR-F002 | Bền vững | Refresh trang giữa lúc Focus đang chạy | `settings`/`tasks` còn nguyên; đồng hồ về `idle` (không resume đếm ngược, vì `focusTimer` không lưu) | Should | F5 giữa phiên | Người dùng tưởng bị mất tiến độ |
| NFR-F003 | Riêng tư | Link YouTube nhập vào | Không gửi lên backend, chỉ dùng client-side qua IFrame API | Must | Xem network tab | Rò link cá nhân |
| NFR-F004 | Khả năng dùng | Người mới vào Focus Hub | Có sẵn giá trị mặc định hợp lý (25/5 phút) không cần cấu hình | Must | Mở app lần đầu | Bối rối |
| NFR-F005 | Nhất quán | Break Pomodoro và break phiên theo dõi | Lệch nhau tối đa 1 request round-trip (không polling, gọi trực tiếp khi đổi trạng thái) | Should | Đo thời điểm gọi API vs thời điểm UI đổi mode | Báo cáo phiên tính sai exposure |
| NFR-F006 | Bảo trì | Code debug (`agentLog`, hardcoded `sessionId: "246fd2"`, cổng `7881`) | Không được lẫn vào bản chạy thật cho người dùng cuối | Must | Review `focus.js`, `routers/api.py` | Rò log nội bộ, gọi ra cổng debug không tồn tại ở máy người dùng |

---

## 11. Quy tắc nghiệp vụ

| ID | Tên | Phát biểu | Lý do | Ngoại lệ | Điểm thi hành |
|---|---|---|---|---|---|
| BRULE-F001 | Một nguồn âm thanh | Ambient và YouTube không phát đồng thời | Tránh chồng âm | — | `playSelectedAmbient`, `playYoutubeUrl` |
| BRULE-F002 | Break sync một chiều | Chỉ Focus Hub chủ động báo break cho session; session không tự đẩy Pomodoro chạy (trừ nút gợi ý governor, có điều kiện `idle`) | Tránh Pomodoro tự nhảy trạng thái ngoài ý muốn người dùng | UC-F04 | `handleGovernorAction` |
| BRULE-F003 | Preset không cắt ngang | Đổi preset khi đang chạy chỉ ảnh hưởng lượt kế tiếp | Không làm mất tiến độ đang đếm | — | `focusPresetBar` handler |
| BRULE-F004 | Mặc định Focus chỉ set một lần | `insight_window_minutes` chỉ ghi đè `focusMinutes` nếu chưa từng có `pc_settings` | Tôn trọng lựa chọn đã lưu của người dùng | — | `applyBackendDefaultFocusMinutes` |
| BRULE-F005 | Không lưu Pomodoro ở server | Toàn bộ settings/tasks chỉ ở `localStorage` | Giữ Focus Hub không phụ thuộc DB, không cần schema mới ở V0 | V1 có thể đổi | Toàn bộ `focus.js` |

---

## 12. Ma trận truy vết

| Mục tiêu | BR | UR / UC | FR | NFR / Rule | Kiểm thử |
|---|---|---|---|---|---|
| Đồng hồ Pomodoro hoạt động | BR-F001 | UR-F001, F002; UC-F01, F02 | FR-F001–F005 | NFR-F001, F002 | Start/Pause/Reset/preset thủ công |
| Nghỉ Pomodoro = nghỉ phiên | BR-F002, F003 | UR-F003, F004; UC-F03, F04 | FR-F006, F007 | NFR-F005; BRULE-F002 | Bấm Start break từ toast, kiểm tra `session.state` |
| Theo dõi việc + tiến độ | BR-F004 | UR-F005; UC-F05 | FR-F008, F009 | — | Thêm task, hoàn thành 1 Focus, xem 🍅 |
| Không ép âm thanh | BR-F005 | UR-F006, F007; UC-F06, F07 | FR-F010–F015 | BRULE-F001 | Tắt hết âm lượng, kiểm tra im lặng |
| Không đội chi phí AI | BR-F006 | UR-F009; UC-F10 | FR-F018 | — | Không có call OpenRouter từ `focus.js` |
| Dọn nợ kỹ thuật trước release | — | — | — | NFR-F006 | Review — xem mục 13 |

---

## 13. Nợ kỹ thuật quan sát được trong code (fact, không suy diễn)

| Vị trí | Hiện trạng | Rủi ro | Đề xuất |
|---|---|---|---|
| `focus.js:51-73` (`agentLog`) | Hàm gửi log debug tới `http://127.0.0.1:7881/ingest/<uuid>` kèm `sessionId`/`hypothesisId` hardcode, gọi ở nhiều nơi (`speak`, `initFocusUI`, `applySessionGovernor` trong `app.js`) | Người dùng cuối chạy app sẽ có các `fetch` lỗi tới cổng không tồn tại ở máy họ (âm thầm `catch`, nhưng vẫn tốn round-trip mỗi lần) | Gỡ trước khi coi Focus Hub là "xong"; đây là scaffolding từ một phiên debug, không phải tính năng |
| `routers/api.py:27-44` (`/api/debug-client-log`) | Ghi log ra đường dẫn tuyệt đối cứng `d:\Workspace\GBPL\debug-246fd2.log` | Không chạy được (hoặc ghi sai chỗ) trên máy không phải máy dev gốc; lộ cấu trúc thư mục nội bộ trong response nếu bật debug trình duyệt | Gỡ cùng với `agentLog` ở trên |
| `focus.js` toàn file | Không có test tự động nào cho `focusTimer`/task CRUD (chỉ có trong `tracking_AI/eval/`, thuộc phần CV) | Thay đổi logic đếm giờ dễ hồi quy âm thầm (vd đổi `tickFocus` sai điều kiện `<=0`) | Ngoài phạm vi tài liệu này — ghi nhận cho backlog kỹ thuật |

---

## 14. Hướng giai đoạn sau V0 (không thi hành trong V0)

| Lớp | Làm gì |
|---|---|
| V0 | Đúng như hiện trạng code: Pomodoro client-side, đồng bộ break 1 chiều, không lưu server |
| V1 | Lưu `pc_settings`/`pc_tasks` theo `user_id` (cần identity V1 của posturecare-camera); đưa `sessionsCompleted` + task hoàn thành vào Session Report |
| V2 | Thống kê năng suất nhiều phiên/nhiều ngày; đồng bộ đa thiết bị |

Dọn nợ kỹ thuật mục 13 nên làm **trước** V1, không gắn với việc thêm tính năng mới.

---

## 15. Việc kỹ thuật V0 (nếu cần chốt sổ tài liệu này)

1. Gỡ `agentLog`/`/api/debug-client-log`/log file hardcode (mục 13)
2. Xác nhận lại UC-F03/F04 bằng test tay: Start break thủ công và qua governor, quan sát `session.state`
3. Ghi rõ trong UI (không chỉ trong tài liệu) rằng Pomodoro/task là dữ liệu local-only, mất khi xoá site data

---

## 16. Câu hỏi mở và quyết định

| ID | Loại | Nội dung | Quyết định / hành động | Trạng thái |
|---|---|---|---|---|
| Q-F01 | Sản phẩm | Có nên đưa số Pomodoro vào Session Report không? | Chưa — cần thiết kế lại DATA-005 của tài liệu posturecare-camera | Mở |
| Q-F02 | UX | Governor gợi ý nghỉ khi Pomodoro đang chạy Focus dở — có nên hỏi xác nhận "cắt ngang Focus"? | Hiện tại: không cắt ngang, chỉ đồng bộ session (BRULE-F002) | Mở, có thể giữ nguyên |
| Q-F03 | Kỹ thuật | Debug logging (mục 13) gỡ khi nào? | Nên trước khi tính Focus Hub "hoàn thiện" | Mở |
| Q-F04 | Sản phẩm | Có cần đồng bộ đa tab cho Pomodoro giống session (UC-13 posturecare-camera) không? | V0: không — mỗi tab có `focusTimer` riêng trong bộ nhớ JS | Mở |
| Q-F05 | UX | `localStorage` đầy/bị chặn (private mode) có cần cảnh báo người dùng? | Hiện tại im lặng bỏ qua | Mở |
