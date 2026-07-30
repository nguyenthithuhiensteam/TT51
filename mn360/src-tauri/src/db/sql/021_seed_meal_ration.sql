-- MN360 — Dữ liệu demo cho tính khẩu phần ăn: 25 thực phẩm + định mức dinh dưỡng theo
-- nhóm tuổi (nguồn: bảng thành phần thực phẩm Việt Nam / NKN người Việt Nam 2016) và một
-- ngày khẩu phần mẫu cho cả hai nhóm Nhà trẻ / Mẫu giáo.

INSERT INTO foods (id, code, name, food_group, unit, protein_per_100, fat_per_100, carb_per_100, kcal_per_100, calcium_per_100, iron_per_100, vitamin_a_per_100, vitamin_c_per_100, status, created_by, created_at, updated_by, updated_at) VALUES
('food-01', 'TP-0001', 'Gạo tẻ máy', 'Tinh bột', 'gam', 7.9, 1.0, 75.9, 344, 30, 1.3, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-02', 'TP-0002', 'Bún', 'Tinh bột', 'gam', 1.7, 0, 25.7, 110, 12, 0.2, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-03', 'TP-0003', 'Bột gạo tẻ', 'Tinh bột', 'gam', 6.6, 0.4, 82.2, 359, 24, 1.9, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-04', 'TP-0004', 'Bánh mì', 'Tinh bột', 'gam', 7.9, 0.8, 52.6, 249, 28, 2.0, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-05', 'TP-0005', 'Thịt lợn (nạc nửa mỡ)', 'Đạm', 'gam', 16.5, 13.7, 0, 190, 7, 1.3, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-06', 'TP-0006', 'Thịt gà', 'Đạm', 'gam', 20.3, 5.4, 0, 131, 12, 1.5, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-07', 'TP-0007', 'Cá chép', 'Đạm', 'gam', 16.0, 3.6, 0, 96, 17, 1.0, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-08', 'TP-0008', 'Trứng gà', 'Đạm', 'gam', 12.5, 11.6, 0.9, 155, 55, 2.0, 600, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-09', 'TP-0009', 'Đậu phụ', 'Đạm', 'gam', 10.9, 5.0, 0.6, 90, 120, 1.4, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-10', 'TP-0010', 'Tôm tươi', 'Đạm', 'gam', 18.4, 1.8, 0, 90, 79, 1.5, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-11', 'TP-0011', 'Xương lợn', 'Đạm', 'gam', 10.0, 8.0, 0, 110, 250, 0.5, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-12', 'TP-0012', 'Sữa Vinamilk', 'Đạm', 'hop', 3.2, 3.5, 4.7, 62, 120, 0.1, 38, 1, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-13', 'TP-0013', 'TPBS Nutifood Nuvi Grow', 'Đạm', 'hop', 5.0, 4.0, 15.0, 117, 200, 2.0, 100, 10, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-14', 'TP-0014', 'Bí ngô (bí đỏ)', 'Rau củ', 'gam', 0.6, 0.1, 6.5, 30, 25, 0.4, 4000, 11, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-15', 'TP-0015', 'Cà chua', 'Rau củ', 'gam', 0.8, 0.1, 3.5, 19, 12, 1.4, 500, 20, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-16', 'TP-0016', 'Giá đậu xanh', 'Rau củ', 'gam', 2.9, 0.2, 5.2, 34, 30, 0.5, 0, 10, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-17', 'TP-0017', 'Rau cải xanh', 'Rau củ', 'gam', 1.7, 0.3, 3.5, 25, 182, 1.9, 3000, 51, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-18', 'TP-0018', 'Khoai tây', 'Rau củ', 'gam', 2.0, 0.1, 16.5, 76, 10, 1.2, 0, 20, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-19', 'TP-0019', 'Su hào', 'Rau củ', 'gam', 1.7, 0.1, 6.3, 33, 48, 0.5, 0, 42, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-20', 'TP-0020', 'Dầu đậu tương', 'Dầu mỡ', 'ml', 0, 100, 0, 900, 0, 0, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-21', 'TP-0021', 'Muối', 'Gia vị', 'gam', 0, 0, 0, 0, 0, 0, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-22', 'TP-0022', 'Súp (bột canh)', 'Gia vị', 'gam', 0, 0, 0, 0, 0, 0, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-23', 'TP-0023', 'Hạt nêm', 'Gia vị', 'gam', 0, 0, 0, 0, 0, 0, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-24', 'TP-0024', 'Nước mắm', 'Gia vị', 'ml', 5.0, 0, 0, 20, 0, 0, 0, 0, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z'),
('food-25', 'TP-0025', 'Hành lá xanh', 'Gia vị', 'gam', 1.3, 0.3, 3.7, 23, 56, 1.0, 500, 20, 'active', 'user-nuoiduong', '2026-07-27T00:00:00Z', 'user-nuoiduong', '2026-07-27T00:00:00Z');

