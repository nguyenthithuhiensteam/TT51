-- MN360 — Giai đoạn 2: Chuyên môn (kế hoạch giáo dục, quan sát, đánh giá trẻ)
-- Quy trình: Giáo viên soạn → Tổ trưởng góp ý → Phó hiệu trưởng duyệt → thực hiện → đánh giá → điều chỉnh
-- dùng chung trạng thái hồ sơ chuẩn (status) và bảng approvals/audit_logs.

CREATE TABLE education_plans (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    class_id TEXT REFERENCES classes(id),
    plan_type TEXT NOT NULL CHECK (plan_type IN
        ('year','month','topic','week','day','activity','steam','sel','inclusive')),
    title TEXT NOT NULL,
    age_group TEXT,
    period_start TEXT,
    period_end TEXT,
    objectives TEXT,
    requirements TEXT,
    content TEXT,
    activities TEXT,
    environment TEXT,
    materials TEXT,
    methods TEXT,
    evaluation TEXT,
    adjustment TEXT,
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
CREATE INDEX idx_education_plans_status ON education_plans(status);
CREATE INDEX idx_education_plans_class ON education_plans(class_id);

CREATE TABLE observations (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    observed_date TEXT NOT NULL,
    content TEXT NOT NULL,
    teacher_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);
CREATE INDEX idx_observations_child ON observations(child_id);

CREATE TABLE child_assessments (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    period TEXT NOT NULL,
    domain TEXT NOT NULL CHECK (domain IN
        ('the_chat','nhan_thuc','ngon_ngu','tinh_cam_xa_hoi','tham_my')),
    result TEXT NOT NULL,
    note TEXT,
    assessed_by TEXT NOT NULL REFERENCES users(id),
    assessed_at TEXT NOT NULL
);
CREATE INDEX idx_child_assessments_child ON child_assessments(child_id);
