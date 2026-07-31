# Cổng minh chứng kiểm định — MN360

Ứng dụng web độc lập (tách biệt hoàn toàn với app desktop mn360) cho phép cán bộ/giáo viên đăng
nhập bằng Google, tải lên minh chứng kiểm định chất lượng giáo dục theo từng Tiêu chuẩn/Tiêu chí,
và người có quyền duyệt/từ chối từng minh chứng. Dữ liệu lưu trên Firebase (Firestore + Storage),
không liên quan đến dữ liệu SQLite cục bộ của app desktop.

## Trước khi chạy — 3 việc cần làm trên Firebase Console

Dự án dùng chung Firebase project `quantritruongmamnon` (đã có sẵn cho bản xem trước web) nhưng
cần bật thêm các dịch vụ sau (project đó hiện mới chỉ dùng Hosting):

1. **Authentication → Sign-in method** → bật nhà cung cấp **Google**.
2. **Firestore Database** → **Create database** (chọn khu vực gần Việt Nam, ví dụ
   `asia-southeast1`).
3. **Storage** → **Get started** (lưu file minh chứng).
4. **Project settings → General → Your apps** → **Add app → Web (`</>`)** → đặt tên (vd "Cổng
   minh chứng") → sao chép object `firebaseConfig` được hiển thị, dùng để điền vào `.env.local`
   (xem `.env.example`).

## Chạy thử cục bộ

```bash
cp .env.example .env.local   # rồi điền đúng cấu hình lấy từ bước 4 ở trên
npm install
npm run dev
```

## Vai trò & luồng duyệt

- Đăng nhập Google lần đầu → tài khoản ở trạng thái **"Chờ duyệt"** (trừ email trùng
  `VITE_BOOTSTRAP_ADMIN_EMAIL`, tự động là **Quản trị**).
- **Quản trị** vào tab "Quản lý tài khoản" để duyệt tài khoản mới, gán vai trò **Cán bộ** hoặc
  **Người duyệt minh chứng**; cũng là nơi duy nhất thêm/sửa Tiêu chuẩn/Tiêu chí (tab "Quản lý
  tiêu chí").
- **Cán bộ** tải minh chứng lên theo từng Tiêu chí — vào trạng thái "Chờ duyệt".
- **Người duyệt minh chứng** (và Quản trị) vào tab "Duyệt minh chứng" để Duyệt/Từ chối kèm ghi chú.
- Toàn bộ quyền truy cập được kiểm soát ở tầng Firestore/Storage Security Rules
  (`firestore.rules`, `storage.rules`) — không chỉ dựa vào giao diện, nên không thể bỏ qua bằng
  cách gọi thẳng API.

## Triển khai lên Firebase Hosting

Dùng chung project `quantritruongmamnon` nhưng là một **Hosting site riêng**
(`quantritruongmamnon-minhchung`) để không ảnh hưởng bản xem trước desktop hiện có tại
`quantritruongmamnon.web.app`.

```bash
# Chỉ cần chạy 1 lần để tạo site riêng (nếu chưa có)
firebase hosting:sites:create quantritruongmamnon-minhchung --project quantritruongmamnon

firebase deploy --only firestore:rules,firestore:indexes,storage:rules,hosting --project quantritruongmamnon
```

Sau khi tạo Tiêu chuẩn/Tiêu chí đầu tiên qua tab "Quản lý tiêu chí", có thể tham khảo đúng nội
dung 3 Tiêu chuẩn/3 Tiêu chí mẫu đã dùng trong app desktop (`mn360/src-tauri/src/db/sql/018_seed_demo_phase4.sql`)
để nhập cho nhất quán, rồi bổ sung dần các tiêu chí còn lại theo bộ tiêu chuẩn kiểm định thật của
trường.
