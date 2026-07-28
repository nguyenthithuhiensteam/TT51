-- MN360 — Giai đoạn 4: Phụ huynh
-- Mọi truy vấn phía phụ huynh phải lọc theo guardian_id suy ra từ tài khoản đăng nhập,
-- không nhận child_id tùy ý từ phía client (thực hiện ở tầng parentRepo.ts).

ALTER TABLE guardians ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE UNIQUE INDEX idx_guardians_user_id ON guardians(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE child_leave_requests (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    child_id TEXT NOT NULL REFERENCES children(id),
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN
        ('pending_approval','approved','needs_revision','cancelled')),
    decided_by TEXT REFERENCES users(id),
    decided_at TEXT,
    decision_note TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_leave_requests_child ON child_leave_requests(child_id);

CREATE TABLE parent_messages (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    sender_role TEXT NOT NULL CHECK (sender_role IN ('parent','teacher')),
    sender_user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_parent_messages_child ON parent_messages(child_id, created_at);
