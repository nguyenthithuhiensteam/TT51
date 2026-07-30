-- MN360 — Giai đoạn 7 (Phase B): bổ sung dân tộc + diện chính sách cho hồ sơ trẻ
-- Phục vụ báo cáo "Tổng hợp số lượng học sinh từng thời điểm" (đầu năm/giữa năm/cuối năm).
-- ethnicity: tên dân tộc cụ thể (VD: "Kinh", "Tày", "Dao"...); NULL/"Kinh" = không tính vào
-- cột "Dân tộc" của báo cáo (theo quy ước thống kê phổ biến, Kinh là dân tộc đa số).
-- policy_type: phân loại chính sách chính của trẻ (một trẻ chỉ ghi 1 loại ưu tiên nhất theo
-- đúng cấu trúc 3 cột riêng biệt của biểu mẫu gốc).

ALTER TABLE children ADD COLUMN ethnicity TEXT;
ALTER TABLE children ADD COLUMN policy_type TEXT NOT NULL DEFAULT 'khong'
    CHECK (policy_type IN ('khong','con_chinh_sach','ngheo_can_ngheo','khuyet_tat'));
