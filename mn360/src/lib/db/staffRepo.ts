import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
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

export async function listStaff(params: StaffListParams): Promise<PagedResult<StaffWithUser>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: string[] = ["s.deleted_at IS NULL"];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(u.full_name LIKE ? OR s.employee_code LIKE ? OR s.position LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) AS total FROM staff s JOIN users u ON u.id = s.user_id ${whereSql}`,
    args,
  );
  const items = await dbSelect<StaffWithUser>(
    `SELECT s.*, u.full_name AS full_name, u.username AS username FROM staff s
     JOIN users u ON u.id = s.user_id
     ${whereSql}
     ORDER BY u.full_name ASC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize],
  );
  return { items, total: countRows[0]?.total ?? 0, page, pageSize };
}

export async function getStaffById(id: string): Promise<StaffWithUser | null> {
  const rows = await dbSelect<StaffWithUser>(
    `SELECT s.*, u.full_name AS full_name, u.username AS username FROM staff s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getStaffByUserId(userId: string): Promise<StaffWithUser | null> {
  const rows = await dbSelect<StaffWithUser>(
    `SELECT s.*, u.full_name AS full_name, u.username AS username FROM staff s
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ? AND s.deleted_at IS NULL`,
    [userId],
  );
  return rows[0] ?? null;
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
  const id = newId();
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO staff (id, user_id, employee_code, position, employment_type, degree, start_date,
      status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.employeeCode,
      input.position,
      input.employmentType,
      input.degree ?? null,
      input.startDate ?? null,
      input.createdBy,
      ts,
      input.createdBy,
      ts,
    ],
  );
  return id;
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
  return dbSelect<StaffAssignmentRow>(
    `SELECT sa.*, c.name AS class_name FROM staff_assignments sa
     LEFT JOIN classes c ON c.id = sa.class_id
     WHERE sa.staff_id = ? ORDER BY sa.created_at DESC`,
    [staffId],
  );
}

export async function addStaffAssignment(
  staffId: string,
  schoolYearId: string,
  assignmentType: StaffAssignmentRow["assignment_type"],
  description: string | undefined,
  classId: string | undefined,
  createdBy: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO staff_assignments (id, staff_id, school_year_id, class_id, assignment_type, description, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), staffId, schoolYearId, classId ?? null, assignmentType, description ?? null, createdBy, nowIso()],
  );
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
  const where = staffId ? "WHERE l.staff_id = ?" : "";
  const args = staffId ? [staffId] : [];
  return dbSelect<StaffLeaveRow>(
    `SELECT l.*, u.full_name AS staff_name FROM staff_leaves l
     JOIN staff s ON s.id = l.staff_id
     JOIN users u ON u.id = s.user_id
     ${where}
     ORDER BY l.created_at DESC`,
    args,
  );
}

export async function requestStaffLeave(
  staffId: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason: string,
  createdBy: string,
): Promise<void> {
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO staff_leaves (id, staff_id, leave_type, start_date, end_date, reason, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?)`,
    [newId(), staffId, leaveType, startDate, endDate, reason, createdBy, ts, ts],
  );
}

export async function decideStaffLeave(
  leaveId: string,
  approve: boolean,
  approverId: string,
  sessionId: string | null,
): Promise<void> {
  const toStatus: RecordStatus = approve ? "approved" : "needs_revision";
  await dbExecute(
    "UPDATE staff_leaves SET status = ?, approved_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, approverId, nowIso(), leaveId],
  );
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

export async function listStaffEvaluations(
  staffId: string,
  schoolYearId: string,
): Promise<StaffEvaluationRow[]> {
  return dbSelect<StaffEvaluationRow>(
    `SELECT e.*, u.full_name AS evaluator_name FROM staff_evaluations e
     JOIN users u ON u.id = e.evaluator_id
     WHERE e.staff_id = ? AND e.school_year_id = ?
     ORDER BY CASE e.evaluator_role WHEN 'self' THEN 1 WHEN 'team_lead' THEN 2 ELSE 3 END`,
    [staffId, schoolYearId],
  );
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
  await dbExecute(
    `INSERT INTO staff_evaluations (id, staff_id, school_year_id, evaluator_role, evaluator_id,
      rating, strengths, weaknesses, improvement_plan, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(staff_id, school_year_id, evaluator_role) DO UPDATE SET
       rating = excluded.rating, strengths = excluded.strengths, weaknesses = excluded.weaknesses,
       improvement_plan = excluded.improvement_plan, status = excluded.status, updated_at = excluded.updated_at`,
    [
      newId(),
      staffId,
      schoolYearId,
      evaluatorRole,
      evaluatorId,
      data.rating ?? null,
      data.strengths ?? null,
      data.weaknesses ?? null,
      data.improvementPlan ?? null,
      status,
      ts,
      ts,
    ],
  );
}

export async function finalizeStaffEvaluation(
  staffId: string,
  schoolYearId: string,
  evaluatorRole: EvaluatorRole,
  approverId: string,
  sessionId: string | null,
): Promise<void> {
  await dbExecute(
    `UPDATE staff_evaluations SET status = 'approved', updated_at = ?
     WHERE staff_id = ? AND school_year_id = ? AND evaluator_role = ?`,
    [nowIso(), staffId, schoolYearId, evaluatorRole],
  );
  await logAudit({
    entityTable: "staff_evaluations",
    entityId: `${staffId}:${schoolYearId}:${evaluatorRole}`,
    action: "approve",
    userId: approverId,
    sessionId,
  });
}
