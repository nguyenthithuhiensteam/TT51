// Sau khi `vite build --config vite.artifact.config.ts` tạo artifact-dist/index.html +
// artifact-dist/assets/*.{js,css}, script này tự đọc đúng các tệp JS/CSS (đảm bảo đơn — nhờ
// inlineDynamicImports + cssCodeSplit:false trong vite.artifact.config.ts) và ghép thành
// artifact-dist/fragment.html — chỉ chứa nội dung "trong <body>", không có
// <!DOCTYPE>/<html>/<head>/<body>, đúng định dạng cần khi lưu trữ như một trang tĩnh.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, "artifact-dist");
const assetsDir = path.join(distDir, "assets");

const files = readdirSync(assetsDir);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));

if (!jsFile) {
  console.error("Không tìm thấy tệp JS trong artifact-dist/assets/ — build thất bại?");
  process.exit(1);
}

// Tránh đóng thẻ <script>/<style> sớm nếu mã nguồn có chứa chuỗi con "</script"/"</style"
// (an toàn về mặt ngữ nghĩa JS/CSS — chỉ ảnh hưởng cách trình duyệt phân tích HTML).
const js = readFileSync(path.join(assetsDir, jsFile), "utf-8").replace(/<\/script/gi, "<\\/script");
const css = cssFile
  ? readFileSync(path.join(assetsDir, cssFile), "utf-8").replace(/<\/style/gi, "<\\/style")
  : "";

const fragment = [
  '<div id="root"></div>',
  css ? `<style>${css}</style>` : "",
  `<script type="module">${js}</script>`,
].join("\n");

writeFileSync(path.join(distDir, "fragment.html"), fragment, "utf-8");
console.log(`Đã ghép fragment.html (${(fragment.length / 1024).toFixed(0)} KB) từ ${jsFile}${cssFile ? " + " + cssFile : ""}`);
