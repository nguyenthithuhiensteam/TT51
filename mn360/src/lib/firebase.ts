import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Tạo một app Firebase phụ dùng riêng cho thao tác "tạo tài khoản đăng nhập mới" ở màn hình
 * Cài đặt. `createUserWithEmailAndPassword` trên app chính sẽ tự đăng nhập luôn vào tài khoản
 * mới tạo và đăng xuất quản trị viên đang thao tác — dùng app phụ (dùng xong huỷ ngay) để
 * tránh làm mất phiên đăng nhập hiện tại, không cần máy chủ/Cloud Functions.
 */
export async function withSecondaryAuthApp<T>(fn: (secondaryAuth: ReturnType<typeof getAuth>) => Promise<T>): Promise<T> {
  const name = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, name);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    return await fn(secondaryAuth);
  } finally {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }
}

/** Username nội bộ không phải email thật — Firebase Auth Email/Password cần định dạng email. */
export function usernameToAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@mn360.internal`;
}
