import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { PagedResult } from "./taskRepo";
import type { AttendanceStatus, Child, ChildStatus, Guardian, SchoolClass } from "./types";

// ===================== LỚP =====================

export interface ClassWithTeacher extends SchoolClass {
  teacher_name: string | null;
  child_count: number;
}

export async function listClasses(schoolYearId: string): Promise<ClassWithTeacher[]> {
  return dbSelect<ClassWithTeacher>(
    `SELECT c.*, u.full_name AS teacher_name,
       (SELECT COUNT(*) FROM children ch WHERE ch.class_id = c.id AND ch.deleted_at IS NULL AND ch.status = 'studying') AS child_count
     FROM classes c
     LEFT JOIN users u ON u.id = c.homeroom_teacher_id
     WHERE c.school_year_id = ? AND c.deleted_at IS NULL
     ORDER BY c.name ASC`,
    [schoolYearId],
  );
}

export async function getClassById(id: string): Promise<SchoolClass | null> {
  const rows = await dbSelect<SchoolClass>("SELECT * FROM classes WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export interface CreateClassInput {
  schoolYearId: string;
  code: string;
  name: string;
  ageGroup: string;
  homeroomTeacherId?: string;
  room?: string;
  capacity?: number;
  createdBy: string;
}

export async function createClass(input: CreateClassInput): Promise<string> {
  const id = newId();
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO classes (id, school_year_id, code, name, age_group, homeroom_teacher_id, room,
      capacity, status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, ?, ?, ?, ?)`,
    [
      id,
      input.schoolYearId,
      input.code,
      input.name,
      input.ageGroup,
      input.homeroomTeacherId ?? null,
      input.room ?? null,
      input.capacity ?? null,
      input.createdBy,
      ts,
      input.createdBy,
      ts,
    ],
  );
  return id;
}

// ===================== TRẺ EM =====================

export interface ChildWithClass extends Child {
  class_name: string | null;
}

export interface ChildListParams {
  search?: string;
  classId?: string | "all";
  status?: ChildStatus | "all";
  page?: number;
  pageSize?: number;
}

export async function listChildren(params: ChildListParams): Promise<PagedResult<ChildWithClass>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: string[] = ["c.deleted_at IS NULL"];
  const args: unknown[] = [];

  if (params.search) {
    where.push("(c.full_name LIKE ? OR c.code LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`);
  }
  if (params.classId && params.classId !== "all") {
    where.push("c.class_id = ?");
    args.push(params.classId);
  }
  if (params.status && params.status !== "all") {
    where.push("c.status = ?");
    args.push(params.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) AS total FROM children c ${whereSql}`,
    args,
  );
  const items = await dbSelect<ChildWithClass>(
    `SELECT c.*, cl.name AS class_name FROM children c
     LEFT JOIN classes cl ON cl.id = c.class_id
     ${whereSql}
     ORDER BY c.full_name ASC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize],
  );
  return { items, total: countRows[0]?.total ?? 0, page, pageSize };
}

