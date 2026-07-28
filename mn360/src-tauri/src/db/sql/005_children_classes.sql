-- MN360 — Giai đoạn 2: Trẻ em (lớp, hồ sơ trẻ, phụ huynh, điểm danh)
-- Mỗi trẻ có mã định danh duy nhất (children.code) — không dùng họ tên làm khóa dữ liệu.

CREATE TABLE classes (
    id TEXT PRIMARY KEY,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    age_group TEXT NOT NULL,
    homeroom_teacher_id TEXT REFERENCES users(id),
    room TEXT,
    capacity INTEGER,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE(school_year_id, code)
);

CREATE TABLE children (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    class_id TEXT REFERENCES classes(id),
    full_name TEXT NOT NULL,
    dob TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male','female')),
    enrollment_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'studying' CHECK (status IN
        ('studying','transferred_class','reserved','transferred_school','dropped_out','completed')),
    note TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX idx_children_class ON children(class_id);
CREATE INDEX idx_children_status ON children(status);

CREATE TABLE child_status_history (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL REFERENCES users(id),
    changed_at TEXT NOT NULL,
    note TEXT
);

CREATE TABLE guardians (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    relationship TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE child_guardians (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    is_primary INTEGER NOT NULL DEFAULT 0,
    can_pickup INTEGER NOT NULL DEFAULT 1,
    UNIQUE(child_id, guardian_id)
);

CREATE TABLE attendance (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    attendance_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present','absent_excused','absent_unexcused','late')),
    note TEXT,
    recorded_by TEXT NOT NULL REFERENCES users(id),
    recorded_at TEXT NOT NULL,
    UNIQUE(child_id, attendance_date)
);
CREATE INDEX idx_attendance_class_date ON attendance(class_id, attendance_date);
