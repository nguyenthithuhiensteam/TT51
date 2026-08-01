import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Cấu hình build "bản xem trước trình duyệt" (web preview) — dùng để xem giao diện/luồng
 * thao tác MN360 trong trình duyệt thường, KHÔNG phải bản đóng gói desktop chính thức.
 * Thay `@tauri-apps/*` bằng các shim trong `src/lib/webshim/` (SQLite qua sql.js, mật khẩu
 * demo giả lập, không có sao lưu/khôi phục tệp/AI Gateway thật).
 *
 * Chạy: npm run build:web  →  kết quả ở dist-web/, mở qua một static server cục bộ
 * (ví dụ: npx serve dist-web) vì trình duyệt chặn ES module tải qua file://.
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: "public-web",
  define: {
    __IS_WEB_PREVIEW__: "true",
    __ENABLE_GOOGLE_LOGIN__: "false",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tauri-apps/api/core": path.resolve(__dirname, "src/lib/webshim/core.ts"),
      "@tauri-apps/plugin-sql": path.resolve(__dirname, "src/lib/webshim/pluginSql.ts"),
      "@tauri-apps/plugin-dialog": path.resolve(__dirname, "src/lib/webshim/pluginDialog.ts"),
    },
  },
  build: {
    outDir: "dist-web",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-docx": ["docx"],
          "vendor-exceljs": ["exceljs"],
          "vendor-jspdf": ["jspdf", "jspdf-autotable"],
          "vendor-recharts": ["recharts"],
        },
      },
    },
  },
});
