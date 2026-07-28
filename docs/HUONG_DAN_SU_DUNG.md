# MN360 — Hướng dẫn sử dụng

Tài liệu dành cho người dùng cuối (cán bộ quản lý, giáo viên, kế toán, y tế, nuôi dưỡng, văn
thư, cấp ủy, phụ huynh) và quản trị viên. Hướng dẫn cài đặt/build dành cho lập trình viên xem
tại [`../mn360/README.md`](../mn360/README.md).

## 1. Đăng nhập lần đầu

1. Mở ứng dụng MN360 trên máy tính đã cài đặt.
2. Nhập **Tên đăng nhập** và **Mật khẩu** do quản trị viên cấp.
3. Lần đăng nhập đầu tiên, hệ thống **bắt buộc đổi mật khẩu** — chọn mật khẩu mới đủ mạnh
   (tối thiểu 8 ký tự, có chữ hoa/thường/số).
4. Sau 5 lần nhập sai mật khẩu, tài khoản tạm khóa — liên hệ quản trị viên hệ thống để mở khóa.
5. Ứng dụng tự khóa màn hình sau một thời gian không thao tác — nhập lại mật khẩu để tiếp tục,
   dữ liệu đang nhập dở không bị mất.

## 2. Giao diện chính

- **Thanh bên trái (sidebar)**: liệt kê các phân hệ theo đúng quyền của tài khoản đang đăng
  nhập — phân hệ nào không có quyền sẽ **không hiển thị**, kể cả khi biết đường dẫn cũng bị
  chặn (đặc biệt là Công tác Đảng).
- **Thanh trên (top bar)**: tên trường, năm học đang áp dụng, tìm kiếm, thông báo (chuông),
  tài khoản, nút khóa màn hình, và trạng thái online/offline.
- **Trạng thái mạng**: khi mất Internet, mọi nghiệp vụ nội bộ vẫn hoạt động bình thường; chỉ
  Cổng phụ huynh trực tuyến, đồng bộ và AI Gateway cần có mạng.

## 3. Vòng đời một hồ sơ (áp dụng cho hầu hết phân hệ)

Mọi hồ sơ nghiệp vụ (kế hoạch giáo dục, thực đơn, phiếu thu/chi, đánh giá viên chức, tiêu chí
kiểm định, nghị quyết Đảng...) đi qua các trạng thái:

```
Bản nháp → Đã gửi → Chờ duyệt → (Yêu cầu điều chỉnh) → Đã phê duyệt → Đã ký → Đã ban hành
→ Đã khóa → Đã lưu trữ / Đã hủy
```

- Chỉ người có quyền `<phân hệ>.approve` mới thấy nút **Duyệt**; người tạo không tự duyệt được
  hồ sơ của chính mình.
- Mọi thay đổi trạng thái được ghi lại đầy đủ (người thực hiện, thời điểm, trạng thái trước/
  sau, lý do) — xem trong tab **Lịch sử** của từng hồ sơ.
- Hồ sơ **Đã khóa/Đã lưu trữ** không sửa được nữa; cần quyền `restore` để mở lại (có ghi log).

## 4. Hướng dẫn theo phân hệ

### 4.1 Tổng quan
Trang chủ hiển thị số liệu thật (không phải số mẫu): số việc quá hạn, số văn bản chờ duyệt,
số trẻ đang học, cảnh báo cần xử lý. Nhấn vào từng thẻ để đi thẳng tới danh sách liên quan.

### 4.2 Công việc
- **Thêm nhiệm vụ**: điền đủ "6 rõ" — người phụ trách, việc, thời hạn, sản phẩm mong đợi.
- **Gửi duyệt** khi hoàn thành → người có quyền duyệt xác nhận hoặc yêu cầu điều chỉnh.
- Nhiệm vụ quá hạn tự động cảnh báo trên Tổng quan và trong chuông thông báo (không lặp lại
  thông báo trùng nhờ cơ chế chống trùng).

### 4.3 Văn phòng số
Soạn văn bản (dự thảo) → gửi duyệt → ký/ban hành → lưu trữ. Có thể **chuyển kết luận cuộc họp
thành nhiệm vụ** trực tiếp từ biên bản, không phải chép tay lại. Từ Giai đoạn 4, có thể dùng
**"Soạn dự thảo bằng AI"** (xem mục 6) để hỗ trợ viết nội dung, luôn cần người duyệt.

