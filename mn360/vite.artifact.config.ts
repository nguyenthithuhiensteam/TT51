import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";

/**
 * Cấu hình build "bản xem trước — một tệp HTML duy nhất" để lưu trữ như một trang web tĩnh
 * (Artifact) và chia sẻ qua một đường dẫn. Dựa trên vite.web.config.ts (xem shim trong
 * src/lib/webshim/) nhưng gộp toàn bộ JS/CSS và nhúng luôn nhị phân sql-wasm-browser.wasm
 * dạng base64 (qua hằng số __SQL_WASM_BASE64__) để không cần tải thêm tệp nào qua mạng —
 * không dùng font tự host (rơi về phông hệ thống) để giảm dung lượng nhúng.
 *
 * Chạy: npm run build:artifact  →  kết quả artifact-dist/index.html (một tệp duy nhất).
 */
const wasmPath = path.resolve(__dirname, "node_modules/sql.js/dist/sql-wasm-browser.wasm");
const wasmBase64 = readFileSync(wasmPath).toString("base64");

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __SQL_WASM_BASE64__: JSON.stringify(wasmBase64),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tauri-apps/api/core": path.resolve(__dirname, "src/lib/webshim/core.ts"),
      "@tauri-apps/plugin-sql": path.resolve(__dirname, "src/lib/webshim/pluginSql.ts"),
      "@tauri-apps/plugin-dialog": path.resolve(__dirname, "src/lib/webshim/pluginDialog.ts"),
      "@fontsource/be-vietnam-pro/400.css": path.resolve(__dirname, "src/lib/webshim/emptyFont.css"),
      "@fontsource/be-vietnam-pro/500.css": path.resolve(__dirname, "src/lib/webshim/emptyFont.css"),
      "@fontsource/be-vietnam-pro/600.css": path.resolve(__dirname, "src/lib/webshim/emptyFont.css"),
      "@fontsource/be-vietnam-pro/700.css": path.resolve(__dirname, "src/lib/webshim/emptyFont.css"),
      docx: path.resolve(__dirname, "src/lib/webshim/docxStub.ts"),
      exceljs: path.resolve(__dirname, "src/lib/webshim/exceljsStub.ts"),
    },
  },
  build: {
    outDir: "artifact-dist",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
