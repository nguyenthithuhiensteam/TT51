# MN360 — Lộ trình xây dựng (Roadmap)

Chú thích trạng thái: `✅ Hoàn thành` · `🚧 Đang làm` · `⬜ Chưa bắt đầu`

## Giai đoạn 0 — Khảo sát và đặc tả — ✅ Hoàn thành

- ✅ Kiểm tra thư mục dự án (repo trống, chỉ có `README.md`) → xác định đây là dự án mới.
- ✅ `docs/PRODUCT_SPEC.md`
- ✅ `docs/DATA_MODEL.md`
- ✅ `docs/PERMISSIONS.md`
- ✅ `docs/ROADMAP.md` (tệp này)
- ✅ `docs/ACCEPTANCE_CRITERIA.md`

## Giai đoạn 1 — Nền tảng — ✅ Hoàn thành (bản đầu)

- ✅ Khởi tạo dự án Tauri 2 + React + TypeScript + Vite + Tailwind
- ✅ Cơ sở dữ liệu SQLite + migration có phiên bản (`src-tauri/src/db/migrations.rs`)
- ✅ Lớp truy cập dữ liệu (DAL) trừu tượng (`src/lib/db`)
- ✅ Đăng nhập, băm mật khẩu Argon2id, khóa tài khoản sau nhiều lần sai, đổi mật khẩu lần đầu,
  tự khóa màn hình khi không hoạt động
- ✅ Phân quyền RBAC (vai trò/quyền/gán vai trò), guard route + ẩn sidebar Công tác Đảng
- ✅ Cấu hình trường và năm học
- ✅ Giao diện chính: sidebar 12 mục, top bar đầy đủ thành phần yêu cầu
- ✅ Tổng quan: số liệu thật từ `tasks`/`documents`
- ✅ Công việc: CRUD thật, trạng thái, gửi duyệt/phê duyệt, cảnh báo hạn, chống thông báo trùng
- ✅ Văn phòng số: văn bản + quy trình soạn thảo → ban hành, chuyển kết luận thành nhiệm vụ
- ✅ Sao lưu/khôi phục CSDL, chọn thư mục dữ liệu
- ✅ Dữ liệu demo: Trường Mầm non Tràng Đà (người dùng, vai trò, cán bộ, nhiệm vụ, văn bản mẫu)
- ✅ `tsc --noEmit`, ESLint, Vitest chạy sạch (xem log trong PR/commit)
- 🚧 Đóng gói bộ cài Windows — **chưa thực hiện trong giai đoạn này**, cần máy Windows có
  Visual Studio Build Tools + WebView2 (môi trường hiện tại là Linux headless, chỉ chạy được
  `cargo check`, không build MSI/NSIS). Hướng dẫn chạy thử bằng PowerShell ở cuối tài liệu.

### Việc chưa làm trong Giai đoạn 1 (dời sang giai đoạn sau) — đã xử lý ở Giai đoạn 2

- ~~Xuất Word/Excel/PDF~~ → đã có ở Giai đoạn 2 (xem bên dưới).
- Đồng bộ mạng LAN/máy chủ, AI Gateway — vẫn thuộc Giai đoạn 4.
- ~~Trẻ em, Đội ngũ, Chuyên môn~~ → đã triển khai ở Giai đoạn 2. Nuôi dưỡng, Sức khỏe – An
  toàn, Tài chính – Tài sản, Kiểm định, Công tác Đảng, Phụ huynh vẫn ở dạng schema định hướng
  trong `docs/DATA_MODEL.md` mục 3, chưa có bảng thật/migration/giao diện.

## Giai đoạn 2 — Nghiệp vụ cốt lõi — ✅ Hoàn thành (bản đầu)

- ✅ Migration 004-008 (`src-tauri/src/db/sql/`): mở rộng quyền chi tiết (children/staff/
  curriculum.*), schema Trẻ em (lớp, trẻ, phụ huynh, điểm danh), Đội ngũ (hồ sơ, phân công,
  nghỉ phép, đánh giá 3 cấp), Chuyên môn (kế hoạch giáo dục, quan sát, đánh giá trẻ), dữ liệu
  demo Phase 2 (3 lớp, 12 trẻ, 12 phụ huynh, 15 hồ sơ cán bộ, kế hoạch/quan sát/đánh giá mẫu)
- ✅ Trẻ em: danh sách lớp + thêm lớp, hồ sơ trẻ (mã định danh riêng `TRE-YYYY-NNNN`, không
  dùng họ tên làm khóa), tiếp nhận trẻ, xếp lớp, chuyển lớp/bảo lưu/chuyển trường/thôi học/
  hoàn thành chương trình (có lịch sử), điểm danh theo lớp/ngày với thống kê chuyên cần, thêm
  phụ huynh, nhật ký quan sát, đánh giá sự phát triển theo 5 lĩnh vực
- ✅ Đội ngũ: hồ sơ cán bộ (gắn với tài khoản người dùng), phân công (chủ nhiệm/chuyên môn/hỗ
  trợ/quản lý), nghỉ phép (gửi đề nghị → duyệt/từ chối), đánh giá viên chức 3 cấp (tự đánh giá,
  tổ trưởng, lãnh đạo) với trạng thái nháp/gửi/hoàn tất
- ✅ Chuyên môn: kế hoạch giáo dục theo 9 loại (năm/tháng/chủ đề/tuần/ngày/hoạt động/STEAM/SEL/
  hòa nhập), quy trình Giáo viên soạn → Tổ trưởng góp ý → Phó hiệu trưởng duyệt → ban hành →
  lưu trữ (dùng chung bảng `approvals`/`audit_logs`), liên kết mục tiêu/yêu cầu cần đạt/nội
  dung/hoạt động/môi trường/học liệu/phương pháp/đánh giá/điều chỉnh trong cùng một hồ sơ
- ✅ Xuất Word: kế hoạch giáo dục (`docx`, tải qua Blob, không cần plugin fs riêng)
- ✅ Xuất Excel: danh sách công việc, danh sách trẻ, báo cáo chuyên cần theo tháng (`exceljs`)
- ✅ `tsc --noEmit`, ESLint, Vitest (27 test), `cargo check`, `vite build` chạy sạch; đã chạy
  thử ứng dụng đầy đủ (Xvfb + WebKitGTK) xác nhận migration 001-008 khởi tạo không lỗi

### Ghi chú kỹ thuật Giai đoạn 2

- Các thư viện xuất tệp (`docx`, `exceljs`, `jspdf`) kéo theo một số cảnh báo bảo mật ở
  dependency bậc sâu (chủ yếu liên quan tính năng không dùng tới như `jsPDF.html()` hoặc nén
  zip nâng cao). Vì đây là ứng dụng nội bộ, offline, dữ liệu đầu vào do chính hệ thống tạo ra
  (không phải nội dung người dùng ngoài tải lên), rủi ro thực tế thấp; sẽ rà soát nâng cấp lên
  phiên bản mới hơn (có thể có breaking changes) ở Giai đoạn 5 khi làm cứng bảo mật toàn diện.
- Đổi mật khẩu/xóa hồ sơ trẻ vẫn dùng lưu trữ mềm (`deleted_at`), chưa có giao diện "khôi phục
  hồ sơ đã xóa" riêng — sẽ bổ sung khi làm kho lưu trữ chung ở Giai đoạn 5.

## Giai đoạn 3 — Chăm sóc và vận hành — ✅ Hoàn thành (bản đầu)

- ✅ Migration 009-013: mở rộng quyền chi tiết (nutrition/health/finance.*), schema Nuôi dưỡng
  (món ăn, thực đơn, giao nhận thực phẩm, kiểm thực ba bước), Sức khỏe – An toàn (hồ sơ sức
  khỏe, tăng trưởng, tiêm chủng, sự cố/tai nạn, kiểm tra an toàn), Tài chính – Tài sản (khoản
  thu, phiếu thu/chi, tài sản), dữ liệu demo Giai đoạn 3
