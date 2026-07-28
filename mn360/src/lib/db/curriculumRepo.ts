import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { PagedResult } from "./taskRepo";
import type { AssessmentDomain, PlanType, RecordStatus } from "./types";

export interface EducationPlanRow {
  id: string;
  code: string;
  school_year_id: string;
  class_id: string | null;
  class_name: string | null;
  plan_type: PlanType;
  title: string;
  age_group: string | null;
  period_start: string | null;
  period_end: string | null;
  objectives: string | null;
  requirements: string | null;
  content: string | null;
  activities: string | null;
  environment: string | null;
  materials: string | null;
  methods: string | null;
  evaluation: string | null;
  adjustment: string | null;
  status: RecordStatus;
  version: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PlanListParams {
  search?: string;
  planType?: PlanType | "all";
  status?: RecordStatus | "all";
  page?: number;
  pageSize?: number;
}

export async function listEducationPlans(
  params: PlanListParams,
): Promise<PagedResult<EducationPlanRow>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: string[] = ["p.deleted_at IS NULL"];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(p.title LIKE ? OR p.code LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`);
  }
  if (params.planType && params.planType !== "all") {
    where.push("p.plan_type = ?");
    args.push(params.planType);
  }
  if (params.status && params.status !== "all") {
    where.push("p.status = ?");
    args.push(params.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) AS total FROM education_plans p ${whereSql}`,
    args,
  );
  const items = await dbSelect<EducationPlanRow>(
    `SELECT p.*, cl.name AS class_name, u.full_name AS created_by_name FROM education_plans p
     LEFT JOIN classes cl ON cl.id = p.class_id
     JOIN users u ON u.id = p.created_by
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize],
  );
  return { items, total: countRows[0]?.total ?? 0, page, pageSize };
}

export async function getEducationPlanById(id: string): Promise<EducationPlanRow | null> {
  const rows = await dbSelect<EducationPlanRow>(
    `SELECT p.*, cl.name AS class_name, u.full_name AS created_by_name FROM education_plans p
     LEFT JOIN classes cl ON cl.id = p.class_id
     JOIN users u ON u.id = p.created_by
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

async function nextPlanSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM education_plans", []);
  return (rows[0]?.n ?? 0) + 1;
}

export interface CreateEducationPlanInput {
  schoolYearId: string;
  classId?: string;
  planType: PlanType;
  title: string;
  ageGroup?: string;
  periodStart?: string;
  periodEnd?: string;
  objectives?: string;
  requirements?: string;
  content?: string;
  activities?: string;
  environment?: string;
  materials?: string;
  methods?: string;
  createdBy: string;
  sessionId: string | null;
}

export async function createEducationPlan(input: CreateEducationPlanInput): Promise<string> {
  const id = newId();
  const seq = await nextPlanSequence();
  const year = new Date().getFullYear();
  const code = `KHGD-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();

  await dbExecute(
    `INSERT INTO education_plans (id, code, school_year_id, class_id, plan_type, title, age_group,
      period_start, period_end, objectives, requirements, content, activities, environment,
      materials, methods, status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`,
    [
      id,
      code,
      input.schoolYearId,
      input.classId ?? null,
      input.planType,
      input.title,
      input.ageGroup ?? null,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.objectives ?? null,
      input.requirements ?? null,
      input.content ?? null,
      input.activities ?? null,
      input.environment ?? null,
      input.materials ?? null,
      input.methods ?? null,
      input.createdBy,
      ts,
      input.createdBy,
      ts,
    ],
  );

  await logAudit({
    entityTable: "education_plans",
    entityId: id,
    action: "create",
    afterJson: { code, title: input.title },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return id;
}

export async function updateEducationPlanContent(
  id: string,
  fields: Partial<
    Pick<
      EducationPlanRow,
      | "objectives"
      | "requirements"
      | "content"
      | "activities"
      | "environment"
      | "materials"
      | "methods"
      | "evaluation"
      | "adjustment"
    >
  >,
  updatedBy: string,
  sessionId: string | null,
): Promise<void> {
  await dbExecute(
    `UPDATE education_plans SET objectives = ?, requirements = ?, content = ?, activities = ?,
     environment = ?, materials = ?, methods = ?, evaluation = ?, adjustment = ?,
     version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?`,
    [
      fields.objectives ?? null,
      fields.requirements ?? null,
      fields.content ?? null,
      fields.activities ?? null,
      fields.environment ?? null,
      fields.materials ?? null,
      fields.methods ?? null,
      fields.evaluation ?? null,
      fields.adjustment ?? null,
      updatedBy,
      nowIso(),
      id,
    ],
  );
  await logAudit({
    entityTable: "education_plans",
    entityId: id,
    action: "update",
    userId: updatedBy,
    sessionId,
  });
}

/** Quy trình: Giáo viên soạn → Tổ trưởng góp ý → Phó hiệu trưởng duyệt → thực hiện → đánh giá → điều chỉnh. */
export async function changeEducationPlanStatus(
  id: string,
  toStatus: RecordStatus,
  action: "submit" | "approve" | "reject" | "publish",
  actorId: string,
  sessionId: string | null,
  comment?: string,
): Promise<void> {
  const plan = await getEducationPlanById(id);
  if (!plan) throw new Error("Không tìm thấy kế hoạch giáo dục");
  const fromStatus = plan.status;

  await dbExecute(
    "UPDATE education_plans SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, actorId, nowIso(), id],
  );
  await dbExecute(
    `INSERT INTO approvals (id, entity_table, entity_id, step_no, approver_id, action, comment, from_status, to_status, acted_at)
     VALUES (?, 'education_plans', ?, 1, ?, ?, ?, ?, ?, ?)`,
    [newId(), id, actorId, action, comment ?? null, fromStatus, toStatus, nowIso()],
  );
  await logAudit({
    entityTable: "education_plans",
    entityId: id,
    action: `status_change:${fromStatus}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

export interface PlanApprovalRow {
  id: string;
  approver_name: string;
  action: string;
  comment: string | null;
  from_status: RecordStatus | null;
  to_status: RecordStatus | null;
  acted_at: string;
}

export async function listPlanApprovals(planId: string): Promise<PlanApprovalRow[]> {
  return dbSelect<PlanApprovalRow>(
    `SELECT a.id, u.full_name AS approver_name, a.action, a.comment, a.from_status, a.to_status, a.acted_at
     FROM approvals a JOIN users u ON u.id = a.approver_id
     WHERE a.entity_table = 'education_plans' AND a.entity_id = ?
     ORDER BY a.acted_at ASC`,
    [planId],
  );
}

// ===================== NHẬT KÝ QUAN SÁT =====================

export interface ObservationRow {
  id: string;
  child_id: string;
  child_name: string;
  observed_date: string;
  content: string;
  teacher_name: string;
  created_at: string;
}

export async function listObservationsByChild(childId: string): Promise<ObservationRow[]> {
  return dbSelect<ObservationRow>(
    `SELECT o.id, o.child_id, ch.full_name AS child_name, o.observed_date, o.content,
       u.full_name AS teacher_name, o.created_at
     FROM observations o
     JOIN children ch ON ch.id = o.child_id
     JOIN users u ON u.id = o.teacher_id
     WHERE o.child_id = ? ORDER BY o.observed_date DESC`,
    [childId],
  );
}

export async function addObservation(
  childId: string,
  classId: string,
  observedDate: string,
  content: string,
  teacherId: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO observations (id, child_id, class_id, observed_date, content, teacher_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), childId, classId, observedDate, content, teacherId, nowIso()],
  );
}

// ===================== ĐÁNH GIÁ SỰ PHÁT TRIỂN TRẺ =====================

export interface ChildAssessmentRow {
  id: string;
  child_id: string;
  period: string;
  domain: AssessmentDomain;
  result: string;
  note: string | null;
  assessed_by_name: string;
  assessed_at: string;
}

export async function listChildAssessments(childId: string): Promise<ChildAssessmentRow[]> {
  return dbSelect<ChildAssessmentRow>(
    `SELECT a.id, a.child_id, a.period, a.domain, a.result, a.note, u.full_name AS assessed_by_name, a.assessed_at
     FROM child_assessments a JOIN users u ON u.id = a.assessed_by
     WHERE a.child_id = ? ORDER BY a.assessed_at DESC`,
    [childId],
  );
}

export async function addChildAssessment(
  childId: string,
  schoolYearId: string,
  period: string,
  domain: AssessmentDomain,
  result: string,
  note: string | undefined,
  assessedBy: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO child_assessments (id, child_id, school_year_id, period, domain, result, note, assessed_by, assessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), childId, schoolYearId, period, domain, result, note ?? null, assessedBy, nowIso()],
  );
}
