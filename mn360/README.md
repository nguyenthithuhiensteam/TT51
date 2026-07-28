# MN360 – Hệ điều hành trường mầm non số

Ứng dụng desktop local-first cho trường mầm non, xây dựng bằng Tauri 2 + React + TypeScript +
SQLite. Xem đặc tả đầy đủ trong `../docs/`.

## Yêu cầu môi trường (máy phát triển)

- Node.js 20+ và npm
- Rust (bản ổn định mới nhất) — cài qua https://rustup.rs
- Windows: Visual Studio Build Tools (C++) và WebView2 Runtime (thường có sẵn trên Windows 10/11)
- Linux (chỉ để phát triển/kiểm thử): `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`, `libsoup-3.0-dev`

## Cài đặt

```powershell
cd mn360
npm install
```

## Chạy thử (chế độ phát triển)

```powershell
npm run tauri dev
```

Lệnh trên sẽ mở cửa sổ ứng dụng MN360, tự động tạo cơ sở dữ liệu SQLite (kèm dữ liệu demo)
tại thư mục dữ liệu người dùng của hệ điều hành (mặc định `%APPDATA%\MN360\data\mn360.db` trên
Windows), và cho phép đổi sang thư mục khác trong màn hình **Cấu hình trường / năm học**.

## Tài khoản demo (Trường Mầm non Tràng Đà)

Mật khẩu demo cho **tất cả** tài khoản: `MN360@2026` (bắt buộc đổi mật khẩu lần đăng nhập đầu).

| Tên đăng nhập | Vai trò |
|---|---|
| `hieutruong` | Hiệu trưởng (kiêm cấp ủy) |
| `phohieutruong1`, `phohieutruong2` | Phó hiệu trưởng |
| `totruong1`, `totruong2` | Tổ trưởng |
| `giaovien1` … `giaovien6` | Giáo viên |
| `vanthu` | Văn thư |
| `ketoan` | Kế toán |
| `yte` | Nhân viên y tế |
| `nuoiduong` | Nhân viên nuôi dưỡng |
| `quantrihethong` | Quản trị hệ thống |
| `quantrikythuat` | Quản trị kỹ thuật (không xem được trẻ em/sức khỏe/tài chính/Đảng) |
| `phuhuynh1` | Phụ huynh |

Dữ liệu demo Giai đoạn 2 đã có sẵn: 3 lớp (Mẫu giáo lớn A, Mẫu giáo nhỡ B, Nhà trẻ C), 12 trẻ
kèm phụ huynh, 15 hồ sơ cán bộ (gắn với các tài khoản ở trên), một số kế hoạch giáo dục theo
các trạng thái phê duyệt khác nhau để thử nghiệm quy trình.

## Kiểm thử

```powershell
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build       # build thử frontend (tsc + vite build)
```

Phía Rust:

```powershell
cd src-tauri
cargo check
```

## Đóng gói bộ cài Windows

```powershell
npm run tauri build
```

Yêu cầu chạy trên máy Windows có đầy đủ Visual Studio Build Tools; kết quả `.msi`/`.exe` nằm
trong `src-tauri/target/release/bundle/`. Bước này chưa được thực hiện trong môi trường phát
triển hiện tại (Linux headless) — xem `../docs/ROADMAP.md` mục Giai đoạn 5.

## Sao lưu / khôi phục nhanh

Vào **Sao lưu / Khôi phục** trên thanh điều hướng (yêu cầu quyền `system.backup`) để sao lưu
thủ công hoặc khôi phục từ một bản sao lưu `.db` có sẵn.

## Cấu trúc thư mục

```
mn360/
├── src/                # Giao diện React + TypeScript
│   ├── components/     # UI dùng chung + layout (sidebar, topbar, khóa màn hình)
│   ├── features/       # Từng phân hệ nghiệp vụ (auth, dashboard, tasks, documents, ...)
│   ├── lib/db/         # Lớp truy cập dữ liệu (DAL) qua SQLite, dễ thay bằng PostgreSQL
│   ├── lib/schemas/    # Zod schema kiểm tra dữ liệu đầu vào
│   ├── lib/export/     # Xuất Word (docx) và Excel (exceljs)
│   └── store/          # Zustand store (phiên đăng nhập, trạng thái ứng dụng)
└── src-tauri/          # Backend Rust (Tauri 2), migrations SQL có phiên bản, lệnh hệ thống
    └── src/db/sql/     # Các tệp migration 001-008 (nền tảng, RBAC mở rộng, Trẻ em, Đội ngũ, Chuyên môn)
```
