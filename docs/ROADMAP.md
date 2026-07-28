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

## Giai đoạn 4 — Chất lượng và kết nối — ⬜ Chưa bắt đầu

- Kiểm định chất lượng (tự đánh giá, minh chứng, kế hoạch cải tiến)
- Công tác Đảng (phân hệ tách biệt, phân quyền riêng)
- Phụ huynh (giao diện tối giản, chỉ xem dữ liệu con mình)
- Thông báo đa kênh
- Đồng bộ dữ liệu qua mạng LAN/đám mây
- AI Gateway (đa nhà cung cấp, ẩn danh dữ liệu trẻ, có kiểm duyệt con người)

## Giai đoạn 5 — Hoàn thiện — ⬜ Chưa bắt đầu

- Kiểm thử tổng thể, phân quyền, mất mạng, dữ liệu thiếu/sai/trùng, sao lưu/khôi phục
- Tối ưu hiệu năng
- Đóng gói bộ cài Windows (.msi/.exe) chính thức
- Hướng dẫn sử dụng và bàn giao

## Hướng dẫn chạy thử Giai đoạn 1-3 (PowerShell trên Windows)

Xem chi tiết đầy đủ trong `mn360/README.md`, tóm tắt:

```powershell
cd mn360
npm install
npm run tauri dev
```

Tài khoản demo: `hieutruong` / `MN360@2026` (bắt buộc đổi mật khẩu lần đăng nhập đầu).

Nếu đã chạy ứng dụng từ trước, CSDL SQLite hiện có sẽ tự động áp dụng thêm các migration mới
(004-008 của Giai đoạn 2, 009-013 của Giai đoạn 3) khi mở lại ứng dụng — không cần xóa dữ liệu cũ.
