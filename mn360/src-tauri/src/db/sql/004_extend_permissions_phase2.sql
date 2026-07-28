-- MN360 — Giai đoạn 2: bổ sung quyền chi tiết cho Trẻ em, Đội ngũ, Chuyên môn
-- Không sửa lại 001-003 vì đã áp dụng trên CSDL hiện có — mọi thay đổi phải là migration mới.

INSERT INTO permissions (id, code, module, action, description) VALUES
('perm-children-create', 'children.create', 'children', 'create', 'Tiếp nhận/tạo hồ sơ trẻ'),
('perm-children-edit', 'children.edit', 'children', 'edit', 'Sửa hồ sơ trẻ, xếp lớp'),
('perm-children-approve', 'children.approve', 'children', 'approve', 'Duyệt chuyển lớp/bảo lưu/chuyển trường/thôi học'),
('perm-children-export', 'children.export', 'children', 'export', 'Xuất báo cáo trẻ em/chuyên cần'),
('perm-staff-create', 'staff.create', 'staff', 'create', 'Tạo hồ sơ cán bộ'),
('perm-staff-edit', 'staff.edit', 'staff', 'edit', 'Sửa hồ sơ, phân công cán bộ'),
('perm-staff-approve', 'staff.approve', 'staff', 'approve', 'Duyệt nghỉ phép, đánh giá viên chức'),
('perm-staff-export', 'staff.export', 'staff', 'export', 'Xuất báo cáo đội ngũ'),
('perm-curriculum-create', 'curriculum.create', 'curriculum', 'create', 'Soạn kế hoạch giáo dục'),
('perm-curriculum-submit', 'curriculum.submit', 'curriculum', 'submit', 'Gửi duyệt kế hoạch giáo dục'),
('perm-curriculum-approve', 'curriculum.approve', 'curriculum', 'approve', 'Góp ý/phê duyệt kế hoạch giáo dục'),
('perm-curriculum-export', 'curriculum.export', 'curriculum', 'export', 'Xuất kế hoạch giáo dục ra Word/PDF');

-- system_admin: có toàn bộ quyền nghiệp vụ mới (đã loại trừ party.view từ trước)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-system_admin-' || p.code, 'role-system_admin', p.id FROM permissions p
WHERE p.code IN (
  'children.create','children.edit','children.approve','children.export',
  'staff.create','staff.edit','staff.approve','staff.export',
  'curriculum.create','curriculum.submit','curriculum.approve','curriculum.export'
);

-- principal
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-principal-' || p.code, 'role-principal', p.id FROM permissions p
WHERE p.code IN (
  'children.create','children.edit','children.approve','children.export',
  'staff.create','staff.edit','staff.approve','staff.export',
  'curriculum.create','curriculum.submit','curriculum.approve','curriculum.export'
);

-- vice_principal
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-vice_principal-' || p.code, 'role-vice_principal', p.id FROM permissions p
WHERE p.code IN (
  'children.edit','children.approve','children.export',
  'staff.edit','staff.approve','staff.export',
  'curriculum.create','curriculum.submit','curriculum.approve','curriculum.export'
);

-- team_lead: góp ý kế hoạch chuyên môn (bước 1), xem đội ngũ/trẻ em tổ mình
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-team_lead-' || p.code, 'role-team_lead', p.id FROM permissions p
WHERE p.code IN (
  'children.edit',
  'curriculum.create','curriculum.submit','curriculum.approve','curriculum.export'
);

-- teacher: soạn kế hoạch, xem/ghi nhận thông tin trẻ lớp mình
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-teacher-' || p.code, 'role-teacher', p.id FROM permissions p
WHERE p.code IN (
  'children.edit',
  'curriculum.create','curriculum.submit','curriculum.export'
);

-- clerk: tuyển sinh/tiếp nhận trẻ
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-clerk-' || p.code, 'role-clerk', p.id FROM permissions p
WHERE p.code IN ('children.create','children.edit','children.export');
