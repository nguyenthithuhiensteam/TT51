-- MN360 — Giai đoạn 3: bổ sung quyền chi tiết cho Nuôi dưỡng, Sức khỏe – An toàn, Tài chính – Tài sản
-- Không sửa lại các migration trước — mọi thay đổi phải là migration mới.

INSERT INTO permissions (id, code, module, action, description) VALUES
('perm-nutrition-create', 'nutrition.create', 'nutrition', 'create', 'Tạo món ăn/thực đơn, ghi nhận giao nhận thực phẩm'),
('perm-nutrition-edit', 'nutrition.edit', 'nutrition', 'edit', 'Sửa thực đơn, xác nhận cảnh báo dị ứng, kiểm thực ba bước'),
('perm-nutrition-approve', 'nutrition.approve', 'nutrition', 'approve', 'Duyệt thực đơn'),
('perm-nutrition-export', 'nutrition.export', 'nutrition', 'export', 'Xuất báo cáo nuôi dưỡng'),
('perm-health-create', 'health.create', 'health', 'create', 'Tạo hồ sơ sức khỏe/tiêm chủng/sự cố/kiểm tra an toàn'),
('perm-health-edit', 'health.edit', 'health', 'edit', 'Sửa hồ sơ sức khỏe, cập nhật tăng trưởng'),
('perm-health-approve', 'health.approve', 'health', 'approve', 'Duyệt kế hoạch khắc phục an toàn'),
('perm-health-export', 'health.export', 'health', 'export', 'Xuất báo cáo sức khỏe – an toàn'),
('perm-finance-create', 'finance.create', 'finance', 'create', 'Lập phiếu thu/chi, danh mục tài sản'),
('perm-finance-edit', 'finance.edit', 'finance', 'edit', 'Kiểm tra phiếu thu/chi, cập nhật tài sản'),
('perm-finance-approve', 'finance.approve', 'finance', 'approve', 'Phê duyệt phiếu thu/chi, kiểm kê, thanh lý tài sản'),
('perm-finance-export', 'finance.export', 'finance', 'export', 'Xuất báo cáo tài chính – tài sản');

-- system_admin
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-system_admin-' || p.code, 'role-system_admin', p.id FROM permissions p
WHERE p.code IN (
  'nutrition.create','nutrition.edit','nutrition.approve','nutrition.export',
  'health.create','health.edit','health.approve','health.export',
  'finance.create','finance.edit','finance.approve','finance.export'
);

-- principal: phê duyệt cao nhất
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-principal-' || p.code, 'role-principal', p.id FROM permissions p
WHERE p.code IN (
  'nutrition.create','nutrition.edit','nutrition.approve','nutrition.export',
  'health.create','health.edit','health.approve','health.export',
  'finance.create','finance.edit','finance.approve','finance.export'
);

-- vice_principal: duyệt thực đơn, duyệt kế hoạch khắc phục an toàn (không có quyền tài chính)
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-vice_principal-' || p.code, 'role-vice_principal', p.id FROM permissions p
WHERE p.code IN (
  'nutrition.create','nutrition.edit','nutrition.approve','nutrition.export',
  'health.edit','health.approve','health.export'
);

-- nutrition_staff: chuẩn bị thực đơn, giao nhận thực phẩm, kiểm thực ba bước
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-nutrition_staff-' || p.code, 'role-nutrition_staff', p.id FROM permissions p
WHERE p.code IN ('nutrition.create','nutrition.edit','nutrition.export');

-- nurse: hồ sơ sức khỏe, xác nhận cảnh báo dị ứng trên thực đơn
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-nurse-' || p.code, 'role-nurse', p.id FROM permissions p
WHERE p.code IN ('nutrition.edit', 'health.create','health.edit','health.export');

-- accountant: lập phiếu thu/chi và tài sản, không tự phê duyệt
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-accountant-' || p.code, 'role-accountant', p.id FROM permissions p
WHERE p.code IN ('finance.create','finance.edit','finance.export');
