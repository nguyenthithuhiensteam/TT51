# MN360 — Tiêu chí nghiệm thu

Trạng thái áp dụng cho **bản Giai đoạn 1-6**. Bộ cài Windows chính thức (`.msi`/`.exe`) chưa
được tạo ra trong môi trường phát triển (Linux headless) — cấu hình đóng gói đã hoàn thiện,
cần chạy `npm run tauri build` trên máy Windows theo `mn360/README.md` để có tệp cài đặt cuối
cùng.

| # | Tiêu chí (theo mục XII yêu cầu gốc) | Trạng thái |
|---|---|---|
| 1 | Cài được trên Windows | 🚧 Cấu hình đóng gói (WiX/NSIS, ngôn ngữ, icon) đã hoàn thiện; chưa build MSI/EXE thật — cần chạy trên máy Windows |
| 2 | Chạy được khi không có Internet | ✅ Toàn bộ nghiệp vụ nội bộ dùng SQLite cục bộ; chỉ AI Gateway cần mạng |
| 3 | Dữ liệu được lưu sau khi đóng ứng dụng | ✅ SQLite file trên đĩa, không lưu bộ nhớ tạm |
| 4 | Không tự lưu vào OneDrive | ✅ Thư mục dữ liệu do người dùng chọn, mặc định ngoài OneDrive |
| 5 | Người dùng được phân quyền đúng | ✅ RBAC theo vai trò + quyền thao tác chi tiết (59 mã quyền), có kiểm thử |
| 6 | Phụ huynh không xem được dữ liệu của trẻ khác | ✅ Mọi truy vấn `parentRepo.ts` lọc theo `guardian_id` suy từ tài khoản đăng nhập, kiểm tra sở hữu trước khi trả dữ liệu |
| 7 | Người không có thẩm quyền không thấy phân hệ Công tác Đảng | ✅ Ẩn sidebar + chặn route + 7 bảng CSDL tách biệt hoàn toàn; đã xác nhận không role nào khác có quyền `party.*` |
| 8 | Mỗi phân hệ có danh sách/thêm/sửa/xem chi tiết/tìm kiếm/lọc | ✅ Áp dụng cho 10/12 phân hệ (trừ Phụ huynh — thiết kế một trang tối giản theo yêu cầu, và Tổng quan — thuần hiển thị số liệu) |
| 9 | Quy trình gửi duyệt và phê duyệt hoạt động | ✅ Công việc, Văn phòng số, Kế hoạch giáo dục, Nghỉ phép, Đánh giá viên chức, Thực đơn, Kiểm tra an toàn, Phiếu thu/chi, Tiêu chí kiểm định, Nghị quyết Đảng, Đơn xin nghỉ của phụ huynh |
| 10 | Có lịch sử chỉnh sửa | ✅ `task_status_history`, `child_status_history`, `asset_status_history`, `approvals`, `audit_logs` |
| 11 | Có cảnh báo nhiệm vụ quá hạn | ✅ Tính theo `due_date`, chống trùng bằng `notifications.dedup_key` |
| 12 | Điểm danh tự động cập nhật số suất ăn | ✅ Thực đơn và Khẩu phần dinh dưỡng đều lấy số trẻ ăn trực tiếp từ bảng `attendance`, không nhập lại |
| 13 | Có thể xuất Word, Excel, PDF | 🚧 Đã có Word (kế hoạch giáo dục) và Excel (công việc, trẻ em, chuyên cần, tài chính, khẩu phần dinh dưỡng); PDF vẫn chưa triển khai — dời sang phạm vi mở rộng sau |
| 14 | Sao lưu và khôi phục thành công | ✅ Có lệnh sao lưu thủ công + khôi phục, kiểm thử bằng script |
| 15 | Không tạo dữ liệu trùng khi thao tác/đồng bộ lại | ✅ Ràng buộc `UNIQUE` trên các cặp khóa nghiệp vụ (mã hồ sơ, ngày điểm danh, bước kiểm thực, kỳ đảng phí...); `SyncQueue` cho giai đoạn có máy chủ |
| 16 | Không có lỗi nghiêm trọng trên giao diện | ✅ Đã kiểm thử thủ công các luồng chính GĐ1-4 |
| 17 | Không có lỗi TypeScript, lint hoặc test | ✅ `tsc --noEmit`, ESLint, Vitest (30 test) chạy sạch |
| 18 | Có bộ dữ liệu demo | ✅ Trường Mầm non Tràng Đà: đầy đủ 12 phân hệ có dữ liệu mẫu, kể cả đảng viên/kiểm định/liên kết phụ huynh |
| 19 | Có tài liệu cài đặt, sử dụng, bàn giao | ✅ `mn360/README.md` (cài đặt/chạy thử/đóng gói), `docs/HUONG_DAN_SU_DUNG.md` (sử dụng theo phân hệ), `docs/BAN_GIAO.md` (bàn giao và vận hành) |
| 20 | Có bộ cài Windows cuối cùng | 🚧 Cấu hình đóng gói hoàn thiện; tệp `.msi`/`.exe` cần build trên máy Windows thật (không build được từ Linux headless) |

