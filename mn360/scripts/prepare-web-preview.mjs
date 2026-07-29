// Sao chép tệp nhị phân sql-wasm-browser.wasm từ sql.js vào public-web/ trước khi build
// bản xem trước trình duyệt (npm run build:web). Không commit tệp nhị phân này vào git —
// script này tái tạo lại từ node_modules mỗi lần build.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(rootDir, "node_modules/sql.js/dist/sql-wasm-browser.wasm");
const destDir = path.join(rootDir, "public-web");
const dest = path.join(destDir, "sql-wasm-browser.wasm");

if (!existsSync(src)) {
  console.error("Không tìm thấy sql.js — chạy `npm install` trước.");
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("Đã chuẩn bị public-web/sql-wasm-browser.wasm");
