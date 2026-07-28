# MN360 — Tiêu chí nghiệm thu

Trạng thái áp dụng cho **bản Giai đoạn 1** (nền tảng). Các tiêu chí thuộc phạm vi nghiệp vụ
chưa triển khai (Giai đoạn 2+) được đánh dấu "Chưa áp dụng" và sẽ chuyển sang "Đạt/Không đạt"
khi phân hệ tương ứng được xây dựng.

| # | Tiêu chí (theo mục XII yêu cầu gốc) | Trạng thái Giai đoạn 1 |
|---|---|---|
| 1 | Cài được trên Windows | ⬜ Chưa đóng gói MSI/EXE — cần build trên máy Windows |
| 2 | Chạy được khi không có Internet | ✅ Toàn bộ nghiệp vụ Giai đoạn 1 dùng SQLite cục bộ |
| 3 | Dữ liệu được lưu sau khi đóng ứng dụng | ✅ SQLite file trên đĩa, không lưu bộ nhớ tạm |
| 4 | Không tự lưu vào OneDrive | ✅ Thư mục dữ liệu do người dùng chọn, mặc định ngoài OneDrive |
| 5 | Người dùng được phân quyền đúng | ✅ RBAC theo vai trò + quyền thao tác, có kiểm thử |
| 6 | Phụ huynh không xem được dữ liệu của trẻ khác | ⬜ Chưa áp dụng (phân hệ Phụ huynh ở Giai đoạn 4) |
| 7 | Người không có thẩm quyền không thấy phân hệ Công tác Đảng | ✅ Ẩn sidebar + chặn route + chặn DAL |
| 8 | Mỗi phân hệ có danh sách/thêm/sửa/xem chi tiết/tìm kiếm/lọc | ✅ Áp dụng cho Công việc, Văn phòng số (2 phân hệ đã có ở GĐ1) |
| 9 | Quy trình gửi duyệt và phê duyệt hoạt động | ✅ Công việc và Văn phòng số có quy trình thật |
| 10 | Có lịch sử chỉnh sửa | ✅ `task_status_history`, `approvals`, `audit_logs` |
| 11 | Có cảnh báo nhiệm vụ quá hạn | ✅ Tính theo `due_date`, chống trùng bằng `notifications.dedup_key` |
| 12 | Điểm danh tự động cập nhật số suất ăn | ⬜ Chưa áp dụng (Điểm danh/Nuôi dưỡng ở Giai đoạn 2–3) |
| 13 | Có thể xuất Word, Excel, PDF | ⬜ Chưa áp dụng (Giai đoạn 2) |
| 14 | Sao lưu và khôi phục thành công | ✅ Có lệnh sao lưu thủ công + khôi phục, kiểm thử bằng script |
| 15 | Không tạo dữ liệu trùng khi thao tác/đồng bộ lại | ✅ Ràng buộc `UNIQUE(code)`, `dedup_key`; `SyncQueue` cho Giai đoạn sau |
| 16 | Không có lỗi nghiêm trọng trên giao diện | ✅ Đã kiểm thử thủ công các luồng chính GĐ1 |
| 17 | Không có lỗi TypeScript, lint hoặc test | ✅ `tsc --noEmit`, ESLint, Vitest chạy sạch |
| 18 | Có bộ dữ liệu demo | ✅ Trường Mầm non Tràng Đà (phạm vi GĐ1) |
| 19 | Có tài liệu cài đặt, sử dụng, bàn giao | ✅ `README.md` (cài đặt/chạy thử), tài liệu bàn giao đầy đủ ở Giai đoạn 5 |
| 20 | Có bộ cài Windows cuối cùng | ⬜ Thuộc Giai đoạn 5 |

## Ghi chú kiểm thử đã thực hiện ở Giai đoạn 1

- Kiểm thử phân quyền: đăng nhập với vai trò `teacher` xác nhận không thấy mục "Công tác
  Đảng"; đăng nhập `system_admin` xác nhận không có quyền `finance.view`/`health.view`/
  `party.view` theo mặc định.
- Kiểm thử mất mạng: ứng dụng không gọi mạng ở Giai đoạn 1 (chưa có AI/đồng bộ) — toàn bộ
  thao tác CRUD/phê duyệt/sao lưu chạy thuần cục bộ.
- Kiểm thử dữ liệu thiếu/sai: Zod schema chặn ở tầng form trước khi ghi CSDL; ràng buộc
  `NOT NULL`/`CHECK` ở tầng migration SQLite.
- Kiểm thử sao lưu/khôi phục: script `npm run test` bao gồm test khôi phục từ bản sao lưu
  và so sánh số dòng dữ liệu trước/sau.
