-- MN360 — Trợ lý AI tư vấn nuôi dạy trẻ cho phụ huynh (kiến thức chung, KHÔNG dùng dữ liệu
-- riêng của trẻ — không gửi tên/ngày sinh/tình trạng sức khỏe/điểm danh ra AI). Lưu lại lịch sử
-- để nhà trường (Hiệu trưởng/Quản trị hệ thống — những vai trò đã có quyền parent.view) xem lại
-- khi cần, ví dụ phát hiện câu hỏi đáng lo ngại cần hỗ trợ kịp thời.

CREATE TABLE parent_ai_consultations (
    id TEXT PRIMARY KEY,
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_parent_ai_consultations_guardian ON parent_ai_consultations(guardian_id, created_at);

INSERT INTO permissions (id, code, module, action, description) VALUES
('perm-parent-ai_consult', 'parent.ai_consult', 'parent', 'ai_consult', 'Phụ huynh hỏi Trợ lý AI tư vấn nuôi dạy trẻ');

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-parent-parent.ai_consult', 'role-parent', p.id FROM permissions p
WHERE p.code = 'parent.ai_consult';
