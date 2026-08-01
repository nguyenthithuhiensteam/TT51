import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { newId } from "../utils/id";
import { COL, db, nowIso } from "./client";
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

async function getUserName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? null) : null;
}

// ===================== LỚP =====================

export interface ClassWithTeacher extends SchoolClass {
  teacher_name: string | null;
  child_count: number;
}

export async function listClasses(schoolYearId: string): Promise<ClassWithTeacher[]> {
  const snap = await getDocs(
    query(collection(db, COL.classes), where("school_year_id", "==", schoolYearId)),
  );
  const classes = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ClassWithTeacher, "id">) }))
    .filter((c) => !c.deleted_at);
  await Promise.all(
    classes.map(async (c) => {
      const countSnap = await getCountFromServer(
        query(
          collection(db, COL.children),
          where("class_id", "==", c.id),
          where("status", "==", "studying"),
        ),
      );
      c.child_count = countSnap.data().count;
    }),
  );
  return classes.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function getClassById(id: string): Promise<SchoolClass | null> {
  const snap = await getDoc(doc(db, COL.classes, id));
  if (!snap.exists() || snap.data().deleted_at) return null;
  return { id: snap.id, ...(snap.data() as Omit<SchoolClass, "id">) };
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
  const ts = nowIso();
  const teacherName = input.homeroomTeacherId ? await getUserName(input.homeroomTeacherId) : null;
  // Suy ra nhóm dinh dưỡng từ độ tuổi, giống đúng logic migration 020_meal_ration.sql.
  const nutritionGroup = input.ageGroup.includes("tháng") ? "nha_tre" : "mau_giao";
  const ref = await addDoc(collection(db, COL.classes), {
    school_year_id: input.schoolYearId,
    code: input.code,
    name: input.name,
    age_group: input.ageGroup,
    nutrition_group: nutritionGroup,
    homeroom_teacher_id: input.homeroomTeacherId ?? null,
    homeroom_teacher_name: teacherName,
    room: input.room ?? null,
    capacity: input.capacity ?? null,
    status: "published",
    version: 1,
    created_by: input.createdBy,
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
    deleted_at: null,
  });
  return ref.id;
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

async function listAllChildren(): Promise<ChildWithClass[]> {
  const snap = await getDocs(collection(db, COL.children));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ChildWithClass, "id">) }))
    .filter((c) => !c.deleted_at);
}

export async function listChildren(params: ChildListParams): Promise<PagedResult<ChildWithClass>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  let items = await listAllChildren();

  if (params.classId && params.classId !== "all") {
    items = items.filter((c) => c.class_id === params.classId);
  }
  if (params.status && params.status !== "all") {
    items = items.filter((c) => c.status === params.status);
  }
  if (params.search) {
    const s = params.search.toLowerCase();
    items = items.filter((c) => c.full_name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s));
  }
  items.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));

  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

