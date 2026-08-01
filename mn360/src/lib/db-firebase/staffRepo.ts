import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { PagedResult } from "./taskRepo";
import type { EmploymentType, EvaluatorRole, RecordStatus, Staff } from "./types";

export interface StaffWithUser extends Staff {
  full_name: string;
  username: string;
}

export interface StaffListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

async function listAllStaff(): Promise<StaffWithUser[]> {
  const snap = await getDocs(collection(db, COL.staff));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffWithUser, "id">) }))
    .filter((s) => !s.deleted_at);
}

export async function listStaff(params: StaffListParams): Promise<PagedResult<StaffWithUser>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  let items = await listAllStaff();

  if (params.search) {
    const s = params.search.toLowerCase();
    items = items.filter(
      (r) =>
        r.full_name.toLowerCase().includes(s) ||
        r.employee_code.toLowerCase().includes(s) ||
        r.position.toLowerCase().includes(s),
    );
  }
  items.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));

  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

export async function getStaffById(id: string): Promise<StaffWithUser | null> {
  const snap = await getDoc(doc(db, COL.staff, id));
  if (!snap.exists() || snap.data().deleted_at) return null;
  return { id: snap.id, ...(snap.data() as Omit<StaffWithUser, "id">) };
}

export async function getStaffByUserId(userId: string): Promise<StaffWithUser | null> {
  const snap = await getDocs(query(collection(db, COL.staff), where("user_id", "==", userId)));
  const found = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffWithUser, "id">) })).find((s) => !s.deleted_at);
  return found ?? null;
}

export interface CreateStaffInput {
  userId: string;
  employeeCode: string;
  position: string;
  employmentType: EmploymentType;
  degree?: string;
  startDate?: string;
  createdBy: string;
}

export async function createStaff(input: CreateStaffInput): Promise<string> {
  const ts = nowIso();
  const userSnap = await getDoc(doc(db, COL.users, input.userId));
  const userData = userSnap.exists() ? userSnap.data() : null;

  const ref = await addDoc(collection(db, COL.staff), {
    user_id: input.userId,
    full_name: userData?.full_name ?? "",
    username: userData?.username ?? "",
    employee_code: input.employeeCode,
    position: input.position,
    employment_type: input.employmentType,
    degree: input.degree ?? null,
    start_date: input.startDate ?? null,
    status: "active",
    note: null,
    version: 1,
    created_by: input.createdBy,
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
    deleted_at: null,
  });
  return ref.id;
}

export interface StaffAssignmentRow {
  id: string;
  staff_id: string;
  class_id: string | null;
  class_name: string | null;
  assignment_type: "homeroom" | "subject" | "support" | "management";
  description: string | null;
  created_at: string;
}

export async function listStaffAssignments(staffId: string): Promise<StaffAssignmentRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.staffAssignments), where("staff_id", "==", staffId), orderBy("created_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffAssignmentRow, "id">) }));
}

export async function addStaffAssignment(
  staffId: string,
  schoolYearId: string,
  assignmentType: StaffAssignmentRow["assignment_type"],
  description: string | undefined,
  classId: string | undefined,
  createdBy: string,
): Promise<void> {
  const className = classId ? ((await getDoc(doc(db, COL.classes, classId))).data()?.name ?? null) : null;
  await addDoc(collection(db, COL.staffAssignments), {
    staff_id: staffId,
    school_year_id: schoolYearId,
    class_id: classId ?? null,
    class_name: className,
    assignment_type: assignmentType,
    description: description ?? null,
    created_by: createdBy,
    created_at: nowIso(),
  });
}

// ===================== NGHỈ PHÉP =====================

export interface StaffLeaveRow {
  id: string;
  staff_id: string;
  staff_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: RecordStatus;
  created_at: string;
}

export async function listStaffLeaves(staffId?: string): Promise<StaffLeaveRow[]> {
  const base = collection(db, COL.staffLeaves);
  const snap = await getDocs(staffId ? query(base, where("staff_id", "==", staffId), orderBy("created_at", "desc")) : query(base, orderBy("created_at", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffLeaveRow, "id">) }));
}