- ✅ Nuôi dưỡng: ngân hàng món ăn, thực đơn theo lớp/ngày với **số trẻ ăn lấy trực tiếp từ điểm
  danh** (không nhập lại — hoàn thành tiêu chí #12 trong `ACCEPTANCE_CRITERIA.md`), cảnh báo
  dị ứng tự động đối chiếu hồ sơ sức khỏe với thành phần món ăn (yêu cầu người có trách nhiệm
  xác nhận trước khi duyệt), kiểm thực ba bước (trước chế biến/trước khi ăn/lưu mẫu), giao
  nhận thực phẩm theo nhà cung cấp, quy trình duyệt thực đơn (draft → pending_approval →
  approved/needs_revision)
- ✅ Sức khỏe – An toàn: hồ sơ sức khỏe (nhóm máu, bệnh nền, dị ứng) theo trẻ, biểu theo dõi
  chiều cao/cân nặng, tiêm chủng, ghi nhận sự cố/tai nạn, kiểm tra an toàn (lớp học/sân
  chơi/điện-nước/PCCC) với mức độ nguy cơ và kế hoạch khắc phục có quy trình phê duyệt
- ✅ Tài chính – Tài sản: khoản thu (định kỳ/một lần), phiếu thu/phiếu chi theo đúng quy trình
  **lập → kiểm tra → phê duyệt** (3 người khác nhau, không có bước nào tự động), danh mục tài
  sản với kiểm kê phát hiện hỏng/điều chuyển/thanh lý có lịch sử, xuất báo cáo Excel
- ✅ `tsc --noEmit`, ESLint, Vitest (27 test), `cargo check`, `vite build` chạy sạch; đã chạy
  thử toàn bộ ứng dụng qua Xvfb+WebKitGTK xác nhận 13 migration khởi tạo không lỗi

## Giai đoạn 4 — Chất lượng và kết nối — ✅ Hoàn thành (bản đầu, xem giới hạn bên dưới)

- ✅ Migration 014-018: quyền chi tiết accreditation/party/parent.*, schema Kiểm định
  (tiêu chuẩn, tiêu chí, phân công, kho minh chứng N-N), schema Công tác Đảng (**7 bảng hoàn
  toàn tách biệt** khỏi mọi bảng nghiệp vụ khác — không JOIN/reuse bảng chung), schema Phụ
  huynh (`guardians.user_id` liên kết tài khoản, đơn xin nghỉ, tin nhắn), dữ liệu demo
- ✅ Kiểm định: tiêu chuẩn/tiêu chí theo khung kiểm định, phân công phụ trách, tự đánh giá
  (mô tả hiện trạng/điểm mạnh/điểm yếu/kế hoạch cải tiến) theo quy trình phê duyệt, kho minh
  chứng — mỗi tệp có mã duy nhất, liên kết N-N với nhiều tiêu chí, **không tải trùng** (chọn
  minh chứng có sẵn để liên kết thay vì tải lại)
- ✅ Công tác Đảng: hồ sơ đảng viên (chức vụ chi bộ), sinh hoạt chi bộ định kỳ/chuyên đề kèm
  biên bản, nghị quyết và theo dõi thực hiện, đánh giá đảng viên cuối năm, đảng phí theo
  tháng. Đã xác nhận bằng script: **không role nào ngoài `party_committee` có bất kỳ quyền
  `party.*` nào**, kể cả `system_admin`/`principal`/`tech_admin`
- ✅ Phụ huynh: giao diện tập trung một trang, mọi truy vấn lọc theo `guardian_id` suy ra từ
  tài khoản đăng nhập ở tầng `parentRepo.ts` (không nhận `child_id` tùy ý từ client) — xem
  thông tin con, chuyên cần, thực đơn hôm nay (chỉ khi đã duyệt), khoản thu, gửi đơn xin nghỉ,
  trao đổi với giáo viên; phía giáo viên duyệt đơn nghỉ và trả lời tin nhắn ngay trong hồ sơ
  trẻ (`ChildDetailPage`)
- ✅ AI Gateway: cấu hình đa nhà cung cấp (OpenAI/Gemini/Claude/Tắt) tại Cài đặt, khóa API
  lưu cục bộ (không trong mã nguồn), lớp ẩn danh `redactText()` tự ẩn số điện thoại/ngày
  tháng/tên trẻ-phụ huynh trước khi gửi, xem trước nội dung sẽ gửi, kết quả luôn có nhãn
  "Nội dung do AI hỗ trợ" và người dùng phải bấm "Chèn vào nội dung" mới lưu — không có bước
  nào tự động ban hành. Lệnh gọi AI thật chạy ở phía Rust (`ai_generate`, dùng `reqwest`) để
  không bị chặn CORS như gọi thẳng từ webview — **kiến trúc đã biên dịch và chạy được nhưng
  chưa kiểm thử với khóa API thật** vì môi trường phát triển không có khóa.
- ⬜ **Đồng bộ dữ liệu qua mạng LAN/đám mây — chưa triển khai.** Bảng `sync_queue` đã có sẵn
  từ Giai đoạn 1 nhưng cần một máy chủ tiếp nhận (chưa tồn tại); xây dựng giả một cơ chế đồng
  bộ không có máy chủ thật để kiểm thử sẽ vi phạm nguyên tắc "không giả lập chức năng" nên để
  lại cho giai đoạn có hạ tầng máy chủ.
- ⬜ **Thông báo đa kênh (SMS/Zalo/email) — chưa triển khai.** Cần tài khoản dịch vụ ngoài
  (SMTP, Zalo OA, nhà mạng SMS) chưa được cấu hình; thông báo trong ứng dụng (in-app, đã có từ
  Giai đoạn 1) tiếp tục hoạt động đầy đủ cho các nghiệp vụ mới (đơn xin nghỉ, tin nhắn).
- ✅ `tsc --noEmit`, ESLint, Vitest (30 test), `cargo check` (bao gồm biên dịch `reqwest`),
  `vite build` chạy sạch; đã chạy thử toàn bộ ứng dụng qua Xvfb+WebKitGTK xác nhận 18
  migration khởi tạo không lỗi

## Giai đoạn 5 — Hoàn thiện — ✅ Hoàn thành (bản đầu, xem giới hạn bên dưới)

- ✅ **Tối ưu hiệu năng**: chuyển toàn bộ trang phân hệ (Công việc, Văn phòng số, Trẻ em, Đội
  ngũ, Chuyên môn, Nuôi dưỡng, Sức khỏe-An toàn, Tài chính-Tài sản, Kiểm định, Công tác Đảng,
  Phụ huynh, Cài đặt, Sao lưu) sang `React.lazy` + `Suspense` thay vì nạp hết một lần; tách
  vendor chunk riêng cho `docx`/`exceljs`/`jspdf`/`recharts` trong `vite.config.ts`. Kết quả:
  bundle JS tải ngay khi mở ứng dụng giảm từ **2163 KB xuống 170 KB** (gzip 51 KB), các thư
  viện xuất tệp nặng (đặc biệt `exceljs` ~938 KB) chỉ tải khi thật sự dùng tính năng xuất Excel.
- ✅ **Migration 019** (`019_perf_indexes.sql`): rà soát toàn bộ câu lệnh `WHERE`/join trong
  `src/lib/db/*.ts`, đối chiếu với chỉ mục đã có (kể cả chỉ mục ngầm từ ràng buộc `UNIQUE`), bổ
  sung 15 chỉ mục còn thiếu cho các truy vấn tra cứu thường dùng: `task_assignees.user_id`,
  lịch sử/minh chứng/bình luận theo `task_id`, thông báo theo người dùng, lịch sử trạng thái
  trẻ/tài sản theo id, `child_guardians.guardian_id` (chiều ngược với UNIQUE hiện có), điểm
  danh theo trẻ+ngày, khoản thu theo trẻ, thực đơn theo lớp+ngày, biên bản sinh hoạt chi bộ
  theo cuộc họp, đảng phí theo kỳ. Đã chạy 19 migration liên tiếp trên SQLite thật (Python
  `sqlite3`) xác nhận không lỗi, tổng 45 chỉ mục tùy chỉnh.
- ✅ **Kiểm thử tổng thể**: `tsc --noEmit`, ESLint, Vitest (30 test), `cargo check`,
  `vite build` chạy sạch sau toàn bộ thay đổi Giai đoạn 5; khởi động lại ứng dụng đầy đủ qua
  Xvfb+WebKitGTK, xác nhận biên dịch/khởi tạo 19 migration không panic/lỗi.
- ✅ **Chuẩn hóa cấu hình đóng gói Windows**: hoàn thiện `src-tauri/tauri.conf.json` với tên
  nhà xuất bản, mô tả ngắn/dài, ngôn ngữ cài đặt tiếng Việt (NSIS `Vietnamese`), chế độ cài
  `perMachine`; xác nhận bộ icon đầy đủ và hợp lệ (`32x32`, `128x128`, `128x128@2x`, `.ico`
  6 kích thước, `.icns`).
- ✅ **Bộ cài Windows thật đã build được** qua GitHub Actions (`.github/workflows/build-windows.yml`,
  chạy thủ công trên `windows-latest`, tải kết quả ở tab Actions → mục Artifacts). Ban đầu cấu
  hình cả `msi` (WiX) và `nsis`; bản WiX lỗi hệ thống trên runner GitHub Actions (`failed to run
  ... light.exe` — vấn đề đã biết của WiX v3 trên môi trường CI đó), nên đã chuyển hẳn sang chỉ
  đóng gói **NSIS** (`.exe`) — vẫn là bộ cài Windows đầy đủ, ổn định hơn trong CI. Xây trên máy
  Windows thật (không qua CI) vẫn theo hướng dẫn ở `mn360/README.md` mục "Đóng gói bộ cài
  Windows" nếu cần bản `.msi`.
- ✅ **Tài liệu sử dụng và bàn giao**: `docs/HUONG_DAN_SU_DUNG.md` (hướng dẫn theo từng phân hệ,
  vòng đời hồ sơ, sao lưu/khôi phục, AI Gateway, xử lý sự cố thường gặp cho người dùng cuối) và
  `docs/BAN_GIAO.md` (checklist cài đặt lần đầu tại trường, vận hành định kỳ, quản trị tài
  khoản, xử lý sự cố kỹ thuật, giới hạn đã biết) — cả hai đã liên kết từ `README.md` gốc.
- ⬜ **Xuất PDF** — vẫn chưa triển khai (đã có Word/Excel từ Giai đoạn 2); không phát sinh thêm
  trong Giai đoạn 5 vì không nằm trong phạm vi tối ưu/đóng gói/tài liệu đã đặt ra.
- ⬜ **Rà soát/nâng cấp phiên bản các thư viện xuất tệp có cảnh báo bảo mật bậc sâu** (đã ghi
  chú từ Giai đoạn 2) — chưa thực hiện trong lần này; rủi ro vẫn ở mức thấp vì ứng dụng offline,
  dữ liệu đầu vào do chính hệ thống tạo ra.

### Ghi chú kiểm thử đã thực hiện — Giai đoạn 5

- Đo kích thước bundle trước/sau tối ưu bằng `npm run build`: trước 1 tệp JS duy nhất 2163 KB
  (gzip 615 KB); sau khi tách route + vendor chunk, tệp tải ngay còn 170 KB (gzip 51 KB), các
  phần còn lại (từng trang phân hệ, `docx`, `recharts`, `exceljs`, `jspdf`) tải theo yêu cầu.
- Chạy trực tiếp 19 tệp migration bằng Python `sqlite3` (không qua Tauri) trên CSDL trống, đối
  chiếu danh sách chỉ mục tạo ra khớp với thiết kế (45 chỉ mục `idx_*`, không trùng tên, không
  lỗi cú pháp/ràng buộc khóa ngoại).
- Khởi động ứng dụng qua Xvfb + WebKitGTK sau khi đổi `tauri.conf.json` (thêm cấu hình đóng gói
  Windows) và thêm migration 019 — xác nhận Tauri tự rebuild khi phát hiện đổi cấu hình, biên
  dịch thành công, cửa sổ chạy ổn định, không panic trong toàn bộ log.

## Giai đoạn 6 — Tích hợp tính khẩu phần ăn (Nuôi dưỡng) — ✅ Hoàn thành

Theo yêu cầu của nhà trường (dựa trên công cụ tính khẩu phần sẵn có "Bữa ăn hạnh phúc" của
Trường Mầm non Hương Sen): tích hợp tính dinh dưỡng và chi phí khẩu phần vào phân hệ Nuôi
dưỡng. Đã thống nhất với người dùng: khẩu phần tính gộp theo 2 nhóm tuổi **toàn trường** (Nhà
trẻ/Mẫu giáo) mỗi ngày — giữ đúng cách nhà trường đang vận hành, không tách riêng theo từng
lớp như các phân hệ khác của MN360.

- ✅ Migration 020: thêm cột `classes.nutrition_group` (suy tự động từ `age_group` hiện có,
  sửa tay được nếu suy luận sai), bảng `foods` (thành phần dinh dưỡng P/L/G/kcal/Ca/Fe/VitA/
  VitC trên 100 đơn vị), `nutrition_norms` (định mức theo nhóm tuổi, nguồn NKN người Việt Nam
  2016), `daily_rations` (khẩu phần một ngày của một nhóm — dùng chung `RecordStatus` và
  `approvals`/`audit_logs` như các hồ sơ khác, snapshot `meal_fee_rate` để không ảnh hưởng báo
  cáo cũ khi đổi định mức sau), `ration_items` (từng dòng thực phẩm).
- ✅ Migration 021: seed 25 thực phẩm thường dùng + 16 dòng định mức dinh dưỡng (2 nhóm × 8
  chất) + dữ liệu demo (khẩu phần mẫu ngày 2026-07-28 cho cả hai nhóm, một đã duyệt một đang
  chờ duyệt) + bổ sung điểm danh cho lớp Nhà trẻ C để có số liệu demo đầy đủ cho cả hai nhóm.
- ✅ `rationRepo.ts`: tính tổng dinh dưỡng/trẻ, tính chi phí (phân biệt đơn vị gam/ml theo
  đơn giá/kg và đơn vị hộp theo đơn giá/hộp), đối chiếu định mức (đạt/thiếu/cao), đối chiếu
  tiền ăn (tiêu chuẩn được chi theo số trẻ thực tế × định mức, đã chi, thừa/thiếu). **Số trẻ
  mỗi nhóm lấy tự động từ điểm danh** (JOIN `classes.nutrition_group`) — không nhập lại thủ
  công, đúng nguyên tắc "một dữ liệu — một nguồn gốc chịu trách nhiệm" đã áp dụng cho Thực đơn.
- ✅ Tab "Khẩu phần dinh dưỡng" mới trong Nuôi dưỡng: chọn ngày + nhóm tuổi, thêm/sửa/xóa dòng
  thực phẩm (kèm thêm thực phẩm ngoài danh mục), bảng đối chiếu dinh dưỡng theo 8 chất (giá
  trị/chuẩn/% đạt/nhãn trạng thái), bảng đối chiếu tiền ăn, quy trình gửi duyệt/duyệt/yêu cầu
  điều chỉnh dùng chung cơ chế với Thực đơn (người duyệt phải khác người lập), xuất Excel.
  Chỉ chỉnh sửa được khi hồ sơ ở trạng thái `draft`/`needs_revision`; đã duyệt thì chỉ xem.
- ✅ Cài đặt định mức tiền ăn/trẻ/ngày mặc định (lưu trong `system_settings`, snapshot vào
  từng khẩu phần khi lập).
- ✅ `tsc --noEmit`, ESLint, Vitest (30 test), `cargo check`, `vite build` chạy sạch.

### Mở rộng tab Khẩu phần dinh dưỡng — tích hợp đầy đủ nội dung app "Bữa ăn hạnh phúc"

Sau khi bàn giao bản đầu, người dùng phản hồi: phần Nuôi dưỡng cần tích hợp **đầy đủ hơn** nội
dung của app "Bữa ăn hạnh phúc" (không chỉ phần nhập liệu + đối chiếu dinh dưỡng), đồng thời xác
nhận các phân hệ khác của MN360 giữ nguyên không thay đổi. Đã rà soát toàn bộ 7 tab của app gốc
và bổ sung thêm 3 tab con trong "Khẩu phần dinh dưỡng" (chỉ trong phạm vi Nuôi dưỡng, không đụng
tới phân hệ nào khác):

- ✅ **Tổng hợp tuần** (tương đương `renderTongHop`): bảng số trẻ ăn + chi phí đã nhập theo từng
  ngày trong tuần (Thứ 2 → Thứ 7) cho cả hai nhóm Nhà trẻ/Mẫu giáo, cộng dồn cả tuần, xuất Excel.
  Hàm `getWeeklyRationSummary` trong `rationRepo.ts` — không cần bảng CSDL mới, tổng hợp trực
  tiếp từ `daily_rations`/`ration_items`/điểm danh đã có.
- ✅ **Chính sách** (tương đương `renderChinhSach`): trích dẫn văn bản căn cứ (01/VBHN-BGDĐT,
  2195/QĐ-BGDĐT, 218/2025/QH15, 277/2025/NĐ-CP, 17/2025/NQ-HĐND — nội dung tĩnh ở
  `mealPolicyContent.ts`, có ghi chú "đối chiếu văn bản địa phương" vì mức hỗ trợ khác nhau giữa
  các tỉnh), đối tượng hưởng hỗ trợ, lịch chi trả, và checklist việc cần làm — checklist lưu bền
  vững qua `system_settings` (key `nutrition_policy_checklist_state`), chỉ người có quyền
  `nutrition.edit` mới đánh dấu được.
- ✅ **In biểu mẫu** (tương đương `renderXuat`/`buildBieuHTML`): xem trước và in "Bảng tính ăn
  hàng ngày" đúng khuôn giấy hành chính — gộp cột Nhà trẻ + Mẫu giáo cạnh nhau theo từng thực
  phẩm, dòng tổng cộng, và khối chữ ký NGƯỜI TỔNG HỢP / NGƯỜI DUYỆT / DUYỆT CHI (in kèm tên hiệu
  trưởng nhà trường). Dùng `window.print()` với CSS `@media print`/`@page` (giống cách Công việc
  và Văn phòng số đã làm), không dùng cửa sổ popup như app gốc để tương thích tốt hơn với
  WebView của Tauri. Hàm `getCombinedDailyReport` trong `rationRepo.ts` gộp khẩu phần của hai
  nhóm cùng ngày thành một bảng theo đúng thực phẩm.
- ✅ Sửa thiếu sót: nút "Xuất Excel" ở tab Nhập liệu trước đó chưa kiểm tra quyền — nay yêu cầu
  `nutrition.export` giống các nút xuất/in mới.
- ⏭️ **Không triển khai "Nhập Excel"** (tương đương `renderImport`/`importExcel` của app gốc):
  tính năng này đọc lại đúng định dạng file Excel do chính app gốc xuất ra (dò theo vị trí ô cụ
  thể của một mẫu bảng tính riêng), phục vụ mô hình một máy/một file cục bộ. Trong MN360, dữ liệu
  đã có sẵn trong CSDL dùng chung của trường nên không cần "xuất ra Excel rồi nhập lại" — làm
  tính năng này sẽ vừa giả (không có nguồn Excel ngoài nào thực sự cần nhập) vừa rất dễ vỡ khi
  người dùng chỉnh sửa file. Có thể bổ sung sau nếu trường có nhu cầu nhập số liệu từ một mẫu
  Excel cụ thể khác đang dùng thực tế.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (30 test), `vite build` chạy sạch sau khi bổ sung.

### Ghi chú kiểm thử đã thực hiện — Giai đoạn 6

- Chạy trực tiếp 21 migration bằng Python `sqlite3` trên CSDL trống — không lỗi; đối chiếu số
  dòng seed đúng thiết kế (25 thực phẩm, 16 định mức, 2 khẩu phần demo, 10 dòng thực phẩm).
- Tính tay bằng Python lại đúng công thức `Σ(dinh_dưỡng_100g × định_mức/trẻ ÷ 100)` cho cả hai
  khẩu phần demo, đối chiếu khớp 100% với số hiển thị trên giao diện khi chạy thử ứng dụng
  thật (Xvfb + WebKitGTK): Mẫu giáo 447.7 kcal/trẻ, chi phí 26.682 đ; Nhà trẻ 327.9 kcal/trẻ,
  chi phí 35.700 đ.
- Đăng nhập bằng tài khoản `nuoiduong` (Nhân viên nuôi dưỡng), xác nhận: sidebar chỉ hiện đúng
  3 mục theo phân quyền vai trò; khẩu phần ngày mới tự tạo bản nháp trống, chỉnh sửa được;
  khẩu phần đã duyệt hiển thị chỉ đọc (không có ô nhập, không có nút xóa); khẩu phần chờ duyệt
  không hiện nút duyệt (đúng vì tài khoản không có quyền `nutrition.approve`).
- Phát hiện và sửa 1 lỗi hiển thị trong lúc kiểm thử: đơn vị "hộp" hiển thị nhầm thành mã nội
  bộ "hop" ở chế độ chỉ đọc thay vì nhãn tiếng Việt — đã sửa dùng `FOOD_UNIT_LABELS`.
- Kiểm thử 3 tab con bổ sung (Tổng hợp tuần/Chính sách/In biểu mẫu) bằng bản xem trước trình
  duyệt (`npm run build:web` + Playwright/Chromium), đăng nhập `nuoiduong`: Tổng hợp tuần hiển
  thị đúng số trẻ + chi phí cho ngày có dữ liệu (28/07) và "Chưa nhập" cho ngày chỉ có điểm danh
  mà chưa nhập khẩu phần; In biểu mẫu hiển thị đúng số liệu khớp với tab Nhập liệu (35.700 đ Nhà
  trẻ, 26.682 đ Mẫu giáo — khớp số đã đối chiếu tay ở trên) và xác nhận bằng
  `page.emulateMedia({ media: "print" })` rằng khi in chỉ còn lại đúng nội dung biểu mẫu (sidebar/
  topbar/nút điều khiển đều ẩn).

## Giai đoạn 7 — Tích hợp biểu mẫu báo cáo thật (Trẻ em) — 🚧 Đang làm

Theo yêu cầu người dùng, gửi kèm 5 biểu mẫu PDF báo cáo thật đang dùng ở trường: Chuyên cần
tháng (lưới ngày×trẻ), Khám sức khỏe toàn diện, Tổng hợp đánh giá phát triển qua biểu đồ,
Tổng hợp sức khỏe qua biểu đồ theo lớp/tháng, và Tổng hợp (số lượng học sinh theo thời điểm +
chuyên cần hàng tháng/học kỳ/năm). Triển khai theo 4 phần (Phase A-D) do mức sẵn sàng dữ liệu
khác nhau — người dùng đã xác nhận muốn làm cả 4 phần và cần xuất/in đúng khuôn biểu mẫu gốc.

### Phase A — Chuyên cần lưới tháng + tổng hợp tháng/học kỳ/năm — ✅ Hoàn thành

Không cần đổi CSDL — suy trực tiếp từ bảng `attendance` đã có (một dòng/trẻ/ngày).

- ✅ `childRepo.ts`: `getMonthlyAttendanceGrid(classId, yearMonth)` — lưới điểm danh cả tháng
  (x = có mặt/đi muộn, N = nghỉ có phép/không phép), chỉ tính những ngày/trẻ có bản ghi thật
  trong tháng đó (không suy diễn từ trạng thái hiện tại của trẻ, để đúng lịch sử ngay cả khi
  trẻ đã chuyển lớp/nghỉ học sau đó).
- ✅ `getYearlyAttendanceSummary(classId, start, end)`: tổng hợp từng tháng của năm học + trung
  bình Học Kỳ I (tháng 9-12) / Học Kỳ II (các tháng còn lại) / cả năm — công thức suy ngược
  chính xác từ 2 biểu mẫu gốc: **Số trẻ đăng ký** = số trẻ có bản ghi điểm danh trong tháng,
  **Số trẻ đi học** = số trẻ có ít nhất 1 ngày có mặt/đi muộn, **Số ngày học** = số ngày có bản
  ghi điểm danh, **Tổng số ngày trẻ đi học** = tổng số lượt có mặt/đi muộn, **Bình quân** =
  làm tròn(tổng ngày trẻ đi học ÷ số ngày học), **Tỷ lệ chuyên cần** = làm tròn 1 chữ số thập
  phân của (tổng ngày trẻ đi học ÷ (số ngày học × số trẻ đi học) × 100) — đã đối chiếu công thức
  này khớp chính xác với nhiều tháng trong file "Tổng hợp" gốc (tháng 9: 98,1%; tháng 10: 98,0%;
  tháng 12: 98,2%; tháng 2: 98,6%). Học Kỳ/Cả năm = trung bình cộng các tháng thành phần.
- ✅ Tab mới "Báo cáo chuyên cần" trong Trẻ em, 2 tab con: "Lưới điểm danh tháng" (in đúng khuôn
  "Chuyên cần Tháng N" — có `@page` khổ ngang, ẩn toàn bộ giao diện khi in) và "Tổng hợp năm học"
  (in + xuất Excel, đúng khuôn "TỔNG HỢP CHUYÊN CẦN HÀNG THÁNG").
- ✅ Kiểm thử bằng Playwright/Chromium trên bản xem trước: đối chiếu tay với dữ liệu demo lớp
  Mẫu giáo lớn A tháng 7/2026 (2 ngày điểm danh, 4 trẻ) — khớp chính xác Bình quân 3 trẻ = 75%.
  Xác nhận `page.emulateMedia({media:"print"})` chỉ còn lại đúng nội dung biểu mẫu.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (30 test) chạy sạch.

### Phase B — Tổng hợp số lượng học sinh theo thời điểm — ✅ Hoàn thành

- ✅ Migration 022: thêm `children.ethnicity` (tên dân tộc cụ thể, NULL/"Kinh" = không tính vào
  cột "Dân tộc" của báo cáo — theo quy ước thống kê phổ biến) và `children.policy_type`
  (`khong`/`con_chinh_sach`/`ngheo_can_ngheo`/`khuyet_tat` — một phân loại chính theo đúng cấu
  trúc 3 cột riêng biệt của biểu mẫu gốc).
- ✅ Migration 023: seed demo dân tộc/diện chính sách cho vài trẻ để có số liệu khác 0 khi thử.
- ✅ `childRepo.ts`: `updateChildDemographics`; `getStudentCountByTimePoints(classId, start, end)`
  — snapshot sĩ số tại 3 thời điểm (đầu năm = tháng đầu năm học, giữa năm = tháng 12 cuối Học
  Kỳ I, cuối năm = tháng cuối năm học), suy từ bản ghi điểm danh của tháng đó (cùng kỹ thuật với
  Phase A) để phản ánh đúng sĩ số thời điểm, không lấy theo trạng thái hiện tại của trẻ. Tuổi
  suy từ ngày sinh so với tháng chụp nhanh; "Dân tộc" = có ghi dân tộc và khác "Kinh".
- ✅ UI: nút "Sửa dân tộc / diện chính sách" trên hồ sơ trẻ; tab con thứ 3 "Số lượng học sinh"
  trong "Báo cáo tổng hợp" (đổi tên từ "Báo cáo chuyên cần" vì nay bao quát hơn), in đúng khuôn
  "TỔNG HỢP SỐ LƯỢNG HỌC SINH TỪNG THỜI ĐIỂM" + xuất Excel.
- ✅ Kiểm thử: chạy 23 migration liên tiếp bằng `sqlite3` trực tiếp — không lỗi; đối chiếu tay
  bằng Python truy vấn thô khớp chính xác với dữ liệu demo lớp Nhà trẻ C (4 trẻ, 1 dân tộc Dao,
  1 nghèo cận nghèo, 1 khuyết tật). Kiểm thử UI bằng Playwright: hồ sơ trẻ hiển thị đúng dân
  tộc/diện chính sách, form sửa hoạt động, bảng tổng hợp hiển thị đúng cấu trúc (không lỗi khi
  ngoài phạm vi năm học cấu hình — hiển thị 0 thay vì crash, giống hạn chế đã ghi nhận ở Phase A
  do dữ liệu demo chuyên cần nằm ngoài `school_years.end_date`).
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (30 test), `cargo check` chạy sạch.

### Phase C — Khám sức khỏe toàn diện — ✅ Hoàn thành

- ✅ Migration 024: bảng `physical_exams` — mỗi đợt khám (`exam_no` = "Lần N") có 1 dòng/trẻ,
  8 cột chuyên khoa (Tai mũi họng, Răng hàm mặt, Cơ xương khớp, Tim mạch, Hô hấp, Tâm thần kinh,
  Mắt, Bệnh khác — đúng cấu trúc biểu mẫu gốc), Xếp loại, Kết luận (mặc định "Bình thường").
  `class_id` lưu lại lớp của trẻ tại thời điểm khám (giống cách `attendance.class_id` đã làm)
  để báo cáo đúng dù trẻ sau này chuyển lớp. `UNIQUE(child_id, exam_no)`.
- ✅ Migration 025: seed demo "Khám sức khỏe toàn diện Lần 1" ngày 28/10/2025 cho lớp Mẫu giáo
  lớn A, khớp đúng ngày và nội dung ("Bình thường") với biểu mẫu PDF trường gửi kèm.
- ✅ `healthRepo.ts`: `listPhysicalExamRounds`, `getPhysicalExamGrid` (lưới trẻ đang học trong
  lớp × kết quả đã có, nếu có), `upsertPhysicalExam` (một dòng/trẻ/đợt khám).
- ✅ Tab mới "Khám sức khỏe toàn diện" trong Sức khỏe – An toàn: chọn lớp + đợt khám (tự động
  liệt kê các đợt đã có, cho phép thêm đợt mới), nhập trực tiếp trên bảng (8 cột chuyên khoa +
  Xếp loại + Kết luận), lưu từng dòng; in đúng khuôn "KHÁM SỨC KHỎE TOÀN DIỆN LẦN N" (chỉ hiện
  nội dung đã nhập, ẩn cột thao tác khi in, hiển thị đầy đủ văn bản không bị cắt như khi nhập).
- ✅ Kiểm thử: chạy 25 migration liên tiếp — không lỗi. Kiểm thử UI qua Playwright/Chromium: đợt
  khám demo hiển thị đúng ngày 28/10/2025 và "Bình thường" cho cả 4 trẻ lớp Mẫu giáo lớn A;
  tạo được đợt khám mới (Lần 2, ngày khác) độc lập với Lần 1; sửa/lưu một dòng hoạt động đúng;
  phát hiện và sửa lỗi hiển thị: ô nhập hẹp làm cắt chữ khi in — đã thêm phần tử hiển thị đầy đủ
  văn bản riêng cho chế độ in.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (30 test), `cargo check`, `vite build` chạy sạch.

### Phase D — Đánh giá phát triển qua biểu đồ (SD) + tổng hợp lớp/trường — ✅ Hoàn thành

Bế tắc trước đó (không tải được bảng chuẩn WHO chính xác từ who.int/CDC do bị chặn 403) đã được
gỡ: tìm thấy kho GitHub chính thức `WorldHealthOrganization/anthro` — R package công cụ tính
Chuẩn tăng trưởng trẻ em WHO, do chính nhân viên WHO (bộ phận dữ liệu dinh dưỡng) duy trì — `git
clone` trực tiếp lấy nguyên văn 3 bảng tham số LMS (`weianthro.txt`, `lenanthro.txt`,
`bmianthro.txt`, 0-1826 ngày tuổi tức 0-60 tháng) mà **không qua bất kỳ mô hình tóm tắt/diễn giải
nào** — loại bỏ hoàn toàn rủi ro sai số liệu y tế đã lo ngại trước đó. Người dùng quyết định: trẻ
trên 60 tháng (Mẫu giáo lớn 5-6 tuổi, ngoài phạm vi chuẩn WHO 0-60 tháng) tạm dùng mốc 60 tháng.

- ✅ Migration 028: bảng `who_growth_standards` (indicator `wfa`/`hfa`/`bmifa` × sex × age_days,
  tham số `l`/`m`/`s`, khóa chính gộp, `WITHOUT ROWID`).
- ✅ Migration 029: seed 10.962 dòng (3 chỉ số × 2 giới × 1.827 ngày tuổi), sinh bằng script
  chuyển đổi cơ học từ file `.txt` gốc (không gõ tay) — đã đối chiếu từng điểm mẫu (đầu/cuối mỗi
  file, vài mốc giữa) khớp chính xác với file nguồn.
- ✅ `src/lib/utils/growth.ts`: `ageInDays`, `clampToWhoRange` (cắt về 1826 ngày cho trẻ >60
  tháng), `calcZScore` (công thức LMS/Cole), `classifyWfa`/`classifyHfa`/`classifyBmifa` (ngưỡng
  phân loại chuẩn WHO: nhẹ cân, thấp còi, gầy còm ở -2SD/-3SD; BMI/tuổi có thêm nguy cơ thừa cân
  (+1SD), thừa cân (+2SD), béo phì (+3SD) — cân nặng/tuổi và chiều cao/tuổi không có ngưỡng thừa
  cân theo đúng khuyến cáo WHO).
- ✅ `healthRepo.ts`: `getGrowthAssessments(childId)` — tính z-score + phân loại cho toàn bộ lịch
  sử đo của một trẻ; `getGrowthSummary({classId} | {schoolYearId})` — tổng hợp phân loại (theo
  lần đo gần nhất mỗi trẻ) cho một lớp hoặc toàn trường.
- ✅ Tab mới "Đánh giá phát triển (SD)" trong Sức khỏe – An toàn, 2 tab con: "Biểu đồ tăng trưởng
  trẻ" (biểu đồ đường z-score theo thời gian, 3 chỉ số, có đường tham chiếu ±2SD/±3SD, bảng chi
  tiết từng lần đo kèm nhãn phân loại) và "Tổng hợp lớp/trường" (chọn lớp hoặc "Toàn trường", số
  lượng + tỷ lệ % theo từng mức phân loại cho cả 3 chỉ số).
