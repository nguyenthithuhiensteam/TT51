-- MN360 — Giai đoạn 4: Kiểm định chất lượng
-- Mỗi minh chứng có mã duy nhất, liên kết N-N với nhiều tiêu chí — không tải cùng tệp nhiều lần.

CREATE TABLE accreditation_standards (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    order_no INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE accreditation_criteria (
    id TEXT PRIMARY KEY,
    standard_id TEXT NOT NULL REFERENCES accreditation_standards(id),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    order_no INTEGER NOT NULL DEFAULT 1,
    current_status_note TEXT,
    strengths TEXT,
    weaknesses TEXT,
    improvement_plan TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_accreditation_criteria_standard ON accreditation_criteria(standard_id);

CREATE TABLE criteria_assignments (
    id TEXT PRIMARY KEY,
    criteria_id TEXT NOT NULL REFERENCES accreditation_criteria(id),
    assignee_id TEXT NOT NULL REFERENCES users(id),
    assigned_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE(criteria_id, assignee_id)
);

CREATE TABLE evidence_files (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    description TEXT,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    uploaded_at TEXT NOT NULL
);

CREATE TABLE criteria_evidence_links (
    id TEXT PRIMARY KEY,
    criteria_id TEXT NOT NULL REFERENCES accreditation_criteria(id),
    evidence_id TEXT NOT NULL REFERENCES evidence_files(id),
    linked_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE(criteria_id, evidence_id)
);
