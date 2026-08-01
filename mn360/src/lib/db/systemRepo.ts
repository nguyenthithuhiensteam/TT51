import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { Role, School, SchoolYear, User, UserAccountWithAccess } from "./types";

export async function getSchool(): Promise<School | null> {
  const rows = await dbSelect<School>("SELECT * FROM schools LIMIT 1");
  return rows[0] ?? null;
}

export async function updateSchool(
  id: string,
  data: { name: string; address?: string; phone?: string; principalName?: string },
): Promise<void> {
  await dbExecute(
    "UPDATE schools SET name = ?, address = ?, phone = ?, principal_name = ?, updated_at = ? WHERE id = ?",
    [data.name, data.address ?? null, data.phone ?? null, data.principalName ?? null, nowIso(), id],
  );
}

export async function listSchoolYears(schoolId: string): Promise<SchoolYear[]> {
  return dbSelect<SchoolYear>(
    "SELECT * FROM school_years WHERE school_id = ? ORDER BY start_date DESC",
    [schoolId],
  );
}

export async function getCurrentSchoolYear(schoolId: string): Promise<SchoolYear | null> {
  const rows = await dbSelect<SchoolYear>(
    "SELECT * FROM school_years WHERE school_id = ? AND is_current = 1 LIMIT 1",
    [schoolId],
  );
  return rows[0] ?? null;
}

export async function createSchoolYear(
  schoolId: string,
  code: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO school_years (id, school_id, code, start_date, end_date, is_current, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [newId(), schoolId, code, startDate, endDate, nowIso(), nowIso()],
  );
}

export async function setCurrentSchoolYear(schoolId: string, schoolYearId: string): Promise<void> {
  await dbExecute("UPDATE school_years SET is_current = 0, updated_at = ? WHERE school_id = ?", [
    nowIso(),
    schoolId,
  ]);
  await dbExecute("UPDATE school_years SET is_current = 1, updated_at = ? WHERE id = ?", [
    nowIso(),
    schoolYearId,
  ]);
}

export async function listActiveUsers(): Promise<User[]> {
  return dbSelect<User>(
    "SELECT * FROM users WHERE deleted_at IS NULL AND is_active = 1 ORDER BY full_name ASC",
  );
}

// ===================== QUẢN LÝ TÀI KHOẢN (chỉ system.edit) =====================

export async function listRoles(): Promise<Role[]> {
  return dbSelect<Role>("SELECT * FROM roles ORDER BY name ASC");
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE username = ?", [
    username,
  ]);
  return (rows[0]?.n ?? 0) > 0;
}

export interface CreateUserAccountInput {
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  roleId: string;
  passwordHash: string;
  createdBy: string;
  sessionId: string | null;
}

/** Tạo tài khoản đăng nhập mới, gán 1 vai trò, bắt buộc đổi mật khẩu ở lần đăng nhập đầu. */
export async function createUserAccount(input: CreateUserAccountInput): Promise<string> {
  const id = newId();
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO users (id, username, full_name, email, phone, password_hash, password_algo,
      must_change_password, failed_login_count, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'argon2id', 1, 0, 1, ?, ?)`,
    [id, input.username, input.fullName, input.email ?? null, input.phone ?? null, input.passwordHash, ts, ts],
  );
  await dbExecute("INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)", [
    newId(),
    id,
    input.roleId,
    ts,
  ]);
  await logAudit({
    entityTable: "users",
    entityId: id,
    action: "create",
    afterJson: { username: input.username, fullName: input.fullName, roleId: input.roleId },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });
  return id;
}

// ===================== Quản lý tài khoản chờ duyệt (chỉ bản web thật/đăng nhập Google) =====
// Bản desktop không có khái niệm tài khoản Google chờ duyệt (tài khoản luôn được quản trị viên
// tạo sẵn qua createUserAccount ở trên) — các hàm dưới đây chỉ tồn tại để màn hình Cài đặt (dùng
// chung UI) biên dịch được, không bao giờ thực sự được gọi trên desktop vì bị ẩn qua
// __ENABLE_GOOGLE_LOGIN__.

function notSupportedOnDesktop(name: string): never {
  throw new Error(`${name}: chỉ áp dụng cho tài khoản đăng nhập Google trên bản web thật.`);
}

export async function listAllUserAccounts(): Promise<UserAccountWithAccess[]> {
  return notSupportedOnDesktop("listAllUserAccounts");
}

export async function approveUserAccount(..._args: unknown[]): Promise<never> {
  return notSupportedOnDesktop("approveUserAccount");
}

export async function updateUserPermissions(..._args: unknown[]): Promise<never> {
  return notSupportedOnDesktop("updateUserPermissions");
}

export async function setUserAccountActive(..._args: unknown[]): Promise<never> {
  return notSupportedOnDesktop("setUserAccountActive");
}
