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

## Bản xem trước trình duyệt (web preview)

Để xem nhanh giao diện/luồng thao tác trong trình duyệt thường mà không cần cài Rust/Tauri
(chỉ dùng để xem giao diện — không phải bản chính thức, xem giới hạn bên dưới):

```powershell
cd mn360
npm install
npm run build:web
npx serve dist-web
```

Rồi mở địa chỉ mà `npx serve` in ra. Bản này thay SQLite/Rust bằng SQLite mô phỏng trong trình
duyệt (`sql.js`) nên **dữ liệu chỉ lưu tạm trong bộ nhớ, mất khi tải lại trang**; không có sao
lưu/khôi phục tệp thật, không gọi AI Gateway thật, không đính kèm tệp thật. Xem chi tiết trong
`dist-web/HUONG_DAN_MO.txt` sau khi build.

### Bản một tệp HTML (để lưu trữ như một trang tĩnh/chia sẻ qua đường dẫn)

```powershell
npm run build:artifact
```

Kết quả `artifact-dist/fragment.html` là toàn bộ ứng dụng gộp vào **một tệp HTML duy nhất**
(nhúng luôn nhị phân sql-wasm dạng base64 — không tải thêm tệp nào qua mạng khi mở). So với
bản web preview thông thường, bản này **không có tính năng xuất Word/Excel** (bỏ để giảm dung
lượng khi nhúng) — mọi tính năng khác giữ nguyên. Có thể mở trực tiếp bằng cách chèn nội dung
tệp vào một trang HTML có `<div id="root"></div>`, hoặc lưu trữ như một trang tĩnh.

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

Dữ liệu demo Giai đoạn 2-6 đã có sẵn: 3 lớp (Mẫu giáo lớn A, Mẫu giáo nhỡ B, Nhà trẻ C), 12 trẻ
kèm phụ huynh, 15 hồ sơ cán bộ (gắn với các tài khoản ở trên), một số kế hoạch giáo dục theo
các trạng thái phê duyệt khác nhau để thử nghiệm quy trình, 8 món ăn với thực đơn mẫu (trẻ
"Trần Thị Bình" dị ứng trứng để thử tính năng cảnh báo dị ứng), 25 thực phẩm kèm khẩu phần
dinh dưỡng mẫu ngày 28/07/2026 cho cả hai nhóm Nhà trẻ/Mẫu giáo (một đã duyệt, một chờ duyệt —
đăng nhập `nuoiduong` để thử tại Nuôi dưỡng → Khẩu phần dinh dưỡng), hồ sơ sức khỏe/tăng
trưởng/tiêm chủng, một sự cố và một đợt kiểm tra an toàn mẫu, khoản thu/phiếu thu-chi/tài sản
mẫu ở các bước quy trình khác nhau, tiêu chuẩn/tiêu chí kiểm định kèm minh chứng mẫu, đảng
viên/sinh hoạt chi bộ mẫu (chỉ tài khoản `hieutruong` — cấp ủy — xem được), và tài khoản
`phuhuynh1` được liên kết sẵn với trẻ "Nguyễn Văn An" (child-1) để thử Góc phụ huynh (xin
nghỉ, trao đổi với giáo viên, xem chuyên cần/thực đơn/khoản thu của riêng con mình).

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

Thực hiện trên máy Windows (không thể build MSI/NSIS từ Linux headless):

```powershell
# 1. Cài công cụ (một lần)
#    - Visual Studio Build Tools 2022, chọn "Desktop development with C++"
#    - Rust: https://rustup.rs (chọn toolchain msvc mặc định)
#    - Node.js 20+
#    - WebView2 Runtime (có sẵn trên Windows 10 2004+/Windows 11; nếu thiếu tải tại
#      https://developer.microsoft.com/microsoft-edge/webview2)

# 2. Build
cd mn360
npm install
npm run tauri build
```

Kết quả:
- Bộ cài MSI: `src-tauri/target/release/bundle/msi/MN360_<version>_x64_vi-VN.msi`
- Bộ cài NSIS (.exe): `src-tauri/target/release/bundle/nsis/MN360_<version>_x64-setup.exe`

Cấu hình đóng gói (`src-tauri/tauri.conf.json`) đã có sẵn tên nhà xuất bản, mô tả, ngôn ngữ cài
đặt tiếng Việt (WiX `vi-VN`, NSIS `Vietnamese`) và biểu tượng đầy đủ; chỉ cần chạy lệnh trên
máy Windows để tạo ra bộ cài thật. Môi trường phát triển hiện tại (Linux headless) chỉ kiểm tra
được biên dịch Rust qua `cargo check`, không tạo được `.msi`/`.exe` — xem `../docs/ROADMAP.md`
mục Giai đoạn 5.

## Sao lưu / khôi phục nhanh

Vào **Sao lưu / Khôi phục** trên thanh điều hướng (yêu cầu quyền `system.backup`) để sao lưu
thủ công hoặc khôi phục từ một bản sao lưu `.db` có sẵn.

## Cấu trúc thư mục

```
mn360/
├── src/                # Giao diện React + TypeScript
│   ├── components/     # UI dùng chung + layout (sidebar, topbar, khóa màn hình)
│   ├── features/       # Từng phân hệ nghiệp vụ (auth, dashboard, tasks, documents, kiểm định,
│   │                   #   Đảng, phụ huynh, ...)
│   ├── lib/db/         # Lớp truy cập dữ liệu (DAL) qua SQLite, dễ thay bằng PostgreSQL
│   ├── lib/schemas/    # Zod schema kiểm tra dữ liệu đầu vào
│   ├── lib/export/     # Xuất Word (docx) và Excel (exceljs)
│   ├── lib/ai/         # Cổng AI: ẩn danh dữ liệu trước khi gửi, gọi lệnh Rust `ai_generate`
│   └── store/          # Zustand store (phiên đăng nhập, trạng thái ứng dụng)
└── src-tauri/          # Backend Rust (Tauri 2), migrations SQL có phiên bản, lệnh hệ thống
    └── src/db/sql/     # Các tệp migration 001-021 (nền tảng, Trẻ em, Đội ngũ, Chuyên môn,
                         #   Nuôi dưỡng (gồm khẩu phần dinh dưỡng), Sức khỏe-An toàn,
                         #   Tài chính-Tài sản, Kiểm định, Công tác Đảng, Phụ huynh)
```
