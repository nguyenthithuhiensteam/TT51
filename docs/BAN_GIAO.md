# MN360 — Tài liệu bàn giao

Dành cho quản trị viên hệ thống/quản trị kỹ thuật nhà trường tiếp nhận vận hành MN360 sau khi
bàn giao. Hướng dẫn sử dụng theo vai trò xem tại
[`HUONG_DAN_SU_DUNG.md`](./HUONG_DAN_SU_DUNG.md).

## 1. Thành phần bàn giao

| Hạng mục | Vị trí |
|---|---|
| Mã nguồn đầy đủ | Repo Git, nhánh phát triển đã merge vào nhánh chính thức của trường |
| Tài liệu đặc tả/lộ trình | `docs/PRODUCT_SPEC.md`, `docs/DATA_MODEL.md`, `docs/PERMISSIONS.md`, `docs/ROADMAP.md`, `docs/ACCEPTANCE_CRITERIA.md` |
| Hướng dẫn cài đặt/chạy thử/build | `mn360/README.md` |
| Hướng dẫn sử dụng theo phân hệ | `docs/HUONG_DAN_SU_DUNG.md` |
| Bộ cài Windows (`.msi`/`.exe`) | Build từ mã nguồn trên máy Windows theo hướng dẫn ở `mn360/README.md` mục "Đóng gói bộ cài Windows" — môi trường phát triển hiện tại không tạo sẵn bộ cài này |

## 2. Cài đặt lần đầu tại trường

1. Cài đặt ứng dụng từ bộ cài `.msi`/`.exe` trên từng máy tính sẽ sử dụng (máy văn phòng, máy
   kế toán, máy y tế...). Yêu cầu Windows 10 (2004+) hoặc Windows 11, đã có WebView2 Runtime
   (thường có sẵn, tự động cài kèm nếu thiếu).
2. Chạy ứng dụng lần đầu — vào **Cài đặt → Cấu hình trường/năm học** để nhập tên trường, năm
   học hiện tại.
3. **Chọn thư mục lưu dữ liệu** ngay từ đầu: khuyến nghị một ổ đĩa cục bộ cố định (VD:
   `D:\MN360\data`), **tuyệt đối không chọn thư mục đang được đồng bộ tự động lên OneDrive**
   (mặc định `Desktop`/`Documents` trên Windows 11 có thể đã bật OneDrive — cần kiểm tra và tắt
   đồng bộ cho thư mục này hoặc chọn ổ đĩa khác).
4. Đăng nhập bằng tài khoản `system_admin` được cấp riêng cho trường (không dùng tài khoản
   demo `quantrihethong`/`MN360@2026` ở môi trường thật) → đổi mật khẩu ngay.
5. Tạo tài khoản thật cho từng cán bộ theo vai trò tương ứng (xem `docs/PERMISSIONS.md` mục 1),
   xóa/vô hiệu hóa các tài khoản demo trước khi đưa vào sử dụng chính thức.

## 3. Vận hành định kỳ

| Việc | Tần suất | Người thực hiện |
|---|---|---|
| Sao lưu dữ liệu (`.db`) ra ổ đĩa ngoài/USB | Hằng ngày, cuối buổi | Quản trị viên/văn thư được phân công |
| Kiểm tra dung lượng ổ đĩa còn trống | Hằng tuần | Quản trị kỹ thuật |
| Rà soát tài khoản nghỉ việc/chuyển công tác — vô hiệu hóa kịp thời | Khi có biến động nhân sự | Quản trị hệ thống, có xác nhận của Hiệu trưởng |
| Cập nhật phiên bản ứng dụng (khi có bản mới) | Theo thông báo | Quản trị kỹ thuật — **luôn sao lưu dữ liệu trước khi cập nhật** |
| Rà soát nhật ký (`audit_logs`) các thao tác nhạy cảm (xóa, khôi phục, cấp quyền) | Hằng tháng | Hiệu trưởng/Quản trị hệ thống |

## 4. Quản trị tài khoản và phân quyền

