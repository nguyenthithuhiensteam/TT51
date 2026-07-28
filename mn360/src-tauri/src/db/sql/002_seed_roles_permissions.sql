-- MN360 — Nạp 12 vai trò hệ thống, danh mục quyền và ma trận phân quyền mặc định
-- (xem docs/PERMISSIONS.md để biết diễn giải đầy đủ)

INSERT INTO roles (id, code, name, description, is_system) VALUES
('role-system_admin', 'system_admin', 'Quản trị hệ thống', 'Toàn quyền quản trị nghiệp vụ và hệ thống', 1),
('role-principal', 'principal', 'Hiệu trưởng', 'Phê duyệt và điều hành toàn trường', 1),
('role-vice_principal', 'vice_principal', 'Phó hiệu trưởng', 'Phụ trách chuyên môn/điều hành theo phân công', 1),
('role-team_lead', 'team_lead', 'Tổ trưởng', 'Phụ trách tổ chuyên môn', 1),
('role-teacher', 'teacher', 'Giáo viên', 'Thực hiện nhiệm vụ chuyên môn tại lớp', 1),
('role-clerk', 'clerk', 'Văn thư', 'Quản lý văn bản, hồ sơ hành chính', 1),
('role-accountant', 'accountant', 'Kế toán', 'Quản lý tài chính, tài sản', 1),
('role-nurse', 'nurse', 'Nhân viên y tế', 'Quản lý sức khỏe, an toàn', 1),
('role-nutrition_staff', 'nutrition_staff', 'Nhân viên nuôi dưỡng', 'Quản lý bếp ăn, thực đơn', 1),
('role-party_committee', 'party_committee', 'Cấp ủy', 'Phụ trách công tác Đảng', 1),
('role-parent', 'parent', 'Phụ huynh', 'Theo dõi thông tin của con', 1),
('role-tech_admin', 'tech_admin', 'Quản trị kỹ thuật', 'Vận hành hạ tầng kỹ thuật, không mặc định xem dữ liệu nghiệp vụ nhạy cảm', 1);

INSERT INTO permissions (id, code, module, action, description) VALUES
('perm-dashboard-view', 'dashboard.view', 'dashboard', 'view', 'Xem tổng quan'),
('perm-task-view', 'task.view', 'task', 'view', 'Xem công việc'),
('perm-task-create', 'task.create', 'task', 'create', 'Tạo công việc'),
('perm-task-edit', 'task.edit', 'task', 'edit', 'Sửa công việc'),
('perm-task-submit', 'task.submit', 'task', 'submit', 'Gửi duyệt công việc'),
('perm-task-approve', 'task.approve', 'task', 'approve', 'Phê duyệt công việc'),
('perm-task-export', 'task.export', 'task', 'export', 'Xuất báo cáo công việc'),
('perm-document-view', 'document.view', 'document', 'view', 'Xem văn bản'),
('perm-document-create', 'document.create', 'document', 'create', 'Soạn thảo văn bản'),
('perm-document-submit', 'document.submit', 'document', 'submit', 'Gửi duyệt văn bản'),
('perm-document-approve', 'document.approve', 'document', 'approve', 'Phê duyệt/ký văn bản'),
('perm-document-publish', 'document.publish', 'document', 'publish', 'Ban hành văn bản'),
('perm-document-export', 'document.export', 'document', 'export', 'Xuất văn bản'),
('perm-system-view', 'system.view', 'system', 'view', 'Xem cấu hình hệ thống'),
('perm-system-edit', 'system.edit', 'system', 'edit', 'Sửa cấu hình trường/năm học'),
('perm-system-backup', 'system.backup', 'system', 'backup', 'Sao lưu dữ liệu'),
('perm-system-restore', 'system.restore', 'system', 'restore', 'Khôi phục dữ liệu'),
('perm-children-view', 'children.view', 'children', 'view', 'Xem phân hệ Trẻ em'),
('perm-staff-view', 'staff.view', 'staff', 'view', 'Xem phân hệ Đội ngũ'),
('perm-curriculum-view', 'curriculum.view', 'curriculum', 'view', 'Xem phân hệ Chuyên môn'),
('perm-nutrition-view', 'nutrition.view', 'nutrition', 'view', 'Xem phân hệ Nuôi dưỡng'),
('perm-health-view', 'health.view', 'health', 'view', 'Xem phân hệ Sức khỏe – An toàn'),
('perm-finance-view', 'finance.view', 'finance', 'view', 'Xem phân hệ Tài chính – Tài sản'),
('perm-accreditation-view', 'accreditation.view', 'accreditation', 'view', 'Xem phân hệ Kiểm định'),
('perm-party-view', 'party.view', 'party', 'view', 'Xem phân hệ Công tác Đảng'),
('perm-parent-view', 'parent.view', 'parent', 'view', 'Xem phân hệ Phụ huynh');

