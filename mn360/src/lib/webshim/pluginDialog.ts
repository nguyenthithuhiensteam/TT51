/**
 * Bản xem trước trình duyệt — thay thế `@tauri-apps/plugin-dialog`. Trình duyệt thường
 * không cho phép chọn tệp/thư mục hệ thống theo cách Tauri hỗ trợ, nên hộp thoại luôn trả
 * về "không chọn gì" — các nút liên quan (đính kèm tệp, chọn thư mục sao lưu...) vẫn hiển
 * thị và bấm được, chỉ không thực hiện được thao tác tệp thật.
 */
export async function open(_options?: unknown): Promise<string | string[] | null> {
  return null;
}

export async function save(_options?: unknown): Promise<string | null> {
  return null;
}
