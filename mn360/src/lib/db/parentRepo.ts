// Lớp truy cập dữ liệu Phụ huynh — MỌI hàm đều tự suy ra danh sách trẻ hợp lệ từ userId đăng
// nhập (qua guardians.user_id → child_guardians), không bao giờ tin child_id gửi trực tiếp từ
// giao diện mà không kiểm tra quyền sở hữu trước.
import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import type { AttendanceStatus, LeaveRequestStatus } from "./types";

async function getGuardianIdForUser(userId: string): Promise<string | null> {
  const rows = await dbSelect<{ id: string }>("SELECT id FROM guardians WHERE user_id = ?", [userId]);
  return rows[0]?.id ?? null;
}

async function assertGuardianOwnsChild(guardianId: string, childId: string): Promise<void> {
  const rows = await dbSelect<{ n: number }>(
    "SELECT COUNT(*) AS n FROM child_guardians WHERE guardian_id = ? AND child_id = ?",
    [guardianId, childId],
  );
  if ((rows[0]?.n ?? 0) === 0) {
    throw new Error("Bạn không có quyền xem thông tin của trẻ này");
  }
}

export interface MyChildRow {
  id: string;
  code: string;
  full_name: string;
  dob: string;
  gender: "male" | "female";
  class_id: string | null;
  class_name: string | null;
  status: string;
}

export async function listMyChildren(userId: string): Promise<MyChildRow[]> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) return [];
  return dbSelect<MyChildRow>(
    `SELECT ch.id, ch.code, ch.full_name, ch.dob, ch.gender, ch.class_id, cl.name AS class_name, ch.status
     FROM children ch
     JOIN child_guardians cg ON cg.child_id = ch.id
     LEFT JOIN classes cl ON cl.id = ch.class_id
     WHERE cg.guardian_id = ? AND ch.deleted_at IS NULL
     ORDER BY ch.full_name`,
    [guardianId],
  );
}

export interface MyAttendanceRow {
  attendance_date: string;
  status: AttendanceStatus;
  note: string | null;
}

export async function getMyChildAttendance(
  userId: string,
  childId: string,
  fromDate: string,
  toDate: string,
): Promise<MyAttendanceRow[]> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) return [];
  await assertGuardianOwnsChild(guardianId, childId);
  return dbSelect<MyAttendanceRow>(
    `SELECT attendance_date, status, note FROM attendance
     WHERE child_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date DESC`,
    [childId, fromDate, toDate],
  );
}

export interface MyMenuRow {
  menu_date: string;
  status: string;
  items: { meal_slot: string; dish_name: string }[];
}

export async function getTodayMenuForChild(userId: string, childId: string): Promise<MyMenuRow | null> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) return null;
  await assertGuardianOwnsChild(guardianId, childId);

  const childRows = await dbSelect<{ class_id: string | null }>("SELECT class_id FROM children WHERE id = ?", [childId]);
  const classId = childRows[0]?.class_id;
  if (!classId) return null;

  const today = new Date().toISOString().slice(0, 10);
  const menuRows = await dbSelect<{ id: string; menu_date: string; status: string }>(
    `SELECT id, menu_date, status FROM menus
     WHERE class_id = ? AND menu_date = ? AND status IN ('approved','published') AND deleted_at IS NULL`,
    [classId, today],
  );
  const menu = menuRows[0];
  if (!menu) return null;

  const items = await dbSelect<{ meal_slot: string; dish_name: string }>(
    `SELECT mi.meal_slot, d.name AS dish_name FROM menu_items mi
     JOIN dishes d ON d.id = mi.dish_id
     WHERE mi.menu_id = ? ORDER BY mi.meal_slot`,
    [menu.id],
  );
  return { menu_date: menu.menu_date, status: menu.status, items };
}

export interface MyRevenueRow {
  code: string;
  fee_item_name: string | null;
  amount: number;
  revenue_date: string;
  status: string;
}

export async function getMyChildRevenues(userId: string, childId: string): Promise<MyRevenueRow[]> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) return [];
  await assertGuardianOwnsChild(guardianId, childId);
  return dbSelect<MyRevenueRow>(
    `SELECT r.code, fi.name AS fee_item_name, r.amount, r.revenue_date, r.status
     FROM revenues r LEFT JOIN fee_items fi ON fi.id = r.fee_item_id
     WHERE r.child_id = ? ORDER BY r.revenue_date DESC`,
    [childId],
  );
}

export interface MyLeaveRequestRow {
  id: string;
  code: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveRequestStatus;
  decision_note: string | null;
}

export async function listMyLeaveRequests(userId: string, childId: string): Promise<MyLeaveRequestRow[]> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) return [];
  await assertGuardianOwnsChild(guardianId, childId);
  return dbSelect<MyLeaveRequestRow>(
    "SELECT id, code, start_date, end_date, reason, status, decision_note FROM child_leave_requests WHERE child_id = ? ORDER BY created_at DESC",
    [childId],
  );
}

async function nextLeaveRequestSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM child_leave_requests", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createLeaveRequest(
  userId: string,
  childId: string,
  startDate: string,
  endDate: string,
  reason: string,
): Promise<void> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) throw new Error("Tài khoản chưa được liên kết với hồ sơ phụ huynh");
  await assertGuardianOwnsChild(guardianId, childId);
  const seq = await nextLeaveRequestSequence();
  const year = new Date().getFullYear();
  const code = `XN-${year}-${String(seq).padStart(4, "0")}`;
  await dbExecute(
    `INSERT INTO child_leave_requests (id, code, child_id, guardian_id, start_date, end_date, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?)`,
    [newId(), code, childId, guardianId, startDate, endDate, reason, nowIso()],
  );
}

export interface ParentMessageRow {
  id: string;
  sender_role: "parent" | "teacher";
  sender_name: string;
  content: string;
  created_at: string;
}

export async function listMyMessages(userId: string, childId: string): Promise<ParentMessageRow[]> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) return [];
  await assertGuardianOwnsChild(guardianId, childId);
  return dbSelect<ParentMessageRow>(
    `SELECT pm.id, pm.sender_role, u.full_name AS sender_name, pm.content, pm.created_at
     FROM parent_messages pm JOIN users u ON u.id = pm.sender_user_id
     WHERE pm.child_id = ? ORDER BY pm.created_at ASC`,
    [childId],
  );
}

export async function sendMessageAsParent(userId: string, childId: string, content: string): Promise<void> {
  const guardianId = await getGuardianIdForUser(userId);
  if (!guardianId) throw new Error("Tài khoản chưa được liên kết với hồ sơ phụ huynh");
  await assertGuardianOwnsChild(guardianId, childId);
  await dbExecute(
    "INSERT INTO parent_messages (id, child_id, guardian_id, sender_role, sender_user_id, content, is_read, created_at) VALUES (?, ?, ?, 'parent', ?, ?, 0, ?)",
    [newId(), childId, guardianId, userId, content, nowIso()],
  );
}
