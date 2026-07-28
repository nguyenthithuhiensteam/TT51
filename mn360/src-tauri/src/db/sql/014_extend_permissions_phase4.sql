-- MN360 — Giai đoạn 4: bổ sung quyền cho Kiểm định, Công tác Đảng, Phụ huynh
-- Không sửa lại các migration trước — mọi thay đổi phải là migration mới.

INSERT INTO permissions (id, code, module, action, description) VALUES
('perm-accreditation-create', 'accreditation.create', 'accreditation', 'create', 'Lập tiêu chuẩn/tiêu chí, phân công phụ trách'),
('perm-accreditation-edit', 'accreditation.edit', 'accreditation', 'edit', 'Viết mô tả hiện trạng, điểm mạnh/yếu, kế hoạch cải tiến, tải minh chứng'),
('perm-accreditation-approve', 'accreditation.approve', 'accreditation', 'approve', 'Phê duyệt báo cáo tự đánh giá theo tiêu chí'),
('perm-accreditation-export', 'accreditation.export', 'accreditation', 'export', 'Xuất báo cáo kiểm định'),
('perm-party-create', 'party.create', 'party', 'create', 'Tạo hồ sơ đảng viên, sinh hoạt chi bộ, nghị quyết'),
('perm-party-edit', 'party.edit', 'party', 'edit', 'Sửa hồ sơ/biên bản công tác Đảng'),
('perm-party-approve', 'party.approve', 'party', 'approve', 'Thông qua nghị quyết, đánh giá đảng viên'),
('perm-party-export', 'party.export', 'party', 'export', 'Xuất báo cáo công tác Đảng'),
('perm-parent-create', 'parent.create', 'parent', 'create', 'Phụ huynh gửi đơn xin nghỉ, tin nhắn cho giáo viên');

-- system_admin: toàn quyền kiểm định (KHÔNG có party.* — giữ tách biệt tuyệt đối)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-system_admin-' || p.code, 'role-system_admin', p.id FROM permissions p
WHERE p.code IN ('accreditation.create','accreditation.edit','accreditation.approve','accreditation.export');

-- principal
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-principal-' || p.code, 'role-principal', p.id FROM permissions p
WHERE p.code IN ('accreditation.create','accreditation.edit','accreditation.approve','accreditation.export');

-- vice_principal
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-vice_principal-' || p.code, 'role-vice_principal', p.id FROM permissions p
WHERE p.code IN ('accreditation.create','accreditation.edit','accreditation.approve','accreditation.export');

-- team_lead, teacher, clerk: được phân công viết minh chứng/tự đánh giá theo tiêu chí
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-team_lead-' || p.code, 'role-team_lead', p.id FROM permissions p
WHERE p.code IN ('accreditation.edit','accreditation.export');

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-teacher-' || p.code, 'role-teacher', p.id FROM permissions p
WHERE p.code IN ('accreditation.edit','accreditation.export');

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-clerk-' || p.code, 'role-clerk', p.id FROM permissions p
WHERE p.code IN ('accreditation.edit','accreditation.export');

-- Công tác Đảng: CHỈ party_committee — không role nào khác được cấp, kể cả system_admin/principal
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-party_committee-' || p.code, 'role-party_committee', p.id FROM permissions p
WHERE p.code IN ('party.create','party.edit','party.approve','party.export');

-- Phụ huynh: gửi xin nghỉ, tin nhắn
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-parent-' || p.code, 'role-parent', p.id FROM permissions p
WHERE p.code IN ('parent.create');

-- Giáo viên chủ nhiệm duyệt đơn xin nghỉ của trẻ lớp mình (mở rộng quyền children.approve đã cấp GĐ2)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-teacher-children-approve', 'role-teacher', p.id FROM permissions p
WHERE p.code = 'children.approve';
