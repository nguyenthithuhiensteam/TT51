-- MN360 — Giai đoạn 3: Nuôi dưỡng (món ăn, thực đơn, giao nhận thực phẩm, kiểm thực ba bước)
-- Số trẻ ăn thực tế lấy từ bảng attendance (điểm danh) — không nhập lại thủ công.

CREATE TABLE dishes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('breakfast','lunch','snack','dinner')),
    energy_kcal REAL,
    ingredients_note TEXT,
    allergens_note TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE menus (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    school_year_id TEXT NOT NULL REFERENCES school_years(id),
    class_id TEXT REFERENCES classes(id),
    menu_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft','submitted','pending_approval','needs_revision','approved','signed',
         'published','locked','archived','cancelled')),
    note TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE(school_year_id, class_id, menu_date)
);
CREATE INDEX idx_menus_date ON menus(menu_date);

CREATE TABLE menu_items (
    id TEXT PRIMARY KEY,
    menu_id TEXT NOT NULL REFERENCES menus(id),
    dish_id TEXT NOT NULL REFERENCES dishes(id),
    meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast','lunch','snack','dinner')),
    created_at TEXT NOT NULL
);
CREATE INDEX idx_menu_items_menu ON menu_items(menu_id);

CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE food_deliveries (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    delivery_date TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL,
    total_price REAL,
    received_by TEXT NOT NULL REFERENCES users(id),
    note TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_food_deliveries_date ON food_deliveries(delivery_date);

-- Kiểm thực ba bước: trước chế biến, trước khi ăn, lưu mẫu
CREATE TABLE three_step_inspections (
    id TEXT PRIMARY KEY,
    menu_id TEXT NOT NULL REFERENCES menus(id),
    step TEXT NOT NULL CHECK (step IN ('before_processing','before_eating','sample_storage')),
    checked_by TEXT NOT NULL REFERENCES users(id),
    checked_at TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('dat','khong_dat')),
    note TEXT,
    UNIQUE(menu_id, step)
);
