# MN360 – HỆ ĐIỀU HÀNH TRƯỜNG MẦM NON SỐ
## Đặc tả sản phẩm (Product Spec)

> Tài liệu này là nguồn tham chiếu gốc cho toàn bộ quá trình thiết kế và xây dựng MN360.
> Cập nhật lần cuối: Giai đoạn 0 – Khảo sát và đặc tả.

## 1. Bối cảnh và mục tiêu

MN360 là hệ thống quản trị toàn diện cho một trường mầm non công lập tại Việt Nam,
bao phủ 12 phân hệ nghiệp vụ: Tổng quan, Công việc, Văn phòng số, Trẻ em, Đội ngũ,
Chuyên môn, Nuôi dưỡng, Sức khỏe – An toàn, Tài chính – Tài sản, Kiểm định,
Công tác Đảng, Phụ huynh.

Nguyên tắc cốt lõi:

1. **Một dữ liệu – một nguồn gốc chịu trách nhiệm.** Mỗi thực thể nghiệp vụ (trẻ, cán bộ,
   nhiệm vụ, văn bản...) có đúng một bảng sở hữu dữ liệu; các phân hệ khác chỉ tham chiếu,
   không sao chép/nhập lại.
2. **Nhập một lần, dùng nhiều lần.** Ví dụ: điểm danh trẻ là nguồn duy nhất cho suất ăn,
   tiền ăn, báo cáo chuyên cần và thông báo phụ huynh.
3. **Không bắt giáo viên nhập lại dữ liệu đã có.**
4. **Mọi nhiệm vụ có người phụ trách, thời hạn, sản phẩm, minh chứng** (nguyên tắc "6 rõ":
   rõ người, rõ việc, rõ thời gian, rõ kết quả, rõ trách nhiệm, rõ kiểm tra).
5. **Mọi hồ sơ có trạng thái, lịch sử chỉnh sửa, quy trình phê duyệt** (xem `docs/DATA_MODEL.md`
   mục trạng thái hồ sơ chuẩn).
6. **Local-first.** Hoạt động đầy đủ khi mất Internet; AI, đồng bộ, phụ huynh trực tuyến chỉ
   dùng khi có mạng.
7. **Con người quyết định.** Hệ thống không tự động phê duyệt nội dung chuyên môn, tài chính,
   nhân sự, sức khỏe, an toàn hoặc văn bản chính thức.

## 2. Mô hình triển khai

- Ứng dụng desktop Windows, đóng gói bằng Tauri 2, chạy local-first.
- Cơ sở dữ liệu chính là SQLite, lưu tại thư mục do quản trị viên chọn (mặc định gợi ý
  `D:\MN360\data`, không mặc định OneDrive).
- Không có Internet: toàn bộ nghiệp vụ nội bộ (trẻ em, đội ngũ, chuyên môn, nuôi dưỡng, sức
  khỏe, tài chính, kiểm định, Đảng, công việc, văn phòng số) vẫn hoạt động đầy đủ.
- Có Internet: kích hoạt đồng bộ (hàng chờ `SyncQueue`), cổng phụ huynh, và AI Gateway.
- Kiến trúc Data Access Layer (DAL) tách biệt nghiệp vụ khỏi SQLite để có thể chuyển sang
  PostgreSQL khi triển khai nhiều máy/máy chủ trường.

## 3. Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Đóng gói desktop | Tauri 2 (Rust backend) |
| Giao diện | React 18 + TypeScript + Vite |
| CSS/UI | Tailwind CSS, hệ component tự xây theo phong cách shadcn/ui |
| Cơ sở dữ liệu cục bộ | SQLite qua `tauri-plugin-sql`, migrations có phiên bản bằng Rust |
| Kiểm tra dữ liệu | Zod |
| Biểu mẫu | React Hook Form + `@hookform/resolvers/zod` |
| Biểu đồ | Recharts |
| Băm mật khẩu | Argon2id (lệnh Rust `hash_password`/`verify_password`), không lộ ra JS |
| Xuất tệp | (Giai đoạn 2+) docx/exceljs/pdf-lib phía frontend hoặc lệnh Rust |
| Trạng thái ứng dụng | Zustand (store nhẹ, không phụ thuộc mạng) |
| Định tuyến | React Router |
| Kiểm thử | Vitest + Testing Library, ESLint, `tsc --noEmit` |

