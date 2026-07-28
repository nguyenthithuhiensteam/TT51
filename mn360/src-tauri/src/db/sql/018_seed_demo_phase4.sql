-- MN360 — Giai đoạn 4: dữ liệu demo tiếng Việt (Trường Mầm non Tràng Đà)

-- ===================== KIỂM ĐỊNH =====================

INSERT INTO accreditation_standards (id, code, name, order_no, created_at, updated_at) VALUES
('std-1', 'TC1', 'Tổ chức và quản lý nhà trường', 1, '2025-09-01T00:00:00Z', '2025-09-01T00:00:00Z'),
('std-2', 'TC2', 'Cán bộ quản lý, giáo viên, nhân viên', 2, '2025-09-01T00:00:00Z', '2025-09-01T00:00:00Z'),
('std-3', 'TC3', 'Cơ sở vật chất và thiết bị dạy học', 3, '2025-09-01T00:00:00Z', '2025-09-01T00:00:00Z');

INSERT INTO accreditation_criteria (id, standard_id, code, name, order_no, current_status_note, strengths, weaknesses, improvement_plan, status, version, created_by, created_at, updated_by, updated_at) VALUES
('crit-1-1', 'std-1', 'TC1.1', 'Phương hướng, chiến lược xây dựng và phát triển nhà trường', 1,
 'Nhà trường đã ban hành kế hoạch chiến lược giai đoạn 2025-2030, được công khai trên bảng tin và họp phụ huynh đầu năm',
 'Kế hoạch bám sát định hướng phát triển giáo dục địa phương, có sự tham gia góp ý của giáo viên',
 'Chưa có đánh giá định kỳ giữa kỳ để điều chỉnh kế hoạch',
 'Bổ sung rà soát, đánh giá kế hoạch chiến lược vào cuối mỗi học kỳ',
 'approved', 2, 'user-pht1', '2025-09-10T00:00:00Z', 'user-hieutruong', '2025-10-01T00:00:00Z'),
('crit-1-2', 'std-1', 'TC1.2', 'Hội đồng trường và các hội đồng khác', 2,
 'Đã thành lập Hội đồng trường, Hội đồng thi đua khen thưởng theo quy định',
 'Thành phần hội đồng đầy đủ theo quy định', NULL, NULL,
 'pending_approval', 1, 'user-vanthu', '2026-07-01T00:00:00Z', 'user-vanthu', '2026-07-15T00:00:00Z'),
('crit-2-1', 'std-2', 'TC2.1', 'Đối với hiệu trưởng, phó hiệu trưởng', 1, NULL, NULL, NULL, NULL,
 'draft', 1, 'user-tt1', '2026-07-20T00:00:00Z', 'user-tt1', '2026-07-20T00:00:00Z');

INSERT INTO criteria_assignments (id, criteria_id, assignee_id, assigned_by, created_at) VALUES
('ca-1', 'crit-1-1', 'user-pht1', 'user-hieutruong', '2025-09-05T00:00:00Z'),
('ca-2', 'crit-1-2', 'user-vanthu', 'user-hieutruong', '2025-09-05T00:00:00Z'),
('ca-3', 'crit-2-1', 'user-tt1', 'user-hieutruong', '2025-09-05T00:00:00Z');

INSERT INTO evidence_files (id, code, file_name, file_path, description, uploaded_by, uploaded_at) VALUES
('ev-1', 'MC-0001', 'Ke-hoach-chien-luoc-2025-2030.pdf', '/demo/evidence/ke-hoach-chien-luoc.pdf', 'Kế hoạch chiến lược phát triển nhà trường giai đoạn 2025-2030', 'user-pht1', '2025-09-10T00:00:00Z'),
('ev-2', 'MC-0002', 'Quyet-dinh-thanh-lap-hoi-dong-truong.pdf', '/demo/evidence/qd-hoi-dong-truong.pdf', 'Quyết định thành lập Hội đồng trường', 'user-vanthu', '2026-07-01T00:00:00Z');

INSERT INTO criteria_evidence_links (id, criteria_id, evidence_id, linked_by, created_at) VALUES
('cel-1', 'crit-1-1', 'ev-1', 'user-pht1', '2025-09-10T00:00:00Z'),
('cel-2', 'crit-1-2', 'ev-2', 'user-vanthu', '2026-07-01T00:00:00Z');

-- ===================== CÔNG TÁC ĐẢNG =====================

