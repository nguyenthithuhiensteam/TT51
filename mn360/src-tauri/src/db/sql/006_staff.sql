-- MN360 — Giai đoạn 2: Đội ngũ (hồ sơ, phân công, nghỉ phép, đánh giá)

CREATE TABLE staff (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    employee_code TEXT NOT NULL UNIQUE,
    position TEXT NOT NULL,
    employment_type TEXT NOT NULL DEFAULT 'contract' CHECK (employment_type IN
        ('payroll','contract','probation')),
    degree TEXT,
    start_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','resigned')),
    note TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE staff_assignments (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES staff(id),
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    class_id TEXT REFERENCES classes(id),
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('homeroom','subject','support','management')),
    description TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);
CREATE INDEX idx_staff_assignments_staff ON staff_assignments(staff_id);

CREATE TABLE staff_leaves (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES staff(id),
    leave_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    approved_by TEXT REFERENCES users(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_staff_leaves_staff ON staff_leaves(staff_id);

CREATE TABLE staff_evaluations (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES staff(id),
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    evaluator_role TEXT NOT NULL CHECK (evaluator_role IN ('self','team_lead','principal')),
    evaluator_id TEXT NOT NULL REFERENCES users(id),
    rating TEXT,
    strengths TEXT,
    weaknesses TEXT,
    improvement_plan TEXT,
    evidence_note TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(staff_id, school_year_id, evaluator_role)
);
