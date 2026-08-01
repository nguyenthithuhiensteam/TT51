// getSchool/getCurrentSchoolYear đã chuyển sang Firestore thật (cần cho đăng nhập). Các hàm
// còn lại (quản lý năm học ở màn hình Cài đặt) TỰ ĐỘNG SINH — chưa triển khai. Quản lý tài
// khoản/phân quyền (Đợt 10) đã chuyển sang Firestore thật bên dưới.
import { collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore";
import { logAudit } from "./authRepo";
import { COL, db, nowIso } from "./client";
import type { School, SchoolYear, User, UserAccountWithAccess } from "./types";

function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "systemRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function getSchool(): Promise<School | null> {
  const snap = await getDocs(query(collection(db, COL.schools), limit(1)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<School, "id">) };
}

export async function updateSchool(..._args: unknown[]): Promise<never> {
  return notImplemented("updateSchool");
}

export async function listSchoolYears(..._args: unknown[]): Promise<never> {
  return notImplemented("listSchoolYears");
}

export async function getCurrentSchoolYear(schoolId: string): Promise<SchoolYear | null> {
  const snap = await getDocs(
    query(collection(db, COL.schoolYears), where("school_id", "==", schoolId), where("is_current", "==", 1), limit(1)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<SchoolYear, "id">) };
}

export async function createSchoolYear(..._args: unknown[]): Promise<never> {
  return notImplemented("createSchoolYear");
}

export async function setCurrentSchoolYear(..._args: unknown[]): Promise<never> {
  return notImplemented("setCurrentSchoolYear");
}

export async function listActiveUsers(): Promise<User[]> {
  const snap = await getDocs(
    query(collection(db, COL.users), where("is_active", "==", 1), orderBy("full_name", "asc")),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      username: data.username,
      full_name: data.full_name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      password_hash: "",
      password_algo: "firebase",
      must_change_password: data.must_change_password ?? 0,
      failed_login_count: 0,
      locked_until: null,
      last_login_at: data.last_login_at ?? null,
      is_active: data.is_active ?? 1,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: null,
    } satisfies User;
  });
}

export async function listRoles(..._args: unknown[]): Promise<never> {
  return notImplemented("listRoles");
}

export async function isUsernameTaken(..._args: unknown[]): Promise<never> {
  return notImplemented("isUsernameTaken");
}

export async function createUserAccount(..._args: unknown[]): Promise<never> {
  return notImplemented("createUserAccount");
}

// ============ Quản lý tài khoản & phân quyền (Đợt 10, chỉ bản web thật) ============

function mapAccount(id: string, data: Record<string, unknown>): UserAccountWithAccess {
  return {
    id,
    username: (data.username as string) ?? "",
    full_name: (data.full_name as string) ?? "",
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    password_hash: "",
    password_algo: "firebase",
    must_change_password: (data.must_change_password as number) ?? 0,
    failed_login_count: 0,
    locked_until: null,
    last_login_at: (data.last_login_at as string | null) ?? null,
    is_active: (data.is_active as number) ?? 0,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    deleted_at: null,
    permissionCodes: (data.permissionCodes as string[]) ?? [],
    roleCodes: (data.roleCodes as string[]) ?? [],
    authProvider: (data.authProvider as "password" | "google") ?? "password",
  };
}

/** Danh sách toàn bộ tài khoản (kể cả đang chờ duyệt) cho màn hình quản trị — chỉ người có
 * quyền system.edit mới gọi được (thực thi lại ở Firestore Security Rules). */
export async function listAllUserAccounts(): Promise<UserAccountWithAccess[]> {
  const snap = await getDocs(query(collection(db, COL.users), orderBy("created_at", "desc")));
  return snap.docs.map((d) => mapAccount(d.id, d.data()));
}

/** Phê duyệt một tài khoản đang chờ (thường là tài khoản Google mới đăng nhập lần đầu), gán
 * quyền ngay lúc duyệt. */
export async function approveUserAccount(
  userId: string,
  permissionCodes: string[],
  approvedBy: string,
): Promise<void> {
  const ts = nowIso();
  await updateDoc(doc(db, COL.users, userId), {
    is_active: 1,
    permissionCodes,
    updated_at: ts,
  });
  await logAudit({
    entityTable: "users",
    entityId: userId,
    action: "approve",
    afterJson: { permissionCodes },
    userId: approvedBy,
    sessionId: approvedBy,
  });
}

/** Cập nhật lại danh sách quyền của một tài khoản đã được duyệt. */
export async function updateUserPermissions(
  userId: string,
  permissionCodes: string[],
  updatedBy: string,
): Promise<void> {
  const ts = nowIso();
  await updateDoc(doc(db, COL.users, userId), { permissionCodes, updated_at: ts });
  await logAudit({
    entityTable: "users",
    entityId: userId,
    action: "update_permissions",
    afterJson: { permissionCodes },
    userId: updatedBy,
    sessionId: updatedBy,
  });
}

/** Khoá/mở khoá một tài khoản (không xoá dữ liệu — is_active=0 chặn đăng nhập ở loginWithPassword
 * và loginWithGoogle). */
export async function setUserAccountActive(
  userId: string,
  isActive: boolean,
  updatedBy: string,
): Promise<void> {
  const ts = nowIso();
  await updateDoc(doc(db, COL.users, userId), { is_active: isActive ? 1 : 0, updated_at: ts });
  await logAudit({
    entityTable: "users",
    entityId: userId,
    action: isActive ? "activate" : "deactivate",
    userId: updatedBy,
    sessionId: updatedBy,
  });
}
