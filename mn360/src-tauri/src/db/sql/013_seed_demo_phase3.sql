-- MN360 — Giai đoạn 3: dữ liệu demo tiếng Việt (Trường Mầm non Tràng Đà)
-- Không sử dụng thông tin sức khỏe thật của trẻ em — toàn bộ là dữ liệu hư cấu minh họa.

-- ===================== NUÔI DƯỠNG =====================

INSERT INTO dishes (id, code, name, category, energy_kcal, ingredients_note, allergens_note, status, created_by, created_at, updated_by, updated_at) VALUES
('dish-1', 'MA-0001', 'Cơm trắng', 'lunch', 130, 'Gạo tẻ', NULL, 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z'),
('dish-2', 'MA-0002', 'Thịt kho trứng', 'lunch', 220, 'Thịt lợn, trứng gà, nước mắm', 'Trứng', 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z'),
('dish-3', 'MA-0003', 'Canh rau ngót', 'lunch', 45, 'Rau ngót, thịt băm', NULL, 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z'),
('dish-4', 'MA-0004', 'Sữa tươi', 'breakfast', 110, 'Sữa bò tươi tiệt trùng', 'Sữa', 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z'),
('dish-5', 'MA-0005', 'Bánh mì trứng', 'breakfast', 250, 'Bánh mì, trứng gà, dưa leo', 'Trứng, Gluten', 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z'),
('dish-6', 'MA-0006', 'Chuối tráng miệng', 'snack', 90, 'Chuối tiêu chín', NULL, 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z'),
('dish-7', 'MA-0007', 'Cháo tôm', 'lunch', 180, 'Gạo tẻ, tôm tươi, rau củ', 'Hải sản', 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z'),
('dish-8', 'MA-0008', 'Súp bí đỏ', 'dinner', 95, 'Bí đỏ, sữa, thịt băm', 'Sữa', 'active', 'user-nuoiduong', '2025-08-10T00:00:00Z', 'user-nuoiduong', '2025-08-10T00:00:00Z');

INSERT INTO menus (id, code, school_year_id, class_id, menu_date, status, note, version, created_by, created_at, updated_by, updated_at) VALUES
('menu-1', 'TD-2026-0001', 'sy-2025-2026', 'class-1', '2026-07-28', 'approved', NULL, 2, 'user-nuoiduong', '2026-07-27T07:00:00Z', 'user-pht2', '2026-07-27T09:00:00Z'),
('menu-2', 'TD-2026-0002', 'sy-2025-2026', 'class-3', '2026-07-28', 'pending_approval', 'Chờ Phó hiệu trưởng duyệt', 1, 'user-nuoiduong', '2026-07-27T07:00:00Z', 'user-nuoiduong', '2026-07-27T07:00:00Z');

INSERT INTO menu_items (id, menu_id, dish_id, meal_slot, created_at) VALUES
('mi-1', 'menu-1', 'dish-5', 'breakfast', '2026-07-27T07:00:00Z'),
('mi-2', 'menu-1', 'dish-1', 'lunch', '2026-07-27T07:00:00Z'),
('mi-3', 'menu-1', 'dish-2', 'lunch', '2026-07-27T07:00:00Z'),
('mi-4', 'menu-1', 'dish-3', 'lunch', '2026-07-27T07:00:00Z'),
('mi-5', 'menu-1', 'dish-6', 'snack', '2026-07-27T07:00:00Z'),
('mi-6', 'menu-2', 'dish-4', 'breakfast', '2026-07-27T07:00:00Z'),
('mi-7', 'menu-2', 'dish-7', 'lunch', '2026-07-27T07:00:00Z'),
('mi-8', 'menu-2', 'dish-8', 'dinner', '2026-07-27T07:00:00Z');

INSERT INTO suppliers (id, name, phone, address, created_at, updated_at) VALUES
('sup-1', 'Công ty TNHH Thực phẩm sạch Tuyên Quang', '0207xxxxxxx', 'TP Tuyên Quang', '2025-08-10T00:00:00Z', '2025-08-10T00:00:00Z'),
('sup-2', 'Hợp tác xã Rau an toàn Tràng Đà', '0207yyyyyyy', 'Xã Tràng Đà, TP Tuyên Quang', '2025-08-10T00:00:00Z', '2025-08-10T00:00:00Z');

INSERT INTO food_deliveries (id, supplier_id, delivery_date, item_name, quantity, unit, unit_price, total_price, received_by, note, created_at) VALUES
('fd-1', 'sup-1', '2026-07-28', 'Gạo tẻ', 20, 'kg', 22000, 440000, 'user-nuoiduong', 'Giao đủ, đúng hạn', '2026-07-28T06:30:00Z'),
('fd-2', 'sup-2', '2026-07-28', 'Rau ngót', 8, 'kg', 15000, 120000, 'user-nuoiduong', NULL, '2026-07-28T06:30:00Z');

INSERT INTO three_step_inspections (id, menu_id, step, checked_by, checked_at, result, note) VALUES
('tsi-1', 'menu-1', 'before_processing', 'user-nuoiduong', '2026-07-28T06:45:00Z', 'dat', 'Thực phẩm tươi, có hóa đơn chứng từ'),
('tsi-2', 'menu-1', 'before_eating', 'user-yte', '2026-07-28T10:30:00Z', 'dat', 'Món ăn chín kỹ, đảm bảo nhiệt độ'),
('tsi-3', 'menu-1', 'sample_storage', 'user-nuoiduong', '2026-07-28T10:45:00Z', 'dat', 'Đã lưu mẫu đủ 3 món, niêm phong, ghi nhãn');

-- ===================== SỨC KHỎE – AN TOÀN =====================

INSERT INTO health_records (id, child_id, blood_type, chronic_conditions, allergies, note, version, created_by, created_at, updated_by, updated_at) VALUES
('hr-1', 'child-1', 'O', NULL, NULL, NULL, 1, 'user-yte', '2025-09-10T00:00:00Z', 'user-yte', '2025-09-10T00:00:00Z'),
('hr-2', 'child-2', 'A', NULL, 'Dị ứng trứng', 'Phụ huynh đề nghị không cho ăn món có trứng', 1, 'user-yte', '2025-09-10T00:00:00Z', 'user-yte', '2025-09-10T00:00:00Z'),
('hr-3', 'child-3', 'B', 'Hen suyễn nhẹ', NULL, 'Theo dõi khi vận động mạnh', 1, 'user-yte', '2025-09-10T00:00:00Z', 'user-yte', '2025-09-10T00:00:00Z');

INSERT INTO growth_measurements (id, child_id, measured_date, height_cm, weight_kg, note, measured_by, created_at) VALUES
('gm-1', 'child-1', '2025-09-10', 108, 17.5, NULL, 'user-yte', '2025-09-10T00:00:00Z'),
('gm-2', 'child-1', '2026-05-15', 112, 19.0, NULL, 'user-yte', '2026-05-15T00:00:00Z'),
('gm-3', 'child-2', '2025-09-10', 106, 16.8, NULL, 'user-yte', '2025-09-10T00:00:00Z'),
('gm-4', 'child-2', '2026-05-15', 110, 18.2, NULL, 'user-yte', '2026-05-15T00:00:00Z');

INSERT INTO vaccinations (id, child_id, vaccine_name, dose_no, vaccinated_date, place, note, created_by, created_at) VALUES
('vac-1', 'child-1', 'Vắc xin Sởi - Quai bị - Rubella', 2, '2023-06-01', 'Trạm Y tế xã Tràng Đà', NULL, 'user-yte', '2025-09-10T00:00:00Z'),
('vac-2', 'child-2', 'Vắc xin Viêm não Nhật Bản', 1, '2023-04-15', 'Trạm Y tế xã Tràng Đà', NULL, 'user-yte', '2025-09-10T00:00:00Z');

INSERT INTO incidents (id, code, child_id, class_id, occurred_at, category, severity, description, actions_taken, reported_by, created_at) VALUES
('inc-1', 'SC-2026-0001', 'child-3', 'class-1', '2026-07-20T09:15:00Z', 'accident', 'low',
 'Trẻ bị té nhẹ khi chơi ở khu vực cầu trượt, xây xước nhẹ ở đầu gối',
 'Sơ cứu tại chỗ bằng bông băng y tế, thông báo và trao đổi trực tiếp với phụ huynh khi đón trẻ',
 'user-gv1', '2026-07-20T09:30:00Z');

INSERT INTO safety_inspections (id, code, area, inspection_date, checklist_result, risk_level, remediation_plan, status, inspected_by, version, created_by, created_at, updated_by, updated_at) VALUES
('si-1', 'AT-2026-0001', 'playground', '2026-07-15',
 'Rào chắn khu vực cầu trượt có dấu hiệu lỏng ốc vít; các thiết bị khác đạt yêu cầu',
 'medium', 'Sửa chữa, siết chặt lại rào chắn khu vực cầu trượt trước ngày 05/08/2026',
 'pending_approval', 'user-pht2', 1, 'user-pht2', '2026-07-15T08:00:00Z', 'user-pht2', '2026-07-15T08:00:00Z');

-- ===================== TÀI CHÍNH – TÀI SẢN =====================

INSERT INTO fee_items (id, code, name, amount, period, category, is_active, created_at, updated_at) VALUES
('fee-1', 'KT-0001', 'Tiền ăn bán trú', 450000, 'monthly', 'Bán trú', 1, '2025-08-01T00:00:00Z', '2025-08-01T00:00:00Z'),
('fee-2', 'KT-0002', 'Học phí', 150000, 'monthly', 'Học phí', 1, '2025-08-01T00:00:00Z', '2025-08-01T00:00:00Z'),
('fee-3', 'KT-0003', 'Quỹ hội phụ huynh', 100000, 'one_time', 'Quỹ hội', 1, '2025-08-01T00:00:00Z', '2025-08-01T00:00:00Z');

INSERT INTO revenues (id, code, school_year_id, child_id, fee_item_id, amount, revenue_date, payer_name, note, status, prepared_by, checked_by, approved_by, version, created_at, updated_at) VALUES
('rev-1', 'PT-2026-0001', 'sy-2025-2026', 'child-1', 'fee-1', 450000, '2026-07-05', 'Nguyễn Văn Bảo', 'Tiền ăn tháng 7/2026', 'approved', 'user-ketoan', 'user-pht2', 'user-hieutruong', 3, '2026-07-05T08:00:00Z', '2026-07-08T08:00:00Z'),
('rev-2', 'PT-2026-0002', 'sy-2025-2026', 'child-2', 'fee-1', 450000, '2026-07-06', 'Trần Thị Cúc', 'Tiền ăn tháng 7/2026', 'pending_approval', 'user-ketoan', NULL, NULL, 1, '2026-07-06T08:00:00Z', '2026-07-06T08:00:00Z');

INSERT INTO expenses (id, code, school_year_id, category, amount, expense_date, payee_name, note, status, prepared_by, checked_by, approved_by, version, created_at, updated_at) VALUES
('exp-1', 'PC-2026-0001', 'sy-2025-2026', 'Văn phòng phẩm', 500000, '2026-07-10', 'Nhà sách Tuyên Quang', 'Mua giấy in, mực in phục vụ văn phòng', 'pending_approval', 'user-ketoan', NULL, NULL, 1, '2026-07-10T08:00:00Z', '2026-07-10T08:00:00Z');

INSERT INTO assets (id, code, name, category, quantity, unit_price, purchase_date, location, status, note, version, created_by, created_at, updated_by, updated_at) VALUES
('asset-1', 'TS-0001', 'Bàn ghế học sinh', 'Thiết bị dạy học', 50, 350000, '2020-08-01', 'Các phòng học', 'active', NULL, 1, 'user-ketoan', '2025-08-01T00:00:00Z', 'user-ketoan', '2025-08-01T00:00:00Z'),
('asset-2', 'TS-0002', 'Máy tính văn phòng', 'Thiết bị văn phòng', 3, 12000000, '2021-08-01', 'Phòng Hiệu trưởng, Kế toán', 'active', NULL, 1, 'user-ketoan', '2025-08-01T00:00:00Z', 'user-ketoan', '2025-08-01T00:00:00Z'),
('asset-3', 'TS-0003', 'Điều hòa lớp học', 'Thiết bị điện', 6, 9000000, '2019-08-01', 'Các phòng học', 'repair', 'Điều hòa lớp Mẫu giáo lớn A có tiếng ồn bất thường', 2, 'user-ketoan', '2025-08-01T00:00:00Z', 'user-ketoan', '2026-07-20T00:00:00Z');

INSERT INTO asset_status_history (id, asset_id, from_status, to_status, changed_by, changed_at, note) VALUES
('ash-1', 'asset-3', 'active', 'repair', 'user-ketoan', '2026-07-20T00:00:00Z', 'Phát hiện tiếng ồn bất thường khi kiểm kê, chuyển bảo trì');