- ✅ Kiểm thử: 17 unit test cho `growth.ts` (z-score khớp bảng WHO thực tế, ranh giới phân loại,
  clamp tuổi). Kiểm thử UI qua Playwright/Chromium (bản xem trước web): biểu đồ hiển thị đúng cho
  trẻ demo (Nguyễn Văn An, 2 lần đo 65,9 và 74 tháng tuổi — đều bị cắt về mốc 60 tháng khi tính,
  hiển thị đúng "Bình thường" cho cả 3 chỉ số); tổng hợp "Toàn trường" hiển thị đúng 2/2 trẻ có
  số liệu, 100% bình thường, khớp dữ liệu demo. Không lỗi console.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (60 test), `cargo check`, `vite build` chạy sạch.

## Bổ sung ngoài 4 phase — theo phản hồi trực tiếp của người dùng khi dùng thử bản xem trước

### Đội ngũ — tạo tài khoản đăng nhập mới cùng hồ sơ cán bộ — ✅ Hoàn thành

Người dùng phản hồi "chưa có cài đặt để bổ sung... cán bộ quản lý". Rà soát phát hiện đây là lỗ
hổng thật: màn hình "Tạo hồ sơ cán bộ" trước đó chỉ cho **chọn** một tài khoản đã có sẵn, không
có nơi nào tạo được tài khoản đăng nhập mới — nghĩa là không thể đưa cán bộ mới vào hệ thống.