INSERT INTO nutrition_norms (id, nutrition_group, nutrient_key, min_value, max_value) VALUES
('nn-nt-kcal', 'nha_tre', 'kcal', 600, 651),
('nn-nt-protein', 'nha_tre', 'protein', 19.5, 32.6),
('nn-nt-fat', 'nha_tre', 'fat', 20, 29),
('nn-nt-carb', 'nha_tre', 'carb', 84, 105),
('nn-nt-calcium', 'nha_tre', 'calcium', 500, NULL),
('nn-nt-iron', 'nha_tre', 'iron', 7, NULL),
('nn-nt-vitamin_a', 'nha_tre', 'vitamin_a', 400, NULL),
('nn-nt-vitamin_c', 'nha_tre', 'vitamin_c', 30, NULL),
('nn-mg-kcal', 'mau_giao', 'kcal', 615, 726),
('nn-mg-protein', 'mau_giao', 'protein', 20, 36.3),
('nn-mg-fat', 'mau_giao', 'fat', 17.1, 28.2),
('nn-mg-carb', 'mau_giao', 'carb', 98.8, 120),
('nn-mg-calcium', 'mau_giao', 'calcium', 600, NULL),
('nn-mg-iron', 'mau_giao', 'iron', 10, NULL),
('nn-mg-vitamin_a', 'mau_giao', 'vitamin_a', 450, NULL),
('nn-mg-vitamin_c', 'mau_giao', 'vitamin_c', 35, NULL);

-- Thêm điểm danh ngày 2026-07-28 cho lớp Nhà trẻ C để có số trẻ cho cả hai nhóm tuổi khi demo.
INSERT INTO attendance (id, child_id, class_id, attendance_date, status, note, recorded_by, recorded_at) VALUES
('att-9', 'child-9', 'class-3', '2026-07-28', 'present', NULL, 'user-gv5', '2026-07-28T08:00:00Z'),
('att-10', 'child-10', 'class-3', '2026-07-28', 'present', NULL, 'user-gv5', '2026-07-28T08:00:00Z'),
('att-11', 'child-11', 'class-3', '2026-07-28', 'present', NULL, 'user-gv5', '2026-07-28T08:00:00Z'),
('att-12', 'child-12', 'class-3', '2026-07-28', 'absent_excused', 'Trẻ bị ốm', 'user-gv5', '2026-07-28T08:00:00Z');

-- Khẩu phần mẫu ngày 2026-07-28 — Mẫu giáo (3 trẻ ăn theo điểm danh: child-1, child-2, child-3).
INSERT INTO daily_rations (id, code, school_year_id, ration_date, nutrition_group, meal_fee_rate, status, version, created_by, created_at, updated_by, updated_at) VALUES
('ration-1', 'KP-2026-0001', 'sy-2025-2026', '2026-07-28', 'mau_giao', 20000, 'approved', 2, 'user-nuoiduong', '2026-07-27T14:00:00Z', 'user-pht2', '2026-07-28T07:30:00Z'),
('ration-2', 'KP-2026-0002', 'sy-2025-2026', '2026-07-28', 'nha_tre', 20000, 'pending_approval', 1, 'user-nuoiduong', '2026-07-27T14:10:00Z', 'user-nuoiduong', '2026-07-27T14:10:00Z');

INSERT INTO ration_items (id, ration_id, food_id, amount_per_child, unit_price, created_at) VALUES
('ri-1', 'ration-1', 'food-01', 80, 22000, '2026-07-27T14:00:00Z'),
('ri-2', 'ration-1', 'food-05', 45, 130000, '2026-07-27T14:00:00Z'),
('ri-3', 'ration-1', 'food-17', 60, 15000, '2026-07-27T14:00:00Z'),
('ri-4', 'ration-1', 'food-20', 8, 45000, '2026-07-27T14:00:00Z'),
('ri-5', 'ration-1', 'food-21', 3, 8000, '2026-07-27T14:00:00Z'),
('ri-6', 'ration-2', 'food-03', 60, 25000, '2026-07-27T14:10:00Z'),
('ri-7', 'ration-2', 'food-06', 35, 90000, '2026-07-27T14:10:00Z'),
('ri-8', 'ration-2', 'food-14', 40, 12000, '2026-07-27T14:10:00Z'),
('ri-9', 'ration-2', 'food-20', 6, 45000, '2026-07-27T14:10:00Z'),
('ri-10', 'ration-2', 'food-12', 1, 6500, '2026-07-27T14:10:00Z');