export async function requestStaffLeave(
  staffId: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason: string,
  createdBy: string,
): Promise<void> {
  const staff = await getStaffById(staffId);
  const ts = nowIso();
  await addDoc(collection(db, COL.staffLeaves), {
    staff_id: staffId,
    staff_name: staff?.full_name ?? "",
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    reason,
    status: "pending_approval" as RecordStatus,
    approved_by: null,
    created_by: createdBy,
    created_at: ts,
    updated_at: ts,
  });
}

export async function decideStaffLeave(
  leaveId: string,
  approve: boolean,
  approverId: string,
  sessionId: string | null,
): Promise<void> {
  const toStatus: RecordStatus = approve ? "approved" : "needs_revision";
  await updateDoc(doc(db, COL.staffLeaves, leaveId), {
    status: toStatus,
    approved_by: approverId,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "staff_leaves",
    entityId: leaveId,
    action: approve ? "approve" : "reject",
    userId: approverId,
    sessionId,
  });
}

// ===================== ĐÁNH GIÁ VIÊN CHỨC =====================

export interface StaffEvaluationRow {
  id: string;
  staff_id: string;
  school_year_id: string;
  evaluator_role: EvaluatorRole;
  evaluator_id: string;
  evaluator_name: string;
  rating: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_plan: string | null;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

function evaluationDocId(staffId: string, schoolYearId: string, evaluatorRole: EvaluatorRole): string {
  return `${staffId}_${schoolYearId}_${evaluatorRole}`;
}

const EVALUATOR_ORDER: Record<EvaluatorRole, number> = { self: 1, team_lead: 2, principal: 3 };

export async function listStaffEvaluations(staffId: string, schoolYearId: string): Promise<StaffEvaluationRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.staffEvaluations), where("staff_id", "==", staffId), where("school_year_id", "==", schoolYearId)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffEvaluationRow, "id">) }))
    .sort((a, b) => EVALUATOR_ORDER[a.evaluator_role] - EVALUATOR_ORDER[b.evaluator_role]);
}

export async function upsertStaffEvaluation(
  staffId: string,
  schoolYearId: string,
  evaluatorRole: EvaluatorRole,
  evaluatorId: string,
  data: {
    rating?: string;
    strengths?: string;
    weaknesses?: string;
    improvementPlan?: string;
  },
  submit: boolean,
): Promise<void> {
  const ts = nowIso();
  const status: RecordStatus = submit ? "submitted" : "draft";
  const id = evaluationDocId(staffId, schoolYearId, evaluatorRole);
  const existing = await getDoc(doc(db, COL.staffEvaluations, id));
  await setDoc(doc(db, COL.staffEvaluations, id), {
    staff_id: staffId,
    school_year_id: schoolYearId,
    evaluator_role: evaluatorRole,
    evaluator_id: evaluatorId,
    evaluator_name: await (async () => {
      const u = await getDoc(doc(db, COL.users, evaluatorId));
      return u.exists() ? (u.data().full_name as string) : "";
    })(),
    rating: data.rating ?? null,
    strengths: data.strengths ?? null,
    weaknesses: data.weaknesses ?? null,
    improvement_plan: data.improvementPlan ?? null,
    status,
    created_at: existing.exists() ? existing.data().created_at : ts,
    updated_at: ts,
  });
}

export async function finalizeStaffEvaluation(
  staffId: string,
  schoolYearId: string,
  evaluatorRole: EvaluatorRole,
  approverId: string,
  sessionId: string | null,
): Promise<void> {
  const id = evaluationDocId(staffId, schoolYearId, evaluatorRole);
  await updateDoc(doc(db, COL.staffEvaluations, id), { status: "approved", updated_at: nowIso() });
  await logAudit({
    entityTable: "staff_evaluations",
    entityId: id,
    action: "approve",
    userId: approverId,
    sessionId,
  });
}
