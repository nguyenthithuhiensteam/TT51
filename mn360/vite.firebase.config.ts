import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Cấu hình build bản web THẬT (không phải bản xem trước sql.js ở vite.web.config.ts) —
 * dữ liệu lưu vĩnh viễn trên Firestore, đăng nhập qua Firebase Auth. Alias "@/lib/db" trỏ
 * sang "@/lib/db-firebase" (các phân hệ chưa chuyển đổi chỉ là stub báo "chưa hỗ trợ").
 *
 * Chạy: npm run build:firebase  →  kết quả ở dist-firebase/
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: "public-web",
  define: {
    __IS_WEB_PREVIEW__: "false",
    __ENABLE_GOOGLE_LOGIN__: "true",
  },
  resolve: {
    alias: [
      { find: "@/lib/db", replacement: path.resolve(__dirname, "src/lib/db-firebase") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  build: {
    outDir: "dist-firebase",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-docx": ["docx"],
          "vendor-exceljs": ["exceljs"],
          "vendor-jspdf": ["jspdf", "jspdf-autotable"],
          "vendor-recharts": ["recharts"],
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
        },
      },
    },
  },
});