### 4.4 Trẻ em
- Tiếp nhận trẻ mới → xếp lớp. Mỗi trẻ có mã định danh riêng (`TRE-YYYY-NNNN`), không dùng họ
  tên làm khóa để tránh trùng.
- Điểm danh theo lớp/ngày — số liệu này **là nguồn duy nhất** cho suất ăn (phân hệ Nuôi dưỡng)
  và báo cáo chuyên cần, không cần nhập lại.
- Chuyển lớp/bảo lưu/chuyển trường/thôi học/hoàn thành chương trình đều lưu lịch sử.
- Trong hồ sơ trẻ có thêm tab xử lý **đơn xin nghỉ của phụ huynh** và **tin nhắn trao đổi**
  (giáo viên duyệt đơn/trả lời ngay tại đây).

### 4.5 Đội ngũ
Hồ sơ cán bộ gắn với tài khoản đăng nhập, phân công (chủ nhiệm/chuyên môn/hỗ trợ/quản lý), quy
trình nghỉ phép (gửi → duyệt), đánh giá viên chức theo 3 cấp (tự đánh giá → tổ trưởng → lãnh
đạo), mỗi cấp không được tự gán trùng người.

### 4.6 Chuyên môn
Kế hoạch giáo dục theo 9 loại (năm/tháng/chủ đề/tuần/ngày/hoạt động/STEAM/SEL/hòa nhập), quy
trình **Giáo viên soạn → Tổ trưởng góp ý → Phó hiệu trưởng duyệt → ban hành**. Có nhật ký quan
sát và đánh giá phát triển trẻ theo 5 lĩnh vực. Xuất được ra Word.

### 4.7 Nuôi dưỡng
- Ngân hàng món ăn (thành phần, dị ứng liên quan) → xây thực đơn theo lớp/ngày.
- **Số trẻ ăn lấy tự động từ điểm danh**, không nhập tay.
- Hệ thống **tự cảnh báo dị ứng** khi món ăn trong thực đơn trùng với dị ứng đã ghi trong hồ sơ
  sức khỏe của trẻ trong lớp — người có trách nhiệm phải xác nhận đã xem trước khi duyệt.
- Kiểm thực ba bước (trước chế biến/trước khi ăn/lưu mẫu) và giao nhận thực phẩm theo nhà cung
  cấp đều có biểu mẫu riêng, bắt buộc trước khi thực đơn được duyệt.

### 4.8 Sức khỏe – An toàn
Hồ sơ sức khỏe (nhóm máu, bệnh nền, dị ứng), biểu đồ tăng trưởng, sổ tiêm chủng, ghi nhận sự
cố/tai nạn, kiểm tra an toàn định kỳ (lớp học/sân chơi/điện-nước/PCCC) kèm mức độ nguy cơ và kế
hoạch khắc phục phải được phê duyệt trước khi đóng.

### 4.9 Tài chính – Tài sản
- Khoản thu (định kỳ/một lần) → phiếu thu/phiếu chi đi qua đúng 3 bước **lập → kiểm tra →
  phê duyệt**, luôn là 3 người khác nhau.
- Danh mục tài sản: kiểm kê, ghi nhận hỏng/điều chuyển/thanh lý, có lịch sử đầy đủ.
- Xuất báo cáo Excel theo kỳ.

### 4.10 Kiểm định
Theo khung tiêu chuẩn/tiêu chí, phân công người phụ trách từng tiêu chí, tự đánh giá (hiện
trạng/điểm mạnh/điểm yếu/kế hoạch cải tiến), gắn **minh chứng** từ kho dùng chung — chọn minh
chứng có sẵn để liên kết với nhiều tiêu chí thay vì tải lại nhiều lần.

