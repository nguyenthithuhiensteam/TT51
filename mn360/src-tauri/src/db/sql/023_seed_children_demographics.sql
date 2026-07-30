-- MN360 — Giai đoạn 7 (Phase B): dữ liệu demo dân tộc/diện chính sách cho một số trẻ
-- để có số liệu khác 0 khi thử báo cáo "Tổng hợp số lượng học sinh từng thời điểm".

UPDATE children SET ethnicity = 'Tày' WHERE id = 'child-3';
UPDATE children SET ethnicity = 'Dao' WHERE id = 'child-5';
UPDATE children SET ethnicity = 'Dao', policy_type = 'ngheo_can_ngheo' WHERE id = 'child-9';
UPDATE children SET policy_type = 'khuyet_tat' WHERE id = 'child-11';
UPDATE children SET policy_type = 'con_chinh_sach' WHERE id = 'child-2';
