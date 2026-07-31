-- Phase D: bảng chuẩn tăng trưởng WHO (LMS) dùng để tính z-score cân nặng/tuổi,
-- chiều cao/tuổi, BMI/tuổi cho trẻ 0-60 tháng. Dữ liệu nạp ở migration seed kế tiếp.
CREATE TABLE who_growth_standards (
  indicator TEXT NOT NULL CHECK (indicator IN ('wfa', 'hfa', 'bmifa')),
  sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
  age_days INTEGER NOT NULL CHECK (age_days BETWEEN 0 AND 1826),
  l REAL NOT NULL,
  m REAL NOT NULL,
  s REAL NOT NULL,
  PRIMARY KEY (indicator, sex, age_days)
) WITHOUT ROWID;
