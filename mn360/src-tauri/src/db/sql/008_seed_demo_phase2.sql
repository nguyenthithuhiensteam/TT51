-- MN360 — Giai đoạn 2: dữ liệu demo tiếng Việt (Trường Mầm non Tràng Đà)
-- Không sử dụng thông tin thật của trẻ em — toàn bộ tên, ngày sinh là hư cấu.

-- ===================== LỚP (3 nhóm/lớp) =====================

INSERT INTO classes (id, school_year_id, code, name, age_group, homeroom_teacher_id, room, capacity, status, version, created_by, created_at, updated_by, updated_at) VALUES
('class-1', 'sy-2025-2026', 'MGL-A', 'Mẫu giáo lớn A', '5-6 tuổi', 'user-gv1', 'Phòng A1', 25, 'published', 1, 'user-hieutruong', '2025-08-15T00:00:00Z', 'user-hieutruong', '2025-08-15T00:00:00Z'),
('class-2', 'sy-2025-2026', 'MGN-B', 'Mẫu giáo nhỡ B', '4-5 tuổi', 'user-gv3', 'Phòng B1', 25, 'published', 1, 'user-hieutruong', '2025-08-15T00:00:00Z', 'user-hieutruong', '2025-08-15T00:00:00Z'),
('class-3', 'sy-2025-2026', 'NT-C', 'Nhà trẻ C', '24-36 tháng', 'user-gv5', 'Phòng C1', 20, 'published', 1, 'user-hieutruong', '2025-08-15T00:00:00Z', 'user-hieutruong', '2025-08-15T00:00:00Z');

-- ===================== TRẺ EM (12 trẻ mẫu) =====================

