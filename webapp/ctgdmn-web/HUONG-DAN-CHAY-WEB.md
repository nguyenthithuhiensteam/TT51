# CTGDMN — bản web tĩnh (chạy trong trình duyệt, không cần cài Electron)

## Cách mở
Trình duyệt **không cho phép** mở trực tiếp file `index.html` bằng cách
click đúp (giao thức `file://`) vì ES module + IndexedDB bị chặn ở chế độ
đó. Cần chạy qua một máy chủ web tĩnh rất đơn giản:

- Cách nhanh nhất (đã cài Python): mở terminal tại thư mục này rồi chạy
  `python3 -m http.server 8000`, sau đó vào `http://localhost:8000/src/index.html`
- Hoặc dùng bất kỳ dịch vụ hosting tĩnh nào (GitHub Pages, Netlify, Vercel,
  Cloudflare Pages...): chỉ cần tải cả thư mục này lên, trỏ vào
  `src/index.html`.

## Khác gì so với bản Electron (desktop)?
- **Dữ liệu lưu trong trình duyệt** (localStorage + IndexedDB) của **từng
  máy/trình duyệt**, không đồng bộ giữa nhiều người dùng hay nhiều máy.
  Dùng mục "Dữ liệu và sao lưu" để xuất/nhập tệp JSON khi cần chuyển dữ
  liệu qua máy khác.
- Xoá dữ liệu duyệt web (clear browsing data) của trình duyệt sẽ xoá luôn
  dữ liệu ứng dụng — nên sao lưu định kỳ.
- Không có kho 246 tài liệu PDF nguồn (thư mục `program-documents/`) vì
  các PDF gốc không có trong gói này — phần "Kho chương trình" sẽ hiển thị
  danh sách nhưng không mở được PDF cho tới khi bạn tự thêm thư mục
  `program-documents/` cạnh `src/` với các tệp PDF tương ứng.
- Mật khẩu được băm bằng PBKDF2-SHA256 (Web Crypto có sẵn trong trình
  duyệt) thay vì bcrypt — độ an toàn tương đương, không cần thư viện
  ngoài.
- Lần đầu chạy vẫn sẽ yêu cầu "Thiết lập tài khoản quản trị đầu tiên"
  giống bản desktop.
