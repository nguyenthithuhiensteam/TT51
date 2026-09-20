# CTGDMN Desktop

Ứng dụng cục bộ quản lý dữ liệu mở và soạn kế hoạch giáo dục mầm non năm học 2026–2027. Các chức năng cốt lõi vẫn hoạt động khi không có Internet.

## Chức năng phiên bản 0.6

- Tổng quan 5 nhóm độ tuổi, 246 tài liệu và 3.780 trang.
- Tra cứu toàn văn theo từ khóa, độ tuổi và loại hồ sơ.
- Duyệt mục tiêu/chủ đề, kế hoạch tháng và kế hoạch/giáo án tuần.
- Xem nội dung trích xuất và mở PDF gốc.
- Đánh dấu tài liệu đã rà soát hoặc cần theo dõi.
- Hiển thị cảnh báo về mốc thời gian, tên tệp, phân loại và thông tin chung.
- Xuất bản sao trạng thái rà soát dưới dạng JSON.
- Soạn kế hoạch năm, chủ đề/tháng, tuần và giáo án ngày theo các bảng mẫu mầm non.
- Xuất DOCX thật (bảng động, lặp dòng tiêu đề, không nhúng ảnh chụp) và PDF tạo hoàn toàn trên máy.
- Nhập mẫu DOCX riêng của trường, đặt mẫu mặc định, sao lưu và khôi phục kho mẫu.
- Kết nối GenAI tùy chọn với OpenAI, Gemini, Claude hoặc API tương thích OpenAI.

## Thiết lập GenAI

Mở **Cài đặt → Kết nối AI**, chọn nhà cung cấp, mô hình và nhập khóa API. Khóa có thể chỉ giữ trong phiên hoặc được mã hóa bằng kho bảo mật của hệ điều hành trên máy này. Ứng dụng không ghi khóa API vào nhật ký hay dữ liệu kế hoạch.

Trước khi gửi, ứng dụng chỉ lấy nội dung chuyên môn cần thiết và loại các trường nhận dạng, liên hệ, sức khỏe của trẻ. Kết quả AI luôn mở dưới dạng bản nháp để giáo viên xem và bấm áp dụng; ứng dụng không tự động phê duyệt. Khi ngoại tuyến, người dùng có thể lưu yêu cầu vào hàng chờ cục bộ và chủ động mở lại sau.

## Mẫu DOCX tùy chỉnh

Mẫu Word riêng có thể dùng các biến:

- `{{SCHOOL_NAME}}`, `{{SCHOOL_YEAR}}`
- `{{PLAN_TITLE}}`, `{{PLAN_PERIOD}}`, `{{PLAN_CLASS}}`, `{{PLAN_AUTHOR}}`
- `{{PLAN_OBJECTIVES}}`, `{{PLAN_ACTIVITIES}}`, `{{PLAN_MATERIALS}}`, `{{PLAN_ASSESSMENT}}`
- `{{PLAN_TABLE}}` — bắt buộc đặt trên một đoạn riêng; ứng dụng thay bằng bảng động đúng loại kế hoạch.

Quản trị viên thao tác tại **Cài đặt → Mẫu văn bản**. Bản sao lưu mẫu là tệp JSON cục bộ có chứa bản DOCX đã mã hóa Base64.

## Chạy trên máy phát triển

1. Cài Node.js bản LTS.
2. Mở thư mục này bằng Codex hoặc Terminal.
3. Chạy `npm install`.
4. Chạy `npm start`.

## Tạo bộ cài Windows

Trên máy Windows, nhấp chuột phải `build-windows.ps1`, chọn **Run with PowerShell**; hoặc yêu cầu Codex chạy tệp này. Kịch bản sẽ cài thư viện, chạy kiểm thử và tạo bộ cài trong thư mục `out/make`.

Để chạy thử trước khi đóng gói, dùng `run-development.ps1`.

## Lưu ý

Các cảnh báo không làm thay đổi PDF nguồn. Trước khi sửa hồ sơ chính thức, cần kiểm tra lại văn bản gốc và thẩm quyền phê duyệt của nhà trường.