INSERT INTO children (id, code, school_year_id, class_id, full_name, dob, gender, enrollment_date, status, version, created_by, created_at, updated_by, updated_at) VALUES
('child-1', 'TRE-2026-0001', 'sy-2025-2026', 'class-1', 'Nguyễn Văn An', '2020-03-15', 'male', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-2', 'TRE-2026-0002', 'sy-2025-2026', 'class-1', 'Trần Thị Bình', '2020-07-22', 'female', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-3', 'TRE-2026-0003', 'sy-2025-2026', 'class-1', 'Lê Văn Cường', '2020-01-10', 'male', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-4', 'TRE-2026-0004', 'sy-2025-2026', 'class-1', 'Phạm Thị Dung', '2020-09-05', 'female', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-5', 'TRE-2026-0005', 'sy-2025-2026', 'class-2', 'Hoàng Văn Em', '2021-04-18', 'male', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-6', 'TRE-2026-0006', 'sy-2025-2026', 'class-2', 'Vũ Thị Phương', '2021-06-30', 'female', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-7', 'TRE-2026-0007', 'sy-2025-2026', 'class-2', 'Đặng Văn Giang', '2021-02-14', 'male', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-8', 'TRE-2026-0008', 'sy-2025-2026', 'class-2', 'Bùi Thị Hoa', '2021-11-25', 'female', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-9', 'TRE-2026-0009', 'sy-2025-2026', 'class-3', 'Ngô Văn Inh', '2023-05-01', 'male', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-10', 'TRE-2026-0010', 'sy-2025-2026', 'class-3', 'Đỗ Thị Kim', '2023-08-19', 'female', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-11', 'TRE-2026-0011', 'sy-2025-2026', 'class-3', 'Trịnh Văn Long', '2023-03-27', 'male', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z'),
('child-12', 'TRE-2026-0012', 'sy-2025-2026', 'class-3', 'Lý Thị Mai', '2023-10-09', 'female', '2025-09-05', 'studying', 1, 'user-vanthu', '2025-08-20T00:00:00Z', 'user-vanthu', '2025-08-20T00:00:00Z');

INSERT INTO guardians (id, full_name, relationship, phone, address, created_at, updated_at) VALUES
('guardian-1', 'Nguyễn Văn Bảo', 'Bố', '0911000001', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-2', 'Trần Thị Cúc', 'Mẹ', '0911000002', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-3', 'Lê Văn Đạt', 'Bố', '0911000003', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-4', 'Phạm Thị Hà', 'Mẹ', '0911000004', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-5', 'Hoàng Văn Khoa', 'Bố', '0911000005', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-6', 'Vũ Thị Lan', 'Mẹ', '0911000006', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-7', 'Đặng Văn Minh', 'Bố', '0911000007', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-8', 'Bùi Thị Nga', 'Mẹ', '0911000008', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-9', 'Ngô Văn Phúc', 'Bố', '0911000009', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-10', 'Đỗ Thị Quyên', 'Mẹ', '0911000010', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-11', 'Trịnh Văn Sơn', 'Bố', '0911000011', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z'),
('guardian-12', 'Lý Thị Tâm', 'Mẹ', '0911000012', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-20T00:00:00Z', '2025-08-20T00:00:00Z');

INSERT INTO child_guardians (id, child_id, guardian_id, is_primary, can_pickup) VALUES
('cg-1', 'child-1', 'guardian-1', 1, 1), ('cg-2', 'child-2', 'guardian-2', 1, 1),
('cg-3', 'child-3', 'guardian-3', 1, 1), ('cg-4', 'child-4', 'guardian-4', 1, 1),
('cg-5', 'child-5', 'guardian-5', 1, 1), ('cg-6', 'child-6', 'guardian-6', 1, 1),
('cg-7', 'child-7', 'guardian-7', 1, 1), ('cg-8', 'child-8', 'guardian-8', 1, 1),
('cg-9', 'child-9', 'guardian-9', 1, 1), ('cg-10', 'child-10', 'guardian-10', 1, 1),
('cg-11', 'child-11', 'guardian-11', 1, 1), ('cg-12', 'child-12', 'guardian-12', 1, 1);

-- Điểm danh mẫu 2 ngày gần đây cho lớp Mẫu giáo lớn A
INSERT INTO attendance (id, child_id, class_id, attendance_date, status, note, recorded_by, recorded_at) VALUES
('att-1', 'child-1', 'class-1', '2026-07-27', 'present', NULL, 'user-gv1', '2026-07-27T08:00:00Z'),
('att-2', 'child-2', 'class-1', '2026-07-27', 'present', NULL, 'user-gv1', '2026-07-27T08:00:00Z'),
('att-3', 'child-3', 'class-1', '2026-07-27', 'absent_excused', 'Gia đình xin nghỉ ốm', 'user-gv1', '2026-07-27T08:00:00Z'),
('att-4', 'child-4', 'class-1', '2026-07-27', 'present', NULL, 'user-gv1', '2026-07-27T08:00:00Z'),
('att-5', 'child-1', 'class-1', '2026-07-28', 'present', NULL, 'user-gv1', '2026-07-28T08:00:00Z'),
('att-6', 'child-2', 'class-1', '2026-07-28', 'late', 'Đến muộn 15 phút', 'user-gv1', '2026-07-28T08:00:00Z'),
('att-7', 'child-3', 'class-1', '2026-07-28', 'present', NULL, 'user-gv1', '2026-07-28T08:00:00Z'),
('att-8', 'child-4', 'class-1', '2026-07-28', 'absent_unexcused', NULL, 'user-gv1', '2026-07-28T08:00:00Z');

-- ===================== ĐỘI NGŨ =====================

INSERT INTO staff (id, user_id, employee_code, position, employment_type, degree, start_date, status, version, created_by, created_at, updated_by, updated_at) VALUES
('staff-1', 'user-hieutruong', 'VC-0001', 'Hiệu trưởng', 'payroll', 'Đại học Sư phạm Mầm non', '2015-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-2', 'user-pht1', 'VC-0002', 'Phó hiệu trưởng phụ trách chuyên môn', 'payroll', 'Đại học Sư phạm Mầm non', '2017-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-3', 'user-pht2', 'VC-0003', 'Phó hiệu trưởng phụ trách cơ sở vật chất', 'payroll', 'Đại học Sư phạm Mầm non', '2018-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-4', 'user-tt1', 'VC-0004', 'Tổ trưởng tổ Mẫu giáo lớn', 'payroll', 'Cao đẳng Sư phạm Mầm non', '2016-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-5', 'user-tt2', 'VC-0005', 'Tổ trưởng tổ Nhà trẻ - Mẫu giáo bé', 'payroll', 'Cao đẳng Sư phạm Mầm non', '2016-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-6', 'user-gv1', 'VC-0006', 'Giáo viên', 'payroll', 'Đại học Sư phạm Mầm non', '2019-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-7', 'user-gv2', 'VC-0007', 'Giáo viên', 'payroll', 'Cao đẳng Sư phạm Mầm non', '2020-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-8', 'user-gv3', 'VC-0008', 'Giáo viên', 'contract', 'Đại học Sư phạm Mầm non', '2021-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-9', 'user-gv4', 'VC-0009', 'Giáo viên', 'contract', 'Cao đẳng Sư phạm Mầm non', '2021-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-10', 'user-gv5', 'VC-0010', 'Giáo viên', 'contract', 'Trung cấp Sư phạm Mầm non', '2022-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-11', 'user-gv6', 'VC-0011', 'Giáo viên', 'probation', 'Cao đẳng Sư phạm Mầm non', '2025-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-12', 'user-vanthu', 'VC-0012', 'Văn thư', 'payroll', 'Trung cấp Văn thư lưu trữ', '2018-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-13', 'user-ketoan', 'VC-0013', 'Kế toán', 'payroll', 'Đại học Kế toán', '2017-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-14', 'user-yte', 'VC-0014', 'Nhân viên y tế', 'contract', 'Trung cấp Y', '2020-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('staff-15', 'user-nuoiduong', 'VC-0015', 'Nhân viên nuôi dưỡng', 'contract', 'Trung cấp Nấu ăn', '2019-08-01', 'active', 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z');

INSERT INTO staff_assignments (id, staff_id, school_year_id, class_id, assignment_type, description, created_by, created_at) VALUES
('sa-1', 'staff-6', 'sy-2025-2026', 'class-1', 'homeroom', 'Giáo viên chủ nhiệm lớp Mẫu giáo lớn A', 'user-hieutruong', '2025-08-15T00:00:00Z'),
('sa-2', 'staff-8', 'sy-2025-2026', 'class-2', 'homeroom', 'Giáo viên chủ nhiệm lớp Mẫu giáo nhỡ B', 'user-hieutruong', '2025-08-15T00:00:00Z'),
('sa-3', 'staff-10', 'sy-2025-2026', 'class-3', 'homeroom', 'Giáo viên chủ nhiệm lớp Nhà trẻ C', 'user-hieutruong', '2025-08-15T00:00:00Z'),
('sa-4', 'staff-2', 'sy-2025-2026', NULL, 'management', 'Phụ trách chuyên môn toàn trường', 'user-hieutruong', '2025-08-15T00:00:00Z');

INSERT INTO staff_leaves (id, staff_id, leave_type, start_date, end_date, reason, status, approved_by, created_by, created_at, updated_at) VALUES
('leave-1', 'staff-7', 'Nghỉ ốm', '2026-07-29', '2026-07-30', 'Sốt vi rút, có giấy khám của trạm y tế', 'pending_approval', NULL, 'user-gv2', '2026-07-28T07:30:00Z', '2026-07-28T07:30:00Z');

INSERT INTO staff_evaluations (id, staff_id, school_year_id, evaluator_role, evaluator_id, rating, strengths, weaknesses, improvement_plan, status, created_at, updated_at) VALUES
('eval-1', 'staff-6', 'sy-2025-2026', 'self', 'user-gv1', 'Hoàn thành tốt nhiệm vụ', 'Chủ động xây dựng kế hoạch giáo dục, phối hợp tốt với phụ huynh', 'Cần bổ sung kỹ năng ứng dụng công nghệ trong dạy học', 'Tham gia lớp bồi dưỡng CNTT học kỳ tới', 'submitted', '2026-05-20T00:00:00Z', '2026-05-20T00:00:00Z'),
('eval-2', 'staff-6', 'sy-2025-2026', 'team_lead', 'user-tt1', NULL, NULL, NULL, NULL, 'draft', '2026-05-20T00:00:00Z', '2026-05-20T00:00:00Z');

-- ===================== CHUYÊN MÔN =====================

INSERT INTO education_plans (id, code, school_year_id, class_id, plan_type, title, age_group, period_start, period_end, objectives, requirements, content, status, version, created_by, created_at, updated_by, updated_at) VALUES
('plan-1', 'KHGD-2026-0001', 'sy-2025-2026', 'class-1', 'year', 'Kế hoạch giáo dục năm học 2025-2026 - Khối Mẫu giáo lớn', '5-6 tuổi', '2025-09-05', '2026-05-31',
 'Phát triển toàn diện thể chất, nhận thức, ngôn ngữ, tình cảm-xã hội và thẩm mỹ cho trẻ 5-6 tuổi',
 'Theo yêu cầu cần đạt độ tuổi 5-6 tuổi trong Chương trình giáo dục mầm non',
 'Triển khai theo các chủ đề tháng, tích hợp hoạt động STEAM và giáo dục kỹ năng xã hội',
 'approved', 2, 'user-gv1', '2025-08-25T00:00:00Z', 'user-pht1', '2025-09-01T00:00:00Z'),
('plan-2', 'KHGD-2026-0002', 'sy-2025-2026', 'class-1', 'topic', 'Kế hoạch chủ đề Gia đình', '5-6 tuổi', '2026-07-13', '2026-07-31',
 'Trẻ hiểu về các thành viên, mối quan hệ và công việc trong gia đình',
 'Trẻ kể được tên và công việc của người thân trong gia đình',
 'Hoạt động khám phá, tạo hình, kể chuyện theo chủ đề Gia đình',
 'pending_approval', 1, 'user-gv1', '2026-07-10T00:00:00Z', 'user-gv1', '2026-07-22T00:00:00Z'),
('plan-3', 'KHGD-2026-0003', 'sy-2025-2026', 'class-3', 'week', 'Kế hoạch tuần 1 tháng 8 - Nhà trẻ C', '24-36 tháng', '2026-08-03', '2026-08-07',
 'Rèn nền nếp, thói quen vệ sinh cá nhân cho trẻ nhà trẻ',
 'Trẻ tự xúc ăn, rửa tay theo hướng dẫn',
 'Hoạt động vận động tinh, làm quen âm nhạc, chơi tập có chủ đích',
 'draft', 1, 'user-gv5', '2026-07-25T00:00:00Z', 'user-gv5', '2026-07-25T00:00:00Z');

INSERT INTO observations (id, child_id, class_id, observed_date, content, teacher_id, created_at) VALUES
('obs-1', 'child-1', 'class-1', '2026-07-27', 'An tích cực tham gia hoạt động nhóm, biết chia sẻ đồ chơi với bạn.', 'user-gv1', '2026-07-27T10:00:00Z'),
('obs-2', 'child-3', 'class-1', '2026-07-28', 'Cường còn nhút nhát khi phát biểu trước lớp, cần khích lệ thêm.', 'user-gv1', '2026-07-28T10:00:00Z');

INSERT INTO child_assessments (id, child_id, school_year_id, period, domain, result, note, assessed_by, assessed_at) VALUES
('assess-1', 'child-1', 'sy-2025-2026', 'Học kỳ 2', 'the_chat', 'Đạt', 'Vận động thô, tinh tốt, nhanh nhẹn', 'user-gv1', '2026-05-15T00:00:00Z'),
('assess-2', 'child-1', 'sy-2025-2026', 'Học kỳ 2', 'ngon_ngu', 'Đạt', 'Diễn đạt rõ ràng, vốn từ phong phú', 'user-gv1', '2026-05-15T00:00:00Z');
