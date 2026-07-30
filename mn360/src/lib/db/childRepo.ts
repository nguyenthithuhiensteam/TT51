import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { PagedResult } from "./taskRepo";
import type {
  AttendanceStatus,
  Child,
  ChildStatus,
  Guardian,
  LeaveRequestStatus,
  PolicyType,
  SchoolClass,
} from "./types";

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

export async function updateChildDemographics(
  id: string,
  ethnicity: string | null,
  policyType: PolicyType,
  updatedBy: string,
  sessionId: string | null,
): Promise<void> {
  await dbExecute(
    `UPDATE children SET ethnicity = ?, policy_type = ?, version = version + 1, updated_by = ?, updated_at = ?
     WHERE id = ?`,
    [ethnicity || null, policyType, updatedBy, nowIso(), id],
  );
  await logAudit({
    entityTable: "children",
    entityId: id,
    action: "update_demographics",
    afterJson: { ethnicity, policyType },
    userId: updatedBy,
    sessionId,
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

// ===================== BÁO CÁO CHUYÊN CẦN THEO THÁNG/HỌC KỲ/NĂM =====================

export type AttendanceMark = "x" | "N";

export interface MonthlyAttendanceGridChild {
  childId: string;
  code: string;
  fullName: string;
  cells: Record<string, AttendanceMark>;
  totalDays: number;
}

export interface MonthlyAttendanceGrid {
  yearMonth: string;
  schoolDays: string[];
  children: MonthlyAttendanceGridChild[];
  dailyTotals: Record<string, number>;
  avgPerDay: number;
  rate: number;
}

/**
 * Lưới điểm danh cả tháng cho một lớp (x = có mặt/đi muộn, N = nghỉ) — dùng cho biểu in
 * "Chuyên cần Tháng N". Chỉ tính những trẻ và những ngày có bản ghi điểm danh thật trong tháng
 * (không suy diễn từ trạng thái hiện tại của trẻ) để đúng với lịch sử thực tế của tháng đó.
 */
export async function getMonthlyAttendanceGrid(classId: string, yearMonth: string): Promise<MonthlyAttendanceGrid> {
  const from = `${yearMonth}-01`;
  const to = `${yearMonth}-31`;
  const rows = await dbSelect<{
    child_id: string;
    code: string;
    full_name: string;
    attendance_date: string;
    status: AttendanceStatus;
  }>(
    `SELECT a.child_id AS child_id, ch.code AS code, ch.full_name AS full_name,
       a.attendance_date AS attendance_date, a.status AS status
     FROM attendance a
     JOIN children ch ON ch.id = a.child_id
     WHERE a.class_id = ? AND a.attendance_date BETWEEN ? AND ?
     ORDER BY ch.full_name ASC, a.attendance_date ASC`,
    [classId, from, to],
  );

  const dayset = new Set<string>();
  const byChild = new Map<string, MonthlyAttendanceGridChild>();
  for (const r of rows) {
    dayset.add(r.attendance_date);
    if (!byChild.has(r.child_id)) {
      byChild.set(r.child_id, { childId: r.child_id, code: r.code, fullName: r.full_name, cells: {}, totalDays: 0 });
    }
    const mark: AttendanceMark = r.status === "present" || r.status === "late" ? "x" : "N";
    byChild.get(r.child_id)!.cells[r.attendance_date] = mark;
  }

  const schoolDays = [...dayset].sort();
  const children = [...byChild.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
  for (const c of children) {
    c.totalDays = schoolDays.filter((d) => c.cells[d] === "x").length;
  }

  const dailyTotals: Record<string, number> = {};
  for (const d of schoolDays) {
    dailyTotals[d] = children.filter((c) => c.cells[d] === "x").length;
  }
  const totalPresentDays = Object.values(dailyTotals).reduce((s, n) => s + n, 0);
  const attended = children.filter((c) => c.totalDays > 0).length;

  return {
    yearMonth,
    schoolDays,
    children,
    dailyTotals,
    avgPerDay: schoolDays.length ? Math.round(totalPresentDays / schoolDays.length) : 0,
    rate: schoolDays.length && attended ? Math.round((totalPresentDays / (schoolDays.length * attended)) * 1000) / 10 : 0,
  };
}

export interface MonthlyAttendanceStatsRow {
  label: string;
  registered: number;
  attended: number;
  schoolDays: number;
  totalPresentDays: number;
  avgPerDay: number;
  rate: number;
}

async function getMonthAttendanceStats(classId: string, yearMonth: string): Promise<MonthlyAttendanceStatsRow> {
  const from = `${yearMonth}-01`;
  const to = `${yearMonth}-31`;
  const rows = await dbSelect<{ child_id: string; attendance_date: string; status: AttendanceStatus }>(
    "SELECT child_id, attendance_date, status FROM attendance WHERE class_id = ? AND attendance_date BETWEEN ? AND ?",
    [classId, from, to],
  );
  const dayset = new Set<string>();
  const registeredSet = new Set<string>();
  const attendedSet = new Set<string>();
  let totalPresentDays = 0;
  for (const r of rows) {
    dayset.add(r.attendance_date);
    registeredSet.add(r.child_id);
    if (r.status === "present" || r.status === "late") {
      totalPresentDays += 1;
      attendedSet.add(r.child_id);
    }
  }
  const schoolDays = dayset.size;
  const attended = attendedSet.size;
  return {
    label: yearMonth,
    registered: registeredSet.size,
    attended,
    schoolDays,
    totalPresentDays,
    avgPerDay: schoolDays ? Math.round(totalPresentDays / schoolDays) : 0,
    rate: schoolDays && attended ? Math.round((totalPresentDays / (schoolDays * attended)) * 1000) / 10 : 0,
  };
}

function meanRow(label: string, rowsIn: MonthlyAttendanceStatsRow[]): MonthlyAttendanceStatsRow {
  const n = rowsIn.length || 1;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    label,
    registered: round1(rowsIn.reduce((s, r) => s + r.registered, 0) / n),
    attended: round1(rowsIn.reduce((s, r) => s + r.attended, 0) / n),
    schoolDays: round1(rowsIn.reduce((s, r) => s + r.schoolDays, 0) / n),
    totalPresentDays: round1(rowsIn.reduce((s, r) => s + r.totalPresentDays, 0) / n),
    avgPerDay: round1(rowsIn.reduce((s, r) => s + r.avgPerDay, 0) / n),
    rate: round1(rowsIn.reduce((s, r) => s + r.rate, 0) / n),
  };
}

function monthsInRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export interface YearlyAttendanceSummary {
  months: MonthlyAttendanceStatsRow[];
  semester1: MonthlyAttendanceStatsRow;
  semester2: MonthlyAttendanceStatsRow;
  fullYear: MonthlyAttendanceStatsRow;
}

/**
 * Tổng hợp chuyên cần theo từng tháng của năm học + trung bình Học kỳ I (9-12), Học kỳ II
 * (1-5, hoặc các tháng còn lại) và cả năm — theo đúng công thức "TỔNG HỢP CHUYÊN CẦN HÀNG THÁNG"
 * nhà trường đang dùng.
 */
export async function getYearlyAttendanceSummary(
  classId: string,
  schoolYearStart: string,
  schoolYearEnd: string,
): Promise<YearlyAttendanceSummary> {
  const yearMonths = monthsInRange(schoolYearStart, schoolYearEnd);
  const months = await Promise.all(yearMonths.map((ym) => getMonthAttendanceStats(classId, ym)));
  const hk1 = months.filter((m) => ["09", "10", "11", "12"].includes(m.label.slice(5, 7)));
  const hk2 = months.filter((m) => !["09", "10", "11", "12"].includes(m.label.slice(5, 7)));
  const semester1 = meanRow("Học Kỳ I", hk1.length ? hk1 : months);
  const semester2 = meanRow("Học Kỳ II", hk2.length ? hk2 : months);
  const fullYear = meanRow("Cả năm", [semester1, semester2]);
  return { months, semester1, semester2, fullYear };
}

// ===================== TỔNG HỢP SỐ LƯỢNG HỌC SINH THEO THỜI ĐIỂM =====================

export interface StudentCountSnapshot {
  label: string;
  total: number;
  male: number;
  female: number;
  ethnicMinority: number;
  femaleEthnicMinority: number;
  policyChildren: number;
  poorHousehold: number;
  disabled: number;
  age3to4: number;
  age4to5: number;
  age5to6: number;
}

/**
 * Chụp nhanh số lượng trẻ của một lớp tại một tháng cụ thể — dùng bản ghi điểm danh của tháng
 * đó (giống cách xác định "đăng ký" ở báo cáo chuyên cần) để phản ánh đúng sĩ số thời điểm đó,
 * không lấy theo trạng thái hiện tại của trẻ (có thể đã chuyển lớp/thôi học sau đó).
 */
async function getStudentCountSnapshot(classId: string, yearMonth: string, label: string): Promise<StudentCountSnapshot> {
  const from = `${yearMonth}-01`;
  const to = `${yearMonth}-31`;
  const rows = await dbSelect<{
    child_id: string;
    gender: "male" | "female";
    dob: string;
    ethnicity: string | null;
    policy_type: PolicyType;
  }>(
    `SELECT DISTINCT ch.id AS child_id, ch.gender AS gender, ch.dob AS dob,
       ch.ethnicity AS ethnicity, ch.policy_type AS policy_type
     FROM attendance a
     JOIN children ch ON ch.id = a.child_id
     WHERE a.class_id = ? AND a.attendance_date BETWEEN ? AND ?`,
    [classId, from, to],
  );

  const [refYear, refMonth] = yearMonth.split("-").map(Number);
  const snap: StudentCountSnapshot = {
    label,
    total: rows.length,
    male: 0,
    female: 0,
    ethnicMinority: 0,
    femaleEthnicMinority: 0,
    policyChildren: 0,
    poorHousehold: 0,
    disabled: 0,
    age3to4: 0,
    age4to5: 0,
    age5to6: 0,
  };
  for (const r of rows) {
    if (r.gender === "male") snap.male += 1;
    else snap.female += 1;

    const isMinority = !!r.ethnicity && r.ethnicity !== "Kinh";
    if (isMinority) {
      snap.ethnicMinority += 1;
      if (r.gender === "female") snap.femaleEthnicMinority += 1;
    }
    if (r.policy_type === "con_chinh_sach") snap.policyChildren += 1;
    if (r.policy_type === "ngheo_can_ngheo") snap.poorHousehold += 1;
    if (r.policy_type === "khuyet_tat") snap.disabled += 1;

    const [birthYear, birthMonth] = r.dob.split("-").map(Number);
    let age = refYear - birthYear;
    if (refMonth < birthMonth) age -= 1;
    if (age <= 3) snap.age3to4 += 1;
    else if (age === 4) snap.age4to5 += 1;
    else snap.age5to6 += 1;
  }
  return snap;
}

/**
 * "Tổng hợp số lượng học sinh từng thời điểm" — đầu năm (tháng đầu năm học), giữa năm (cuối
 * Học Kỳ I, thường là tháng 12) và cuối năm (tháng cuối năm học), theo đúng cấu trúc biểu mẫu
 * gốc của trường.
 */
export async function getStudentCountByTimePoints(
  classId: string,
  schoolYearStart: string,
  schoolYearEnd: string,
): Promise<StudentCountSnapshot[]> {
  const months = monthsInRange(schoolYearStart, schoolYearEnd);
  if (!months.length) return [];
  const startMonth = months[0];
  const decMonth = months.find((m) => m.slice(5, 7) === "12") ?? months[Math.floor(months.length / 2)];
  const endMonth = months[months.length - 1];
  const points: [string, string][] = [
    [startMonth, "Đầu năm"],
    [decMonth, "Giữa năm"],
    [endMonth, "Cuối năm"],
  ];
  return Promise.all(points.map(([ym, label]) => getStudentCountSnapshot(classId, ym, label)));
}

// ===================== ĐƠN XIN NGHỈ & TRAO ĐỔI VỚI PHỤ HUYNH (PHÍA GIÁO VIÊN) =====================

export interface StaffLeaveRequestRow {
  id: string;
  code: string;
  child_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveRequestStatus;
  created_at: string;
}

export async function listLeaveRequestsForChild(childId: string): Promise<StaffLeaveRequestRow[]> {
  return dbSelect<StaffLeaveRequestRow>(
    `SELECT lr.id, lr.code, ch.full_name AS child_name, lr.start_date, lr.end_date, lr.reason,
       lr.status, lr.created_at
     FROM child_leave_requests lr JOIN children ch ON ch.id = lr.child_id
     WHERE lr.child_id = ? ORDER BY lr.created_at DESC`,
    [childId],
  );
}

export async function decideLeaveRequest(
  id: string,
  approve: boolean,
  decidedBy: string,
  note: string | undefined,
): Promise<void> {
  const toStatus: LeaveRequestStatus = approve ? "approved" : "needs_revision";
  await dbExecute(
    "UPDATE child_leave_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?",
    [toStatus, decidedBy, nowIso(), note ?? null, id],
  );
  await logAudit({
    entityTable: "child_leave_requests",
    entityId: id,
    action: approve ? "approve" : "reject",
    userId: decidedBy,
    sessionId: null,
  });
}

export interface StaffMessageRow {
  id: string;
  sender_role: "parent" | "teacher";
  sender_name: string;
  content: string;
  created_at: string;
}

export async function listMessagesForChild(childId: string): Promise<StaffMessageRow[]> {
  return dbSelect<StaffMessageRow>(
    `SELECT pm.id, pm.sender_role, u.full_name AS sender_name, pm.content, pm.created_at
     FROM parent_messages pm JOIN users u ON u.id = pm.sender_user_id
     WHERE pm.child_id = ? ORDER BY pm.created_at ASC`,
    [childId],
  );
}

export async function replyAsTeacher(childId: string, teacherId: string, content: string): Promise<void> {
  const guardianRows = await dbSelect<{ guardian_id: string }>(
    "SELECT guardian_id FROM child_guardians WHERE child_id = ? LIMIT 1",
    [childId],
  );
  const guardianId = guardianRows[0]?.guardian_id;
  if (!guardianId) throw new Error("Trẻ chưa có thông tin phụ huynh liên kết");
  await dbExecute(
    "INSERT INTO parent_messages (id, child_id, guardian_id, sender_role, sender_user_id, content, is_read, created_at) VALUES (?, ?, ?, 'teacher', ?, ?, 0, ?)",
    [newId(), childId, guardianId, teacherId, content, nowIso()],
  );
}
