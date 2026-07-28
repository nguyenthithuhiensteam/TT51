-- MN360 — Giai đoạn 3: Sức khỏe – An toàn
-- Dữ liệu sức khỏe được phân loại bảo vệ cao — chỉ truy vấn qua healthRepo với health.view.

CREATE TABLE health_records (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL UNIQUE REFERENCES children(id),
    blood_type TEXT,
    chronic_conditions TEXT,
    allergies TEXT,
    note TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL
);

CREATE TABLE growth_measurements (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    measured_date TEXT NOT NULL,
    height_cm REAL NOT NULL,
    weight_kg REAL NOT NULL,
    note TEXT,
    measured_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE(child_id, measured_date)
);
CREATE INDEX idx_growth_child ON growth_measurements(child_id);

CREATE TABLE vaccinations (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    vaccine_name TEXT NOT NULL,
    dose_no INTEGER NOT NULL DEFAULT 1,
    vaccinated_date TEXT NOT NULL,
    place TEXT,
    note TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);
CREATE INDEX idx_vaccinations_child ON vaccinations(child_id);

CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    child_id TEXT REFERENCES children(id),
    class_id TEXT REFERENCES classes(id),
    occurred_at TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('accident','health','other')),
    severity TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
    description TEXT NOT NULL,
    actions_taken TEXT,
    reported_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);
CREATE INDEX idx_incidents_child ON incidents(child_id);

CREATE TABLE safety_inspections (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    area TEXT NOT NULL CHECK (area IN ('classroom','playground','electrical','fire_prevention','other')),
    inspection_date TEXT NOT NULL,
    checklist_result TEXT,
    risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
    remediation_plan TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    inspected_by TEXT NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_safety_inspections_status ON safety_inspections(status);
