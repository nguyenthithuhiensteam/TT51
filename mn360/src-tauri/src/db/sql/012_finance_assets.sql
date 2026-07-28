-- MN360 — Giai đoạn 3: Tài chính – Tài sản
-- Mọi thao tác tài chính có người lập/kiểm tra/phê duyệt riêng biệt — không tự động phê duyệt.

CREATE TABLE fee_items (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','one_time')),
    category TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE revenues (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    child_id TEXT REFERENCES children(id),
    fee_item_id TEXT REFERENCES fee_items(id),
    amount REAL NOT NULL,
    revenue_date TEXT NOT NULL,
    payer_name TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    prepared_by TEXT NOT NULL REFERENCES users(id),
    checked_by TEXT REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_revenues_status ON revenues(status);

CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    payee_name TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    prepared_by TEXT NOT NULL REFERENCES users(id),
    checked_by TEXT REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_expenses_status ON expenses(status);

CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL,
    purchase_date TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','repair','transferred','disposed')),
    note TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE asset_status_history (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL REFERENCES users(id),
    changed_at TEXT NOT NULL,
    note TEXT
);
