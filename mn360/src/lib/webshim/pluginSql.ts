/**
 * Bản xem trước trình duyệt — thay thế `@tauri-apps/plugin-sql`. Dùng sql.js (SQLite biên
 * dịch sang WebAssembly) chạy hoàn toàn trong trình duyệt thay cho SQLite thật qua Rust.
 * Áp dụng đúng các tệp migration 001-019 (giống hệt bản desktop) trên một CSDL nằm trong
 * bộ nhớ trình duyệt — mất dữ liệu khi tải lại trang, không phải nơi lưu trữ lâu dài.
 */
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";

// Bản "artifact" (một tệp HTML duy nhất, không tải tệp phụ qua mạng) truyền nhị phân wasm
// dạng base64 qua hằng số biên dịch này (xem vite.artifact.config.ts). Các bản build khác
// (web preview thường, dev, test) không định nghĩa hằng số này — tải sql-wasm-browser.wasm
// qua đường dẫn tương đối như bình thường.
declare const __SQL_WASM_BASE64__: string | undefined;

const migrationModules = import.meta.glob("../../../src-tauri/src/db/sql/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function sortedMigrationSql(): string[] {
  return Object.keys(migrationModules)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => migrationModules[key]);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
function ensureSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise =
      typeof __SQL_WASM_BASE64__ !== "undefined"
        ? initSqlJs({ wasmBinary: base64ToArrayBuffer(__SQL_WASM_BASE64__) })
        : initSqlJs({
            locateFile: (file: string) => new URL(file, document.baseURI).toString(),
          });
  }
  return sqlJsPromise;
}

let sharedDb: SqlJsDatabase | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

function initDatabase(): Promise<SqlJsDatabase> {
  if (!initPromise) {
    initPromise = ensureSqlJs().then((SQL) => {
      const db = new SQL.Database();
      for (const sql of sortedMigrationSql()) {
        db.run(sql);
      }
      sharedDb = db;
      return db;
    });
  }
  return initPromise;
}

export default class Database {
  private db: SqlJsDatabase;

  private constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  static async load(_url: string): Promise<Database> {
    const db = sharedDb ?? (await initDatabase());
    return new Database(db);
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never[]);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows as unknown as T;
    } finally {
      stmt.free();
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never[]);
      stmt.step();
    } finally {
      stmt.free();
    }
    return { rowsAffected: this.db.getRowsModified(), lastInsertId: 0 };
  }
}
