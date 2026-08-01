import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __IS_WEB_PREVIEW__: "false",
    __ENABLE_GOOGLE_LOGIN__: "false",
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  clearScreen: false,
  build: {
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
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
