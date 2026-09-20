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

## Chạy như một trang web thật (có máy chủ thật, nhiều người dùng cùng lúc)

Ngoài bản desktop (Electron), thư mục này còn có `server/` — một máy chủ Node.js/Express dùng lại
**y nguyên** toàn bộ logic nghiệp vụ trong `electron/*.cjs` (kho dữ liệu, phân quyền, kế hoạch, xuất
Word/PDF/Excel, AI...), chỉ thay 2 phần vốn dành riêng cho máy tính Windows:

- `BrowserWindow.printToPDF` (Electron) → Chromium ẩn qua Playwright (`server/pdf.mjs`).
- `safeStorage` mã hóa bằng kho bảo mật Windows (Electron) → mã hóa AES-256-GCM bằng khóa chủ đọc
  từ biến môi trường (`server/crypto-store.mjs`).

Giao diện (`src/`) giữ nguyên 100% — chỉ thêm `src/web-bridge.js` để gọi máy chủ qua HTTP thay vì
gọi thẳng hệ điều hành; tệp này tự vô hiệu hóa khi chạy trong Electron thật nên không ảnh hưởng bản
desktop.

### Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `PORT` | Không (mặc định `8787`) | Cổng máy chủ lắng nghe. |
| `CTGDMN_DATA_DIR` | Nên đặt | Thư mục lưu SQLite, cấu hình AI, mẫu DOCX, video ngoại tuyến. **Phải là ổ đĩa lưu trữ lâu dài (persistent volume)** — nếu không, dữ liệu mất khi máy chủ khởi động lại. Mặc định `./data`. |
| `AI_CONFIG_ENCRYPTION_KEY` | Cần nếu dùng AI | Khóa chủ mã hóa khóa API AI khi lưu qua giao diện Cài đặt. Tạo bằng `openssl rand -base64 32`. |
| `AI_PROVIDER`, `AI_MODEL`, `GEMINI_API_KEY` / `OPENAI_API_KEY` / `CLAUDE_API_KEY`, `AI_COMPATIBLE_BASE_URL` / `AI_COMPATIBLE_API_KEY` | Không | Nếu đặt sẵn, máy chủ tự nạp làm cấu hình AI mặc định khi khởi động lần đầu (chỉ khi chưa ai cấu hình qua giao diện) — đúng theo yêu cầu "khóa đọc từ biến môi trường". |
| `PLAYWRIGHT_CHROMIUM_PATH` | Không | Chỉ dùng khi chạy thử cục bộ trên máy đã có sẵn Chromium ở đường dẫn khác; bỏ trống khi chạy trong Docker (ảnh Playwright chính thức đã có sẵn đúng chỗ). |

### Chạy thử cục bộ

```bash
npm install
CTGDMN_DATA_DIR=./data npm run server
```

Mở `http://localhost:8787`.

### Chạy bằng Docker (khuyến nghị khi triển khai thật)

```bash
docker build -t ctgdmn-web .
docker run -p 8787:8787 \
  -v ctgdmn-data:/data \
  -e AI_CONFIG_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  ctgdmn-web
```

`-v ctgdmn-data:/data` là **bắt buộc** để dữ liệu (SQLite, tài khoản, kế hoạch) không mất khi khởi
động lại container.

### Triển khai lên một dịch vụ host thật (Render, Fly.io, Railway...)

Các dịch vụ này đều hỗ trợ "tạo Web Service từ Dockerfile trong repo GitHub", tự động build lại và
triển khai mỗi khi có commit mới — không cần thiết lập gì thêm ở phía GitHub (khác với Firebase
Hosting, không cần workflow riêng). Các bước chung:

1. Đăng ký/đăng nhập dịch vụ đã chọn bằng tài khoản GitHub của bạn.
2. Tạo "Web Service" mới, chọn repo `nguyenthithuhiensteam/TT51`, đặt **thư mục gốc (root
   directory)** là `ctgdmn-windows-fixed`, môi trường build chọn **Docker**.
3. Thêm ổ đĩa lưu trữ lâu dài (persistent disk/volume), gắn vào đường dẫn `/data`. **Đây là bước dễ
   bỏ sót nhất** — nếu không có, mỗi lần triển khai lại sẽ xóa sạch tài khoản và kế hoạch đã lưu.
   Ổ đĩa lâu dài thường là tính năng trả phí trên các dịch vụ này; kiểm tra gói cước trước khi chọn.
4. Thêm các biến môi trường ở bảng trên (ít nhất `AI_CONFIG_ENCRYPTION_KEY` nếu muốn dùng AI).
5. Bấm triển khai. Từ lần push tiếp theo vào nhánh đã chọn, dịch vụ tự build và cập nhật.

## Lưu ý

Các cảnh báo không làm thay đổi PDF nguồn. Trước khi sửa hồ sơ chính thức, cần kiểm tra lại văn bản gốc và thẩm quyền phê duyệt của nhà trường.
