# TT51 - Chương trình Giáo dục Mầm non

Ứng dụng hỗ trợ xây dựng, chỉnh sửa và xuất Kế hoạch giáo dục năm, Kế hoạch chủ đề/tháng, Kế hoạch giáo dục tuần và Giáo án từng ngày, có kết nối AI thật (Gemini / OpenAI / nhà cung cấp tương thích OpenAI).

## Cấu trúc

- `server/` - API Node.js + TypeScript + Express + SQLite (better-sqlite3), lớp dịch vụ AI dùng chung, sinh DOCX/PDF thật.
- `client/` - Giao diện React + TypeScript + Vite.

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