## 4. Bố cục giao diện

- Sidebar trái: 12 mục theo đúng thứ tự trong yêu cầu; mục "Công tác Đảng" ẩn hoàn toàn với
  người dùng không có quyền `party.view`.
- Top bar: logo MN360, tên trường, năm học đang dùng, tìm kiếm toàn hệ thống, thông báo,
  trợ giúp, tài khoản, nút khóa ứng dụng, trạng thái online/offline.
- Bảng màu: navy `#0A1F4E`, xanh dương `#1A6BDB`, xanh mint `#2FBF9F` (bổ sung), nền kem
  `#FBF9F4`, vàng cảnh báo `#F5A524`, đỏ lỗi/nguy cơ `#DC2626`.
- Font: Be Vietnam Pro (tự host, không phụ thuộc CDN khi offline).

## 5. Phạm vi theo giai đoạn

Xem chi tiết trong `docs/ROADMAP.md`. Giai đoạn 0–3 (đã triển khai):

- Giai đoạn 1: Khởi tạo dự án, cơ sở dữ liệu, đăng nhập, phân quyền, cấu hình trường/năm học,
  giao diện chính, Tổng quan, Công việc, Văn phòng số (quy trình cơ bản), sao lưu/khôi phục.
- Giai đoạn 2: Trẻ em (hồ sơ, xếp lớp, điểm danh, chuyên cần, chuyển lớp/bảo lưu/chuyển
  trường/thôi học/hoàn thành), Đội ngũ (hồ sơ, phân công, nghỉ phép, đánh giá 3 cấp), Chuyên
  môn (kế hoạch giáo dục theo quy trình 6 bước, quan sát, đánh giá phát triển trẻ), xuất
  Word/Excel.
- Giai đoạn 3: Nuôi dưỡng (món ăn, thực đơn với số trẻ ăn tự động từ điểm danh, cảnh báo dị
  ứng, kiểm thực ba bước, giao nhận thực phẩm), Sức khỏe – An toàn (hồ sơ sức khỏe, tăng
  trưởng, tiêm chủng, sự cố/tai nạn, kiểm tra an toàn có kế hoạch khắc phục), Tài chính – Tài
  sản (khoản thu, phiếu thu/chi theo quy trình lập-kiểm tra-phê duyệt, danh mục tài sản).

Giai đoạn 4–5 (kế hoạch, chưa triển khai mã): Kiểm định, Công tác Đảng, Phụ huynh, AI Gateway,
xuất PDF, đóng gói bộ cài Windows.

## 6. Vai trò người dùng (tóm tắt, chi tiết ở `docs/PERMISSIONS.md`)

Quản trị hệ thống, Hiệu trưởng, Phó hiệu trưởng, Tổ trưởng, Giáo viên, Văn thư, Kế toán,
Nhân viên y tế, Nhân viên nuôi dưỡng, Cấp ủy, Phụ huynh, Quản trị kỹ thuật.

## 7. Trạng thái hồ sơ chuẩn

`Bản nháp → Đã gửi → Chờ duyệt → (Yêu cầu điều chỉnh) → Đã phê duyệt → Đã ký → Đã ban hành
→ Đã khóa → Đã lưu trữ / Đã hủy`. Mọi thay đổi trạng thái ghi vào `Approvals`/`AuditLogs`
kèm người thực hiện, thời điểm, trạng thái trước/sau, lý do, phiên đăng nhập.

## 8. Giới hạn đã biết ở bản Giai đoạn 1-3

- Chưa đóng gói bộ cài `.msi`/`.exe` Windows cuối cùng (cần máy Windows có Visual Studio
  Build Tools; môi trường xây dựng hiện tại là Linux headless, chỉ kiểm tra biên dịch
  `cargo check` được).
- Chưa có AI Gateway, đồng bộ mạng LAN, xuất PDF — thuộc giai đoạn sau (đã có xuất Word/Excel).
- Điểm danh (Trẻ em) nay đã liên kết tự động với số trẻ ăn (Nuôi dưỡng); chưa có tính khẩu
  phần/giá thành suất ăn tự động theo định lượng thực phẩm (thuộc phạm vi mở rộng sau).
- Các phân hệ Kiểm định, Công tác Đảng, Phụ huynh mới có ở mức schema dữ liệu định hướng,
  chưa có giao diện.