INSERT INTO party_members (id, user_id, membership_type, joined_date, cell_position, status, note, version, created_by, created_at, updated_by, updated_at) VALUES
('pm-1', 'user-hieutruong', 'chinh_thuc', '2010-06-15', 'bi_thu', 'active', NULL, 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('pm-2', 'user-pht1', 'chinh_thuc', '2013-11-20', 'pho_bi_thu', 'active', NULL, 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('pm-3', 'user-tt1', 'chinh_thuc', '2016-03-10', 'chi_uy_vien', 'active', NULL, 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z'),
('pm-4', 'user-gv1', 'chinh_thuc', '2020-07-01', 'dang_vien', 'active', NULL, 1, 'user-hieutruong', '2025-08-01T00:00:00Z', 'user-hieutruong', '2025-08-01T00:00:00Z');

INSERT INTO party_meetings (id, code, meeting_type, title, meeting_date, location, chair_person, content, status, version, created_by, created_at, updated_by, updated_at) VALUES
('pmeet-1', 'SHCB-2026-0001', 'dinh_ky', 'Sinh hoạt chi bộ tháng 7/2026', '2026-07-05', 'Phòng họp chi bộ', 'Nguyễn Thị Hiên',
 'Đánh giá công tác tháng 6, triển khai nhiệm vụ trọng tâm tháng 7, quán triệt văn bản cấp trên',
 'published', 1, 'user-hieutruong', '2026-07-05T08:00:00Z', 'user-hieutruong', '2026-07-05T10:00:00Z'),
('pmeet-2', 'SHCD-2026-0001', 'chuyen_de', 'Sinh hoạt chuyên đề: Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh', '2026-08-01', 'Phòng họp chi bộ', 'Nguyễn Thị Hiên',
 NULL, 'draft', 1, 'user-hieutruong', '2026-07-25T00:00:00Z', 'user-hieutruong', '2026-07-25T00:00:00Z');

INSERT INTO party_meeting_minutes (id, meeting_id, content_html, attendees_note, created_by, created_at) VALUES
('pmm-1', 'pmeet-1', '<p>Chi bộ đã thảo luận và thống nhất các nhiệm vụ trọng tâm tháng 7/2026...</p>', '4/4 đảng viên tham dự đầy đủ', 'user-hieutruong', '2026-07-05T10:00:00Z');

INSERT INTO party_resolutions (id, meeting_id, code, title, content, status, created_by, created_at, updated_by, updated_at) VALUES
('pres-1', 'pmeet-1', 'NQ-2026-0001', 'Nghị quyết về công tác phát triển đảng viên mới',
 'Phấn đấu giới thiệu ít nhất 01 quần chúng ưu tú đi học lớp bồi dưỡng nhận thức về Đảng trong năm học 2026-2027',
 'approved', 'user-hieutruong', '2026-07-05T10:00:00Z', 'user-hieutruong', '2026-07-05T10:00:00Z');

INSERT INTO resolution_tracking (id, resolution_id, progress_note, status, updated_by, updated_at) VALUES
('rt-1', 'pres-1', 'Đã rà soát danh sách quần chúng ưu tú trong trường, dự kiến giới thiệu 01 đồng chí', 'dang_thuc_hien', 'user-pht1', '2026-07-20T00:00:00Z');

INSERT INTO party_member_evaluations (id, member_id, year, rating, strengths, weaknesses, status, evaluated_by, created_at, updated_at) VALUES
('pme-1', 'pm-1', 2025, 'hoan_thanh_tot', 'Gương mẫu, hoàn thành tốt nhiệm vụ được giao', NULL, 'approved', 'user-hieutruong', '2025-12-20T00:00:00Z', '2025-12-25T00:00:00Z');

INSERT INTO party_fees (id, member_id, period, amount, paid_date, collected_by, created_at) VALUES
('pf-1', 'pm-1', '2026-07', 50000, '2026-07-05', 'user-pht1', '2026-07-05T00:00:00Z'),
('pf-2', 'pm-2', '2026-07', 40000, '2026-07-05', 'user-pht1', '2026-07-05T00:00:00Z'),
('pf-3', 'pm-3', '2026-07', 30000, NULL, NULL, '2026-07-01T00:00:00Z'),
('pf-4', 'pm-4', '2026-07', 30000, NULL, NULL, '2026-07-01T00:00:00Z');

-- ===================== PHỤ HUYNH =====================

UPDATE guardians SET user_id = 'user-phuhuynh1' WHERE id = 'guardian-1';

INSERT INTO child_leave_requests (id, code, child_id, guardian_id, start_date, end_date, reason, status, created_at) VALUES
('lr-1', 'XN-2026-0001', 'child-1', 'guardian-1', '2026-08-03', '2026-08-04', 'Gia đình có việc riêng, đưa con về quê', 'pending_approval', '2026-07-28T09:00:00Z');

INSERT INTO parent_messages (id, child_id, guardian_id, sender_role, sender_user_id, content, is_read, created_at) VALUES
('msg-1', 'child-1', 'guardian-1', 'parent', 'user-phuhuynh1', 'Chào cô, hôm nay bé An ở lớp có ăn ngủ tốt không ạ?', 1, '2026-07-27T16:00:00Z'),
('msg-2', 'child-1', 'guardian-1', 'teacher', 'user-gv1', 'Chào anh/chị, hôm nay bé An ăn hết suất, ngủ trưa ngoan ạ.', 0, '2026-07-27T17:00:00Z');
