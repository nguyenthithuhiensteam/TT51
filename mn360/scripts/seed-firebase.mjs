// Khởi tạo dữ liệu ban đầu cho bản web thật: 1 trường, 1 năm học hiện tại, và tài khoản đăng
// nhập thật đầu tiên (Firebase Auth + hồ sơ Firestore). An toàn để CHẠY LẠI nhiều lần khi có
// phân hệ mới được chuyển đổi — chỉ cập nhật thêm quyền (permissionCodes), không đụng tới mật
// khẩu/trạng thái đã đổi của tài khoản. Dùng Firebase Auth SDK phía client (không cần service
// account/Cloud Functions) — script tự đăng nhập bằng tài khoản vừa tạo để ghi hồ sơ của chính
// tài khoản đó (đúng theo rules).
//
// Chạy: node scripts/seed-firebase.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
if (!existsSync(envPath)) {
  console.error("Không tìm thấy .env.local — cần cấu hình Firebase trước khi seed.");
  process.exit(1);
}
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const ADMIN_USERNAME = "hieutruong";
const ADMIN_EMAIL = `${ADMIN_USERNAME}@mn360.internal`;
const ADMIN_PASSWORD = "MN360@2026";
const SCHOOL_ID = "school-1";
const SCHOOL_YEAR_ID = "sy-2025-2026";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  console.log("Đang tạo tài khoản Firebase Auth:", ADMIN_EMAIL);
  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = cred.user.uid;
    console.log("Đã tạo tài khoản mới, uid =", uid);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.log("Tài khoản đã tồn tại, đăng nhập lại để lấy uid...");
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      uid = cred.user.uid;
    } else {
      throw err;
    }
  }

  const ts = new Date().toISOString();

  console.log("Ghi hồ sơ trường...");
  await setDoc(doc(db, "mn360_schools", SCHOOL_ID), {
    code: "MN360",
    name: "Trường Mầm non Tràng Đà",
    address: null,
    phone: null,
    principal_name: "Nguyễn Thị Hiền",
    data_dir: null,
    logo_path: null,
    created_at: ts,
    updated_at: ts,
  });

  console.log("Ghi năm học hiện tại...");
  await setDoc(doc(db, "mn360_school_years", SCHOOL_YEAR_ID), {
    school_id: SCHOOL_ID,
    code: "2025-2026",
    start_date: "2025-09-01",
    end_date: "2026-05-31",
    is_current: 1,
    created_at: ts,
    updated_at: ts,
  });

  const PERMISSION_CODES = [
    "dashboard.view",
    "task.view",
    "task.create",
    "task.edit",
    "task.export",
    "task.submit",
    "task.approve",
    "children.view",
    "children.create",
    "children.edit",
    "children.export",
    "children.approve",
    "staff.view",
    "staff.create",
    "staff.edit",
    "staff.approve",
  ];

  const userRef = doc(db, "mn360_users", uid);
  const existingProfile = await getDoc(userRef);
  if (existingProfile.exists()) {
    console.log("Hồ sơ đã tồn tại — chỉ cập nhật quyền theo các đợt đã xây (giữ nguyên mật khẩu/trạng thái đã đổi)...");
    await setDoc(userRef, { roleCodes: ["hieu_truong"], permissionCodes: PERMISSION_CODES, updated_at: ts }, { merge: true });
  } else {
    console.log("Ghi hồ sơ tài khoản quản trị lần đầu...");
    await setDoc(userRef, {
      username: ADMIN_USERNAME,
      full_name: "Nguyễn Thị Hiền",
      email: null,
      phone: null,
      must_change_password: 1,
      is_active: 1,
      last_login_at: null,
      created_at: ts,
      updated_at: ts,
      roleCodes: ["hieu_truong"],
      permissionCodes: PERMISSION_CODES,
    });
  }

  console.log("\nXong! Đăng nhập thử với:");
  console.log("  Tên đăng nhập:", ADMIN_USERNAME);
  console.log("  Mật khẩu:", ADMIN_PASSWORD, "(bắt buộc đổi ngay lần đầu)");
  process.exit(0);
}

main().catch((err) => {
  console.error("Lỗi khi seed:", err);
  process.exit(1);
});
