/**
 * Bản xem trước trình duyệt (web preview) — thay thế `@tauri-apps/api/core` để ứng dụng
 * chạy được trong trình duyệt thường mà không cần Tauri. CHỈ dùng để xem giao diện/luồng
 * thao tác; không phải bản desktop thật (không có Rust backend, không băm mật khẩu
 * Argon2id thật, không sao lưu/khôi phục tệp thật).
 */

const DEMO_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$tO36OSl1SqtW/l+CusEfqA$NQy+Exuo9C4n3moRiFY6Aj+SoNLXe85wN+X5fx+vqPE";
const DEMO_PASSWORD = "MN360@2026";

function fakeHash(password: string): string {
  return "webshim:" + btoa(unescape(encodeURIComponent(password)));
}

function verifyAgainstShimHash(hash: string, password: string): boolean {
  if (hash === DEMO_HASH) return password === DEMO_PASSWORD;
  if (hash.startsWith("webshim:")) {
    try {
      return decodeURIComponent(escape(atob(hash.slice("webshim:".length)))) === password;
    } catch {
      return false;
    }
  }
  return false;
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case "get_db_url":
      return "sqljs://browser-preview" as unknown as T;

    case "verify_password": {
      const { password, hash } = (args ?? {}) as { password: string; hash: string };
      return verifyAgainstShimHash(hash, password) as unknown as T;
    }

    case "hash_password": {
      const { password } = (args ?? {}) as { password: string };
      return fakeHash(password) as unknown as T;
    }

    case "ai_generate":
      throw new Error(
        "Cổng AI không khả dụng trong bản xem trước trình duyệt — chỉ hoạt động trong ứng dụng desktop thật có cấu hình khóa API.",
      );

    case "backup_database":
    case "restore_database":
    case "set_data_dir":
      throw new Error(
        "Thao tác với tệp/thư mục trên đĩa không khả dụng trong bản xem trước trình duyệt.",
      );

    case "list_backups":
      return [] as unknown as T;

    case "get_data_dir":
      return "(Bản xem trước trình duyệt — dữ liệu chỉ lưu tạm trong bộ nhớ, mất khi tải lại trang)" as unknown as T;

    case "save_attachment":
      throw new Error("Đính kèm tệp không khả dụng trong bản xem trước trình duyệt.");

    default:
      throw new Error(`Lệnh "${cmd}" không được hỗ trợ trong bản xem trước trình duyệt.`);
  }
}
