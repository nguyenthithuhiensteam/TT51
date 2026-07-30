# MN360 – Hệ điều hành trường mầm non số

Dự án xây dựng ứng dụng quản trị toàn diện cho trường mầm non công lập tại Việt Nam,
chạy local-first trên Windows (Tauri 2 + React + TypeScript + SQLite).

- Mã nguồn ứng dụng: [`mn360/`](./mn360)
- Tài liệu đặc tả và lộ trình: [`docs/`](./docs)
  - [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) — đặc tả sản phẩm
  - [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — mô hình dữ liệu
  - [`docs/PERMISSIONS.md`](./docs/PERMISSIONS.md) — ma trận phân quyền
  - [`docs/ROADMAP.md`](./docs/ROADMAP.md) — lộ trình xây dựng theo giai đoạn
  - [`docs/ACCEPTANCE_CRITERIA.md`](./docs/ACCEPTANCE_CRITERIA.md) — tiêu chí nghiệm thu
  - [`docs/HUONG_DAN_SU_DUNG.md`](./docs/HUONG_DAN_SU_DUNG.md) — hướng dẫn sử dụng theo phân hệ
  - [`docs/BAN_GIAO.md`](./docs/BAN_GIAO.md) — tài liệu bàn giao và vận hành

Xem hướng dẫn cài đặt, chạy thử và tài khoản demo trong [`mn360/README.md`](./mn360/README.md).

Trạng thái hiện tại: **Giai đoạn 0-6 đã hoàn thành** — nền tảng (cơ sở dữ liệu, đăng nhập,
phân quyền, cấu hình trường/năm học, giao diện chính, Tổng quan, Công việc, Văn phòng số, sao
lưu/khôi phục), nghiệp vụ cốt lõi (Trẻ em, Đội ngũ, Chuyên môn), chăm sóc/vận hành (Nuôi
dưỡng — gồm tính khẩu phần dinh dưỡng và chi phí, Sức khỏe – An toàn, Tài chính – Tài sản),
chất lượng/kết nối (Kiểm định, Công tác Đảng, Phụ huynh, AI Gateway), và hoàn thiện (tối ưu
hiệu năng, chuẩn hóa cấu hình đóng gói Windows, tài liệu sử dụng/bàn giao). Đồng bộ mạng LAN/
đám mây, thông báo đa kênh (cần hạ tầng máy chủ/dịch vụ ngoài) và bộ cài `.msi`/`.exe` thật
(cần build trên máy Windows) vẫn còn lại — chi tiết ở `docs/ROADMAP.md`.