- ✅ `systemRepo.ts`: `listRoles`, `isUsernameTaken`, `createUserAccount` (tạo user + gán 1 vai
  trò qua `user_roles`, `must_change_password = 1` bắt buộc đổi mật khẩu lần đăng nhập đầu, ghi
  `audit_logs`). Không cần migration mới — dùng đúng bảng `users`/`roles`/`user_roles` sẵn có.
- ✅ Nút "Thêm cán bộ mới (tài khoản mới)" trong Đội ngũ (chỉ hiện với quyền `system.edit`, tách
  biệt với nút "Tạo hồ sơ cán bộ" cũ dùng để gắn tài khoản đã có sẵn) — nhập họ tên/tên đăng
  nhập/vai trò/mật khẩu tạm/email/điện thoại + thông tin hồ sơ cán bộ trong cùng một form, tạo
  tài khoản và hồ sơ cán bộ trong một lần lưu (băm mật khẩu qua lệnh Rust `hash_password` có sẵn,
  đã hoạt động sẵn trong bản xem trước trình duyệt).
- ✅ Kiểm thử end-to-end bằng Playwright: tạo tài khoản mới `giaovien_login_test`, đăng xuất tài
  khoản hiệu trưởng, đăng nhập bằng tài khoản vừa tạo — xác nhận bắt buộc đổi mật khẩu ở lần đăng
  nhập đầu, và sidebar chỉ hiện đúng các mục theo quyền vai trò Giáo viên (không thấy Tài chính/
  Kiểm định/Công tác Đảng/Phụ huynh) — đúng RBAC.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (30 test), `cargo check`, `vite build` chạy sạch.

