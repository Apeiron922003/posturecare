# Đặc tả yêu cầu phần mềm (SRS)

**Sản phẩm:** PostureCare Camera (webcam laptop)  
**Phiên bản tài liệu:** 0.4 — trình bày theo mẫu SRS + đặc tả use case (hạng mục / luồng tác nhân–hệ thống)  
**Ngày:** 2026-09-13  
**Phạm vi release:** **V0** (vận hành + demo ý tưởng), gồm hai bề mặt triển khai **V0-desktop** (mục 1–16) và **V0-web** (mục 17, thêm ở bản 0.4). V1 identity, V2 survey/ads ghi riêng, không trộn vào luồng V0.  
**Nguồn:** codebase (`tracking_AI/`, `dashboard/gPBL/`, `rules.json`), `README.md`, `UPDATE.md`

| Hạng mục | Nội dung |
|---|---|
| Loại tài liệu | SRS / đặc tả nghiệp vụ + use case |
| Fact / giả định / quyết định / mở | Tách trong mục 3 và 16 |
| Không suy diễn | Sai số IPD chưa đo, chẩn đoán y khoa, lux từ pixel |

---

## Danh sách use case (V0)

| Mã | Tên | Tác nhân chính | Ưu tiên |
|---|---|---|---|
| [UC-01](#uc-01--bắt-đầu-phiên-bằng-webcam) | Bắt đầu phiên bằng webcam | Người dùng | Must |
| [UC-02](#uc-02--hiệu-chỉnh-gốc-tư-thế-0) | Hiệu chỉnh gốc tư thế 0° | Người dùng | Must |
| [UC-03](#uc-03--hiệu-chỉnh-khoảng-cách-ipd) | Hiệu chỉnh khoảng cách IPD | Người dùng | Must |
| [UC-04](#uc-04--theo-dõi-tư-thế-thời-gian-thực) | Theo dõi tư thế thời gian thực | Người dùng, Hệ thống | Must |
| [UC-05](#uc-05--nhận-và-xử-lý-cảnh-báo) | Nhận và xử lý cảnh báo | Người dùng, Hệ thống | Must |
| [UC-06](#uc-06--snooze-dnd-ack) | Snooze / DND / Ack | Người dùng | Must |
| [UC-07](#uc-07--nghỉ-giữa-phiên) | Nghỉ giữa phiên | Người dùng | Should |
| [UC-08](#uc-08--away-và-kết-thúc-idle) | Away và kết thúc idle | Hệ thống | Must |
| [UC-09](#uc-09--dừng-phiên-và-xem-báo-cáo) | Dừng phiên và xem báo cáo | Người dùng | Must |
| [UC-12](#uc-12--không-có-quyền--không-mở-được-camera) | Không có quyền / không mở camera | Người dùng | Must |
| [UC-13](#uc-13--tab-thứ-hai-gắn-vào-phiên) | Tab thứ hai gắn vào phiên | Người dùng | Must |
| [UC-14](#uc-14--đổi-ngưỡng-và-chế-độ-demo) | Đổi ngưỡng và chế độ demo | Người dùng | Should |
| UC-10, UC-11, UC-15 | Hỏi LLM / Advice LLM / proxy sáng | — | Won't (ngoài V0) |

---

## 1. Mục đích và phạm vi

| Hạng mục | Nội dung |
|---|---|
| Mục tiêu nghiệp vụ | Theo dõi tư thế và khoảng cách ngồi trên **laptop có webcam**, không cần kit ESP32; nhắc khi lệch **đủ lâu**; đóng phiên thì xem số liệu. |
| Ý tưởng một câu | Mở webcam → calibrate → theo dõi bằng **if-else** → nhắc / nghỉ → report. Không chẩn đoán bệnh. Không AI trên đường nóng V0. |
| Ranh giới sản phẩm V0 | App cục bộ: webcam → MediaPipe trên máy → dashboard `localhost:8080` → SQLite. |
| Bề mặt triển khai V0 | **V0-desktop**: đúng như mô tả ở dòng trên (mục 1–16). **V0-web**: cùng business rule / governor / dữ liệu, nhưng capture + CV chạy trong trình duyệt qua `getUserMedia` + WASM, backend public phục vụ nhiều người dùng (mục 17). Không phải release mới (V1/V2) — là cách triển khai khác của cùng V0. |
| Trong phạm vi V0 | Webcam mặc định `0`; wizard 4 bước; pose, IPD, EAR, blink, phiên, governor heuristic, report không LLM. |
| Ngoài phạm vi V0 | Firmware, LDR/lux, siêu âm, LED; tài khoản; bảng hỏi; ads; OpenRouter; upload frame; app điện thoại. |
| V1 (sau) | Identity nhẹ (Google / magic link); tóm tắt phiên theo người. |
| V2 (sau) | Survey gắn `session_id`; ads tách origin. |
| Không dùng làm KPI | Chẩn đoán bệnh, giảm đau cổ có kiểm chứng lâm sàng. |

**Acceptance bản ý tưởng (không ESP32):** overlay mặt; calibrate 0° và ~50 cm; số live (góc, cm, EAR, blink, `face_present`); lệch ngắn chưa nhắc; snooze/DND/ack; away + gợi ý nghỉ demo 3 phút; Stop = report **không gọi LLM**. Wizard không mặc định ESP32; dashboard không phụ thuộc LDR/ultrasonic để có số.

### 1.1 Định nghĩa

| Thuật ngữ | Nghĩa |
|---|---|
| Phiên | Một lần theo dõi gắn `session_id`. Stop camera = đóng phiên. |
| Exposure | Thời gian có mặt ở trạng thái `monitoring`. |
| Flag / qualified flag | Cờ rủi ro nguyên tử / đã giữ đủ thời gian hold. |
| Governor | Bộ điều phối thông báo. V0: toast/TTS từ câu sẵn, không LLM. |
| IPD distance | Ước lượng cm = `K / IPD_pixels`. |
| Grace | ~20 s `calibrating` (UI: STARTING); không bắn cảnh báo. |

### 1.2 Tín hiệu và ngưỡng trưng bày (đã có trong code)

| Tín hiệu | Thuật toán | Ngưỡng if-else | Hold |
|---|---|---|---|
| Pitch / yaw | solvePnP + góc tương đối sau calibrate | ±5° / \|yaw\| 20° | 15 s / 60 s |
| Roll | atan2 đường hai mắt − reference | \|roll\| 15° | 15 s |
| Khoảng cách | `K / IPD`, EMA 0.75/0.25, K0=4200 | 50–70 cm; &lt;30 cm nguy cấp | 60 s / 15 s |
| EAR + blink | 6 landmark/mắt; 3 frame &lt; 0.294 = 1 chớp | &lt; 6 lần/phút (cửa sổ 60 s) | 60 s |
| Hiện diện | Có/không Face Mesh; null ≠ 0 | mất mặt 30 s → away | — |
| Phiên | idle → calibrating → monitoring → away \| break → ended | grace 20 s; nghỉ 20 phút (demo 3) | — |

50–70 cm bám Rempel et al. (paper nhóm). MAE IPD/pose **chưa đo** — `eval/` còn mock, không đưa lên slide.

Landmark: pose 1, 152, 33, 263, 61, 291; EAR phải `[33,159,158,133,153,145]`, trái `[362,380,374,263,386,385]`.

---

## 2. Stakeholders và người dùng

| ID | Nhóm | Mục tiêu | Trách nhiệm | Quan ngại |
|---|---|---|---|---|
| SH-01 | Người dùng cuối | Ngồi đúng hơn, ít nhắc nhiễu | Cấp quyền camera, calibrate, snooze/DND | Privacy, sai số khoảng cách |
| SH-02 | Demo / giảng viên | Chạy trên laptop lab | Cài Python 3.10–3.12 | Không mang ESP32 |
| SH-03 | Phát triển | Tái sử dụng session/governor | Cắt IoT khỏi UX mặc định | Firebase không bắt buộc V0 |
| SH-04 | Nghiên cứu | Survey sau này | Đề cương V2 | Cần identity V1 |

---

## 3. Giả định, phụ thuộc, ràng buộc

| ID | Loại | Phát biểu | Tác động | Trạng thái |
|---|---|---|---|---|
| A-01 | Giả định | Webcam thấy mặt khi ngồi làm việc | Mất mặt → away | Cần UX |
| A-02 | Giả định | Cam gần đồng phẳng màn đang nhìn | IPD lệch nếu màn ngoài | Cảnh báo Q-03 |
| A-03 | Giả định | V0 không đánh giá lux | Không `too_dark` / `too_bright` | **Chốt** |
| A-04 | Giả định | LED → HUD + toast + TTS | Không GPIO | **Chốt V0** |
| A-05 | Giả định | Một phiên / `device_id`; tab 2 attach | `session_manager` | Fact từ code |
| D-01 | Phụ thuộc | Python 3.10–3.12 + MediaPipe | 3.13 không full stack | Ràng buộc |
| D-02 | Phụ thuộc | Quyền Camera của app cha (Terminal / IDE) | CONNECTING nếu từ chối | Fact |
| D-03 | Phụ thuộc | Firebase key | Không chặn demo ý tưởng | **Không bắt buộc V0** |
| D-04 | Phụ thuộc | OpenRouter | Tốn tiền | **Tắt V0** |
| C-01 | Ràng buộc | Không chẩn đoán bệnh | Copy / câu sẵn | Giữ |
| C-02 | Ràng buộc | Frame trên máy; MJPEG `127.0.0.1` | Privacy | Giữ |
| C-03 | Ràng buộc | Stop Stream = Stop Session | Report | Giữ |

---

## 4. Yêu cầu nghiệp vụ

| ID | Yêu cầu | Lý do | Ưu tiên | Release | Bằng chứng chấp nhận |
|---|---|---|---|---|---|
| BR-001 | Theo dõi tư thế và khoảng cách trên laptop không cần kit IoT | Giảm rào cài đặt | Must | V0 | Demo chỉ webcam |
| BR-002 | Nhắc khi lệch kéo dài; có snooze/DND/ack | Tránh mệt thông báo | Must | V0 | Hold + backoff quan sát được |
| BR-003 | Mỗi lần ngồi là một phiên có báo cáo | Insight theo session | Must | V0 | Stop → report không LLM |
| BR-004 | Không thay tư vấn y khoa | An toàn nội dung | Must | V0 | Review câu sẵn |
| BR-005 | Không upload khung hình | Privacy | Must | V0 | Traffic không có frame |
| BR-006 | Demo nghỉ 3 phút, không bật `too_long` | Demo lab | Should | V0 | Toggle demo |
| BR-007 | Thói quen theo người, sống sót đổi máy | Sản phẩm dài hạn | Should | V1 | Login + summary |
| BR-008 | Gắn bảng hỏi với phiên | Nghiên cứu | Could | V2 | survey_id + session_id |

---

## 5. Yêu cầu người dùng

| ID | Actor | Nhu cầu | Giá trị | Ưu tiên | BR |
|---|---|---|---|---|---|
| UR-001 | Người dùng | Bắt đầu bằng webcam vài bước | Không ESP32 | Must | BR-001 |
| UR-002 | Người dùng | Đặt ngồi thẳng = gốc 0° | Cảnh báo đúng người đó | Must | BR-001 |
| UR-003 | Người dùng | Hiệu chỉnh khoảng ~50 cm | IPD không lệch quá | Must | BR-001 |
| UR-004 | Người dùng | Thấy góc, cm, nhịp chớp, trạng thái phiên | Hiểu đang lệch gì | Must | BR-001 |
| UR-005 | Người dùng | Nhắc chữ + TTS tùy chọn; snooze/DND/ack | Nhắc không quấy | Must | BR-002 |
| UR-006 | Người dùng | Gợi ý nghỉ sau ngồi liên tục | 20-20-20 | Should | BR-003 |
| UR-007 | Người dùng | Báo cáo phiên từ số đã lưu | Tóm tắt phiên | Should | BR-003 |
| UR-008 | Người dùng | Mất camera thì biết phải làm gì | Không treo câm | Must | BR-001 |
| UR-009 | Người demo | Demo nghỉ 3 phút | Demo tiết học | Should | BR-006 |
| UR-010 | Người dùng | Tắt theo dõi = đóng phiên, nhả camera | Privacy, CPU | Must | BR-003, BR-005 |

---

## 6. Yêu cầu chức năng

Mẫu: *Hệ thống shall [hành vi] khi [trigger] nếu [tiền điều kiện].*

| ID | Tên | Phát biểu | Trigger | Ngoại lệ | Ưu tiên | UC |
|---|---|---|---|---|---|---|
| FR-001 | Nguồn video | Dùng webcam index `0` mặc định; cho chọn index khác | Mở wizard / Start | Không mở device → lỗi, không vào monitoring giả | Must | UC-01 |
| FR-002 | Wizard | 4 bước: Camera → Preview → Calibrate → Dashboard; **default webcam** | Lần đầu vào dashboard | Skip vẫn start + grace | Must | UC-01 |
| FR-003 | Mở phiên | Start tạo `calibrating` + grace 20 s trừ khi tracking đã live | POST `/tracking/start` | Tab 2 attach | Must | UC-01, 13 |
| FR-004 | Calibrate pose | Pose hiện tại = (0,0,0); auto-zero frame đầu không phải user-calibrated | Bấm Calibrate | Không landmark → thất bại | Must | UC-02 |
| FR-005 | Calibrate khoảng cách | Tính lại `K` với khoảng 10–200 cm (mặc định 50) | Calibrate distance | Không thấy mắt → từ chối | Must | UC-03 |
| FR-006 | Tín hiệu CV | Có mặt: pitch, roll, yaw, distance_cm, EAR, blinks, blink_rate, face_present. Mất mặt: không giả lập; NO_FACE | Frame mới | Camera mất → face_present false | Must | UC-04 |
| FR-007 | Detector | Flag distance / pose / blink theo rules. Không lux. Không `too_long` song song | Reading mới | Null bỏ qua, không coi 0 | Must | UC-04 |
| FR-008 | Máy trạng thái | Hết grace → monitoring; mất mặt &gt; 30 s → away; away ≥ 3 phút reset exposure; ≥ 15 phút đóng phiên | Tick phiên | Stop tường minh → ended | Must | UC-04, 07, 08 |
| FR-009 | Governor | Chỉ monitoring mới nhắc. Hold 15/60 s. Notice không TTS; alert = heuristic + TTS; escalate = ack; backoff 60/180 s | Flag qualified | Grace/DND/snooze → không bắn | Must | UC-05 |
| FR-010 | Hành động user | Snooze 10 phút, DND, ack, break; persist theo phiên | Nút / API | Break khi away → resume vào away nếu không mặt | Must | UC-06, 07 |
| FR-011 | HUD thay LED | monitoring+normal / alert / escalated. Không GPIO | Đổi severity | Tab ẩn: TTS vẫn được; OS notify = Q-04 | Must | UC-05 |
| FR-012 | Overlay | MJPEG localhost :8089–8091 | Enter dashboard | Port bận / chưa sẵn → placeholder | Should | UC-04 |
| FR-013 | Đóng phiên | Stop: đóng session, nhả camera, report không LLM | Stop Stream | Thiếu reading → vẫn đóng | Must | UC-09 |
| FR-014 | Báo cáo | Stats đã lưu; timeline 10 phút, bucket 10 s; không gọi LLM | Mở Session Report | Chưa có phiên → 404 | Should | UC-09 |
| FR-017 | Cấu hình | Rules pose/distance/blink/demo; gỡ UI LDR | Settings | File lỗi → fallback timing | Should | UC-14 |
| FR-018 | Quyền camera | Từ chối: không crash; hướng dẫn cấp quyền | Start tracking | Cấp sau → start lại | Must | UC-12 |
| FR-019 | Gắn tab | Tab 2 không tạo session_id mới | Start khi ACTIVE | Có thể cập nhật source | Must | UC-13 |
| FR-020 | Device id | Không dùng `esp32_001` | First run | Restore theo device_id | Should | — |

FR-015/016 (LLM ask/advice): Won't V0.

---

## 7. Đặc tả use case

Quy ước luồng: **Bước** | **Tác nhân** | **Hệ thống**.  
A = luồng thay thế; E = ngoại lệ.

### UC-01 — Bắt đầu phiên bằng webcam

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-01 |
| Tên | Bắt đầu phiên bằng webcam |
| Tác nhân chính | Người dùng |
| Tác nhân phụ | Backend FastAPI, process tracking |
| Mô tả tóm tắt | Người dùng mở dashboard, chọn webcam máy mình, bắt đầu phiên theo dõi mà không cấu hình ESP32. |
| Sự kiện kích hoạt | Mở `http://localhost:8080/dashboard` |
| Điều kiện tiên quyết | Backend đang chạy. Máy có webcam. Python MediaPipe sẵn sàng spawn. |
| Đảm bảo thành công | Tracking live. Phiên `calibrating` hoặc `monitoring`. Camera bị process tracking giữ. |
| Đảm bảo thất bại | Không vào monitoring giả. Có thông báo lỗi / CONNECTING. |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | BR-001, UR-001, FR-001, FR-002, FR-003 |
| Quy tắc liên quan | BRULE-001 |
| Dữ liệu | Tạo session (DATA-001); source = `"0"` hoặc index đã chọn |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Mở dashboard | Hiện wizard; nguồn mặc định = webcam (không phải ESP32) |
| 2 | Chọn Continue | Ghi nhận source webcam |
| 3 | — | Gọi start tracking `source="0"` (hoặc index đã chọn) |
| 4 | — | Tạo phiên, state = `calibrating`, bắt đầu đếm ân hạn `grace_sec` (20 s) |
| 5 | Quan sát preview | Hiện overlay (hoặc placeholder nếu chưa có frame) |
| 6 | Chọn Continue | Cho phép sang bước calibrate (UC-02) hoặc dashboard |

**Luồng thay thế**

| Mã | Từ bước | Điều kiện | Hành động | Kết quả |
|---|---|---|---|---|
| A1 | 1 | User bấm Skip wizard | Vẫn start webcam + grace, vào dashboard | Phiên vẫn mở |
| A2 | 3 | Tracking đã chạy (tab/phiên khác) | Không tạo `session_id` mới; attach | UC-13 |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 3 | Không có Python MediaPipe | Báo cài `tracking_AI/.venv`; không giả live | Thất bại |
| E2 | 3 | Không mở được device | Báo chọn camera khác / đóng app đang chiếm webcam | Thất bại |
| E3 | 3 | OS từ chối quyền | Chuyển UC-12 | Thất bại |

**Tiêu chí chấp nhận**

- Given dashboard mới, when hoàn tất Camera+Preview với webcam, then `session.state` ∈ {`calibrating`,`monitoring`} và `source` là webcam.  
- Given không có ESP32, when start, then hệ thống không yêu cầu URL MJPEG ESP32.

---

### UC-02 — Hiệu chỉnh gốc tư thế 0°

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-02 |
| Tên | Hiệu chỉnh gốc tư thế 0° |
| Tác nhân chính | Người dùng |
| Mô tả tóm tắt | Người dùng ngồi thẳng, nhìn camera, đặt pose hiện tại làm gốc (0,0,0). |
| Sự kiện kích hoạt | Bấm Calibrate (wizard bước 3 hoặc card Head Pose) |
| Điều kiện tiên quyết | Tracking live, `face_present = true` |
| Đảm bảo thành công | `user_calibrated = true`; pitch/roll/yaw ≈ 0°; lưu `calibration.json` |
| Đảm bảo thất bại | Không ghi reference giả |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-002, FR-004 |
| Dữ liệu | DATA-003 pose_reference |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Ngồi thẳng, nhìn camera | Đang xuất pose thô |
| 2 | Bấm Calibrate | Lưu pose hiện tại làm reference; `user_calibrated = true` |
| 3 | Quan sát góc | Hiển thị pitch/roll/yaw gần 0°; cho Continue wizard |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 2 | Không có mặt / thiếu landmark | Không lưu; báo thất bại | Thất bại |
| E2 | — | Auto-zero frame đầu (ngầm) | **Không** đặt `user_calibrated` | Không tính đã calibrate |

**Tiêu chí chấp nhận**

- Given có mặt, when bấm Calibrate, then góc tương đối ≈ 0 và file hiệu chỉnh được lưu.  
- Given chỉ mới mở camera, then hệ thống không coi là đã user-calibrate.

---

### UC-03 — Hiệu chỉnh khoảng cách IPD

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-03 |
| Tên | Hiệu chỉnh khoảng cách IPD |
| Tác nhân chính | Người dùng |
| Mô tả tóm tắt | User khai báo khoảng mắt–màn biết trước; hệ thống tính `K`. |
| Sự kiện kích hoạt | Xác nhận khoảng cách (mặc định 50 cm) |
| Điều kiện tiên quyết | Hai mắt thấy được, `current_eye_pixel_dist > 0` |
| Đảm bảo thành công | `K = known_distance_cm × IPD_px`; `distance_cm` bám khoảng đã khai báo |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-003, FR-005 |
| Dữ liệu | DATA-003 K_factor |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Ngồi khoảng biết trước (vd 50 cm) | Đo IPD pixel |
| 2 | Xác nhận khoảng (10–200 cm) | `K = d × IPD_px`; lưu calibration |
| 3 | Quan sát số cm | Reading `distance_cm` cập nhật theo `K` mới |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 2 | Không thấy mắt | Từ chối calibrate | Thất bại |
| E2 | 2 | Ngoài 10–200 cm | Từ chối | Thất bại |

**Tiêu chí chấp nhận**

- Given ngồi ~50 cm và calibrate 50, then `distance_cm` quan sát được hợp lý. Không công bố ±X cm (Q-05).

---

### UC-04 — Theo dõi tư thế thời gian thực

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-04 |
| Tên | Theo dõi tư thế thời gian thực |
| Tác nhân chính | Hệ thống (sau khi user Enter dashboard) |
| Tác nhân phụ | Người dùng (ngồi trước camera) |
| Mô tả tóm tắt | Ở `monitoring`, hệ thống đo góc/khoảng cách/EAR, cộng exposure, sinh flag, ghi SQLite; governor chỉ dùng flag đã hold. |
| Sự kiện kích hoạt | Enter dashboard hoặc hết `grace_sec` |
| Điều kiện tiên quyết | UC-01; nên đã UC-02 |
| Đảm bảo thành công | HUD cập nhật; overlay khớp góc; reading có `session_id` |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-004, FR-006, FR-007, FR-008, FR-012 |
| Quy tắc liên quan | BRULE-004, BRULE-005, BRULE-007 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Enter dashboard / hết grace | State → `monitoring` |
| 2 | Ngồi trước webcam | Cộng exposure khi `face_present` |
| 3 | — | Cập nhật HUD: cm, EAR, blink, góc, badge phiên, DND |
| 4 | — | Overlay landmark / trục 3D (nếu MJPEG sẵn) |
| 5 | — | Detector gán flag; cộng duration; chỉ qualified mới vào governor |
| 6 | — | Ghi reading SQLite khi calibrating hoặc monitoring |

**Luồng thay thế**

| Mã | Từ bước | Điều kiện | Hành động | Kết quả |
|---|---|---|---|---|
| A1 | 3 | Không có LDR | Không hiện live lux; không cờ tối/sáng | Bình thường V0 |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 2 | Mất mặt | Không ghi 0 cm / 0°; `NO_FACE`; sau 30 s → UC-08 | Tạm dừng đo |
| E2 | 2 | Tracking chết | AI source stale; không đóng phiên ngay (Q-06) | Phiên còn mở |

**Tiêu chí chấp nhận**

- Given monitoring và có mặt, when cúi &gt; 5° đủ `danger_hold_sec`, then `head_too_low` qualified.  
- Given mất mặt, when reading lên dashboard, then không có distance/pose giả.

---

### UC-05 — Nhận và xử lý cảnh báo

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-05 |
| Tên | Nhận và xử lý cảnh báo |
| Tác nhân chính | Hệ thống governor |
| Tác nhân phụ | Người dùng (nghe/đọc nhắc) |
| Mô tả tóm tắt | V0: if-else + câu `MOCK_SPOKEN`. Không gọi LLM. |
| Sự kiện kích hoạt | Tập flag qualified đổi, state = monitoring, không DND/snooze |
| Điều kiện tiên quyết | UC-04; không đang grace |
| Đảm bảo thành công | Toast/TTS/HUD đúng mức; không spam từng frame |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-005, FR-009, FR-011 |
| Quy tắc liên quan | BRULE-003, BRULE-007, BRULE-008 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Giữ lệch notice-only ≥ 60 s | Toast notice, không TTS |
| 2 | Giữ danger ≥ 15 s, hoặc too_close ≥ 60 s, hoặc ≥ 2 notice | Vào alert |
| 3 | Tập flag mới (alert lần đầu) | Spoken heuristic + TTS nếu user bật giọng |
| 4 | Cùng tập flag tiếp tục | Repeat backoff 60 s rồi 180 s |
| 5 | Alert ≥ 300 s | Escalated; toast bắt ack |
| 6 | — | HUD: normal / alert / escalated (thay LED) |

**Luồng ngoại lệ**

| Mã | Từ bước | Điều kiện | Hành động | Kết thúc |
|---|---|---|---|---|
| E1 | 1–5 | calibrating / DND / snooze | Không bắn | Im |
| E2 | 3 | (V0 không gọi LLM) | Luôn `MOCK_SPOKEN` | Alert vẫn hiện |
| E3 | 3 | User sửa đúng trong 60 s | `corrected_count++` | Tiếp monitoring |

**Tiêu chí chấp nhận**

- Given `too_close` mới qualified, when governor tick, then một toast + spoken khoảng cách.  
- Given DND bật, when cùng điều kiện, then không toast/TTS.

---

### UC-06 — Snooze, DND, Ack

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-06 |
| Tên | Snooze / DND / Ack |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Bấm nút trên toast hoặc API phiên |
| Điều kiện tiên quyết | Phiên ACTIVE |
| Đảm bảo thành công | Trạng thái governor lưu theo phiên (restart / tab 2 không reset) |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-005, FR-010 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1a | Snooze | Im 600 s; hạ escalate |
| 1b | Bật DND | Im đến khi tắt; hạ escalate |
| 1c | Ack (khi escalated) | Hạ escalate; phiên tiếp tục |

**Tiêu chí chấp nhận**

- Given snooze, when 10 phút chưa hết và vẫn lệch, then không alert mới.  
- Given restart backend giữa phiên, then snooze/DND/cooldown còn.

---

### UC-07 — Nghỉ giữa phiên

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-07 |
| Tên | Nghỉ giữa phiên |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Gợi ý nghỉ hoặc bấm Start break |
| Điều kiện tiên quyết | `monitoring` / `calibrating` / `away` |
| Đảm bảo thành công | State `break`; không cộng exposure |
| Ưu tiên | Should (V0) |
| Yêu cầu liên quan | UR-006, FR-008, FR-010 |
| Quy tắc liên quan | BRULE-006 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Ngồi đủ ngưỡng (20 phút / demo 3 phút) | Gợi ý nghỉ một lần/phiên; không flag `too_long` |
| 2 | Start break | State `break`; tắt chỉ báo đang theo dõi |
| 3 | End break | `monitoring` nếu có mặt; không thì `away` |

**Tiêu chí chấp nhận**

- Given demo_mode, when ngồi đủ `demo_max_minutes`, then hiện gợi ý nghỉ và không bật `too_long`.

---

### UC-08 — Away và kết thúc idle

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-08 |
| Tên | Away và kết thúc idle |
| Tác nhân chính | Hệ thống |
| Sự kiện kích hoạt | Không thấy mặt liên tục &gt; 30 s |
| Điều kiện tiên quyết | Phiên `calibrating` hoặc `monitoring` |
| Đảm bảo thành công | Away đúng đồng hồ; idle 15 phút thì đóng phiên và nhả camera |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | FR-008 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Rời khỏi camera &gt; 30 s | `away`; dừng exposure |
| 2a | Về trước 3 phút | Giữ phút ngồi; về `monitoring` |
| 2b | Về sau ≥ 3 phút | `exposure_sec = 0`; về `monitoring` |
| 3 | Away ≥ 15 phút | Đóng phiên, stop tracking |

**Tiêu chí chấp nhận**

- Given đi 35 s rồi về, then `monitoring` và phút ngồi không reset.  
- Given đi 16 phút, then phiên ended và camera nhả.

---

### UC-09 — Dừng phiên và xem báo cáo

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-09 |
| Tên | Dừng phiên và xem báo cáo |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Stop Stream / Stop Session |
| Điều kiện tiên quyết | Phiên ACTIVE |
| Đảm bảo thành công | `ended`; camera free; report không gọi LLM |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-007, UR-010, FR-013, FR-014 |
| Quy tắc liên quan | BRULE-002, BRULE-009 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Stop | Đóng phiên `ended`; stop process tracking |
| 2 | — | Nhả webcam |
| 3 | Mở Session Report | Thống kê + sparkline từ dữ liệu đã lưu; **không** gọi OpenRouter |

**Luồng thay thế**

| Mã | Từ bước | Điều kiện | Hành động | Kết quả |
|---|---|---|---|---|
| A1 | 3 | Chưa đủ reading | Vẫn đóng phiên; report/insight có thể trống | Thành công một phần |

**Tiêu chí chấp nhận**

- Given stop, when kiểm tra webcam, then không còn process tracking giữ device.  
- Given report, then không có request LLM mới.

---

### UC-12 — Không có quyền / không mở được camera

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-12 |
| Tên | Không có quyền / không mở được camera |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Start tracking khi OS chặn hoặc device bận |
| Điều kiện tiên quyết | UC-01 bước 3 |
| Đảm bảo thành công | Process không crash; UI không sang monitoring giả |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | UR-008, FR-018 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Start khi chưa có quyền / cam bận | Tracking không thoát; UI CONNECTING + hướng dẫn cấp quyền cho **app cha** (Terminal / IDE) |
| 2 | Cấp quyền xong, start lại | Quay UC-01 |

**Tiêu chí chấp nhận**

- Given quyền bị từ chối, when start, then có `error` hoặc CONNECTING; không monitoring giả.

---

### UC-13 — Tab thứ hai gắn vào phiên

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-13 |
| Tên | Tab thứ hai gắn vào phiên |
| Tác nhân chính | Người dùng |
| Sự kiện kích hoạt | Mở dashboard khác khi phiên ACTIVE và tracking đang chạy |
| Đảm bảo thành công | Cùng `session_id`; governor không reset |
| Ưu tiên | Must (V0) |
| Yêu cầu liên quan | FR-019, BRULE-001 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Mở tab thứ hai, Start | Phát hiện tracking/phiên ACTIVE |
| 2 | — | Attach; không tạo session mới |

**Tiêu chí chấp nhận**

- Given phiên đang chạy, when tab 2 start, then `session_id` không đổi.

---

### UC-14 — Đổi ngưỡng và chế độ demo

| Hạng mục | Nội dung |
|---|---|
| Mã | UC-14 |
| Tên | Đổi ngưỡng và chế độ demo |
| Tác nhân chính | Người dùng / người demo |
| Sự kiện kích hoạt | Sửa settings / `rules.json` |
| Trong phạm vi V0 | pose, distance, blink, session timing, governor, demo ngồi |
| Ngoài phạm vi V0 | Light ADC calibration |
| Ưu tiên | Should (V0) |
| Yêu cầu liên quan | UR-009, FR-017 |

**Luồng sự kiện chính**

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Đổi ngưỡng hoặc bật demo 3 phút | Ghi `rules.json` |
| 2 | — | Tracking và dashboard đọc cùng `GET /api/rules` |

**Tiêu chí chấp nhận**

- Given đổi rules, when tracking overlay/cảnh báo, then dùng cùng ngưỡng dashboard.

---

### Use case ngoài V0 (giữ mã, không đặc tả đầy đủ)

| Mã | Tên | Lý do Won't V0 |
|---|---|---|
| UC-10 | Hỏi về phiên bằng LLM | Tốn tiền, chưa có dữ liệu |
| UC-11 | Get Advice / Explain LLM | Như trên; V0 dùng câu sẵn |
| UC-15 | Proxy sáng từ webcam | Không gọi là lux; Q-01 đã chốt không |

---

## 8. Yêu cầu dữ liệu

| ID | Đối tượng | Trường | Validation / vòng đời | Privacy |
|---|---|---|---|---|
| DATA-001 | Session | id, device_id, source, state, thời gian, exposure, governor_json | Một open session / device | Không frame. V1 thêm user_id |
| DATA-002 | Reading | session_id, ts, distance, blink, head_*, events, state | Null ≠ 0; distance plausibility 10–200 cm khi insight | Không frame |
| DATA-003 | Calibration | K_factor, pose_reference, user_calibrated | File local | Local |
| DATA-004 | Rules | distance, head_pose, blink, session, severity, governor | Một file | Local |
| DATA-005 | Report V0 | stats SQLite + spoken heuristic | Không gọi LLM lại | Local |
| DATA-006 | Frame | JPEG overlay localhost | Không persist | Ở máy |

UI V0 không bắt buộc: `light_adc`, `ultrasonic_distance_cm`, `led_state`.

---

## 9. Yêu cầu giao diện

| ID | Giao diện | Hướng | Kênh | Dữ liệu | Lỗi | V0 |
|---|---|---|---|---|---|---|
| INT-001 | Dashboard ↔ FastAPI | 2 chiều | REST `:8080/api/*` | Session, rules, calibrate, start/stop | 4xx/5xx | Có |
| INT-002 | Overlay | Vào UI | MJPEG `:8089–8091` | JPEG đã vẽ | Placeholder | Có |
| INT-003 | Backend ↔ Tracking | Start/stop | Subprocess; Firebase optional | Metric CV | Process exit | RTDB không bắt buộc |
| INT-004 | OpenRouter | Ra | HTTPS | — | — | **Tắt** |
| INT-005 | OS Camera | Vào | OpenCV | Khung hình | Permission / busy | Có |
| INT-006 | ESP32 / LED / LDR | — | — | — | — | Không dùng |

---

## 10. Yêu cầu phi chức năng

Mẫu: *Dưới [điều kiện], hệ thống shall [hành vi] trong/tại [ngưỡng], đo bằng [cách].*

| ID | Thuộc tính | Kịch bản | Yêu cầu + metric | Ưu tiên | Kiểm chứng | Rủi nếu thiếu |
|---|---|---|---|---|---|---|
| NFR-001 | Privacy | MVP mặc định | Không upload frame; overlay loopback | Must | Bắt traffic | Rò hình |
| NFR-002 | Hiệu năng | 1 mặt, webcam thường | Overlay không đứng hình kéo dài | Should | Demo 10 phút | User tắt |
| NFR-003 | Độ trễ | Flag đã đủ hold | Toast trong một chu kỳ tick (poll hiện 10 s — Q-07) | Should | Đo hold→toast | Nhắc trễ |
| NFR-004 | Tương thích | Windows 10 + macOS | Python 3.10–3.12 tracking | Must | `run.ps1 0` | Không demo |
| NFR-005 | Độ tin cậy | Từ chối camera | Không hard-exit | Must | Fault | Treo |
| NFR-006 | Usability | User chưa dùng ESP32 | Wizard default webcam | Must | Walk-through | Tưởng hỏng |
| NFR-007 | Nội dung | Mọi nhắc | Không chẩn đoán; một câu hành động | Must | Review `MOCK_SPOKEN` | Hiểu nhầm |
| NFR-008 | Quan sát | Dev/demo | Cam/AI live-stale, session state | Should | UI | Khó debug |

---

## 11. Quy tắc nghiệp vụ

| ID | Tên | Phát biểu | Lý do | Ngoại lệ | Điểm thi hành |
|---|---|---|---|---|---|
| BRULE-001 | Một phiên / thiết bị | Không hai session active cùng `device_id` | Tránh nhân governor | Tab 2 attach | `start()` |
| BRULE-002 | Stop = đóng phiên | Dừng camera đóng phiên | Toàn vẹn report | — | `stop()` |
| BRULE-003 | Không nhắc trong grace | `calibrating` ⇒ không bắn | Tránh phạt lúc ngồi vào | Hết grace / Ready | Governor |
| BRULE-004 | Exposure | Chỉ `monitoring` + có mặt | Away/break không tính | — | `_accumulate_exposure` |
| BRULE-005 | Null ≠ 0 | Thiếu giá trị không thành “quá gần” | False alarm | — | detectors |
| BRULE-006 | `too_long` tắt | Ngồi lâu = gợi ý nghỉ, không flag song song | Governor đơn giản | — | `DISABLED_FLAGS` |
| BRULE-007 | Hold rồi nhắc | Danger 15 s; too_close 60 s; notice 60 s | Lọc nhiễu frame | — | `qualifying_flags` |
| BRULE-008 | Không chẩn đoán | Chỉ điều kiện ergonomic | An toàn | — | Câu sẵn |
| BRULE-009 | Report không LLM | In từ dữ liệu đã lưu | Chi phí V0 | — | report API |
| BRULE-010 | Không lux giả | Không gán 300–500 lux từ pixel | Trung thực | UC-15 sau này | Product |

---

## 12. Ma trận truy vết

| Mục tiêu | BR | UR / UC | FR | NFR / Rule | Kiểm thử |
|---|---|---|---|---|---|
| Laptop, bỏ kit | BR-001 | UR-001, UC-01, UC-12 | FR-001, 002, 018, 020 | NFR-006 | `run.ps1 0` |
| Nhắc có kiểm soát | BR-002 | UR-005, UC-05, UC-06 | FR-009–011 | BRULE-003, 007 | Giữ pose xấu 20 s / 70 s / 5 phút |
| Phiên + báo cáo | BR-003 | UR-007, 010; UC-07–09 | FR-003, 008, 013, 014 | BRULE-001, 002, 009 | Start–break–stop–report |
| Privacy hình | BR-005 | UC-09 | DATA-006 | NFR-001 | Không frame trên mạng |
| Không AI V0 | — | UC-05, UC-09 | FR-009, 013 | BRULE-009 | Không request OpenRouter |

---

## 13. Backlog thông số camera (không thuộc V0)

| Ưu tiên | Thông số | Cách đo | Ghi chú |
|---|---|---|---|
| P1 | Thời lượng 1 lần chớp | EAR dưới ngưỡng | Phụ thuộc FPS |
| P1 | PERCLOS | % EAR thấp, 1–3 phút | Lẫn nhìn bàn phím |
| P1 | MAR miệng | Landmark 61/291 | Ngáp ≠ nói chuyện |
| P1 | Nhìn khỏi màn (proxy) | \|yaw\| + còn mặt | Không phải gaze |
| P2 | Chênh vai / head vs vai | MediaPipe Pose | Webcam dễ cắt vai |
| P2 | Forward-head proxy | ear–shoulder | Không gọi CVA lâm sàng |
| P3 | Gaze, lux pixel, rPPG, C2–C7, face login | — | Không claim |

Survey V2: `survey_id` + `session_id` + `user_id`. Eval song song: CSV thật trong `tracking_AI/eval/` (không mock lên slide).

---

## 14. Hướng giai đoạn sau V0 (không thi hành trong V0)

| Lớp | Làm gì |
|---|---|
| V0 | Webcam default, ẩn IoT UI, heuristic, demo 30 phút đủ UC-01…09, 12, 13 |
| V1 | Identity nhẹ; cloud chỉ **tóm tắt phiên**, không video |
| V2 | Bảng hỏi; ads iframe origin khác, cấm đè camera. Đường nóng tracking không đốt Firebase/LLM |

Dual-mode: ESP32 vẫn optional cho PBL; UI V0 không mặc định ESP32. Không fork repo. Không viết lại MediaPipe ở V0.

---

## 15. Việc kỹ thuật V0

1. Default webcam; ẩn LDR / ultrasonic / ESP32-first  
2. Tắt LLM governor (luôn heuristic)  
3. Demo 30 phút: UC-01 → 09 + UC-12 nếu test quyền  
4. (Song song) CSV `eval/` thật — khoảng cách + pose  

---

## 16. Câu hỏi mở và quyết định

| ID | Loại | Nội dung | Quyết định / hành động | Trạng thái |
|---|---|---|---|---|
| Q-01 | Product | Ánh sáng không LDR | V0: không lux | **Chốt** |
| Q-02 | Kiến trúc | Firebase bắt buộc? | V0: không | **Chốt** |
| Identity | Product | Tài khoản | V0 không; V1 có | **Chốt** |
| LLM | Product | OpenRouter governor | V0 tắt | **Chốt** |
| Q-03 | UX | Webcam + màn ngoài | Cảnh báo cùng mặt phẳng | Mở wording |
| Q-04 | UX | OS notify khi tab ẩn | V0-web: có, chỉ cho `alert`/`escalate` khi tab ẩn; `notice` vẫn chỉ toast — xem `WEB-010` | **Chốt — WEB-010** |
| Q-05 | Đo lường | MAE IPD/pose | Không bịa ±X cm | Mở — cần CSV thật |
| Q-06 | Lỗ hổng | Tracking crash giữa phiên | Auto-stop vs stale | Mở |
| Q-07 | NFR | Poll 10 s | Có giảm trên desktop? | Mở |
| Q-08 | UX | UI English vs Việt | — | Mở |
| Q-09 | UX | Chọn camera 0/1 wizard | Nên nếu USB cam | Mở |
| Q-10 | UX | `MOCK_SPOKEN` tiếng Việt | — | Mở |
| Q-11 | NFR-web | Hiệu năng WASM (MediaPipe Tasks Vision) trên máy yếu / laptop cũ | Cần đo FPS thật trước khi cam kết NFR | Mở |
| Q-12 | UX-web | Safari / WebKit hỗ trợ WASM SIMD đầy đủ? | Có thể cần fallback độ chính xác thấp hơn | Mở |
| Q-13 | Kiến trúc-web | Đồng bộ calibration khi user đổi trình duyệt/máy | V0-web: không đồng bộ, mỗi trình duyệt tự calibrate lại | **Chốt tạm — xem WEB-006** |
| Q-14 | Product-web | Danh tính user trên web (không có OS session như desktop) | V0-web: ẩn danh theo `device_token` trình duyệt, không tài khoản (khớp Identity=V1) | **Chốt tạm — xem WEB-007** |
| Q-15 | NFR-web | Trình duyệt throttle capture/heartbeat thế nào khi tab ẩn / minimize (Chrome, Edge, Firefox, Safari)? | Debug panel ghi `bg:` (ticks, gap, stale frame, hb gap) mỗi lần tab ẩn rồi hiện lại; ghi số đo thật vào đây, không suy diễn. Đã quan sát (Chrome, tab ẩn ~1 s): worker timer 100 ms giữ đúng nhịp, `setTimeout` main thread trễ ~250 ms. **Chưa đo** với camera thật, và chưa đo sau > 5 phút ẩn | Mở — xem `WEB-009` |

---

## 17. Triển khai Web (V0-web)

Bổ sung ở bản 0.4, theo yêu cầu chạy public sản phẩm trên web. Mục này đặc tả một **bề mặt triển khai khác của cùng V0** — không phải V1/V2, không nới phạm vi nghiệp vụ đã chốt ở mục 1–16. Mọi `BR`, `UR`, `UC`, `BRULE`, và đặc biệt các bất biến privacy (`NFR-001`, `C-02`, `BR-005`, `BRULE-010`) áp dụng nguyên vẹn; chỉ **nơi chạy capture/CV và nơi host backend** thay đổi.

### 17.1 Quyết định kiến trúc

| Hạng mục | Nội dung |
|---|---|
| Vấn đề | `V0-desktop` dùng OpenCV mở webcam bằng index cục bộ (`source="0"`) trong subprocess Python do backend spawn — camera này gắn vật lý với máy chạy backend. Một backend public duy nhất không thể mở webcam của người dùng ở xa qua cơ chế này. |
| Quyết định | Capture + suy luận CV (Face Landmarker) chạy **trong trình duyệt** của người dùng bằng WASM (`@mediapipe/tasks-vision` hoặc tương đương). Video **không rời máy người dùng** — giữ đúng tinh thần `C-02`/`NFR-001`, chỉ đổi "máy" từ desktop-chạy-backend sang chính trình duyệt của người xem. |
| Vì sao không chọn server xử lý video | Đã cân nhắc phương án browser stream video qua WebRTC lên server rồi server chạy MediaPipe Python: vi phạm thẳng `BR-005`/`C-02` (frame rời máy), tăng chi phí hạ tầng (WebRTC ingest + GPU/CPU theo số người dùng đồng thời), không cần thiết vì MediaPipe có bản Web chính thức tương đương. Bị loại. |
| Hệ quả | Phần compute nặng (Face Landmarker) chuyển từ Python sang JS/WASM chạy client-side — đây là **port sang nền tảng khác**, không phải chỉ "deploy" code Python hiện có. Backend public chỉ còn nhận số liệu đã suy ra (góc, cm, EAR, flag), không nhận ảnh. |

### 17.2 Kiến trúc

```
Trình duyệt (bất kỳ máy nào có Chrome/Edge/Firefox hiện đại, cần HTTPS)
  ├─ getUserMedia()                         → camera stream, không upload
  ├─ MediaPipe Tasks Vision (Face Landmarker, WASM) chạy client-side
  ├─ JS: pitch/yaw/roll, distance = K/IPD (EMA 0.75/0.25, K0=4200), EAR/blink
  │      — công thức và ngưỡng giữ nguyên mục 1.2 và Phụ lục A
  ├─ Canvas vẽ overlay landmark (thay MJPEG cục bộ — không cần stream ảnh qua mạng)
  ├─ Detector + Governor (hold/qualify/notice/alert/escalate) chạy client-side
  │      để giữ độ trễ thấp (NFR-003); backend chỉ lưu, không quyết định real-time
  ├─ Web Speech API (`speechSynthesis`) thay TTS server — không cần server audio
  └─ Chỉ gửi lên backend: {device_token, session_id, ts, pitch, yaw, roll,
        distance_cm, ear, blink, face_present, flags[]} — không có frame ảnh
        ↓ HTTPS
Backend public (một instance phục vụ nhiều người dùng)
  ├─ REST API tương đương /api/* hiện tại (start/stop session, rules, calibrate, report)
  ├─ DB: Postgres thay SQLite (nhiều phiên ghi đồng thời)
  └─ Report API: tính từ dữ liệu đã lưu, không gọi LLM (giữ nguyên BRULE-009)
```

### 17.3 Ánh xạ thay đổi so với V0-desktop

| ID gốc | Nội dung gốc | Thay đổi cho V0-web |
|---|---|---|
| `INT-005` | OS Camera qua OpenCV | Đổi kênh vào thành `getUserMedia` (trình duyệt); vẫn "Vào", vẫn permission/busy là lỗi cần xử lý (xem `WEB-002`) |
| `INT-002` | Overlay MJPEG `:8089–8091` | Bỏ hẳn kênh MJPEG; overlay vẽ trực tiếp bằng `<canvas>` trong cùng tiến trình trình duyệt, không qua mạng |
| `A-05` | Một phiên / `device_id`; tab 2 attach | `device_id` desktop (gắn máy chạy backend) → `device_token` web: một danh tính ẩn danh cấp cho mỗi trình duyệt (xem `WEB-007`), lưu trong `localStorage`; tab 2 cùng trình duyệt vẫn attach theo `BRULE-001` |
| `D-02` | Quyền Camera của app cha (Terminal/IDE) | Đổi thành quyền camera chuẩn của trình duyệt (`getUserMedia` prompt) — UX đơn giản hơn, không cần hướng dẫn cấp quyền OS như `UC-12` bản desktop |
| `DATA-003` | Calibration lưu file local (`calibration.json`) | Lưu trong `localStorage` của trình duyệt (xem `WEB-006`); không đồng bộ giữa các trình duyệt/máy ở V0-web (`Q-13`) |
| `NFR-004` | Tương thích Windows 10 + macOS, Python 3.10–3.12 | Thay điều kiện tương thích: trình duyệt hỗ trợ WASM + `getUserMedia` (xem `WEB-004`); không cần cài Python nữa |
| `D-01` | Python 3.10–3.12 + MediaPipe | Không áp dụng cho V0-web (không có runtime Python phía client); backend public có thể dùng bất kỳ ngôn ngữ nào miễn giữ đúng hợp đồng API |

### 17.4 Giả định, ràng buộc, yêu cầu mới (V0-web)

| ID | Loại | Nội dung | Ưu tiên |
|---|---|---|---|
| WEB-001 | Ràng buộc | Trang phải phục vụ qua HTTPS (hoặc `localhost` khi dev) — `getUserMedia` bị trình duyệt chặn trên HTTP thường | Must |
| WEB-002 | FR | Từ chối quyền camera / không có camera: không crash trang, hiện hướng dẫn cấp quyền trình duyệt (tương đương tinh thần `UC-12`, kênh khác) | Must |
| WEB-003 | FR | Face Landmarker (WASM) tải và khởi tạo trong trình duyệt trước khi vào `calibrating`; tải chậm/thất bại → thông báo rõ, không giả lập landmark | Must |
| WEB-004 | NFR | Dưới điều kiện máy tầm trung (không GPU rời), hệ thống shall giữ tốc độ suy luận đủ mượt cho overlay thời gian thực; đo bằng FPS thực tế trước khi công bố số — **chưa đo, không đưa lên slide** (giữ tinh thần `Q-05`) | Should |
| WEB-005 | FR | Governor + TTS chạy client-side bằng `speechSynthesis`; hành vi hold/backoff/escalate giữ nguyên `BRULE-007`, `FR-009` | Must |
| WEB-006 | Dữ liệu | Calibration (`K_factor`, `pose_reference`) lưu `localStorage` theo trình duyệt; mất khi xóa dữ liệu trình duyệt — chấp nhận ở V0-web, không coi là lỗi | Should |
| WEB-007 | Dữ liệu | `device_token`: chuỗi ẩn danh sinh khi lần đầu vào trang, lưu `localStorage`, dùng thay `device_id` cho `BRULE-001`/`A-05`; không phải tài khoản, không định danh cá nhân (Identity thật vẫn là V1, không kéo sớm vào V0-web) | Must |
| WEB-008 | Interface | API backend public dùng cùng hình dạng `/api/*` như `INT-001`, thêm `device_token` vào mỗi request thay vì suy từ tiến trình cục bộ | Must |
| WEB-009 | FR | Khi tab leader bị ẩn / minimize, capture + detector + heartbeat shall tiếp tục chạy (vòng lặp chuyển từ `requestAnimationFrame` sang timer trong Worker, lấy mẫu thưa hơn); hold/threshold giữ nguyên vì tính theo đồng hồ thật. Không vẽ overlay khi ẩn. Hiệu quả thực tế từng trình duyệt: `Q-15` | Must |
| WEB-010 | FR | Khi tab ẩn, sự kiện governor mức `alert` / `escalate` shall hiện thêm thông báo hệ thống (Notification API, một slot, bản mới thay bản cũ; `escalate` giữ đến khi người dùng bấm). `notice` vẫn chỉ toast (`FR-009`). Quyền xin khi bấm Start; bị từ chối → báo trong UI, TTS vẫn chạy. Nội dung = câu `MOCK_SPOKEN`, không claim y tế (`BRULE-008`) | Should |
| WEB-012 | Dữ liệu | `readings` thô (góc, cm, EAR, flags) lưu tối đa 30 ngày, backend xoá định kỳ (quét mỗi giờ). Không ảnh hưởng `DATA-001` session; tổng hợp dài hạn thuộc V1 | Must |
| WEB-013 | NFR | API public giới hạn tần suất: 300 request/phút mỗi `device_token`, 30 `POST /sessions/start`/phút mỗi IP; vượt → `429` + `Retry-After`. Client coi `429` như lỗi mạng (thử lại, không nhả camera — giữ quy tắc heartbeat). Batch readings ≤ 50, `device_token`/`tab_id` ≤ 128 ký tự | Must |
| WEB-011 | FR | Cửa sổ nổi (Document Picture-in-Picture, chỉ Chromium) hiển thị severity HUD bằng màu + ký hiệu hướng chỉnh + khoảng cách cm, nút xác nhận khi `escalate`. Không hiển thị video/khuôn mặt. Không có mặt → dấu “—”, không phải 0 cm (`BRULE-005`). Trình duyệt không hỗ trợ → ẩn nút | Could |

### 17.5 Bất biến giữ nguyên (không đổi khi chuyển sang web)

- **Không upload frame** (`NFR-001`, `C-02`, `BR-005`): video không rời trình duyệt của người dùng dưới bất kỳ hình thức nào.
- **Null ≠ 0** (`BRULE-005`): mất mặt trên web vẫn là `face_present=false`/`NO_FACE`, không phải 0 cm/0°.
- **`too_long` disabled** (`BRULE-006`), **report không LLM** (`BRULE-009`), **không lux giả** (`BRULE-010`), **không chẩn đoán** (`BRULE-008`, `C-01`): áp dụng y nguyên.
- **Không ESP32/LED/GPIO** (`INT-006`): không áp dụng cho web, càng không cần bàn tới.
- Ngưỡng, hold, công thức khoảng cách/pose/EAR ở mục 1.2 và Phụ lục A: **giữ nguyên giá trị**, chỉ đổi ngôn ngữ triển khai (Python → JS).

---

## Phụ lục A — Ánh xạ flag V0

| Flag | Tín hiệu | Hold | Mức | Nguồn |
|---|---|---|---|---|
| `critically_close` | &lt; 30 cm | 15 s | Alert | IPD |
| `too_close` | &lt; 50 cm | 60 s | Alert | IPD |
| `too_far` | &gt; 70 cm | 60 s | Notice | IPD |
| `head_too_low` / `head_too_high` / `head_tilted` | Vượt pose | 15 s | Alert | Webcam + calibrate |
| `head_turned` | \|yaw\| &gt; 20° | 60 s | Notice | Webcam |
| `low_blink_rate` | &lt; 6 bpm | 60 s | Notice | Webcam |
| `too_dark` / `too_bright` | Lux | — | Không V0 | — |
| `too_long` | Ngồi lâu | — | Disabled | Break suggest |
