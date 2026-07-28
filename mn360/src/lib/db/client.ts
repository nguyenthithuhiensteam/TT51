import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

let dbPromise: Promise<Database> | null = null;

/**
 * Kết nối SQLite duy nhất dùng chung toàn ứng dụng. Đường dẫn CSDL được backend Rust
 * quyết định (theo thư mục dữ liệu người quản trị đã chọn), migrations đã chạy sẵn
 * trước khi cửa sổ hiển thị.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = invoke<string>("get_db_url").then((url) => Database.load(url));
  }
  return dbPromise;
}

export async function dbSelect<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

export async function dbExecute(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb();
  await db.execute(sql, params);
}

export function nowIso(): string {
  return new Date().toISOString();
}
