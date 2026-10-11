# Trường Mầm non Số — máy chủ gộp (Python/FastAPI)

Gộp KH GDMN (bản Node ở `../ctgdmn-windows-fixed`) và CT388 (`ct388/`, phục vụ tại `/ct388`) thành một service.

Triển khai: `docker build -f truong-mn-so/Dockerfile .` từ gốc repo, hoặc Render Blueprint `render.yaml` ở gốc repo.

## Chạy trên máy

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m uvicorn backend.main:app --port 8787
```

- Không đặt `DATABASE_URL` → dữ liệu lưu ở `data/truong-mn-so.sqlite`.
- Có `DATABASE_URL` (Postgres trên Render) → dùng chung CSDL với CT388; bảng KH GDMN có tiền tố `kh_`.
- Kiểm thử: `.venv/Scripts/python -m pytest -q` (SQLite) và `.venv/Scripts/python tests/run_postgres.py` (Postgres nhúng)
- Xuất PDF trên Windows: đặt `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge có sẵn (Docker dùng Chromium kèm Playwright).
- Đối chiếu Word với bản Node cần `npm ci --omit=dev --ignore-scripts` trong `../ctgdmn-windows-fixed`.

## Tiến độ chuyển từ Node

| Nhóm API | Trạng thái |
|---|---|
| Đăng nhập, tài khoản, yêu cầu cấp tài khoản | Xong |
| Hồ sơ trẻ, đánh giá trẻ, ngân hàng mục tiêu | Xong |
| Kho kế hoạch, quy trình duyệt, cấu hình, nhật ký, sao lưu/khôi phục | Xong |
| Mẫu DOCX (danh sách, nhập, mặc định, sao lưu) — lưu trong CSDL | Xong |
| Video trực tuyến | Xong |
| AI (cấu hình, thử kết nối, soạn/cải thiện/rà soát) | Xong — Claude qua thư viện `anthropic`, structured outputs |
| Xuất Word (kể cả mẫu tùy chỉnh), Excel, PDF | Xong — nội dung Word khớp bản Node |
| Nhập Word/Excel/PDF, kho PDF chương trình, hướng dẫn | Xong — PDF bổ sung lưu trong CSDL |
| Video MP4 ngoại tuyến | Chưa |
| CT388 gắn tại `/ct388` (mã chép từ repo CTGDMN_388 @ c47ff3e) | Xong — đăng nhập vẫn riêng |
| Dockerfile + `render.yaml` (service mới `truong-mn-so`) | Đã viết, chưa build thử (máy không có Docker) |

Các API chưa chuyển trả về mã 501 kèm thông báo tiếng Việt.
