// getSchool/getCurrentSchoolYear đã chuyển sang Firestore thật (cần cho đăng nhập). Các hàm
// còn lại (quản lý năm học, tài khoản ở màn hình Cài đặt) TỰ ĐỘNG SINH — chưa triển khai.
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { COL, db } from "./client";
import type { School, SchoolYear, User } from "./types";

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
