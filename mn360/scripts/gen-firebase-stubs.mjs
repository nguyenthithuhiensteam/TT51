// Sinh các file "chưa triển khai" trong src/lib/db-firebase/ cho những phân hệ chưa được
// chuyển sang Firestore, để bản build web thật (vite.firebase.config.ts) có đủ file cần
// thiết mà không phải chép tay từng hàm. Chỉ chạy 1 lần khi cần thêm phân hệ mới; các file
// đã được người viết tay chuyển đổi thật (authRepo/taskRepo/systemRepo/client/types) sẽ
// không bị ghi đè trừ khi xoá đi trước.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDbDir = path.resolve(__dirname, "../src/lib/db");
const outDir = path.resolve(__dirname, "../src/lib/db-firebase");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Dùng: node scripts/gen-firebase-stubs.mjs <tenFile1.ts> <tenFile2.ts> ...");
  process.exit(1);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const fnRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
const constRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*[:=]/g;

for (const file of files) {
  const srcPath = path.join(srcDbDir, file);
  const outPath = path.join(outDir, file);
  if (existsSync(outPath)) {
    console.log(`Bỏ qua (đã có): ${file}`);
    continue;
  }
  const content = readFileSync(srcPath, "utf8");
  const names = new Set();
  for (const m of content.matchAll(fnRegex)) names.add(m[1]);
  for (const m of content.matchAll(constRegex)) names.add(m[1]);

  const moduleName = file.replace(/\.ts$/, "");
  const lines = [
    `// TỰ ĐỘNG SINH — phân hệ "${moduleName}" chưa được chuyển sang Firestore trên bản web.`,
    `// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.`,
    `function notImplemented(name: string): never {`,
    `  throw new Error(\`\${name}: phân hệ "${moduleName}" chưa hỗ trợ trên bản web (đang được xây dựng).\`);`,
    `}`,
    "",
  ];
  for (const name of names) {
    lines.push(`export async function ${name}(..._args: unknown[]): Promise<never> {`);
    lines.push(`  return notImplemented("${name}");`);
    lines.push(`}`);
    lines.push("");
  }
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Đã sinh: ${file} (${names.size} hàm)`);
}
