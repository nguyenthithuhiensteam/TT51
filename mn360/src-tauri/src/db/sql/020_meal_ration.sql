-- MN360 — Bổ sung: tính khẩu phần ăn (dinh dưỡng + chi phí) trong Nuôi dưỡng
-- Theo yêu cầu nhà trường: khẩu phần tính gộp theo 2 nhóm tuổi toàn trường (Nhà trẻ/Mẫu giáo)
-- mỗi ngày — không tách riêng theo từng lớp. Số trẻ mỗi nhóm vẫn lấy tự động từ điểm danh
-- (không nhập lại thủ công), suy ra qua classes.nutrition_group.

ALTER TABLE classes ADD COLUMN nutrition_group TEXT CHECK (nutrition_group IN ('nha_tre','mau_giao'));
UPDATE classes SET nutrition_group = CASE WHEN age_group LIKE '%tháng%' THEN 'nha_tre' ELSE 'mau_giao' END;

-- Thành phần dinh dưỡng thực phẩm trên 100 đơn vị (100g/100ml) hoặc 1 đơn vị nếu unit = 'hop'.
CREATE TABLE foods (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    food_group TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('gam','ml','hop')),
    protein_per_100 REAL NOT NULL DEFAULT 0,
    fat_per_100 REAL NOT NULL DEFAULT 0,
    carb_per_100 REAL NOT NULL DEFAULT 0,
    kcal_per_100 REAL NOT NULL DEFAULT 0,
    calcium_per_100 REAL NOT NULL DEFAULT 0,
    iron_per_100 REAL NOT NULL DEFAULT 0,
    vitamin_a_per_100 REAL NOT NULL DEFAULT 0,
    vitamin_c_per_100 REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX idx_foods_group ON foods(food_group);

-- Định mức dinh dưỡng đối chiếu theo nhóm tuổi (NKN người Việt Nam 2016 / Viện Dinh dưỡng).
CREATE TABLE nutrition_norms (
    id TEXT PRIMARY KEY,
    nutrition_group TEXT NOT NULL CHECK (nutrition_group IN ('nha_tre','mau_giao')),
    nutrient_key TEXT NOT NULL CHECK (nutrient_key IN
        ('kcal','protein','fat','carb','calcium','iron','vitamin_a','vitamin_c')),
    min_value REAL,
    max_value REAL,
    UNIQUE(nutrition_group, nutrient_key)
);

-- Khẩu phần một ngày của một nhóm tuổi (toàn trường). meal_fee_rate lưu lại (snapshot) định mức
-- tiền ăn/trẻ/ngày tại thời điểm lập, để đổi định mức sau này không làm sai lệch báo cáo cũ.
CREATE TABLE daily_rations (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    ration_date TEXT NOT NULL,
    nutrition_group TEXT NOT NULL CHECK (nutrition_group IN ('nha_tre','mau_giao')),
    meal_fee_rate REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    UNIQUE(school_year_id, ration_date, nutrition_group)
);
CREATE INDEX idx_daily_rations_date ON daily_rations(ration_date);

CREATE TABLE ration_items (
    id TEXT PRIMARY KEY,
    ration_id TEXT NOT NULL REFERENCES daily_rations(id),
    food_id TEXT NOT NULL REFERENCES foods(id),
    amount_per_child REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_ration_items_ration ON ration_items(ration_id);
