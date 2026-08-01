import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword as updateFirebasePassword,
} from "firebase/auth";
import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, usernameToAuthEmail } from "../firebase";
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
