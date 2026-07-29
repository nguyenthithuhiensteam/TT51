# TT51 - Chương trình Giáo dục Mầm non

Ứng dụng hỗ trợ xây dựng, chỉnh sửa và xuất Kế hoạch giáo dục năm, Kế hoạch chủ đề/tháng, Kế hoạch giáo dục tuần và Giáo án từng ngày, có kết nối AI thật (Gemini / OpenAI / nhà cung cấp tương thích OpenAI).

## Cấu trúc

- `server/` - API Node.js + TypeScript + Express + SQLite (better-sqlite3), lớp dịch vụ AI dùng chung, sinh DOCX/PDF thật.
- `client/` - Giao diện React + TypeScript + Vite (ứng dụng soạn kế hoạch mới, xây từ đầu trong phiên này).
- `webapp/ctgdmn-web/` - Ứng dụng CTGDMN gốc (HTML/CSS/JS thuần, do nhà trường cung cấp) - đã được sửa để dùng backend thật của `server/` thay vì lưu trong trình duyệt, và nối AI thật. Xem mục riêng bên dưới.

## Ứng dụng CTGDMN (webapp/ctgdmn-web)

Đây là ứng dụng gốc nhà trường đã có (quản lý tài khoản/phân quyền 6 vai trò, quy trình soạn - nhận xét - phê duyệt kế hoạch nhiều cấp, kho 246 tài liệu chương trình thật, nhật ký hoạt động, video hướng dẫn). Phiên bản gốc lưu toàn bộ dữ liệu trong `localStorage`/`IndexedDB` của trình duyệt (không dùng chung được giữa nhiều máy) và mục "AI" chỉ mở tab ChatGPT/Gemini/Copilot để copy-paste thủ công.

Đã sửa:
- `webapp/ctgdmn-web/src/browser-backend.js` được viết lại để gọi API thật tại `/api/ctgdmn/*` (server/) thay vì localStorage - **giữ nguyên toàn bộ giao diện, `app.js`, `auth-client.js`** (chỉ đổi lớp kết nối dữ liệu phía dưới).
- Toàn bộ tài khoản, kế hoạch, nhận xét, lịch sử chuyển trạng thái, nhật ký hoạt động, video hướng dẫn nay lưu trong SQLite dùng chung (`server/src/ctgdmn/`), đúng theo quy tắc phân quyền gốc (`server/src/ctgdmn/permissions.ts`, chuyển thể từ `browser-backend.js` cũ).
- Màn hình "AI và nguồn trực tuyến" có thêm khối "Kết nối AI trực tiếp": kiểm tra kết nối thật, cấu hình nhà cung cấp/mô hình/khoá API (chỉ Quản trị hệ thống), và nút "Tạo gợi ý bằng AI (kết nối trực tiếp)" gọi thẳng `aiService` dùng chung với `server/` - vẫn giữ nguyên luồng "Sao chép prompt" thủ công cũ cho ai muốn tự kiểm soát hoàn toàn.
- Sửa 1 lỗi có sẵn: `state.workflowPlanId` không được gán khi tự động chọn kế hoạch đầu tiên, khiến các nút nhận xét/gửi/duyệt gọi API với id rỗng (lỗi 404) nếu người dùng chưa bấm chọn kế hoạch trong danh sách.

Truy cập tại `http://localhost:8787/src/index.html` (server phục vụ luôn cả API và tệp tĩnh này, không cần chạy riêng).

**Lưu ý khi tạo tài khoản Tổ trưởng/Phó hiệu trưởng chuyên môn:** phải điền cùng một giá trị "Tổ chuyên môn" (teamId) với giáo viên mà họ phụ trách thì mới nhìn thấy kế hoạch của giáo viên đó, đây là quy tắc phân quyền gốc của ứng dụng (Tổ trưởng chỉ thấy kế hoạch cùng tổ), không phải lỗi.

Còn thiếu (chưa kịp hoàn thiện trong phiên này): nội dung kế hoạch trong quy trình "Soạn - nhận xét - phê duyệt" vẫn là một ô văn bản tự do, chưa tách theo đúng mẫu bảng chi tiết của từng cấp (năm/chủ đề/tuần/giáo án) như 4 tệp PDF mẫu; phần "Kho dữ liệu mở"/"Ma trận chương trình" vẫn dùng dữ liệu cục bộ trình duyệt (`localStorage`) như bản gốc, chưa chuyển sang máy chủ dùng chung.

## Yêu cầu hệ thống

- Node.js 20+
- **LibreOffice, cụ thể là gói `libreoffice-writer`** - dùng để chuyển DOCX sang PDF thật (không chụp ảnh giao diện). Trên Ubuntu/Debian:
  ```
  apt-get update && apt-get install -y --no-install-recommends libreoffice-writer
  ```
  Thiếu gói này, chức năng "Tải PDF" / "Xem trước (PDF)" / "In trực tiếp" sẽ báo lỗi tiếng Việt rõ ràng thay vì làm hỏng dữ liệu.

## Cài đặt và chạy (phát triển)

```bash
cd server && npm install && cp .env.example .env
cd ../client && npm install
```

Chạy song song hai tiến trình:

```bash
cd server && npm run dev    # API tại http://localhost:8787
cd client && npm run dev    # Giao diện tại http://localhost:5173 (proxy /api sang cổng 8787)
```

## Tài khoản demo (đã tạo sẵn khi khởi động lần đầu)

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| giaovien | 123456 | Giáo viên |
| totruong | 123456 | Tổ trưởng |
| quanly | 123456 | Cán bộ quản lý |

Đổi mật khẩu/khoá tài khoản demo trước khi triển khai thật.

## Cấu hình AI

Vào **Cài đặt AI** trong ứng dụng, hoặc cấu hình biến môi trường trong `server/.env`:

```
AI_PROVIDER=gemini            # gemini | openai | openai_compatible
AI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=
OPENAI_API_KEY=
AI_COMPATIBLE_BASE_URL=
AUTH_SECRET=doi-khoa-bi-mat-nay-khi-trien-khai
```

Khoá API nhập qua màn hình "Cài đặt AI" được lưu tại `server/.secrets.json` (đã được `.gitignore`, không commit lên GitHub) - đây là nơi thay thế Secret Manager khi tự triển khai; nếu triển khai lên nền tảng có Secret Manager thật, hãy trỏ biến môi trường tới đó thay vì dùng tệp này.

## Ngân hàng mục tiêu chương trình

Được khởi tạo sẵn với các mã mục tiêu (MT1...MT67) cho độ tuổi 5-6, trích từ kế hoạch chủ đề mẫu do nhà trường cung cấp. Độ tuổi 3-4 và 4-5 hiện chưa có dữ liệu - vào mục **Ngân hàng mục tiêu** (vai trò Tổ trưởng/Cán bộ quản lý) để bổ sung đúng theo Chương trình Giáo dục mầm non hiện hành trước khi tạo kế hoạch cho các độ tuổi này.