export async function getChildById(id: string): Promise<ChildWithClass | null> {
  const snap = await getDoc(doc(db, COL.children, id));
  if (!snap.exists() || snap.data().deleted_at) return null;
  return { id: snap.id, ...(snap.data() as Omit<ChildWithClass, "id">) };
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
  const countSnap = await getCountFromServer(collection(db, COL.children));
  const seq = countSnap.data().count + 1;
  const year = new Date().getFullYear();
  const code = `TRE-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  const className = input.classId ? (await getClassById(input.classId))?.name ?? null : null;

  const ref = await addDoc(collection(db, COL.children), {
    code,
    school_year_id: input.schoolYearId,
    class_id: input.classId ?? null,
    class_name: className,
    full_name: input.fullName,
    dob: input.dob,
    gender: input.gender,
    enrollment_date: input.enrollmentDate,
    status: "studying" as ChildStatus,
    ethnicity: null,
    policy_type: "khong" as PolicyType,
    note: input.note ?? null,
    guardians: [],
    version: 1,
    created_by: input.createdBy,
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
    deleted_at: null,
  });

  await logAudit({
    entityTable: "children",
    entityId: ref.id,
    action: "create",
    afterJson: { code, fullName: input.fullName },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return ref.id;
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
  const before = await getChildById(id);
  const className = input.classId ? (await getClassById(input.classId))?.name ?? null : null;
  await updateDoc(doc(db, COL.children, id), {
    class_id: input.classId ?? null,
    class_name: className,
    full_name: input.fullName,
    dob: input.dob,
    gender: input.gender,
    note: input.note ?? null,
    version: (before?.version ?? 1) + 1,
    updated_by: input.updatedBy,
    updated_at: nowIso(),
  });
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
  const before = await getChildById(id);
  await updateDoc(doc(db, COL.children, id), {
    ethnicity: ethnicity || null,
    policy_type: policyType,
    version: (before?.version ?? 1) + 1,
    updated_by: updatedBy,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "children",
    entityId: id,
    action: "update_demographics",
    afterJson: { ethnicity, policyType },
    userId: updatedBy,
    sessionId,
  });
}

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
  const className = newClassId ? (await getClassById(newClassId))?.name ?? null : child.class_name;

  await updateDoc(doc(db, COL.children, id), {
    status: toStatus,
    class_id: newClassId ?? child.class_id,
    class_name: className,
    version: child.version + 1,
    updated_by: changedBy,
    updated_at: nowIso(),
  });

  await addDoc(collection(db, COL.childStatusHistory), {
    child_id: id,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    changed_by_name: await getUserName(changedBy),
    changed_at: nowIso(),
    note: note ?? null,
  });

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
  const snap = await getDocs(
    query(collection(db, COL.childStatusHistory), where("child_id", "==", childId), orderBy("changed_at", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChildStatusHistoryRow, "id">) }));
}

// ===================== PHỤ HUYNH =====================
// Đơn giản hoá so với bản SQL (bảng guardians + child_guardians riêng): nhúng thẳng danh sách
// phụ huynh vào tài liệu trẻ (luôn đọc/ghi cùng nhau, số lượng nhỏ) — chấp nhận trùng lặp nhẹ
// nếu 2 trẻ có cùng phụ huynh, đổi lại đơn giản hơn nhiều so với chuẩn hoá qua Firestore.

export interface GuardianOfChild extends Guardian {
  is_primary: number;
  can_pickup: number;
}

export async function listGuardiansOfChild(childId: string): Promise<GuardianOfChild[]> {
  const snap = await getDoc(doc(db, COL.children, childId));
  if (!snap.exists()) return [];
  return (snap.data().guardians as GuardianOfChild[] | undefined) ?? [];
}

export async function addGuardianToChild(
  childId: string,
  fullName: string,
  relationship: string,
  phone: string | undefined,
  isPrimary: boolean,
): Promise<void> {
  const ts = nowIso();
  const guardian: GuardianOfChild = {
    id: newId(),
    full_name: fullName,
    relationship,
    phone: phone ?? null,
    address: null,
    created_at: ts,
    updated_at: ts,
    is_primary: isPrimary ? 1 : 0,
    can_pickup: 1,
  };
  const existing = await listGuardiansOfChild(childId);
  await updateDoc(doc(db, COL.children, childId), { guardians: [...existing, guardian] });
}

// ===================== ĐIỂM DANH =====================

export interface AttendanceRow {
  child_id: string;
  child_name: string;
  status: AttendanceStatus | null;
  note: string | null;
}

async function listChildrenOfClass(classId: string): Promise<ChildWithClass[]> {
  const snap = await getDocs(
    query(collection(db, COL.children), where("class_id", "==", classId), where("status", "==", "studying")),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ChildWithClass, "id">) }))
    .filter((c) => !c.deleted_at);
}

function attendanceDocId(childId: string, date: string): string {
  return `${childId}_${date}`;
}

export async function getAttendanceForClassDate(classId: string, date: string): Promise<AttendanceRow[]> {
  const children = await listChildrenOfClass(classId);
  const snap = await getDocs(query(collection(db, COL.attendance), where("class_id", "==", classId), where("attendance_date", "==", date)));
  const byChild = new Map(snap.docs.map((d) => [d.data().child_id as string, d.data()]));
  return children
    .map((c) => ({
      child_id: c.id,
      child_name: c.full_name,
      status: (byChild.get(c.id)?.status as AttendanceStatus | undefined) ?? null,
      note: (byChild.get(c.id)?.note as string | undefined) ?? null,
    }))
    .sort((a, b) => a.child_name.localeCompare(b.child_name, "vi"));
}

export async function recordAttendance(
  childId: string,
  classId: string,
  date: string,
  status: AttendanceStatus,
  note: string | undefined,
  recordedBy: string,
): Promise<void> {
  const child = await getChildById(childId);
  await setDoc(doc(db, COL.attendance, attendanceDocId(childId, date)), {
    child_id: childId,
    child_name: child?.full_name ?? "",
    class_id: classId,
    attendance_date: date,
    status,
    note: note ?? null,
    recorded_by: recordedBy,
    recorded_at: nowIso(),
  });
}

async function listAttendanceInRange(
  classId: string,
  fromDate: string,
  toDate: string,
): Promise<{ child_id: string; attendance_date: string; status: AttendanceStatus }[]> {
  const snap = await getDocs(
    query(
      collection(db, COL.attendance),
      where("class_id", "==", classId),
      where("attendance_date", ">=", fromDate),
      where("attendance_date", "<=", toDate),
    ),
  );
  return snap.docs.map((d) => d.data() as { child_id: string; attendance_date: string; status: AttendanceStatus });
}

export interface AttendanceStats {
  present: number;
  absentExcused: number;
  absentUnexcused: number;
  late: number;
  total: number;
}

export async function getClassAttendanceStats(classId: string, fromDate: string, toDate: string): Promise<AttendanceStats> {
  const rows = await listAttendanceInRange(classId, fromDate, toDate);
  const stats: AttendanceStats = { present: 0, absentExcused: 0, absentUnexcused: 0, late: 0, total: 0 };
  for (const row of rows) {
    stats.total += 1;
    if (row.status === "present") stats.present += 1;
    if (row.status === "absent_excused") stats.absentExcused += 1;
    if (row.status === "absent_unexcused") stats.absentUnexcused += 1;
    if (row.status === "late") stats.late += 1;
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

export async function getChildrenAttendanceSummary(
  classId: string,
  fromDate: string,
  toDate: string,
): Promise<ChildAttendanceSummaryRow[]> {
  const [children, rows] = await Promise.all([
    listChildrenOfClass(classId),
    listAttendanceInRange(classId, fromDate, toDate),
  ]);
  const byChild = new Map<string, ChildAttendanceSummaryRow>();
  for (const c of children) {
    byChild.set(c.id, { child_id: c.id, code: c.code, full_name: c.full_name, present: 0, absent_excused: 0, absent_unexcused: 0, late: 0 });
  }
  for (const r of rows) {
    const row = byChild.get(r.child_id);
    if (!row) continue;
    if (r.status === "present") row.present += 1;
    if (r.status === "absent_excused") row.absent_excused += 1;
    if (r.status === "absent_unexcused") row.absent_unexcused += 1;
    if (r.status === "late") row.late += 1;
  }
  return [...byChild.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
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

export async function getMonthlyAttendanceGrid(classId: string, yearMonth: string): Promise<MonthlyAttendanceGrid> {
  const from = `${yearMonth}-01`;
  const to = `${yearMonth}-31`;
  const rows = await listAttendanceInRange(classId, from, to);
  const childNames = new Map<string, { code: string; full_name: string }>();
  for (const c of await listChildrenOfClass(classId)) childNames.set(c.id, { code: c.code, full_name: c.full_name });

  const dayset = new Set<string>();
  const byChild = new Map<string, MonthlyAttendanceGridChild>();
  for (const r of rows) {
    dayset.add(r.attendance_date);
    if (!byChild.has(r.child_id)) {
      const info = childNames.get(r.child_id);
      byChild.set(r.child_id, { childId: r.child_id, code: info?.code ?? "", fullName: info?.full_name ?? "", cells: {}, totalDays: 0 });
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
  const rows = await listAttendanceInRange(classId, from, to);
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

async function getStudentCountSnapshot(classId: string, yearMonth: string, label: string): Promise<StudentCountSnapshot> {
  const from = `${yearMonth}-01`;
  const to = `${yearMonth}-31`;
  const attendanceRows = await listAttendanceInRange(classId, from, to);
  const childIds = [...new Set(attendanceRows.map((r) => r.child_id))];
  const children = await Promise.all(childIds.map((id) => getChildById(id)));

  const [refYear, refMonth] = yearMonth.split("-").map(Number);
  const snap: StudentCountSnapshot = {
    label,
    total: children.length,
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
  for (const r of children) {
    if (!r) continue;
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
// listLeaveRequestsForChild/listMessagesForChild sẽ trống cho tới khi phân hệ Phụ huynh (nơi
// phụ huynh gửi đơn/tin nhắn) được chuyển đổi ở đợt sau — không lỗi, chỉ chưa có dữ liệu.

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
  const snap = await getDocs(
    query(collection(db, COL.childLeaveRequests), where("child_id", "==", childId), orderBy("created_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffLeaveRequestRow, "id">) }));
}

export async function decideLeaveRequest(
  id: string,
  approve: boolean,
  decidedBy: string,
  note: string | undefined,
): Promise<void> {
  const toStatus: LeaveRequestStatus = approve ? "approved" : "needs_revision";
  await updateDoc(doc(db, COL.childLeaveRequests, id), {
    status: toStatus,
    decided_by: decidedBy,
    decided_at: nowIso(),
    decision_note: note ?? null,
  });
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
  const snap = await getDocs(
    query(collection(db, COL.parentMessages), where("child_id", "==", childId), orderBy("created_at", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMessageRow, "id">) }));
}

export async function replyAsTeacher(childId: string, teacherId: string, content: string): Promise<void> {
  const guardians = await listGuardiansOfChild(childId);
  const guardianId = guardians[0]?.id;
  if (!guardianId) throw new Error("Trẻ chưa có thông tin phụ huynh liên kết");
  await addDoc(collection(db, COL.parentMessages), {
    child_id: childId,
    guardian_id: guardianId,
    sender_role: "teacher",
    sender_user_id: teacherId,
    sender_name: await getUserName(teacherId),
    content,
    is_read: 0,
    created_at: nowIso(),
  });
}