-- system_admin: toàn quyền nghiệp vụ, KHÔNG có party.view (tách biệt Đảng theo yêu cầu)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-system_admin-' || p.code, 'role-system_admin', p.id FROM permissions p
WHERE p.code != 'party.view';

-- principal: toàn quyền nghiệp vụ + phê duyệt, không mặc định thấy Đảng
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-principal-' || p.code, 'role-principal', p.id FROM permissions p
WHERE p.code IN (
  'dashboard.view','task.view','task.create','task.edit','task.submit','task.approve','task.export',
  'document.view','document.create','document.submit','document.approve','document.publish','document.export',
  'system.view','system.edit','system.backup',
  'children.view','staff.view','curriculum.view','nutrition.view','health.view','finance.view',
  'accreditation.view','parent.view'
);

-- vice_principal
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-vice_principal-' || p.code, 'role-vice_principal', p.id FROM permissions p
WHERE p.code IN (
  'dashboard.view','task.view','task.create','task.edit','task.submit','task.approve','task.export',
  'document.view','document.create','document.submit','document.approve','document.export',
  'system.view',
  'children.view','staff.view','curriculum.view','nutrition.view','health.view','accreditation.view'
);

-- team_lead
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-team_lead-' || p.code, 'role-team_lead', p.id FROM permissions p
WHERE p.code IN (
  'dashboard.view','task.view','task.create','task.edit','task.submit','task.approve','task.export',
  'document.view','document.create','document.submit',
  'curriculum.view','staff.view'
);

-- teacher
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-teacher-' || p.code, 'role-teacher', p.id FROM permissions p
WHERE p.code IN (
  'dashboard.view','task.view','task.create','task.edit','task.submit','task.export',
  'document.view','document.create','document.submit',
  'curriculum.view','children.view','nutrition.view','health.view'
);

-- clerk
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-clerk-' || p.code, 'role-clerk', p.id FROM permissions p
WHERE p.code IN (
  'dashboard.view','task.view','task.create','task.submit','task.export',
  'document.view','document.create','document.submit','document.publish','document.export'
);

-- accountant
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-accountant-' || p.code, 'role-accountant', p.id FROM permissions p
WHERE p.code IN ('dashboard.view','task.view','task.create','task.submit','finance.view');

-- nurse
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-nurse-' || p.code, 'role-nurse', p.id FROM permissions p
WHERE p.code IN ('dashboard.view','task.view','task.create','task.submit','health.view','nutrition.view');

-- nutrition_staff
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-nutrition_staff-' || p.code, 'role-nutrition_staff', p.id FROM permissions p
WHERE p.code IN ('dashboard.view','task.view','task.create','task.submit','nutrition.view');

-- party_committee: chỉ vai trò này (và system/role riêng trong tương lai) thấy Đảng
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-party_committee-' || p.code, 'role-party_committee', p.id FROM permissions p
WHERE p.code IN ('dashboard.view','task.view','task.create','task.submit','party.view');

-- parent: chỉ thấy phân hệ Phụ huynh, dữ liệu giới hạn theo con mình ở tầng service
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-parent-' || p.code, 'role-parent', p.id FROM permissions p
WHERE p.code IN ('parent.view');

-- tech_admin: chỉ kỹ thuật/hệ thống, KHÔNG có children/health/finance/party theo yêu cầu
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-tech_admin-' || p.code, 'role-tech_admin', p.id FROM permissions p
WHERE p.code IN ('dashboard.view','task.view','system.view','system.edit','system.backup','system.restore');