export async function getChildById(id: string): Promise<ChildWithClass | null> {
  const rows = await dbSelect<ChildWithClass>(
    `SELECT c.*, cl.name AS class_name FROM children c
     LEFT JOIN classes cl ON cl.id = c.class_id
     WHERE c.id = ? AND c.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

async function nextChildSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM children", []);
  return (rows[0]?.n ?? 0) + 1;
}

export interface CreateChildInput {
  schoolYearId: string;
  classId?: string;
  fullName: string;
  dob: string;
  gender: "male" | "female";
  enrollmentDate: string;
  note?: string;
  createdBy: string;
  sessionId: string | null;
}

export async function createChild(input: CreateChildInput): Promise<string> {
  const id = newId();
  const seq = await nextChildSequence();
  const year = new Date().getFullYear();
  const code = `TRE-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();

  await dbExecute(
    `INSERT INTO children (id, code, school_year_id, class_id, full_name, dob, gender,
      enrollment_date, status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'studying', 1, ?, ?, ?, ?)`,
    [
      id,
      code,
      input.schoolYearId,
      input.classId ?? null,
      input.fullName,
      input.dob,
      input.gender,
      input.enrollmentDate,
      input.createdBy,
      ts,
      input.createdBy,
      ts,
    ],
  );

  await logAudit({
    entityTable: "children",
    entityId: id,
    action: "create",
    afterJson: { code, fullName: input.fullName },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return id;
}

export interface UpdateChildInput {
  classId?: string;
  fullName: string;
  dob: string;
  gender: "male" | "female";
  note?: string;
  updatedBy: string;
  sessionId: string | null;
}

export async function updateChild(id: string, input: UpdateChildInput): Promise<void> {
  await dbExecute(
    `UPDATE children SET class_id = ?, full_name = ?, dob = ?, gender = ?, note = ?,
     version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?`,
    [
      input.classId ?? null,
      input.fullName,
      input.dob,
      input.gender,
      input.note ?? null,
      input.updatedBy,
      nowIso(),
      id,
    ],
  );
  await logAudit({
    entityTable: "children",
    entityId: id,
    action: "update",
    afterJson: input,
    userId: input.updatedBy,
    sessionId: input.sessionId,
  });
}

/** Chuyển lớp/bảo lưu/chuyển trường/thôi học/hoàn thành chương trình — luôn ghi lịch sử. */
export async function changeChildStatus(
  id: string,
  toStatus: ChildStatus,
  changedBy: string,
  sessionId: string | null,
  note?: string,
  newClassId?: string,
): Promise<void> {
  const child = await getChildById(id);
  if (!child) throw new Error("Không tìm thấy hồ sơ trẻ");
  const fromStatus = child.status;

  await dbExecute(
    `UPDATE children SET status = ?, class_id = COALESCE(?, class_id), version = version + 1,
     updated_by = ?, updated_at = ? WHERE id = ?`,
    [toStatus, newClassId ?? null, changedBy, nowIso(), id],
  );

  await dbExecute(
    `INSERT INTO child_status_history (id, child_id, from_status, to_status, changed_by, changed_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), id, fromStatus, toStatus, changedBy, nowIso(), note ?? null],
  );

  await logAudit({
    entityTable: "children",
    entityId: id,
    action: `status_change:${fromStatus}->${toStatus}`,
    beforeJson: { status: fromStatus },
    afterJson: { status: toStatus, note },
    userId: changedBy,
    sessionId,
  });
}

export interface ChildStatusHistoryRow {
  id: string;
  from_status: ChildStatus | null;
  to_status: ChildStatus;
  changed_by_name: string;
  changed_at: string;
  note: string | null;
}

export async function listChildStatusHistory(childId: string): Promise<ChildStatusHistoryRow[]> {
  return dbSelect<ChildStatusHistoryRow>(
    `SELECT h.*, u.full_name AS changed_by_name FROM child_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.child_id = ? ORDER BY h.changed_at ASC`,
    [childId],
  );
}

// ===================== PHỤ HUYNH =====================

export interface GuardianOfChild extends Guardian {
  is_primary: number;
  can_pickup: number;
}

export async function listGuardiansOfChild(childId: string): Promise<GuardianOfChild[]> {
  return dbSelect<GuardianOfChild>(
    `SELECT g.*, cg.is_primary, cg.can_pickup FROM guardians g
     JOIN child_guardians cg ON cg.guardian_id = g.id
     WHERE cg.child_id = ?`,
    [childId],
  );
}

export async function addGuardianToChild(
  childId: string,
  fullName: string,
  relationship: string,
  phone: string | undefined,
  isPrimary: boolean,
): Promise<void> {
  const guardianId = newId();
  const ts = nowIso();
  await dbExecute(
    "INSERT INTO guardians (id, full_name, relationship, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [guardianId, fullName, relationship, phone ?? null, ts, ts],
  );
  await dbExecute(
    "INSERT INTO child_guardians (id, child_id, guardian_id, is_primary, can_pickup) VALUES (?, ?, ?, ?, 1)",
    [newId(), childId, guardianId, isPrimary ? 1 : 0],
  );
}

// ===================== ĐIỂM DANH =====================

export interface AttendanceRow {
  child_id: string;
  child_name: string;
  status: AttendanceStatus | null;
  note: string | null;
}

export async function getAttendanceForClassDate(
  classId: string,
  date: string,
): Promise<AttendanceRow[]> {
  return dbSelect<AttendanceRow>(
    `SELECT ch.id AS child_id, ch.full_name AS child_name, a.status AS status, a.note AS note
     FROM children ch
     LEFT JOIN attendance a ON a.child_id = ch.id AND a.attendance_date = ?
     WHERE ch.class_id = ? AND ch.deleted_at IS NULL AND ch.status = 'studying'
     ORDER BY ch.full_name ASC`,
    [date, classId],
  );
}

export async function recordAttendance(
  childId: string,
  classId: string,
  date: string,
  status: AttendanceStatus,
  note: string | undefined,
  recordedBy: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO attendance (id, child_id, class_id, attendance_date, status, note, recorded_by, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(child_id, attendance_date) DO UPDATE SET
       status = excluded.status, note = excluded.note, recorded_by = excluded.recorded_by,
       recorded_at = excluded.recorded_at`,
    [newId(), childId, classId, date, status, note ?? null, recordedBy, nowIso()],
  );
}

export interface AttendanceStats {
  present: number;
  absentExcused: number;
  absentUnexcused: number;
  late: number;
  total: number;
}

export async function getClassAttendanceStats(
  classId: string,
  fromDate: string,
  toDate: string,
): Promise<AttendanceStats> {
  const rows = await dbSelect<{ status: AttendanceStatus; n: number }>(
    `SELECT status, COUNT(*) AS n FROM attendance
     WHERE class_id = ? AND attendance_date BETWEEN ? AND ?
     GROUP BY status`,
    [classId, fromDate, toDate],
  );
  const stats: AttendanceStats = { present: 0, absentExcused: 0, absentUnexcused: 0, late: 0, total: 0 };
  for (const row of rows) {
    stats.total += row.n;
    if (row.status === "present") stats.present = row.n;
    if (row.status === "absent_excused") stats.absentExcused = row.n;
    if (row.status === "absent_unexcused") stats.absentUnexcused = row.n;
    if (row.status === "late") stats.late = row.n;
  }
  return stats;
}

export interface ChildAttendanceSummaryRow {
  child_id: string;
  code: string;
  full_name: string;
  present: number;
  absent_excused: number;
  absent_unexcused: number;
  late: number;
}

/** Tổng hợp chuyên cần từng trẻ trong lớp theo khoảng ngày — dùng cho báo cáo/xuất Excel. */
export async function getChildrenAttendanceSummary(
  classId: string,
  fromDate: string,
  toDate: string,
): Promise<ChildAttendanceSummaryRow[]> {
  return dbSelect<ChildAttendanceSummaryRow>(
    `SELECT ch.id AS child_id, ch.code AS code, ch.full_name AS full_name,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN a.status = 'absent_excused' THEN 1 ELSE 0 END) AS absent_excused,
       SUM(CASE WHEN a.status = 'absent_unexcused' THEN 1 ELSE 0 END) AS absent_unexcused,
       SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late
     FROM children ch
     LEFT JOIN attendance a ON a.child_id = ch.id AND a.attendance_date BETWEEN ? AND ?
     WHERE ch.class_id = ? AND ch.deleted_at IS NULL AND ch.status = 'studying'
     GROUP BY ch.id
     ORDER BY ch.full_name ASC`,
    [fromDate, toDate, classId],
  );
}
