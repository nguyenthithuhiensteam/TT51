-- MN360 — Giai đoạn 1: schema nền tảng
-- Quy ước trạng thái hồ sơ chuẩn dùng chung toàn hệ thống (xem docs/DATA_MODEL.md)
-- draft | submitted | pending_approval | needs_revision | approved | signed | published
-- | locked | archived | cancelled

PRAGMA foreign_keys = ON;

-- ===================== NỀN TẢNG & ĐỊNH DANH =====================

CREATE TABLE schools (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    principal_name TEXT,
    data_dir TEXT,
    logo_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE school_years (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    code TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(school_id, code)
);

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'argon2id',
    must_change_password INTEGER NOT NULL DEFAULT 1,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT
);

CREATE TABLE user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    role_id TEXT NOT NULL REFERENCES roles(id),
    created_at TEXT NOT NULL,
    UNIQUE(user_id, role_id)
);

CREATE TABLE role_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES roles(id),
    permission_id TEXT NOT NULL REFERENCES permissions(id),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    device_info TEXT,
    ip TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    revoked_at TEXT
);

CREATE TABLE system_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value_json TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    user_id TEXT REFERENCES users(id),
    session_id TEXT,
    device_info TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_table, entity_id);

CREATE TABLE sync_queue (
    id TEXT PRIMARY KEY,
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','synced','failed')),
    created_at TEXT NOT NULL,
    synced_at TEXT,
    error TEXT
);

CREATE TABLE backups (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    size_bytes INTEGER,
    kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','auto')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    note TEXT
);

-- ===================== CÔNG VIỆC =====================

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    title TEXT NOT NULL,
    field TEXT,
    content TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
    assigned_by TEXT REFERENCES users(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    start_date TEXT,
    due_date TEXT,
    deliverable TEXT,
    done_criteria TEXT,
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    difficulty TEXT,
    proposal TEXT,
    review_comment TEXT,
    approval_result TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

CREATE TABLE task_assignees (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role_in_task TEXT NOT NULL DEFAULT 'coordinator' CHECK (role_in_task IN ('owner','coordinator')),
    UNIQUE(task_id, user_id)
);

CREATE TABLE task_evidence (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    uploaded_at TEXT NOT NULL,
    note TEXT
);

CREATE TABLE task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE task_status_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL REFERENCES users(id),
    changed_at TEXT NOT NULL,
    note TEXT
);

-- ===================== VĂN PHÒNG SỐ =====================

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    doc_type TEXT NOT NULL CHECK (doc_type IN ('incoming','outgoing','internal','draft')),
    title TEXT NOT NULL,
    summary TEXT,
    issuing_unit TEXT,
    recipient TEXT,
    sign_date TEXT,
    effective_date TEXT,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_type ON documents(doc_type);

CREATE TABLE document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    version_no INTEGER NOT NULL,
    file_path TEXT,
    content_html TEXT,
    edited_by TEXT NOT NULL REFERENCES users(id),
    edited_at TEXT NOT NULL,
    note TEXT,
    UNIQUE(document_id, version_no)
);

CREATE TABLE approval_flows (
    id TEXT PRIMARY KEY,
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1,
    total_steps INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending_approval',
    UNIQUE(entity_table, entity_id)
);

CREATE TABLE approvals (
    id TEXT PRIMARY KEY,
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    step_no INTEGER NOT NULL,
    approver_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL CHECK (action IN ('submit','comment','approve','reject','sign','publish')),
    comment TEXT,
    from_status TEXT,
    to_status TEXT,
    acted_at TEXT NOT NULL
);
CREATE INDEX idx_approvals_entity ON approvals(entity_table, entity_id);

CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    title TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    location TEXT,
    chair_person TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE meeting_minutes (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    content_html TEXT,
    conclusions_json TEXT,
    file_path TEXT
);

CREATE TABLE document_task_links (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id),
    meeting_id TEXT REFERENCES meetings(id),
    task_id TEXT NOT NULL REFERENCES tasks(id)
);

-- ===================== ĐÍNH KÈM DÙNG CHUNG =====================

CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    uploaded_at TEXT NOT NULL
);
CREATE INDEX idx_attachments_entity ON attachments(entity_table, entity_id);

CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','danger')),
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    dedup_key TEXT
);
CREATE UNIQUE INDEX idx_notifications_dedup ON notifications(user_id, dedup_key)
    WHERE dedup_key IS NOT NULL;
