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

### Việc chưa làm trong Giai đoạn 1 (dời sang giai đoạn sau)

- Xuất Word/Excel/PDF (thuộc Giai đoạn 2 theo yêu cầu gốc).
- Đồng bộ mạng LAN/máy chủ, AI Gateway (Giai đoạn 4).
- Toàn bộ 9 phân hệ nghiệp vụ còn lại (Trẻ em, Đội ngũ, Chuyên môn, Nuôi dưỡng, Sức khỏe – An
  toàn, Tài chính – Tài sản, Kiểm định, Công tác Đảng, Phụ huynh) — đã có schema định hướng
  trong `docs/DATA_MODEL.md` mục 3, chưa có bảng thật/migration/giao diện.

## Giai đoạn 2 — Nghiệp vụ cốt lõi — ⬜ Chưa bắt đầu

- Trẻ em (hồ sơ, tuyển sinh, xếp lớp, điểm danh, chuyên cần...)
- Đội ngũ (hồ sơ, phân công, chấm công, đánh giá viên chức, KPI...)
- Chuyên môn (kế hoạch giáo dục các cấp, giáo án, quan sát/đánh giá trẻ)
- Phê duyệt kế hoạch chuyên môn theo quy trình 6 bước
- Xuất Word/Excel/PDF theo mẫu nhà trường

## Giai đoạn 3 — Chăm sóc và vận hành — ⬜ Chưa bắt đầu

- Nuôi dưỡng (thực đơn, khẩu phần, kiểm thực ba bước, lưu mẫu...)
- Sức khỏe (hồ sơ sức khỏe, tăng trưởng, tiêm chủng, dị ứng...)
- An toàn (kiểm tra lớp/sân chơi, PCCC, điểm nguy cơ, diễn tập)
- Tài chính (dự toán, thu/chi, công nợ, công khai tài chính)
- Tài sản (danh mục, kiểm kê, sửa chữa, điều chuyển, thanh lý)

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

## Hướng dẫn chạy thử Giai đoạn 1 (PowerShell trên Windows)

Xem chi tiết đầy đủ trong `README.md` ở thư mục gốc dự án, tóm tắt:

```powershell
cd mn360
npm install
npm run tauri dev
```

Tài khoản demo: `hieutruong` / `MN360@2026` (bắt buộc đổi mật khẩu lần đăng nhập đầu).
