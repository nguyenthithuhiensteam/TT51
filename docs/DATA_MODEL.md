# MN360 — Mô hình dữ liệu (Data Model)

## 1. Quy ước chung

Mọi bảng nghiệp vụ chính tuân theo bộ trường chuẩn sau (gọi là *cột chuẩn*):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | TEXT (UUID v4) | Khóa chính |
| `code` | TEXT | Mã nghiệp vụ dễ đọc, duy nhất trong phạm vi năm học (VD: `NV-2026-000123`) |
| `school_year_id` | TEXT | Khóa ngoại `school_years.id` |
| `status` | TEXT | Một trong trạng thái hồ sơ chuẩn |
| `version` | INTEGER | Tăng dần mỗi lần cập nhật (optimistic concurrency) |
| `created_by` | TEXT | Khóa ngoại `users.id` |
| `created_at` | TEXT (ISO 8601) | |
| `updated_by` | TEXT | Khóa ngoại `users.id` |
| `updated_at` | TEXT (ISO 8601) | |
| `deleted_at` | TEXT NULL | Lưu trữ mềm — khác NULL nghĩa là đã xóa mềm/lưu trữ |

Trạng thái hồ sơ chuẩn (bảng `status`):
`draft | submitted | pending_approval | needs_revision | approved | signed | published | locked | archived | cancelled`

Mọi thay đổi trạng thái được ghi vào bảng `approvals` (chuyển trạng thái hồ sơ nghiệp vụ)
và bảng `audit_logs` (mọi hành vi sửa/xóa/xuất dữ liệu nói chung), gồm: người thực hiện,
thời điểm, trạng thái trước, trạng thái sau, nội dung góp ý/lý do, phiên đăng nhập
(`session_id`), thiết bị (`device_info`).

## 2. Nhóm bảng đã triển khai ở Giai đoạn 1

### 2.1 Nền tảng & định danh

- **schools**(id, code, name, address, phone, principal_name, data_dir, logo_path, cột chuẩn)
- **school_years**(id, code `VD: 2025-2026`, start_date, end_date, is_current, cột chuẩn)
- **users**(id, username, full_name, email, phone, password_hash, password_algo,
  must_change_password, failed_login_count, locked_until, last_login_at, is_active, cột chuẩn)
- **roles**(id, code, name, description, is_system) — 12 vai trò chuẩn nạp sẵn (seed)
- **permissions**(id, code `VD: task.approve`, module, action, description)
- **user_roles**(id, user_id, role_id, cột chuẩn)
- **role_permissions**(id, role_id, permission_id)
- **sessions**(id, user_id, device_info, ip, created_at, expires_at, revoked_at) — phục vụ
  nhật ký truy cập và ghi `session_id` vào audit log
- **system_settings**(id, key, value_json, updated_by, updated_at)
- **audit_logs**(id, entity_table, entity_id, action, before_json, after_json, user_id,
  session_id, device_info, created_at)
- **sync_queue**(id, entity_table, entity_id, operation, payload_json, status
  `pending|synced|failed`, created_at, synced_at, error)
- **backups**(id, file_path, size_bytes, kind `manual|auto`, created_by, created_at, note)

### 2.2 Công việc

- **tasks**(id, code, title, field `lĩnh vực`, content, priority `low|normal|high|urgent`,
  assigned_by, owner_id `người chủ trì`, start_date, due_date, deliverable, done_criteria,
  progress_percent, difficulty, proposal, review_comment, approval_result, school_year_id,
  cột chuẩn)
- **task_assignees** (người phối hợp)(id, task_id, user_id, role_in_task `owner|coordinator`)
- **task_evidence**(id, task_id, file_path, file_name, uploaded_by, uploaded_at, note)
- **task_comments**(id, task_id, user_id, content, created_at) — nhật ký công việc
- **task_status_history**(id, task_id, from_status, to_status, changed_by, changed_at, note)

### 2.3 Văn phòng số

- **documents**(id, code, doc_type `incoming|outgoing|internal|draft`, title, summary,
  issuing_unit, recipient, sign_date, effective_date, category, school_year_id, cột chuẩn)
- **document_versions**(id, document_id, version_no, file_path, content_html, edited_by,
  edited_at, note)
- **approval_flows**(id, entity_table, entity_id, current_step, total_steps, status)
- **approvals**(id, entity_table, entity_id, step_no, approver_id, action
  `submit|comment|approve|reject|sign|publish`, comment, from_status, to_status, acted_at)
- **meetings**(id, code, title, meeting_date, location, chair_person, school_year_id, cột chuẩn)
- **meeting_minutes**(id, meeting_id, content_html, conclusions_json, file_path)
- **document_task_links**(id, document_id, meeting_id NULL, task_id) — liên kết nội dung chỉ
  đạo/kết luận cuộc họp thành nhiệm vụ

### 2.4 Đính kèm dùng chung

- **attachments**(id, entity_table, entity_id, file_name, file_path, mime_type, size_bytes,
  uploaded_by, uploaded_at)
- **notifications**(id, user_id, title, body, link, level `info|warning|danger`, is_read,
  created_at, dedup_key) — `dedup_key` đảm bảo không gửi trùng khi chạy lại tác vụ nhắc hạn

## 3. Nhóm bảng đã đặc tả cho Giai đoạn 2–4 (chưa tạo trong migration Giai đoạn 1)