### Tài chính — Phiếu thu/Phiếu chi đúng mẫu C40-BB/C41-BB (TT 107/2017/TT-BTC) — ✅ Hoàn thành

Người dùng phản hồi mẫu phiếu thu/chi hiện tại (chỉ ghi số tiền/ngày/người nộp nội bộ) cần đúng
quy định tài chính. Đã hỏi rõ mẫu áp dụng — người dùng xác nhận dùng mẫu số C40-BB (Phiếu thu)/
C41-BB (Phiếu chi) theo Thông tư 107/2017/TT-BTC (chế độ kế toán hành chính sự nghiệp, áp dụng
cho trường công lập).

- ✅ Migration 026: thêm `payer_address`/`reason`/`attachment_count` (revenues) và
  `payee_address`/`reason`/`attachment_count` (expenses) — các trường bắt buộc trên mẫu gốc mà
  bản ghi nội bộ trước đó chưa có.
- ✅ `src/lib/utils/vietnameseNumber.ts`: đọc số tiền bằng chữ tiếng Việt (thuật toán tính toán
  thuần túy, không phải dữ liệu cần tra cứu — đã viết 13 unit test kiểm tra từng trường hợp đặc
  biệt: "linh", "mốt", "lăm", chèn "không trăm" ở nhóm giữa, bỏ qua nhóm giữa toàn số 0).
- ✅ `VoucherPrint.tsx`: in đúng khuôn mẫu C40-BB/C41-BB — trích dẫn đúng số Thông tư, Họ tên +
  địa chỉ người nộp/nhận, lý do, số tiền bằng số và bằng chữ, số chứng từ gốc kèm theo, khối 5
  chữ ký (Thủ trưởng đơn vị/Kế toán trưởng/Người lập phiếu/Thủ quỹ/Người nộp-nhận tiền), dòng
  "Đã nhận đủ số tiền bằng chữ". Ô "Nợ"/"Có" (số hiệu tài khoản kế toán) để trống cho kế toán ghi
  tay — MN360 không hạch toán sổ kép nên không tự điền số hiệu tài khoản (tránh bịa dữ liệu).
- ✅ Kiểm thử qua Playwright: lập phiếu thu 1.234.567đ, xác nhận bản in hiển thị đúng "Một triệu
  hai trăm ba mươi bốn nghìn năm trăm sáu mươi bảy đồng chẵn." (khớp unit test); lập phiếu chi
  530.000đ, xác nhận "Năm trăm ba mươi nghìn đồng chẵn."; xác nhận `emulateMedia({media:"print"})`
  chỉ còn lại đúng nội dung phiếu.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (43 test), `cargo check`, `vite build` chạy sạch.

### Giao diện — Sidebar responsive trên màn hình hẹp (điện thoại/máy tính bảng) — ✅ Hoàn thành

Người dùng phản hồi "chỗ lập phiếu thu chi tôi thấy chưa sử dụng được". Kiểm thử ở độ rộng máy
tính (1440–1500px) không tái hiện được lỗi — form và bản in hoạt động đúng. Kiểm thử độc lập ở độ
rộng điện thoại (390px) phát hiện nguyên nhân thật: `Sidebar` dùng `w-64` cố định 256px, luôn hiển
thị, không có điểm ngắt responsive hay nút thu gọn — trên màn hình 390px chỉ còn ~134px cho nội
dung, khiến mọi form nhiều trường (kể cả phiếu thu/chi) bị bóp méo không dùng được. Đây là lỗi có
sẵn toàn ứng dụng, không riêng phần phiếu thu/chi.

