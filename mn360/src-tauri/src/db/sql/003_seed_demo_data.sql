-- MN360 — Dữ liệu demo tiếng Việt: Trường Mầm non Tràng Đà (Giai đoạn 1)
-- Không sử dụng thông tin thật của trẻ em. Mật khẩu demo cho mọi tài khoản: MN360@2026
-- Hash Argon2id dưới đây được tạo bằng cùng thuật toán/dạng PHC mà lệnh Rust
-- hash_password/verify_password sử dụng (Argon2::default()).

INSERT INTO schools (id, code, name, address, phone, principal_name, data_dir, logo_path, created_at, updated_at)
VALUES ('school-trangda', 'MN-TRANGDA', 'Trường Mầm non Tràng Đà',
        'Xã Tràng Đà, thành phố Tuyên Quang, tỉnh Tuyên Quang', '0207xxxxxxx',
        'Nguyễn Thị Hiên', NULL, NULL, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z');

INSERT INTO school_years (id, school_id, code, start_date, end_date, is_current, created_at, updated_at)
VALUES ('sy-2025-2026', 'school-trangda', '2025-2026', '2025-09-05', '2026-05-31', 1,
        '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z');

-- ===================== TÀI KHOẢN DEMO =====================
-- Hash Argon2id thật của mật khẩu "MN360@2026", sinh bằng:
--   cargo run --example gen_hash -- "MN360@2026"

INSERT INTO users (id, username, full_name, email, phone, password_hash, password_algo,
                    must_change_password, is_active, created_at, updated_at)
VALUES
('user-hieutruong', 'hieutruong', 'Nguyễn Thị Hiên', 'hieutruong@mn-trangda.edu.vn', '0900000001', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-pht1', 'phohieutruong1', 'Trần Thị Mai', 'pht1@mn-trangda.edu.vn', '0900000002', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-pht2', 'phohieutruong2', 'Lê Văn Hùng', 'pht2@mn-trangda.edu.vn', '0900000003', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-tt1', 'totruong1', 'Phạm Thị Lan', 'tt1@mn-trangda.edu.vn', '0900000004', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-tt2', 'totruong2', 'Đỗ Thị Hoa', 'tt2@mn-trangda.edu.vn', '0900000005', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-gv1', 'giaovien1', 'Vũ Thị Thu', 'gv1@mn-trangda.edu.vn', '0900000006', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-gv2', 'giaovien2', 'Nguyễn Thị Hằng', 'gv2@mn-trangda.edu.vn', '0900000007', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-gv3', 'giaovien3', 'Trần Thị Ngọc', 'gv3@mn-trangda.edu.vn', '0900000008', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-gv4', 'giaovien4', 'Phạm Văn Nam', 'gv4@mn-trangda.edu.vn', '0900000009', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-gv5', 'giaovien5', 'Lê Thị Huyền', 'gv5@mn-trangda.edu.vn', '0900000010', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-gv6', 'giaovien6', 'Nguyễn Văn Long', 'gv6@mn-trangda.edu.vn', '0900000011', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-vanthu', 'vanthu', 'Hoàng Thị Nga', 'vanthu@mn-trangda.edu.vn', '0900000012', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-ketoan', 'ketoan', 'Đặng Thị Thảo', 'ketoan@mn-trangda.edu.vn', '0900000013', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-yte', 'yte', 'Bùi Thị Yến', 'yte@mn-trangda.edu.vn', '0900000014', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-nuoiduong', 'nuoiduong', 'Ngô Thị Hạnh', 'nuoiduong@mn-trangda.edu.vn', '0900000015', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-quantrihethong', 'quantrihethong', 'Quản trị Hệ thống', 'admin@mn-trangda.edu.vn', '0900000016', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-quantrikythuat', 'quantrikythuat', 'Quản trị Kỹ thuật', 'tech@mn-trangda.edu.vn', '0900000017', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'),
('user-phuhuynh1', 'phuhuynh1', 'Phụ huynh Bé An', 'phuhuynh1@example.com', '0900000018', '$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE', 'argon2id', 1, 1, '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z');

INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES
('ur-1', 'user-hieutruong', 'role-principal', '2026-07-28T00:00:00Z'),
('ur-1b', 'user-hieutruong', 'role-party_committee', '2026-07-28T00:00:00Z'),
('ur-2', 'user-pht1', 'role-vice_principal', '2026-07-28T00:00:00Z'),
('ur-3', 'user-pht2', 'role-vice_principal', '2026-07-28T00:00:00Z'),
('ur-4', 'user-tt1', 'role-team_lead', '2026-07-28T00:00:00Z'),
('ur-5', 'user-tt2', 'role-team_lead', '2026-07-28T00:00:00Z'),
('ur-6', 'user-gv1', 'role-teacher', '2026-07-28T00:00:00Z'),
('ur-7', 'user-gv2', 'role-teacher', '2026-07-28T00:00:00Z'),
('ur-8', 'user-gv3', 'role-teacher', '2026-07-28T00:00:00Z'),
('ur-9', 'user-gv4', 'role-teacher', '2026-07-28T00:00:00Z'),
('ur-10', 'user-gv5', 'role-teacher', '2026-07-28T00:00:00Z'),
('ur-11', 'user-gv6', 'role-teacher', '2026-07-28T00:00:00Z'),
('ur-12', 'user-vanthu', 'role-clerk', '2026-07-28T00:00:00Z'),
('ur-13', 'user-ketoan', 'role-accountant', '2026-07-28T00:00:00Z'),
('ur-14', 'user-yte', 'role-nurse', '2026-07-28T00:00:00Z'),
('ur-15', 'user-nuoiduong', 'role-nutrition_staff', '2026-07-28T00:00:00Z'),
('ur-16', 'user-quantrihethong', 'role-system_admin', '2026-07-28T00:00:00Z'),
('ur-17', 'user-quantrikythuat', 'role-tech_admin', '2026-07-28T00:00:00Z'),
('ur-18', 'user-phuhuynh1', 'role-parent', '2026-07-28T00:00:00Z');

-- ===================== CÔNG VIỆC DEMO =====================

INSERT INTO tasks (id, code, school_year_id, title, field, content, priority, assigned_by,
                    owner_id, start_date, due_date, deliverable, done_criteria, progress_percent,
                    status, version, created_by, created_at, updated_by, updated_at)
VALUES
('task-1', 'NV-2026-000001', 'sy-2025-2026', 'Xây dựng kế hoạch giáo dục chủ đề "Gia đình"',
 'Chuyên môn', 'Soạn kế hoạch giáo dục chủ đề Gia đình cho khối Mẫu giáo lớn',
 'high', 'user-pht1', 'user-gv1', '2026-07-10', '2026-07-20',
 'Bản kế hoạch chủ đề (Word)', 'Đủ mục tiêu, yêu cầu cần đạt, hoạt động theo mẫu trường',
 60, 'submitted', 1, 'user-pht1', '2026-07-10T08:00:00Z', 'user-gv1', '2026-07-22T08:00:00Z'),
('task-2', 'NV-2026-000002', 'sy-2025-2026', 'Kiểm tra an toàn phòng cháy chữa cháy quý III',
 'An toàn', 'Kiểm tra hệ thống PCCC toàn trường, lập biên bản',
 'urgent', 'user-hieutruong', 'user-pht2', '2026-07-15', '2026-08-02',
 'Biên bản kiểm tra PCCC', 'Có chữ ký các bên, kèm ảnh minh chứng',
 20, 'draft', 1, 'user-hieutruong', '2026-07-15T08:00:00Z', 'user-pht2', '2026-07-15T08:00:00Z'),
('task-3', 'NV-2026-000003', 'sy-2025-2026', 'Tổng hợp báo cáo chuyên cần tháng 7',
 'Văn phòng', 'Tổng hợp số liệu chuyên cần các lớp gửi Phòng Giáo dục',
 'normal', 'user-pht1', 'user-vanthu', '2026-07-25', '2026-08-05',
 'Báo cáo Excel + Word', 'Khớp số liệu với các lớp, đúng mẫu báo cáo',
 10, 'draft', 1, 'user-pht1', '2026-07-25T08:00:00Z', 'user-vanthu', '2026-07-25T08:00:00Z'),
('task-4', 'NV-2026-000004', 'sy-2025-2026', 'Rà soát danh mục tài sản học kỳ II',
 'Tài sản', 'Kiểm kê tài sản, đối chiếu sổ sách với thực tế',
 'normal', 'user-hieutruong', 'user-ketoan', '2026-06-01', '2026-07-15',
 'Biên bản kiểm kê tài sản', 'Đầy đủ chữ ký hội đồng kiểm kê',
 100, 'approved', 2, 'user-hieutruong', '2026-06-01T08:00:00Z', 'user-hieutruong', '2026-07-16T08:00:00Z'),
('task-5', 'NV-2026-000005', 'sy-2025-2026', 'Chuẩn bị hồ sơ minh chứng tiêu chuẩn 1',
 'Kiểm định', 'Tập hợp minh chứng cho tiêu chuẩn 1 - Tổ chức và quản lý nhà trường',
 'high', 'user-hieutruong', 'user-pht1', '2026-07-05', '2026-07-30',
 'Danh mục minh chứng tiêu chuẩn 1', 'Minh chứng có mã, sắp xếp theo tiêu chí',
 45, 'pending_approval', 1, 'user-hieutruong', '2026-07-05T08:00:00Z', 'user-pht1', '2026-07-26T08:00:00Z');

INSERT INTO task_assignees (id, task_id, user_id, role_in_task) VALUES
('ta-1', 'task-1', 'user-gv1', 'owner'),
('ta-2', 'task-1', 'user-gv2', 'coordinator'),
('ta-3', 'task-2', 'user-pht2', 'owner'),
('ta-4', 'task-3', 'user-vanthu', 'owner'),
('ta-5', 'task-4', 'user-ketoan', 'owner'),
('ta-6', 'task-5', 'user-pht1', 'owner'),
('ta-7', 'task-5', 'user-tt1', 'coordinator');

INSERT INTO task_status_history (id, task_id, from_status, to_status, changed_by, changed_at, note) VALUES
('tsh-1', 'task-1', 'draft', 'submitted', 'user-gv1', '2026-07-22T08:00:00Z', 'Đã hoàn thành bản dự thảo, gửi tổ trưởng góp ý'),
('tsh-2', 'task-4', 'submitted', 'pending_approval', 'user-ketoan', '2026-07-14T08:00:00Z', 'Gửi hiệu trưởng phê duyệt'),
('tsh-3', 'task-4', 'pending_approval', 'approved', 'user-hieutruong', '2026-07-16T08:00:00Z', 'Đồng ý, lưu hồ sơ'),
('tsh-4', 'task-5', 'draft', 'submitted', 'user-pht1', '2026-07-20T08:00:00Z', 'Gửi hiệu trưởng xem trước'),
('tsh-5', 'task-5', 'submitted', 'pending_approval', 'user-pht1', '2026-07-26T08:00:00Z', 'Bổ sung minh chứng còn thiếu, gửi lại');

-- ===================== VĂN PHÒNG SỐ DEMO =====================

INSERT INTO documents (id, code, school_year_id, doc_type, title, summary, issuing_unit, recipient,
                        sign_date, effective_date, category, status, version, created_by, created_at,
                        updated_by, updated_at)
VALUES
('doc-1', 'DEN-2026-001', 'sy-2025-2026', 'incoming', 'Công văn hướng dẫn tựu trường năm học 2026-2027',
 'Hướng dẫn công tác chuẩn bị năm học mới', 'Phòng Giáo dục và Đào tạo', 'Trường Mầm non Tràng Đà',
 '2026-07-18', '2026-07-18', 'Chỉ đạo điều hành', 'published', 1, 'user-vanthu', '2026-07-18T08:00:00Z',
 'user-vanthu', '2026-07-18T08:00:00Z'),
('doc-2', 'DI-2026-001', 'sy-2025-2026', 'outgoing', 'Báo cáo tổng kết năm học 2025-2026',
 'Báo cáo kết quả thực hiện nhiệm vụ năm học', 'Trường Mầm non Tràng Đà', 'Phòng Giáo dục và Đào tạo',
 NULL, NULL, 'Báo cáo', 'pending_approval', 1, 'user-pht1', '2026-07-20T08:00:00Z',
 'user-pht1', '2026-07-24T08:00:00Z'),
('doc-3', 'NB-2026-001', 'sy-2025-2026', 'internal', 'Kế hoạch tổ chức Tết Trung thu 2026',
 'Kế hoạch tổ chức hoạt động Tết Trung thu cho trẻ toàn trường', 'Trường Mầm non Tràng Đà', 'Toàn trường',
 NULL, NULL, 'Kế hoạch', 'draft', 1, 'user-tt1', '2026-07-26T08:00:00Z',
 'user-tt1', '2026-07-26T08:00:00Z');

INSERT INTO document_versions (id, document_id, version_no, file_path, content_html, edited_by, edited_at, note)
VALUES
('dv-1', 'doc-2', 1, NULL, '<p>Dự thảo báo cáo tổng kết năm học...</p>', 'user-pht1', '2026-07-20T08:00:00Z', 'Bản dự thảo đầu tiên'),
('dv-2', 'doc-3', 1, NULL, '<p>Dự thảo kế hoạch Trung thu...</p>', 'user-tt1', '2026-07-26T08:00:00Z', 'Bản dự thảo đầu tiên');

INSERT INTO meetings (id, code, school_year_id, title, meeting_date, location, chair_person, status,
                      version, created_by, created_at, updated_by, updated_at)
VALUES
('meet-1', 'CH-2026-001', 'sy-2025-2026', 'Họp giao ban tháng 7/2026', '2026-07-05', 'Phòng họp nhà trường',
 'Nguyễn Thị Hiên', 'published', 1, 'user-vanthu', '2026-07-05T08:00:00Z', 'user-vanthu', '2026-07-05T10:00:00Z');

INSERT INTO meeting_minutes (id, meeting_id, content_html, conclusions_json, file_path)
VALUES ('mm-1', 'meet-1',
 '<p>Nội dung: đánh giá công tác tháng 6, triển khai nhiệm vụ tháng 7.</p>',
 '["Hoàn thiện hồ sơ minh chứng tiêu chuẩn 1 trước 30/7", "Kiểm tra PCCC toàn trường trước 02/8"]',
 NULL);

INSERT INTO document_task_links (id, document_id, meeting_id, task_id) VALUES
('dtl-1', NULL, 'meet-1', 'task-5'),
('dtl-2', NULL, 'meet-1', 'task-2');

-- ===================== THÔNG BÁO DEMO (không trùng lặp nhờ dedup_key) =====================

INSERT INTO notifications (id, user_id, title, body, link, level, is_read, created_at, dedup_key) VALUES
('noti-1', 'user-pht2', 'Nhiệm vụ sắp đến hạn', 'Nhiệm vụ "Kiểm tra an toàn phòng cháy chữa cháy quý III" đến hạn 02/08/2026', '/cong-viec/task-2', 'warning', 0, '2026-07-28T07:00:00Z', 'task-due-soon-task-2'),
('noti-2', 'user-gv1', 'Nhiệm vụ quá hạn', 'Nhiệm vụ "Xây dựng kế hoạch giáo dục chủ đề Gia đình" đã quá hạn', '/cong-viec/task-1', 'danger', 0, '2026-07-28T07:00:00Z', 'task-overdue-task-1');
