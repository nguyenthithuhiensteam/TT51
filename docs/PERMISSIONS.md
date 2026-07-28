# MN360 — Ma trận phân quyền (Permissions)

## 1. Vai trò hệ thống

| Mã vai trò | Tên |
|---|---|
| `system_admin` | Quản trị hệ thống |
| `principal` | Hiệu trưởng |
| `vice_principal` | Phó hiệu trưởng |
| `team_lead` | Tổ trưởng |
| `teacher` | Giáo viên |
| `clerk` | Văn thư |
| `accountant` | Kế toán |
| `nurse` | Nhân viên y tế |
| `nutrition_staff` | Nhân viên nuôi dưỡng |
| `party_committee` | Cấp ủy |
| `parent` | Phụ huynh |
| `tech_admin` | Quản trị kỹ thuật |

## 2. Thao tác chuẩn (áp dụng cho mọi phân hệ)

`view, create, edit, submit, approve, export, upload, share, lock, archive, restore`

Mã quyền có dạng `<module>.<action>`, ví dụ `task.approve`, `party.view`, `health.export`.

## 3. Nguyên tắc bắt buộc

1. **Quản trị kỹ thuật (`tech_admin`) không mặc định có `view` trên**: `children.*` (trừ
   metadata kỹ thuật), `health.*`, `finance.*`, `party.*`. Chỉ cấp khi được Hiệu trưởng ủy
   quyền tường minh qua một bản ghi `role_permissions` bổ sung có ghi log.
2. **Công tác Đảng ẩn hoàn toàn** với người dùng không có bất kỳ quyền `party.*` nào — mục
   sidebar không render, route bị chặn ở tầng guard, API/DAL từ chối truy vấn.
3. **Phụ huynh (`parent`) chỉ thấy dữ liệu của con mình** — mọi truy vấn phân hệ Phụ huynh
   lọc bắt buộc theo `guardian_id` suy ra từ tài khoản đăng nhập, không nhận `child_id` tùy ý
   từ client.
4. **Không vai trò nào tự động có `approve`** trên tài chính, nhân sự, sức khỏe, an toàn,
   văn bản chính thức — `approve` phải được cấp tường minh theo từng vai trò quản lý.
5. Người phê duyệt bước sau không được trùng người thực hiện bước trước trong cùng một quy
   trình (`approvals.approver_id != submitted_by` ở bước kế tiếp) — kiểm tra tại tầng service.

## 4. Ma trận theo phân hệ (Giai đoạn 1 đã triển khai)

Ký hiệu: X = có quyền mặc định; (X) = có nhưng giới hạn phạm vi (chỉ hồ sơ của mình/lớp mình).

### 4.1 Công việc (`task.*`)

| Vai trò | view | create | edit | submit | approve | export |
|---|---|---|---|---|---|---|
| system_admin | X | X | X | X | | X |
| principal | X | X | X | X | X | X |
| vice_principal | X | X | X | X | X | X |
| team_lead | X | X | (X) | X | (X) tổ mình | X |
| teacher | (X) | X | (X) việc của mình | X | | (X) |
| clerk | X | X | | X | | X |
| accountant/nurse/nutrition_staff | (X) việc của mình | X | (X) | X | | |
| party_committee | (X) | X | (X) | X | | |
| tech_admin | X (metadata) | | | | | |
| parent | | | | | | |

### 4.2 Văn phòng số (`document.*`)

| Vai trò | view | create | submit | approve/sign | publish | archive |
|---|---|---|---|---|---|---|
| principal | X | X | X | X | X | X |
| vice_principal | X | X | X | X (theo ủy quyền) | | |
| clerk | X | X | X | | X | X |
| team_lead/teacher | (X) liên quan | X (dự thảo) | X | | | |
| tech_admin | | | | | | |
| party_committee | (X) văn bản Đảng riêng, không thấy văn bản hành chính nội bộ khác nếu không được gắn | | | | | |

### 4.3 Cấu hình hệ thống (`system.*`)

| Vai trò | view | edit | backup | restore |
|---|---|---|---|---|
| system_admin | X | X | X | X |
| principal | X | (X) trường/năm học | X | |
| tech_admin | X (kỹ thuật) | X (kỹ thuật) | X | X (cần principal xác nhận) |

## 5. Ma trận rút gọn cho các phân hệ Giai đoạn 2+ (định hướng thiết kế quyền, chưa có UI)

| Phân hệ | Xem | Sửa/Duyệt |
|---|---|---|
| Trẻ em | teacher (lớp mình), vice_principal, principal, clerk (tuyển sinh) | vice_principal, principal duyệt chuyển lớp/thôi học |
| Đội ngũ | team_lead (tổ mình), vice_principal, principal | principal duyệt đánh giá cuối |
| Chuyên môn | teacher (soạn), team_lead (góp ý), vice_principal (duyệt) | vice_principal |
| Nuôi dưỡng | nutrition_staff, nurse (dị ứng), vice_principal | vice_principal/principal duyệt thực đơn |
| Sức khỏe – An toàn | nurse, vice_principal, principal; teacher chỉ xem trẻ lớp mình mức tối thiểu | nurse nhập, principal/vice_principal phê duyệt kế hoạch khắc phục |
| Tài chính – Tài sản | accountant, principal | principal phê duyệt thu/chi/thanh lý, không tự động |
| Kiểm định | hội đồng tự đánh giá (gán theo `criteria_assignments`), principal | principal |
| Công tác Đảng | party_committee, các đảng viên được gán | bí thư chi bộ (vai trò con trong `party_committee`) |
| Phụ huynh | parent (con mình) | giáo viên phản hồi trong phạm vi lớp |

## 6. Khóa/mở khóa & lưu trữ

Chỉ `principal`, `vice_principal` (theo ủy quyền), `system_admin` được `lock`/`archive`/
`restore` hồ sơ đã ban hành. Thao tác này luôn ghi `audit_logs` và không xóa vật lý dữ liệu.
