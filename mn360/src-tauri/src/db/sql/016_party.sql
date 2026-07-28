-- MN360 — Giai đoạn 4: Công tác Đảng
-- Toàn bộ bảng trong tệp này TÁCH BIỆT HOÀN TOÀN khỏi các bảng nghiệp vụ khác (không JOIN/reuse
-- bảng meetings/tasks chung) để đảm bảo không có đường truy vấn nào vô tình lộ dữ liệu Đảng
-- sang các phân hệ không có quyền `party.*`.

CREATE TABLE party_members (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    membership_type TEXT NOT NULL DEFAULT 'chinh_thuc' CHECK (membership_type IN ('chinh_thuc','du_bi')),
    joined_date TEXT,
    cell_position TEXT NOT NULL DEFAULT 'dang_vien' CHECK (cell_position IN
        ('bi_thu','pho_bi_thu','chi_uy_vien','dang_vien')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','transferred','suspended')),
    note TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL
);

CREATE TABLE party_meetings (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    meeting_type TEXT NOT NULL DEFAULT 'dinh_ky' CHECK (meeting_type IN ('dinh_ky','chuyen_de')),
    title TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    location TEXT,
    chair_person TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL
);

CREATE TABLE party_meeting_minutes (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES party_meetings(id),
    content_html TEXT,
    attendees_note TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

CREATE TABLE party_resolutions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES party_meetings(id),
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL
);

CREATE TABLE resolution_tracking (
    id TEXT PRIMARY KEY,
    resolution_id TEXT NOT NULL REFERENCES party_resolutions(id),
    progress_note TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('chua_thuc_hien','dang_thuc_hien','hoan_thanh')),
    updated_by TEXT NOT NULL REFERENCES users(id),
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_resolution_tracking_resolution ON resolution_tracking(resolution_id);

CREATE TABLE party_member_evaluations (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES party_members(id),
    year INTEGER NOT NULL,
    rating TEXT CHECK (rating IN ('hoan_thanh_xuat_sac','hoan_thanh_tot','hoan_thanh','khong_hoan_thanh')),
    strengths TEXT,
    weaknesses TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    evaluated_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(member_id, year)
);

CREATE TABLE party_fees (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES party_members(id),
    period TEXT NOT NULL,
    amount REAL NOT NULL,
    paid_date TEXT,
    collected_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE(member_id, period)
);
