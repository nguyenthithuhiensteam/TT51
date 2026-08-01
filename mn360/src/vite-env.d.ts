/// <reference types="vite/client" />

/** true trong bản xem trước web/artifact (webshim), false trong bản desktop Tauri thật. */
declare const __IS_WEB_PREVIEW__: boolean;

/** true chỉ trong bản web thật (Firestore) — bật đăng nhập Google + màn hình quản lý tài
 * khoản/phân quyền, không có ý nghĩa trên bản desktop (chưa có khái niệm tài khoản chờ duyệt). */
declare const __ENABLE_GOOGLE_LOGIN__: boolean;