Được mô tả trước để không phải thiết kế lại khi triển khai; tên bảng khớp mục VI của
yêu cầu gốc:

- **Trẻ em**: children, guardians, child_guardians, enrollments, classes, class_children,
  attendance, class_transfers, school_transfers, dropouts, program_completions,
  universal_education_records
- **Đội ngũ**: staff, staff_assignments, staff_leaves, timekeeping, trainings,
  staff_training_records, certificates, digital_competency_records, evaluations,
  professional_standard_records, kpis, commendations_disciplines, improvement_plans
- **Chuyên môn**: education_programs, education_plans, learning_objectives,
  observations, child_assessments, lesson_plans, learning_resources, professional_reviews
- **Nuôi dưỡng**: dishes, ingredients, menus, menu_items, meal_attendance, suppliers,
  food_deliveries, food_inventory, three_step_inspections, food_samples, kitchen_logs
- **Sức khỏe – An toàn**: health_records, growth_measurements, health_checkups,
  vaccinations, allergies, chronic_conditions, guardian_medicines, incidents,
  safety_inspections, risk_points, remediation_plans, drills
- **Tài chính – Tài sản**: budgets, funding_sources, revenues, fee_items, fee_waivers,
  payments, receipts, payment_vouchers, debts, reconciliations, procurement_requests,
  quotations, contracts, acceptances, assets, asset_inventories, asset_repairs,
  asset_transfers, asset_disposals
- **Kiểm định**: accreditation_councils, self_assessment_plans, accreditation_standards,
  accreditation_criteria, criteria_assignments, evidence_files (mã minh chứng duy nhất,
  liên kết N-N với tiêu chí qua `criteria_evidence_links`), internal_inspections,
  post_inspection_tracking
- **Công tác Đảng** (schema riêng, quyền truy vấn tách biệt hoàn toàn):
  party_members, party_assignments, party_programs, party_plans, party_meetings,
  party_meeting_minutes, resolutions, resolution_tracking, party_inspections,
  party_member_evaluations, cell_evaluations, party_fees, party_reports
- **Phụ huynh**: parent_messages, parent_surveys, parent_survey_responses,
  parent_feedback, consultation_requests, photo_albums, album_photos

## 4. Quan hệ liên kết một-nguồn-dữ-liệu quan trọng

- `attendance` (Giai đoạn 2) → nguồn duy nhất cho: `meal_attendance`, `fee_items`/`payments`
  (tiền ăn), báo cáo chuyên cần, `notifications` gửi phụ huynh.
- `tasks`/`document_task_links` là đích duy nhất khi "chuyển nội dung chỉ đạo thành nhiệm vụ".
- `evidence_files` (Kiểm định) tái sử dụng `attachments` vật lý, chỉ thêm liên kết tiêu chí,
  tránh tải trùng cùng một tệp.

## 5. Kiến trúc truy cập dữ liệu (DAL)

`src/lib/db/*` định nghĩa interface `Repository<T>` (list/find/create/update/softDelete) và
một implementation `SqliteRepository` dùng `tauri-plugin-sql`. Khi triển khai máy chủ nhiều
người dùng, chỉ cần viết `PostgresRepository` cùng interface mà không đổi tầng nghiệp vụ/UI.

## 6. Bổ sung đã triển khai: Khẩu phần ăn (dinh dưỡng + chi phí)

Migration 020-021 (`src-tauri/src/db/sql/`), DAL `src/lib/db/rationRepo.ts`. Khác với danh
sách định hướng ở mục 3 (dùng tên `ingredients`), tên bảng thực tế đã triển khai:

- `classes.nutrition_group` (`nha_tre`/`mau_giao`) — cột bổ sung, suy ra tự động từ
  `age_group` hiện có, có thể chỉnh tay nếu suy luận sai.
- `foods` — thành phần dinh dưỡng (đạm/béo/đường/kcal/canxi/sắt/vitamin A/vitamin C) trên
  100 đơn vị (100g/100ml, hoặc 1 đơn vị nếu `unit = 'hop'`); seed sẵn 25 thực phẩm thường
  dùng, có thể thêm thực phẩm ngoài danh mục ngay trên giao diện.
- `nutrition_norms` — định mức đối chiếu theo nhóm tuổi (nguồn: NKN người Việt Nam 2016).
- `daily_rations` — khẩu phần một ngày của một nhóm tuổi **toàn trường** (không tách theo
  từng lớp, theo đúng cách nhà trường đang vận hành); `meal_fee_rate` lưu snapshot định mức
  tiền ăn/trẻ/ngày tại thời điểm lập để không ảnh hưởng báo cáo cũ khi đổi định mức sau này;
  dùng chung `RecordStatus` (draft→...→approved) và bảng `approvals`/`audit_logs` như các
  hồ sơ khác.
- `ration_items` — từng dòng thực phẩm trong khẩu phần (định mức/trẻ, đơn giá).
- Số trẻ mỗi nhóm lấy tự động từ `attendance` JOIN `classes.nutrition_group` — không nhập
  lại thủ công, giữ đúng nguyên tắc "một dữ liệu — một nguồn gốc chịu trách nhiệm".
- Định mức tiền ăn mặc định lưu trong `system_settings` (key `meal_fee_rate_per_child_per_day`),
  cấu hình tại Cài đặt.
