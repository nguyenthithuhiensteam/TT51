-- MN360 — Giai đoạn 5: Tối ưu hiệu năng — bổ sung chỉ mục còn thiếu
-- Chỉ thêm CREATE INDEX (không đổi cấu trúc bảng/dữ liệu) cho các cột lọc/join
-- xuất hiện trong DAL (src/lib/db/*.ts) nhưng chưa có chỉ mục phù hợp.

-- Công việc: tra cứu nhiệm vụ theo người được phân công, lịch sử/minh chứng/bình luận theo nhiệm vụ
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_evidence_task ON task_evidence(task_id);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_status_history_task ON task_status_history(task_id);

-- Thông báo: danh sách/đếm chưa đọc theo người dùng (ngoài chỉ mục dedup_key hiện có)
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- Trẻ em: lịch sử trạng thái theo trẻ, phụ huynh theo trẻ (chiều ngược với UNIQUE hiện có)
CREATE INDEX idx_child_status_history_child ON child_status_history(child_id);
CREATE INDEX idx_child_guardians_guardian ON child_guardians(guardian_id);
CREATE INDEX idx_attendance_child_date ON attendance(child_id, attendance_date);

-- Tài sản: lịch sử trạng thái theo tài sản
CREATE INDEX idx_asset_status_history_asset ON asset_status_history(asset_id);

-- Tài chính: khoản thu theo trẻ (dùng ở Góc phụ huynh)
CREATE INDEX idx_revenues_child ON revenues(child_id);

-- Nuôi dưỡng: thực đơn theo lớp + ngày (truy vấn "thực đơn hôm nay của lớp")
CREATE INDEX idx_menus_class_date ON menus(class_id, menu_date);

-- Công tác Đảng: biên bản theo cuộc họp, đảng phí theo kỳ
CREATE INDEX idx_party_meeting_minutes_meeting ON party_meeting_minutes(meeting_id);
CREATE INDEX idx_party_fees_period ON party_fees(period);