## Ghi chú kiểm thử đã thực hiện

### Giai đoạn 1

- Kiểm thử phân quyền: đăng nhập với vai trò `teacher` xác nhận không thấy mục "Công tác
  Đảng"; đăng nhập `system_admin` xác nhận không có quyền `finance.view`/`health.view`/
  `party.view` theo mặc định.
- Kiểm thử mất mạng: ứng dụng không gọi mạng ở Giai đoạn 1 (chưa có AI/đồng bộ) — toàn bộ
  thao tác CRUD/phê duyệt/sao lưu chạy thuần cục bộ.
- Kiểm thử dữ liệu thiếu/sai: Zod schema chặn ở tầng form trước khi ghi CSDL; ràng buộc
  `NOT NULL`/`CHECK` ở tầng migration SQLite.
- Kiểm thử sao lưu/khôi phục: script `npm run test` bao gồm test khôi phục từ bản sao lưu
  và so sánh số dòng dữ liệu trước/sau.

### Giai đoạn 2

- Migration 004-008 đã được chạy thử trực tiếp trên SQLite thật (Python `sqlite3`, không qua
  Tauri) để xác nhận cú pháp và ràng buộc khóa ngoại/CHECK hợp lệ trước khi tích hợp vào ứng
  dụng; đối chiếu số dòng dữ liệu demo đúng như thiết kế (3 lớp, 12 trẻ, 12 phụ huynh, 15 cán
  bộ, 3 kế hoạch giáo dục...).
- Đã khởi động toàn bộ ứng dụng (Xvfb + WebKitGTK, `npm run tauri dev`) để xác nhận không có
  lỗi biên dịch Rust hay panic khi nạp 8 migration liên tiếp trên một CSDL trống.
- Zod schema mới (`children.ts`, `staff.ts`, `curriculum.ts`) có unit test riêng xác nhận từ
  chối dữ liệu thiếu trường bắt buộc hoặc giá trị enum không hợp lệ.
- Quy trình phê duyệt kế hoạch giáo dục (soạn → góp ý → duyệt → ban hành → lưu trữ) dùng
  chung cơ chế `approvals`/`audit_logs` đã kiểm chứng ở Giai đoạn 1, đảm bảo không có bước nào
  tự động phê duyệt.

### Giai đoạn 3

- Migration 009-013 đã được chạy thử trực tiếp trên SQLite thật, xác nhận 13 migration liên
  tiếp chạy sạch trên một CSDL trống, tổng 50 mã quyền và 218 dòng phân quyền vai trò.
- Đã khởi động toàn bộ ứng dụng (Xvfb + WebKitGTK) sau khi thêm migration 009-013, xác nhận
  không panic khi biên dịch/khởi tạo.
- Kiểm thử thủ công logic đối chiếu dị ứng: dữ liệu demo có trẻ "Trần Thị Bình" dị ứng trứng
  và thực đơn có món chứa trứng → `checkAllergyWarnings` phát hiện đúng cảnh báo, hiển thị
  trước khi người có trách nhiệm (nuôi dưỡng/y tế) xác nhận và duyệt thực đơn.
- Kiểm thử quy trình tài chính 3 bước: phiếu thu demo `PT-2026-0001` có đủ `prepared_by`
  (kế toán), `checked_by` (phó hiệu trưởng), `approved_by` (hiệu trưởng) là 3 tài khoản khác
  nhau, xác nhận không có bước nào gán trùng người hoặc tự động phê duyệt.

### Giai đoạn 4

- Migration 014-018 đã được chạy thử trực tiếp trên SQLite thật, xác nhận 18 migration liên
  tiếp chạy sạch, tổng 59 mã quyền và 242 dòng phân quyền vai trò.
- Kiểm thử tách biệt Công tác Đảng bằng script SQL: truy vấn `role_permissions` của
  `system_admin`, `principal`, `tech_admin` giao với `permissions.module = 'party'` trả về
  **rỗng** — xác nhận không vai trò nào ngoài `party_committee` có quyền truy cập.
- Kiểm thử phân quyền Phụ huynh: `guardian-1` (tài khoản `phuhuynh1`) chỉ liên kết với
  `child-1`; mọi hàm trong `parentRepo.ts` gọi `assertGuardianOwnsChild()` trước khi trả dữ
  liệu, ném lỗi nếu `child_id` không thuộc phụ huynh đang đăng nhập.
- Kiểm thử kho minh chứng không trùng lặp: `evidence_files` có `UNIQUE(code)`; hai tiêu chí
  demo (`crit-1-1`, `crit-1-2`) dùng hai minh chứng khác nhau, cơ chế liên kết N-N qua
  `criteria_evidence_links` cho phép tái sử dụng một minh chứng cho nhiều tiêu chí mà không
  cần tải lại tệp.
- `reqwest` (dùng cho `ai_generate`) đã biên dịch thành công qua `cargo check`; do môi trường
  không có khóa API thật nên **chưa gọi thử một yêu cầu AI thực tế** — đây là giới hạn đã ghi
  rõ trong `docs/ROADMAP.md`.
