-- MN360 — Giai đoạn 7 (Phase C): Khám sức khỏe toàn diện
-- Mỗi đợt khám (exam_no = "Lần N") có 1 dòng/trẻ, ghi nhận theo từng chuyên khoa như biểu mẫu
-- giấy nhà trường đang dùng. class_id lưu lại lớp của trẻ tại thời điểm khám (giống cách
-- attendance.class_id đã làm) để báo cáo đúng dù trẻ sau này chuyển lớp.

CREATE TABLE physical_exams (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    exam_no INTEGER NOT NULL,
    exam_date TEXT NOT NULL,
    tai_mui_hong TEXT,
    rang_ham_mat TEXT,
    co_xuong_khop TEXT,
    tim_mach TEXT,
    ho_hap TEXT,
    tam_than_kinh TEXT,
    mat TEXT,
    benh_khac TEXT,
    xep_loai TEXT,
    ket_luan TEXT NOT NULL DEFAULT 'Bình thường',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_by TEXT REFERENCES users(id),
    updated_at TEXT NOT NULL,
    UNIQUE(child_id, exam_no)
);
CREATE INDEX idx_physical_exams_class_round ON physical_exams(class_id, exam_no);
