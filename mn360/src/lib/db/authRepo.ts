import { invoke } from "@tauri-apps/api/core";
import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import type { User } from "./types";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** Lỗi nghiệp vụ đăng nhập/đổi mật khẩu — message đã sẵn sàng hiển thị cho người dùng. */
export class AuthError extends Error {}

export interface LoginResult {
  user: User;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const rows = await dbSelect<User>(
    "SELECT * FROM users WHERE username = ? AND deleted_at IS NULL",
    [username],
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await dbSelect<User>("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [
    id,
  ]);
  return rows[0] ?? null;
}

export async function getUserPermissionCodes(userId: string): Promise<string[]> {
  const rows = await dbSelect<{ code: string }>(
    `SELECT DISTINCT p.code AS code
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = ?`,
    [userId],
  );
  return rows.map((r) => r.code);
}

export async function getUserRoleCodes(userId: string): Promise<string[]> {
  const rows = await dbSelect<{ code: string }>(
    `SELECT r.code AS code FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?`,
    [userId],
  );
  return rows.map((r) => r.code);
}

/** Ghi nhận đăng nhập sai; tự khóa tài khoản sau MAX_FAILED_ATTEMPTS lần liên tiếp. */
export async function recordFailedLogin(user: User): Promise<{ lockedUntil: string | null }> {
  const nextCount = user.failed_login_count + 1;
  let lockedUntil: string | null = null;
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
  }
  await dbExecute(
    "UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?",
    [nextCount, lockedUntil, nowIso(), user.id],
  );
  return { lockedUntil };
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await dbExecute(
    `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?,
     updated_at = ? WHERE id = ?`,
    [nowIso(), nowIso(), userId],
  );
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await dbExecute(
    `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`,
    [passwordHash, nowIso(), userId],
  );
}

export async function createSession(userId: string, deviceInfo: string): Promise<string> {
  const id = newId();
  await dbExecute(
    "INSERT INTO sessions (id, user_id, device_info, ip, created_at) VALUES (?, ?, ?, NULL, ?)",
    [id, userId, deviceInfo, nowIso()],
  );
  return id;
}

/** Đăng nhập bằng tài khoản cục bộ: kiểm tra khoá tài khoản, xác minh mật khẩu (Rust/Argon2id),
 * ghi nhận thành công/thất bại, mở phiên và tải vai trò/quyền. Ném AuthError với thông báo đã
 * sẵn sàng hiển thị nếu thất bại. */
export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const user = await findUserByUsername(username.trim());
  if (!user || !user.is_active) {
    throw new AuthError("Tên đăng nhập hoặc mật khẩu không đúng");
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const time = new Date(user.locked_until).toLocaleTimeString("vi-VN");
    throw new AuthError(`Tài khoản đang tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ${time}.`);
  }

  const ok = await invoke<boolean>("verify_password", {
    password,
    hash: user.password_hash,
  });
  if (!ok) {
    const { lockedUntil } = await recordFailedLogin(user);
    throw new AuthError(
      lockedUntil
        ? "Tài khoản đã bị khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút."
        : "Tên đăng nhập hoặc mật khẩu không đúng",
    );
  }

  await recordSuccessfulLogin(user.id);
  const [roles, permissions] = await Promise.all([
    getUserRoleCodes(user.id),
    getUserPermissionCodes(user.id),
  ]);
  const sessionId = await createSession(user.id, navigator.userAgent);
  await logAudit({
    entityTable: "users",
    entityId: user.id,
    action: "login",
    userId: user.id,
    sessionId,
  });
  return { user, roles, permissions, sessionId };
}

/** Đổi mật khẩu: xác minh mật khẩu hiện tại rồi băm/lưu mật khẩu mới (Rust/Argon2id). */
export async function changePassword(
  user: User,
  currentPassword: string,
  newPassword: string,
  sessionId: string | null,
): Promise<void> {
  const ok = await invoke<boolean>("verify_password", {
    password: currentPassword,
    hash: user.password_hash,
  });
  if (!ok) throw new AuthError("Mật khẩu hiện tại không đúng");
  const newHash = await invoke<string>("hash_password", { password: newPassword });
  await updatePassword(user.id, newHash);
  await logAudit({
    entityTable: "users",
    entityId: user.id,
    action: "change_password",
    userId: user.id,
    sessionId,
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
  await dbExecute(
    `INSERT INTO audit_logs
     (id, entity_table, entity_id, action, before_json, after_json, user_id, session_id, device_info, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      entry.entityTable,
      entry.entityId,
      entry.action,
      entry.beforeJson ? JSON.stringify(entry.beforeJson) : null,
      entry.afterJson ? JSON.stringify(entry.afterJson) : null,
      entry.userId,
      entry.sessionId,
      entry.deviceInfo ?? navigator.userAgent,
      nowIso(),
    ],
  );
}