- ✅ `Sidebar.tsx`: nhận `open`/`onClose`; dưới điểm ngắt `md` hiển thị dạng ngăn kéo trượt
  (`fixed` + `-translate-x-full` khi đóng, `translate-x-0` khi mở) với lớp phủ nền mờ; từ `md` trở
  lên giữ nguyên hành vi cũ (`md:static md:translate-x-0`, luôn hiển thị, không cần nút mở). Bấm
  vào một mục điều hướng sẽ tự đóng ngăn kéo trên di động.
- ✅ `Topbar.tsx`: thêm nút hamburger (`md:hidden`) để mở/đóng ngăn kéo; ô tìm kiếm co giãn đúng
  (`min-w-0 flex-1`) thay vì tràn ngang trên màn hình hẹp.
- ✅ `AppLayout.tsx`: quản lý state đóng/mở sidebar, truyền xuống `Sidebar`/`Topbar`; giảm padding
  nội dung chính trên di động (`p-3` thay vì `p-6`, giữ `sm:p-6` cho màn hình rộng hơn).
- ✅ Kiểm thử qua Playwright ở độ rộng 390×844: sau đăng nhập, sidebar nằm ngoài màn hình
  (`x: -256`) và Tổng quan hiển thị toàn chiều rộng; bấm hamburger mở đúng ngăn kéo (`x: 0`); vào
  Tài chính – Tài sản → Phiếu thu xác nhận toàn bộ form (Trẻ, Khoản thu, Số tiền, Ngày, Họ tên/Địa
  chỉ/Lý do người nộp, Số chứng từ) hiển thị đầy đủ, không còn bị bóp méo. Kiểm thử lại ở 1440px
  xác nhận sidebar vẫn tĩnh, luôn hiển thị, không có nút hamburger — hành vi máy tính không đổi.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (43 test), `cargo check`, `vite build` chạy sạch.

### Phụ huynh — Trợ lý AI tư vấn nuôi dạy trẻ — ✅ Hoàn thành

Người dùng yêu cầu thêm trợ lý AI tư vấn cho phụ huynh. Đã hỏi rõ phạm vi trước khi làm — người
dùng chọn: (1) chỉ trả lời kiến thức nuôi dạy trẻ mầm non CHUNG, không dùng dữ liệu riêng của một
trẻ cụ thể (an toàn nhất, không cần ẩn danh vì không có gì để lộ); (2) lưu lại lịch sử hỏi-đáp để
nhà trường xem lại khi cần.

- ✅ Migration 027: bảng `parent_ai_consultations` (guardian_id, question, answer, created_at) +
  quyền mới `parent.ai_consult` (chỉ cấp cho vai trò `parent`).
- ✅ `parentRepo.ts`: `askAiParentingQuestion` (suy `guardian_id` từ tài khoản đăng nhập — không
  nhận trực tiếp từ client, đúng nguyên tắc đã áp dụng cho toàn phân hệ Phụ huynh; gọi
  `generateWithAi` với system prompt giới hạn nghiêm ngặt — chỉ kiến thức chung, KHÔNG chẩn đoán
  bệnh/kê đơn, phải khuyên liên hệ giáo viên/y tế trường nếu có dấu hiệu đáng lo ngại; lưu lại kết
  quả), `listMyAiConsultations` (lịch sử của chính phụ huynh), `listAllAiConsultationsForReview`
  (toàn bộ lịch sử, kèm tên phụ huynh, dành cho nhà trường xem lại).
- ✅ `ParentPortalPage.tsx`: phụ huynh (vai trò `parent`) thấy thêm thẻ "Trợ lý AI tư vấn nuôi dạy
  trẻ" — ô hỏi + lịch sử câu hỏi cũ, luôn kèm cảnh báo "không thay thế tư vấn y tế/chuyên môn".
  Tài khoản có quyền `parent.view` nhưng KHÔNG phải vai trò phụ huynh (Hiệu trưởng/Quản trị hệ
  thống — hai vai trò duy nhất đang có `parent.view`) khi vào cùng route sẽ thấy "Lịch sử hỏi Trợ
  lý AI của phụ huynh" thay vì các chức năng tự phục vụ của phụ huynh (trước đây route này với
  tài khoản không phải phụ huynh chỉ hiện các khối trống do không có hồ sơ `guardian`). Chưa cấp
  `parent.view` cho vai trò `teacher` vì không được yêu cầu — việc mở rộng thêm vai trò xem cần
  quyết định RBAC riêng.
- ✅ Tái sử dụng nguyên trạng AI Gateway đã có (Cài đặt → cấu hình nhà cung cấp/khóa API) — không
  tạo cổng AI riêng; nếu trường chưa cấu hình AI, phụ huynh nhận đúng thông báo "AI đang tắt hoặc
  chưa cấu hình khóa API" thay vì trợ lý âm thầm không phản hồi.
- ✅ Kiểm thử qua Playwright: đăng nhập `phuhuynh1`, xác nhận thẻ Trợ lý AI hiển thị đúng, nhập câu
  hỏi và bấm "Hỏi Trợ lý AI" nhận đúng thông báo cấu hình AI (bản xem trước trình duyệt/trường demo
  chưa bật AI — đúng hành vi mong đợi, giống tính năng AI soạn thảo văn bản đã có); đăng nhập
  `hieutruong`, xác nhận vào `/phu-huynh` thấy đúng bảng xem lại lịch sử (rỗng), không thấy các
  form tự phục vụ của phụ huynh (Xin nghỉ, Trao đổi với giáo viên...).
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (43 test), `cargo check`, `vite build` chạy sạch.

### Trẻ em / Đội ngũ — Nhập danh sách hàng loạt từ Excel + kết nối Google Drive — ✅ Hoàn thành

Người dùng yêu cầu các nút cần cho phép "tải những dữ liệu có sẵn hoặc kết nối với Drive". Đã hỏi
rõ phạm vi trước khi làm — người dùng chọn: nhập danh sách trẻ/cán bộ có sẵn từ Excel, và hỗ trợ
cả hai nguồn chọn tệp (máy tính cục bộ + Google Drive thật, không chỉ chọn tệp trên máy).

- ✅ `src/lib/import/excel.ts`: `parseWorkbookRows` (đọc trang tính đầu tiên của .xlsx thành mảng
  bản ghi theo tiêu đề cột, tự chuẩn hóa ngày tháng về YYYY-MM-DD kể cả khi Excel lưu dưới dạng
  Date), `downloadImportTemplate` (sinh tệp mẫu Excel có tiêu đề + 1 dòng ví dụ, tái dùng
  `downloadBlob` sẵn có).
- ✅ `src/lib/import/googleDrive.ts`: tích hợp Google Drive **thật** — không giả lập. Dùng Google
  Identity Services (`initTokenClient`) xin quyền `drive.readonly` + Google Picker API để chọn
  tệp, tải nội dung qua Drive API (`files.get?alt=media`, hoặc `files/{id}/export` cho Google
  Sheets). Chỉ cần OAuth Client ID + API Key lưu trong `system_settings` (tái dùng đúng bảng/cách
  lưu của AI Gateway) — **không lưu Client Secret phía client**, đúng khuyến nghị bảo mật của
  Google cho ứng dụng chạy trên máy người dùng (Tauri CSP vốn đã `null`/không giới hạn nên không
  cần sửa cấu hình để tải script Google). Chưa cấu hình → báo lỗi rõ ràng thay vì âm thầm thất
  bại.
- ✅ `ImportFileSourceBar.tsx`: 2 nút dùng chung — "Chọn tệp trên máy" (input `type=file` HTML
  thuần, không cần plugin Tauri, hoạt động giống hệt trên desktop lẫn bản xem trước trình duyệt)
  và "Chọn từ Google Drive".
- ✅ `ImportChildrenModal.tsx` (Trẻ em → Hồ sơ trẻ → "Nhập từ Excel"): tải mẫu, đọc tệp, đối chiếu
  cột "Lớp" với lớp có sẵn (khớp tên, không bắt buộc), validate từng dòng (thiếu tên/ngày sinh sai
  định dạng/giới tính không hợp lệ), xem trước có đánh dấu lỗi trước khi nhập, nhập tuần tự (tránh
  đụng độ khi sinh mã `TRE-...` tự tăng), báo cáo số dòng thành công/lỗi.
- ✅ `ImportStaffModal.tsx` (Đội ngũ → "Nhập từ Excel"): mỗi dòng hợp lệ tạo cả tài khoản đăng nhập
  mới (dùng chung 1 mật khẩu tạm nhập tại chỗ, bắt buộc đổi ở lần đăng nhập đầu) lẫn hồ sơ cán bộ
  trong một lượt — đối chiếu cột "Vai trò"/"Loại hợp đồng" với nhãn tiếng Việt có sẵn; tên đăng
  nhập có thể để trống để tự sinh từ họ tên (bỏ dấu, viết thường, thêm số nếu trùng) hoặc nhập tay.
- ✅ `SettingsPage.tsx`: thẻ "Tích hợp Google Drive" mới (OAuth Client ID + API Key), theo đúng mẫu
  giao diện của thẻ AI Gateway đã có.
- ✅ Kiểm thử qua Playwright trên `dist-web` (nơi `exceljs` được nhúng thật, khác bản artifact rút
  gọn): sinh tệp Excel thật bằng `exceljs`, dùng `setInputFiles` mô phỏng chọn tệp trên máy —
  nhập 2 trẻ hợp lệ + 1 dòng lỗi (thiếu tên) bị loại đúng, trẻ nhập vào có gán đúng lớp; nhập 2
  cán bộ hợp lệ + 1 dòng lỗi (vai trò không tồn tại) bị loại đúng, đăng xuất và đăng nhập lại bằng
  tài khoản vừa tạo qua Excel xác nhận mật khẩu tạm hoạt động và bắt buộc đổi mật khẩu; lưu cấu
  hình Google Drive, xác nhận lưu đúng và còn nguyên sau khi điều hướng lại trang Cài đặt; xóa cấu
  hình rồi bấm "Chọn từ Google Drive" xác nhận hiện đúng thông báo "Chưa cấu hình Google Drive".
  **Giới hạn kiểm thử đã biết**: môi trường chạy thử không có thông tin xác thực Google Cloud thật
  và không thể hoàn tất luồng đăng nhập OAuth/Picker của Google (cần trình duyệt thật + tài khoản
  Google) — phần này chỉ được xác minh đúng logic mã nguồn và đúng hành vi khi CHƯA cấu hình; đăng
  nhập Google Drive thật cần được xác nhận lại khi trường thật cấu hình Client ID/API Key của họ.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (43 test), `cargo check`, `vite build` chạy sạch.