- Cấp tài khoản mới, gán vai trò, khóa/mở khóa tài khoản: **Đội ngũ → Tài khoản** (cần quyền
  `system_admin`).
- Nguyên tắc phân quyền tối thiểu: chỉ cấp đúng vai trò cần thiết cho công việc; `tech_admin`
  **không** mặc định thấy dữ liệu trẻ em/sức khỏe/tài chính/Đảng — chỉ cấp bổ sung khi có ủy
  quyền tường minh bằng văn bản của Hiệu trưởng.
- Công tác Đảng: chỉ gán vai trò `party_committee` cho đúng thành viên chi bộ; không gán cho
  tài khoản kỹ thuật dù chỉ để "tiện quản trị".

## 5. Xử lý sự cố kỹ thuật

| Sự cố | Cách xử lý |
|---|---|
| Ứng dụng không khởi động, báo thiếu WebView2 | Cài WebView2 Runtime từ https://developer.microsoft.com/microsoft-edge/webview2 |
| Cửa sổ ứng dụng trắng/treo khi mở | Đóng hoàn toàn ứng dụng (Task Manager nếu cần), mở lại; nếu vẫn lỗi, sao lưu thư mục dữ liệu rồi gỡ cài đặt/cài lại phiên bản mới nhất |
| Nghi ngờ dữ liệu bị hỏng (không mở được danh sách, lỗi khi thao tác) | Ngừng thao tác ngay, sao lưu tệp `.db` hiện tại (kể cả khi lỗi, để lưu vết), khôi phục từ bản sao lưu gần nhất còn hoạt động tốt |
| Máy tính hỏng/mất | Cài ứng dụng trên máy mới, khôi phục từ bản sao lưu `.db` gần nhất — không mất dữ liệu nếu sao lưu định kỳ đầy đủ |
| Nhân viên báo "không thấy phân hệ X" | Kiểm tra tài khoản có đúng vai trò/quyền `<phân hệ>.view` không ở **Đội ngũ → Tài khoản**; đây là hành vi phân quyền đúng thiết kế, không phải lỗi |
| Cần nâng cấp lên phiên bản mới của MN360 | Sao lưu dữ liệu → cài đè bộ cài mới → mở ứng dụng, hệ thống tự áp dụng thêm các migration mới (không cần thao tác thủ công), dữ liệu cũ được giữ nguyên |

## 6. Giới hạn đã biết tại thời điểm bàn giao (xem chi tiết `docs/ROADMAP.md`)

- **Đồng bộ dữ liệu qua mạng LAN/đám mây**: chưa triển khai — cần đầu tư hạ tầng máy chủ. Ứng
  dụng hiện hoạt động độc lập trên từng máy (local-first); nếu trường có nhiều máy cần dùng
  chung dữ liệu, cần lên kế hoạch triển khai máy chủ ở giai đoạn sau.
- **Thông báo đa kênh (SMS/Zalo/email)**: chưa triển khai — cần tài khoản dịch vụ ngoài
  (SMTP/Zalo OA/nhà mạng SMS). Thông báo trong ứng dụng (in-app) hoạt động đầy đủ.
- **AI Gateway**: đã có khung cấu hình và lệnh gọi hoàn chỉnh cho OpenAI/Gemini/Claude nhưng
  **chưa được kiểm thử với khóa API thật** — trường cần tự kiểm thử với khóa API của mình trước
  khi tin tưởng đưa vào dùng chính thức, và luôn bật kiểm tra thủ công (không có bước tự động).
- **Bộ cài Windows chính thức**: chưa được build sẵn trong lần bàn giao này (môi trường phát
  triển là Linux headless) — cần build trên máy Windows theo hướng dẫn ở `mn360/README.md`
  trước khi triển khai đại trà.
- **Xuất PDF**: chưa có (đã có Word/Excel).

## 7. Đầu mối hỗ trợ

Ghi rõ thông tin liên hệ đơn vị/lập trình viên phát triển hệ thống (điền khi bàn giao chính
thức) để nhà trường liên hệ khi cần hỗ trợ nâng cấp, sửa lỗi hoặc mở rộng thêm tính năng ở các
giai đoạn sau.