- Đã khởi động toàn bộ ứng dụng (Xvfb + WebKitGTK) sau khi thêm migration 014-018 và lệnh
  `ai_generate`, xác nhận biên dịch/khởi tạo không lỗi.

### Giai đoạn 5

- Đo bundle trước/sau tối ưu: `npm run build` trước khi tách route/vendor chunk cho ra 1 tệp
  JS duy nhất 2163 KB (gzip 615 KB); sau khi áp dụng `React.lazy` cho toàn bộ trang phân hệ và
  `manualChunks` cho `docx`/`exceljs`/`jspdf`/`recharts`, tệp tải ngay khi mở ứng dụng còn
  170 KB (gzip 51 KB) — giảm hơn 92%.
- Migration 019 (15 chỉ mục mới) đã chạy thử trực tiếp trên SQLite thật nối tiếp 18 migration
  trước, xác nhận tổng 45 chỉ mục tùy chỉnh không trùng tên/không lỗi ràng buộc.
- `tsc --noEmit`, ESLint, Vitest (30 test), `cargo check`, `vite build` chạy sạch sau toàn bộ
  thay đổi Giai đoạn 5; khởi động lại ứng dụng qua Xvfb+WebKitGTK sau khi đổi
  `tauri.conf.json` (cấu hình đóng gói Windows) — Tauri tự phát hiện đổi cấu hình và rebuild,
  biên dịch thành công, không panic trong log.
- Icon đóng gói (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico`, `icon.icns`) đã kiểm
  tra định dạng bằng `file` — hợp lệ cho cả WiX (MSI) và NSIS.

### Giai đoạn 6 — Khẩu phần dinh dưỡng

- Migration 020-021 (21 migration liên tiếp) đã chạy thử trực tiếp trên SQLite thật, không lỗi;
  đối chiếu đúng 25 thực phẩm, 16 định mức dinh dưỡng, 2 khẩu phần demo, 10 dòng thực phẩm.
- Tính tay bằng Python theo đúng công thức tổng dinh dưỡng, đối chiếu khớp 100% với số hiển
  thị trên giao diện thật (Mẫu giáo 447.7 kcal/trẻ, chi phí 26.682 đ; Nhà trẻ 327.9 kcal/trẻ,
  chi phí 35.700 đ) khi chạy thử qua Xvfb + WebKitGTK.
- Đăng nhập bằng tài khoản `nuoiduong`, xác nhận sidebar/quyền đúng vai trò `nutrition_staff`
  (không thấy nút duyệt vì thiếu quyền `nutrition.approve`), khẩu phần đã duyệt hiển thị chỉ
  đọc, khẩu phần mới tự tạo bản nháp trống và chỉnh sửa được.
- `tsc --noEmit`, ESLint, Vitest (30 test), `cargo check`, `vite build` chạy sạch.

**Mở rộng — tích hợp đầy đủ nội dung app "Bữa ăn hạnh phúc" trong tab Khẩu phần dinh dưỡng:**

- Tab con "Tổng hợp tuần" hiển thị đúng số trẻ ăn + chi phí theo từng ngày (Thứ 2 → Thứ 7) —
  kiểm thử qua bản xem trước trình duyệt: ngày 28/07 (có dữ liệu) hiện đúng 3 trẻ Nhà trẻ/3 trẻ
  Mẫu giáo, chi phí 62.382 đ (= 35.700 + 26.682, khớp số đã đối chiếu ở khẩu phần demo); ngày
  27/07 (chỉ có điểm danh, chưa nhập khẩu phần) hiện đúng "Chưa nhập" thay vì 0đ gây hiểu nhầm.
- Tab con "Chính sách" hiển thị đúng nội dung văn bản căn cứ + checklist; checklist đánh dấu
  được và lưu bền vững (yêu cầu quyền `nutrition.edit`).
- Tab con "In biểu mẫu" hiển thị đúng "Bảng tính ăn hàng ngày" gộp Nhà trẻ + Mẫu giáo theo từng
  thực phẩm, tổng cộng khớp 100% với số liệu đã đối chiếu (35.700 đ / 26.682 đ); xác nhận bằng
  `page.emulateMedia({ media: "print" })` rằng khi in chỉ còn nội dung biểu mẫu, ẩn toàn bộ
  sidebar/topbar/nút điều khiển.
- Nút "Xuất Excel" (tab Nhập liệu) và các nút xuất/in mới đều yêu cầu quyền `nutrition.export`.
- Không triển khai "Nhập Excel" (đọc lại đúng định dạng file do app cũ xuất ra) — không phù hợp
  vì MN360 đã có dữ liệu sẵn trong CSDL dùng chung, không cần vòng xuất-rồi-nhập-lại; xem lý do
  chi tiết ở `docs/ROADMAP.md` mục Giai đoạn 6.
- `tsc --noEmit`, ESLint (0 warning), Vitest (30 test), `vite build` chạy sạch sau khi bổ sung.
- Rà soát diff commit xác nhận chỉ các tệp thuộc Nuôi dưỡng/tài liệu bị thay đổi — không phân hệ
  nào khác của MN360 bị ảnh hưởng, đúng theo yêu cầu "giữ nguyên các phần còn lại".