### Nút Trợ lý AI nổi trên mọi trang — ✅ Hoàn thành

Người dùng yêu cầu bổ sung "nút AI". Đã hỏi rõ vị trí/chức năng trước khi làm — người dùng chọn
nút AI nổi (floating), hiển thị trên mọi trang trong ứng dụng.

- ✅ `FloatingAiAssistant.tsx`: nút tròn góc dưới bên phải (biểu tượng Sparkles), bấm mở khung
  hỏi-đáp nhỏ; dùng lại đúng `generateWithAi` (AI Gateway đã cấu hình tại Cài đặt) — không tạo
  cổng AI riêng. Luôn có dòng nhắc "Không nhập tên, ngày sinh, thông tin sức khỏe của trẻ/phụ
  huynh vào đây" ở đầu khung chat. Lịch sử hội thoại chỉ lưu trong phiên làm việc (không ghi CSDL)
  vì đây là trợ lý hỏi-đáp nhanh dùng chung, khác với Trợ lý AI tư vấn phụ huynh (có lưu lịch sử
  để nhà trường xem lại).
- ✅ Gắn vào `AppLayout.tsx` nên chỉ hiển thị sau khi đăng nhập (không có ở màn hình đăng nhập),
  ẩn khi màn hình đang khóa (`isLocked`) để tránh dùng AI khi chưa xác thực lại.
- ✅ Kiểm thử qua Playwright: xác nhận nút KHÔNG hiện ở màn hình đăng nhập, HIỆN sau khi đăng nhập
  và giữ nguyên khi chuyển trang (Tổng quan → Trẻ em); gửi câu hỏi nhận đúng thông báo "AI đang
  tắt hoặc chưa cấu hình khóa API" (trường demo/bản xem trước chưa bật AI — đúng hành vi mong đợi).
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (43 test), `cargo check`, `vite build` chạy sạch.

### Làm rõ nút Trợ lý AI + dải cảnh báo bản xem trước + xuất bản Firebase Hosting — ✅ Hoàn thành

Người dùng phản hồi "không có nút AI" dù đã thêm ở bước trước, và muốn xuất bản được lên Firebase.
Không thể truy cập trực tiếp link Artifact đã xuất bản để chẩn đoán từ môi trường này (mạng sandbox
chặn — chỉ kiểm thử lại được bản build cục bộ giống hệt mã nguồn đã xuất bản), nên xử lý theo hướng
vừa làm nút AI khó bỏ sót hơn, vừa làm rõ ràng bản xem trước để tránh hiểu nhầm:

- ✅ `FloatingAiAssistant.tsx`: nút tròn chỉ icon trước đây đổi thành nút bo tròn có **chữ "Trợ lý
  AI"** cạnh icon Sparkles — dễ nhận ra hơn nút tròn nhỏ ở góc màn hình.
- ✅ `WebPreviewBanner.tsx` (mới): dải cảnh báo màu vàng cố định đầu trang — "Đây là bản xem trước
  trên web — dữ liệu chỉ lưu tạm trong trình duyệt, không phải hệ thống chính thức của trường" —
  hiện ở cả màn hình đăng nhập lẫn sau khi đăng nhập, có nút đóng. Dùng hằng số biên dịch
  `__IS_WEB_PREVIEW__` (định nghĩa `true` trong `vite.web.config.ts`/`vite.artifact.config.ts`,
  `false` trong `vite.config.ts` bản desktop Tauri thật) để trình đóng gói loại bỏ hẳn đoạn mã này
  khỏi bản desktop — đã xác minh bằng cách `grep` chuỗi cảnh báo trong `dist/` (không có, đúng) và
  `dist-web/` (có, đúng).
- ✅ Xuất bản Firebase Hosting: `firebase.json` + `.firebaserc` (dự án `quantritruongmamnon`, theo
  đúng dự án người dùng đã tạo), lệnh `npm run deploy:firebase` (build `dist-web` rồi
  `firebase deploy --only hosting`). **Không tự đăng nhập/xuất bản thay được** — `firebase login`
  cần xác thực Google trên trình duyệt của người dùng, môi trường này không có thông tin xác thực
  Firebase/Google Cloud nào. Đã hướng dẫn chi tiết trong `README.md`.
- ✅ Kiểm thử qua Playwright trên `dist-web`: dải cảnh báo hiện đúng ở màn hình đăng nhập và sau
  đăng nhập, đóng được; nút "Trợ lý AI" có nhãn chữ hiện rõ ràng ở góc dưới bên phải.
- ✅ `tsc --noEmit`, ESLint (0 warning), Vitest (43 test), `cargo check`, `vite build` chạy sạch.

## Hướng dẫn chạy thử Giai đoạn 1-6 (PowerShell trên Windows)

Xem chi tiết đầy đủ trong `mn360/README.md`, tóm tắt:

```powershell
cd mn360
npm install
npm run tauri dev
```

Tài khoản demo: `hieutruong` / `MN360@2026` (bắt buộc đổi mật khẩu lần đăng nhập đầu).
Để thử Phụ huynh, đăng nhập `phuhuynh1` / `MN360@2026` (đã liên kết sẵn với trẻ "Nguyễn Văn An").
Để thử Khẩu phần dinh dưỡng, đăng nhập `nuoiduong` / `MN360@2026`, vào Nuôi dưỡng → Khẩu phần
dinh dưỡng, xem ngày 28/07/2026.

Nếu đã chạy ứng dụng từ trước, CSDL SQLite hiện có sẽ tự động áp dụng thêm các migration mới
(004-008 Giai đoạn 2, 009-013 Giai đoạn 3, 014-018 Giai đoạn 4, 019 Giai đoạn 5, 020-021
Giai đoạn 6) khi mở lại ứng dụng — không cần xóa dữ liệu cũ.

## Giai đoạn 7: Bản web thật (Firestore, dữ liệu vĩnh viễn) — đang triển khai theo từng đợt

Theo yêu cầu bổ sung: trang web xuất bản trước đó (`quantritruongmamnon-minhchung.web.app`) chỉ
là Cổng minh chứng kiểm định (một phần nhỏ), chưa có đủ 12 phân hệ như bản cài máy. Quyết định:
xây bản web thật đầy đủ chức năng, lưu dữ liệu thật trên Firestore (không phải bản xem trước
sql.js đã có sẵn), triển khai dần theo từng đợt vì khối lượng rất lớn (~19.000 dòng giao diện,
20 file kho dữ liệu SQL cần viết lại cho Firestore).

- ✅ Codemod: đổi toàn bộ import `lib/db/*` trong `features/routes/components/store` sang alias
  `@/lib/db` (đã có sẵn trong tsconfig/vite) — để có thể tráo sang bản Firestore bằng alias
  riêng trong `vite.firebase.config.ts` mà không sửa giao diện.
- ✅ `vite.firebase.config.ts` (mới): alias `@/lib/db` → `@/lib/db-firebase`, build ra
  `dist-firebase/`. Script `build:app`/`deploy:app` trong `package.json`, site Hosting riêng
  `quantritruongmamnon-app` (`firebase.app.json`) — tách khỏi site xem trước và site Cổng minh
  chứng kiểm định, tránh xung đột.
- ✅ `src/lib/firebase.ts`: khởi tạo Firebase App/Auth/Firestore, dùng chung project
  `quantritruongmamnon` với `evidence-portal` nhưng namespace Firestore riêng (tiền tố
  `mn360_...`) để không đụng dữ liệu của nhau. Hàm `usernameToAuthEmail` ánh xạ username nội bộ
  sang email giả `@mn360.internal` (Firebase Auth Email/Password bắt buộc định dạng email).
- ✅ Tách `authRepo.loginWithPassword`/`changePassword` khỏi `LoginPage.tsx`/
  `ChangePasswordPage.tsx` (trước đó 2 màn hình này gọi thẳng `invoke("verify_password"/
  "hash_password")` của Tauri — chặn hoàn toàn việc chạy trên web). Bản SQLite giữ nguyên hành
  vi cũ (đã kiểm thử lại `build`/`test`/`lint` không đổi); bản Firestore dùng thẳng
  `signInWithEmailAndPassword`/`reauthenticateWithCredential` của Firebase Auth (Firebase tự lo
  khoá tạm thời khi sai nhiều lần, không cần tự đếm `failed_login_count` như bản SQL).
- ✅ `src/lib/db-firebase/authRepo.ts`, `systemRepo.ts` (chỉ `getSchool`/`getCurrentSchoolYear`/
  `listActiveUsers` — đủ cho đăng nhập + chọn người phụ trách nhiệm vụ), `taskRepo.ts` (đầy đủ,
  làm mẫu đầu tiên): Firestore không có JOIN/LIKE/GROUP BY nên đổi cách tiếp cận — nhúng sẵn
  `owner_name`/`assignees[]` ngay trên tài liệu nhiệm vụ (denormalize) thay vì JOIN;
  `listTasks` tải toàn bộ rồi lọc/sắp xếp/phân trang phía client (phù hợp quy mô một trường,
  vài trăm-nghìn nhiệm vụ); mã nhiệm vụ tuần tự dùng Firestore transaction đếm riêng
  (`mn360_counters`) thay cho `SELECT COUNT(*)` (không an toàn khi nhiều người dùng ghi đồng
  thời); thông báo quá hạn dùng doc ID cố định theo `dedupKey` để tự chống trùng thay cho
  `INSERT OR IGNORE`.
