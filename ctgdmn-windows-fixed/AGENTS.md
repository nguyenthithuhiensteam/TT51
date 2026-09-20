# CTGDMN desktop

## Mục tiêu

Xây dựng ứng dụng ngoại tuyến cho CBQL và giáo viên mầm non tra cứu, rà soát và quản lý kế hoạch giáo dục theo 5 nhóm độ tuổi.

## Nguyên tắc dữ liệu

- Không tự ý sửa nội dung PDF gốc.
- Cảnh báo chỉ là gợi ý rà soát; người có thẩm quyền quyết định điều chỉnh.
- Giữ nguyên dấu tiếng Việt, mã mục tiêu, tên chủ đề và mốc thời gian nguồn.
- Không đưa dữ liệu trẻ em hoặc khóa bí mật vào mã nguồn.

## Cấu trúc

- `electron/`: tiến trình chính và cầu nối an toàn tới hệ điều hành.
- `src/`: giao diện và dữ liệu tìm kiếm.
- `program-documents/`: 246 PDF nguồn, chỉ đọc.
- `tests/`: kiểm thử các hàm lọc, thống kê và an toàn dữ liệu.

## Kiểm tra hoàn thành

Chạy `npm test`. Với thay đổi giao diện, kiểm tra các màn hình ở kích thước 1440×900 và 1120×720. Với thay đổi đóng gói, chạy `npm run package` trên hệ điều hành đích; bộ cài Windows phải được tạo trên Windows trước khi bàn giao chính thức.
