# CTGDMN desktop

## Mục tiêu

Xây dựng ứng dụng ngoại tuyến cho CBQL và giáo viên mầm non tra cứu, rà soát và quản lý kế hoạch giáo dục theo 5 nhóm độ tuổi.

## Nguyên tắc dữ liệu

- Không tự ý sửa nội dung PDF gốc.
- Cảnh báo chỉ là gợi ý rà soát; người có thẩm quyền quyết định điều chỉnh.
- Giữ nguyên dấu tiếng Việt, mã mục tiêu, tên chủ đề và mốc thời gian nguồn.
- Không đưa dữ liệu trẻ em hoặc khóa bí mật vào mã nguồn.

## Cấu trúc

- `electron/`: tiến trình chính và cầu nối an toàn tới hệ điều hành (bản desktop).
- `server/`: máy chủ Node.js/Express cho bản web thật — dùng lại nguyên `electron/*.cjs` (không có
  code nghiệp vụ riêng), chỉ thay `safeStorage`/`printToPDF` bằng bản tương đương chạy trên máy chủ.
  Sửa nghiệp vụ ở `electron/*.cjs` như cũ; `server/index.mjs` chỉ là lớp HTTP mỏng bọc ngoài.
- `src/`: giao diện dùng chung cho cả desktop và web. `src/web-bridge.js` chỉ chạy khi thiếu
  `window.ctgdmnDesktop` (tức là đang chạy trên trình duyệt, không phải Electron thật).
- `program-documents/`: 246 PDF nguồn, chỉ đọc.
- `tests/`: kiểm thử các hàm lọc, thống kê và an toàn dữ liệu.

## Kiểm tra hoàn thành

Chạy `npm test`. Với thay đổi giao diện, kiểm tra các màn hình ở kích thước 1440×900 và 1120×720.
Với thay đổi đóng gói bản desktop, chạy `npm run package` trên hệ điều hành đích; bộ cài Windows
phải được tạo trên Windows trước khi bàn giao chính thức. Với thay đổi ở `electron/*.cjs` hoặc
`server/`, chạy thêm `CTGDMN_DATA_DIR=./data npm run server` và kiểm tra bằng trình duyệt thật
(không chỉ đọc code) — đăng nhập, soạn kế hoạch, xuất Word/PDF, cấu hình AI.