- ✅ 16 phân hệ còn lại (`childRepo`, `staffRepo`, `curriculumRepo`, `nutritionRepo`,
  `healthRepo`, `financeRepo`, `accreditationRepo`, `partyRepo`, `parentRepo`, `documentRepo`,
  `attachmentRepo`, `backupRepo`, `notificationRepo`, `rationRepo`, `searchRepo`, phần còn lại
  của `systemRepo`) chỉ có **stub tự sinh** (`scripts/gen-firebase-stubs.mjs`) — đủ để bản build
  không lỗi thiếu import (Rollup vẫn cần resolve được mọi `import()` tĩnh dù lazy-load), nhưng
  gọi tới sẽ báo lỗi rõ ràng "chưa hỗ trợ trên bản web". Sẽ thay dần ở các đợt sau.
- ✅ `firestore.rules` (trong `evidence-portal/`, dùng chung 1 project nên 1 file rules): thêm
  block `mn360_*` — phân quyền qua `permissionCodes` lưu thẳng trên hồ sơ user (không cần custom
  claims/Cloud Functions, vẫn chạy được trên gói Firebase miễn phí Spark).
- ✅ `scripts/seed-firebase.mjs`: tạo trường/năm học/tài khoản `hieutruong` đầu tiên bằng chính
  Firebase Auth SDK phía client (không cần service account) — chỉ cấp quyền `dashboard.view` +
  `task.*` đúng phạm vi đã xây, tránh vào menu chưa chuyển đổi bị lỗi thay vì thông báo rõ ràng.
- ✅ Xác nhận không phá bản cũ: `npm run build` (desktop), `npm run build:web` (xem trước),
  `npm run typecheck`, `npm run lint`, `npm run test` (60 test) đều chạy sạch sau toàn bộ thay
  đổi; `npm run build:app` (bản Firestore) build thành công.
- ✅ Đợt 0-1 xuất bản và người dùng xác nhận kiểm thử thật thành công (đăng nhập, tạo/duyệt
  nhiệm vụ) tại `https://quantritruongmamnon-app.web.app`.
- ✅ **Đợt 2** — `childRepo.ts` (23 hàm: lớp, trẻ, điểm danh, báo cáo chuyên cần tháng/học kỳ/
  năm, tổng hợp số lượng học sinh theo thời điểm, đơn xin nghỉ/tin nhắn phía giáo viên — đơn
  giản hoá phụ huynh bằng cách nhúng thẳng vào tài liệu trẻ thay vì bảng riêng) và
  `staffRepo.ts` (hồ sơ cán bộ, phân công, nghỉ phép, đánh giá 3 vòng dùng doc ID cố định thay
  ON CONFLICT). Thêm trường `nutrition_group` khi tạo lớp (suy ra từ `age_group`, cần cho Đợt 4).
- ✅ **Đợt 3** — `partyRepo.ts` (18 hàm), giữ đúng nguyên tắc cách ly hoàn toàn của bản gốc: 7
  collection `mn360_party_*` riêng biệt, rules chỉ mở cho `permissionCodes` chứa `party.*`.
- ✅ **Đợt 4** — `curriculumRepo.ts` (kế hoạch giáo dục, quan sát, đánh giá trẻ — nối lại 2 hàm
  ChildDetailPage đã gọi sẵn từ Đợt 2) và `nutritionRepo.ts` + `rationRepo.ts` (món ăn, thực
  đơn, cảnh báo dị ứng, nhà cung cấp/giao nhận, kiểm thực ba bước, khẩu phần dinh dưỡng, tổng
  hợp tuần, biểu in, checklist chính sách).
- ✅ **Đợt 5** — `healthRepo.ts` (544 dòng, lớn nhất): hồ sơ sức khỏe/dị ứng, tăng trưởng, tiêm
  chủng, khám sức khỏe toàn diện, sự cố, kiểm tra an toàn. Đánh giá WHO Z-score đã nối đủ luồng
  tính toán nhưng bảng chuẩn `who_growth_standards` (~11.000 dòng L/M/S) **chưa được nhập** cho
  bản web — ghi số đo vẫn hoạt động bình thường, chỉ phân loại tự động hiện "chưa xác định" cho
  tới khi có script nhập riêng.
- ✅ **Đợt 6** — `financeRepo.ts`: khoản thu, phiếu thu/chi (lập→kiểm tra→phê duyệt), tài sản.
- ✅ **Đợt 7** — `accreditationRepo.ts`: tiêu chuẩn/tiêu chí, phân công, kho minh chứng dùng
  chung (upload 1 lần, liên kết N-N nhiều tiêu chí).
- ✅ **Đợt 8** — `documentRepo.ts`: văn bản đến/đi/nội bộ, phiên bản, quy trình duyệt đầy đủ,
  liên kết văn bản↔nhiệm vụ. Dùng chung `mn360_plan_approvals` cho lịch sử duyệt (kế hoạch giáo
  dục/thực đơn/tiêu chí kiểm định/văn bản đều theo mẫu soạn→duyệt tương tự).
- ✅ **Đợt 9 (module cuối)** — `parentRepo.ts`: mọi hàm tự kiểm tra quyền sở hữu trẻ qua mảng
  phẳng `guardian_user_ids` nhúng trên tài liệu trẻ (thêm hàm mới `linkGuardianToUserAccount`
  trong `childRepo.ts` vì bản SQL gốc dựa vào bảng `guardians` độc lập có `user_id` riêng —
  không còn phù hợp sau khi đơn giản hoá phụ huynh ở Đợt 2). Rules bổ sung hàm `mn360OwnsChild()`
  để phụ huynh đọc đúng dữ liệu con mình (điểm danh, khoản thu, thực đơn, đơn xin nghỉ, tin
  nhắn) mà không cần quyền nhân viên. Trợ lý AI tư vấn nuôi dạy trẻ **chưa hỗ trợ** trên web
  (bản gốc gọi thẳng lệnh Rust `ai_generate`, không có đường tương đương không cần Cloud
  Functions/Blaze) — lịch sử cũ vẫn đọc được, chỉ chưa hỏi được câu mới.
- ✅ **Toàn bộ 12/12 phân hệ đã chuyển đổi sang Firestore.** Sau mỗi đợt đều xác nhận lại
  `npm run build` (desktop), `npm run build:web` (xem trước), `typecheck`/`lint`/`test` (60
  test) không bị ảnh hưởng, và `npm run build:app` (bản Firestore) build thành công trước khi
  xuất bản.
- ✅ **Đợt 10** — Đăng nhập Google + phê duyệt/phân quyền tài khoản (chỉ bản web thật, cờ biên
  dịch `__ENABLE_GOOGLE_LOGIN__`): `loginWithGoogle()` trong `db-firebase/authRepo.ts` đăng nhập
  qua `signInWithPopup`, tài khoản Google lần đầu được ghi hồ sơ `is_active=0` (chờ duyệt) rồi
  đăng xuất ngay; nút "Đăng nhập bằng Google" ở `LoginPage.tsx` chỉ hiện trên bản web. Trang Cài
  đặt có thêm hai thẻ mới: "Tài khoản của tôi" (`MyProfileCard.tsx`, mọi tài khoản tự sửa họ
  tên/email/điện thoại qua `updateMyProfile()`, có ở cả desktop lẫn web) và "Quản lý tài khoản &
  phân quyền" (`AccountManagementCard.tsx`, chỉ hiện với `system.edit` trên bản web) — liệt kê
  tài khoản chờ duyệt/đang hoạt động, chọn quyền theo danh mục `permissionCatalog.ts` (khớp toàn
  bộ mã quyền trong `src-tauri/src/db/sql/*.sql`), phê duyệt/cập nhật quyền/khoá tài khoản qua
  `listAllUserAccounts`/`approveUserAccount`/`updateUserPermissions`/`setUserAccountActive` trong
  `db-firebase/systemRepo.ts` (không tự khoá được chính mình để tránh mất quyền admin). Rule
  `mn360_users` tách `create`/`update`: tự tạo/sửa hồ sơ của chính mình hoặc quản trị viên có
  `system.edit` sửa tài khoản người khác. Các hàm tương ứng bên `db/systemRepo.ts` (SQLite) chỉ
  là stub báo "không hỗ trợ trên desktop" vì máy tính không có khái niệm tài khoản Google chờ
  duyệt — không bao giờ được gọi vì nút/khối giao diện đã ẩn qua cờ biên dịch.

### Còn lại để hoàn thiện thêm (không chặn sử dụng)

- Nhập dữ liệu chuẩn tăng trưởng WHO (`mn360_who_growth_standards`) cho tính năng phân loại
  Z-score ở Sức khỏe.
- Đính kèm tệp thật (minh chứng, ảnh sự cố...) hiện dùng đường dẫn cục bộ kiểu Tauri — cần nối
  sang Cloudinary (đã dùng cho `evidence-portal`) để hoạt động trên web.
- Trợ lý AI tư vấn nuôi dạy trẻ (Phụ huynh) cần một cơ chế gọi AI phù hợp cho web (Cloud
  Function trả phí, hoặc gọi thẳng API AI từ trình duyệt có kiểm soát).
- Sao lưu/khôi phục (`backupRepo.ts`), tìm kiếm toàn hệ thống (`searchRepo.ts`), thông báo
  (`notificationRepo.ts` — khác cơ chế thông báo quá hạn nhiệm vụ đã có trong `taskRepo.ts`) vẫn
  còn là stub — không chặn sử dụng các phân hệ chính nhưng nên hoàn thiện dần.

Để đóng gói bộ cài `.msi`/`.exe` chính thức, chạy `npm run tauri build` trên máy Windows có đầy
đủ Visual Studio Build Tools — xem `mn360/README.md` mục "Đóng gói bộ cài Windows".
