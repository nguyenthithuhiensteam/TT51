import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword as updateFirebasePassword,
} from "firebase/auth";
import { addDoc, collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, googleProvider, usernameToAuthEmail } from "../firebase";
import { COL, db, nowIso } from "./client";
import type { User } from "./types";

export class AuthError extends Error {}

export interface LoginResult {
  user: User;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

interface UserProfileDoc {
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  must_change_password: number;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  roleCodes: string[];
  permissionCodes: string[];
}

function mapProfileToUser(uid: string, data: UserProfileDoc): User {
  return {
    id: uid,
    username: data.username,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    password_hash: "",
    password_algo: "firebase",
    must_change_password: data.must_change_password,
    failed_login_count: 0,
    locked_until: null,
    last_login_at: data.last_login_at,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
    deleted_at: null,
  };
}

/** Đăng nhập qua Firebase Auth (username được ánh xạ sang email nội bộ). Firebase Auth tự
 * xử lý khoá tạm thời khi sai mật khẩu nhiều lần (auth/too-many-requests) nên không cần tự
 * đếm/khoá như bản SQLite. */
export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const email = usernameToAuthEmail(username);
  let uid: string;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/too-many-requests") {
      throw new AuthError(
        "Tài khoản tạm thời bị hạn chế do đăng nhập sai nhiều lần. Vui lòng thử lại sau ít phút.",
      );
    }
    throw new AuthError("Tên đăng nhập hoặc mật khẩu không đúng");
  }

  const ref = doc(db, COL.users, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await signOut(auth);
    throw new AuthError("Tài khoản chưa được khởi tạo hồ sơ, liên hệ quản trị viên");
  }
  const data = snap.data() as UserProfileDoc;
  if (!data.is_active) {
    await signOut(auth);
    throw new AuthError("Tài khoản đã bị khóa, liên hệ quản trị viên");
  }

  const ts = nowIso();
  await updateDoc(ref, { last_login_at: ts, updated_at: ts });
  await logAudit({ entityTable: "users", entityId: uid, action: "login", userId: uid, sessionId: uid });

  return {
    user: mapProfileToUser(uid, data),
    roles: data.roleCodes ?? [],
    permissions: data.permissionCodes ?? [],
    sessionId: uid,
  };
}

/** Đăng nhập bằng tài khoản Google (chỉ bản web thật). Tài khoản Google lần đầu đăng nhập sẽ
 * được tạo hồ sơ ở trạng thái "chờ duyệt" (is_active=0, chưa có quyền gì) và bị đăng xuất ngay —
 * quản trị viên phải vào "Cài đặt → Quản lý tài khoản & phân quyền" để phê duyệt và gán quyền
 * trước khi tài khoản đó đăng nhập được. */
export async function loginWithGoogle(): Promise<LoginResult> {
  let cred;
  try {
    cred = await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw new AuthError("Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.");
    }
    throw new AuthError("Không thể đăng nhập bằng Google, vui lòng thử lại.");
  }
  const uid = cred.user.uid;
  const ref = doc(db, COL.users, uid);
  const snap = await getDoc(ref);
  const ts = nowIso();

  if (!snap.exists()) {
    await setDoc(ref, {
      username: cred.user.email ?? uid,
      full_name: cred.user.displayName || cred.user.email || "Tài khoản Google",
      email: cred.user.email ?? null,
      phone: null,
      must_change_password: 0,
      is_active: 0,
      last_login_at: null,
      created_at: ts,
      updated_at: ts,
      roleCodes: [],
      permissionCodes: [],
      authProvider: "google",
    });
    await logAudit({
      entityTable: "users",
      entityId: uid,
      action: "google_signup",
      userId: uid,
      sessionId: uid,
    });
    await signOut(auth);
    throw new AuthError(
      "Tài khoản Google của bạn đã được ghi nhận và đang chờ quản trị viên phê duyệt quyền truy cập.",
    );
  }

  const data = snap.data() as UserProfileDoc;
  if (!data.is_active) {
    await signOut(auth);
    throw new AuthError("Tài khoản đang chờ quản trị viên phê duyệt quyền truy cập.");
  }

  await updateDoc(ref, { last_login_at: ts, updated_at: ts });
  await logAudit({ entityTable: "users", entityId: uid, action: "login", userId: uid, sessionId: uid });

  return {
    user: mapProfileToUser(uid, data),
    roles: data.roleCodes ?? [],
    permissions: data.permissionCodes ?? [],
    sessionId: uid,
  };
}

/** Đổi mật khẩu: Firebase yêu cầu xác thực lại (reauthenticate) trước khi đổi mật khẩu vì lý do
 * bảo mật (thao tác nhạy cảm cần phiên đăng nhập "gần đây"). */
export async function changePassword(
  user: User,
  currentPassword: string,
  newPassword: string,
  _sessionId: string | null,
): Promise<void> {
  const current = auth.currentUser;
  if (!current || !current.email) {
    throw new AuthError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
  }
  try {
    await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, currentPassword));
  } catch {
    throw new AuthError("Mật khẩu hiện tại không đúng");
  }
  await updateFirebasePassword(current, newPassword);

  const ref = doc(db, COL.users, user.id);
  const ts = nowIso();
  await updateDoc(ref, { must_change_password: 0, updated_at: ts });
  await logAudit({
    entityTable: "users",
    entityId: user.id,
    action: "change_password",
    userId: user.id,
    sessionId: user.id,
  });
}

/** Cập nhật thông tin cá nhân của chính tài khoản đang đăng nhập (họ tên, email, điện thoại). */
export async function updateMyProfile(
  userId: string,
  data: { fullName: string; email?: string | null; phone?: string | null },
): Promise<void> {
  const ref = doc(db, COL.users, userId);
  const ts = nowIso();
  await updateDoc(ref, {
    full_name: data.fullName,
    email: data.email ?? null,
    phone: data.phone ?? null,
    updated_at: ts,
  });
  await logAudit({
    entityTable: "users",
    entityId: userId,
    action: "update_profile",
    userId,
    sessionId: userId,
  });
}

export async function logAudit(entry: {
  entityTable: string;
  entityId: string;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  userId: string | null;
  sessionId: string | null;
  deviceInfo?: string;
}): Promise<void> {
  await addDoc(collection(db, COL.auditLogs), {
    entity_table: entry.entityTable,
    entity_id: entry.entityId,
    action: entry.action,
    before_json: entry.beforeJson ?? null,
    after_json: entry.afterJson ?? null,
    user_id: entry.userId,
    session_id: entry.sessionId,
    device_info: entry.deviceInfo ?? navigator.userAgent,
    created_at: nowIso(),
  });
}