### 4.11 Công tác Đảng
**Chỉ hiển thị với tài khoản có quyền `party.*`** (mặc định chỉ `party_committee`, không tự
động cấp cho `system_admin`/`principal`/`tech_admin`). Quản lý hồ sơ đảng viên, sinh hoạt chi
bộ định kỳ/chuyên đề kèm biên bản, nghị quyết và theo dõi thực hiện, đánh giá đảng viên cuối
năm, đảng phí theo tháng. Dữ liệu phân hệ này tách biệt hoàn toàn về mặt kỹ thuật khỏi các
phân hệ hành chính khác.

### 4.12 Phụ huynh
Giao diện một trang, gọn nhẹ: thông tin con, chuyên cần 30 ngày gần nhất, thực đơn hôm nay (chỉ
hiện khi đã được duyệt/công khai), khoản thu, gửi đơn xin nghỉ, trao đổi trực tiếp với giáo
viên. **Chỉ thấy dữ liệu của con mình** — hệ thống tự xác định trẻ thuộc tài khoản đang đăng
nhập, không thể xem hay đoán dữ liệu của trẻ khác.

## 5. Sao lưu và khôi phục dữ liệu

Vào **Sao lưu / Khôi phục** (cần quyền `system.backup`):

- **Sao lưu thủ công**: tạo một bản sao `.db` tại thời điểm hiện tại, chọn nơi lưu (khuyến
  nghị ổ đĩa ngoài/USB, **không lưu vào thư mục OneDrive được đồng bộ tự động**).
- **Khôi phục**: chọn một tệp `.db` đã sao lưu trước đó để thay thế dữ liệu hiện tại. Thao tác
  này không thể hoàn tác — nên sao lưu dữ liệu hiện tại trước khi khôi phục.
- Khuyến nghị: sao lưu **hằng ngày cuối buổi làm việc** và trước mỗi lần nâng cấp ứng dụng.

## 6. AI Gateway (hỗ trợ soạn thảo bằng AI)

- Cấu hình tại **Cài đặt → AI Gateway**: chọn nhà cung cấp (OpenAI/Gemini/Claude) hoặc **Tắt**,
  nhập khóa API (lưu cục bộ trên máy, không đưa vào mã nguồn/đồng bộ).
- Khi dùng tính năng "Soạn dự thảo bằng AI" (ở Văn phòng số), hệ thống **tự ẩn danh** số điện
  thoại, ngày tháng, tên trẻ/phụ huynh trước khi gửi ra ngoài, và **hiển thị bản xem trước** để
  người dùng xác nhận trước khi gửi.
- Kết quả AI luôn có nhãn **"Nội dung do AI hỗ trợ"** và phải bấm **"Chèn vào nội dung"** thủ
  công mới được lưu — không có bước nào tự động ban hành nội dung do AI tạo ra.
- Nếu không cấu hình khóa API (ví dụ trường chưa có Internet ổn định), toàn bộ phần còn lại của
  ứng dụng vẫn hoạt động bình thường.

## 7. Xử lý sự cố thường gặp

| Tình huống | Cách xử lý |
|---|---|
| Quên mật khẩu | Quản trị viên hệ thống (`system_admin`) vào **Đội ngũ/Tài khoản** đặt lại mật khẩu tạm, người dùng đổi lại ở lần đăng nhập kế tiếp |
| Tài khoản bị khóa do sai mật khẩu nhiều lần | Quản trị viên mở khóa trong màn hình quản lý tài khoản |
| Không thấy một phân hệ trên sidebar | Đúng như thiết kế nếu tài khoản chưa được cấp quyền `<phân hệ>.view` — liên hệ Hiệu trưởng/Quản trị hệ thống để xem xét cấp quyền |
| Mất mạng giữa chừng | Toàn bộ nghiệp vụ nội bộ (không phải AI/đồng bộ/phụ huynh trực tuyến) tiếp tục hoạt động bình thường trên máy, không mất dữ liệu |
| Nhập nhầm dữ liệu đã duyệt | Không sửa trực tiếp hồ sơ đã khóa/ban hành — dùng nghiệp vụ điều chỉnh tương ứng (VD: chuyển lớp lại, tạo phiếu điều chỉnh) để giữ lịch sử minh bạch |
| Ứng dụng không mở được | Kiểm tra đã cài WebView2 Runtime (Windows) chưa; xem thêm mục xử lý sự cố kỹ thuật ở `BAN_GIAO.md` |
