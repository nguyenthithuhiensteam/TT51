import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { PagedResult } from "./taskRepo";
import type { AssessmentDomain, PlanType, RecordStatus } from "./types";

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return "";
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? "") : "";
}

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

async function listAllPlans(): Promise<EducationPlanRow[]> {
  const snap = await getDocs(collection(db, COL.educationPlans));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<EducationPlanRow, "id">) }))
    .filter((p) => !(p as unknown as { deleted_at?: string }).deleted_at);
}

export async function listEducationPlans(params: PlanListParams): Promise<PagedResult<EducationPlanRow>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  let items = await listAllPlans();

  if (params.planType && params.planType !== "all") {
    items = items.filter((p) => p.plan_type === params.planType);
  }
  if (params.status && params.status !== "all") {
    items = items.filter((p) => p.status === params.status);
  }
  if (params.search) {
    const s = params.search.toLowerCase();
    items = items.filter((p) => p.title.toLowerCase().includes(s) || p.code.toLowerCase().includes(s));
  }
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

export async function getEducationPlanById(id: string): Promise<EducationPlanRow | null> {
  const snap = await getDoc(doc(db, COL.educationPlans, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<EducationPlanRow, "id">) };
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
  const countSnap = await getCountFromServer(collection(db, COL.educationPlans));
  const seq = countSnap.data().count + 1;
  const year = new Date().getFullYear();
  const code = `KHGD-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  const className = input.classId ? ((await getDoc(doc(db, COL.classes, input.classId))).data()?.name ?? null) : null;

  const ref = await addDoc(collection(db, COL.educationPlans), {
    code,
    school_year_id: input.schoolYearId,
    class_id: input.classId ?? null,
    class_name: className,
    plan_type: input.planType,
    title: input.title,
    age_group: input.ageGroup ?? null,
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
    objectives: input.objectives ?? null,
    requirements: input.requirements ?? null,
    content: input.content ?? null,
    activities: input.activities ?? null,
    environment: input.environment ?? null,
    materials: input.materials ?? null,
    methods: input.methods ?? null,
    evaluation: null,
    adjustment: null,
    status: "draft" as RecordStatus,
    version: 1,
    created_by: input.createdBy,
    created_by_name: await getUserName(input.createdBy),
    created_at: ts,
    updated_at: ts,
  });

  await logAudit({
    entityTable: "education_plans",
    entityId: ref.id,
    action: "create",
    afterJson: { code, title: input.title },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return ref.id;
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
  const before = await getEducationPlanById(id);
  await updateDoc(doc(db, COL.educationPlans, id), {
    objectives: fields.objectives ?? null,
    requirements: fields.requirements ?? null,
    content: fields.content ?? null,
    activities: fields.activities ?? null,
    environment: fields.environment ?? null,
    materials: fields.materials ?? null,
    methods: fields.methods ?? null,
    evaluation: fields.evaluation ?? null,
    adjustment: fields.adjustment ?? null,
    version: (before?.version ?? 1) + 1,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "education_plans",
    entityId: id,
    action: "update",
    userId: updatedBy,
    sessionId,
  });
}

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

  await updateDoc(doc(db, COL.educationPlans, id), {
    status: toStatus,
    version: plan.version + 1,
    updated_at: nowIso(),
  });
  await addDoc(collection(db, COL.planApprovals), {
    plan_id: id,
    approver_id: actorId,
    approver_name: await getUserName(actorId),
    action,
    comment: comment ?? null,
    from_status: fromStatus,
    to_status: toStatus,
    acted_at: nowIso(),
  });
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
  const snap = await getDocs(
    query(collection(db, COL.planApprovals), where("plan_id", "==", planId), orderBy("acted_at", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlanApprovalRow, "id">) }));
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
  const snap = await getDocs(
    query(collection(db, COL.observations), where("child_id", "==", childId), orderBy("observed_date", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ObservationRow, "id">) }));
}

export async function addObservation(
  childId: string,
  classId: string,
  observedDate: string,
  content: string,
  teacherId: string,
): Promise<void> {
  const childSnap = await getDoc(doc(db, COL.children, childId));
  await addDoc(collection(db, COL.observations), {
    child_id: childId,
    child_name: childSnap.exists() ? (childSnap.data().full_name as string) : "",
    class_id: classId,
    observed_date: observedDate,
    content,
    teacher_id: teacherId,
    teacher_name: await getUserName(teacherId),
    created_at: nowIso(),
  });
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
  const snap = await getDocs(
    query(collection(db, COL.childAssessments), where("child_id", "==", childId), orderBy("assessed_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChildAssessmentRow, "id">) }));
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
  await addDoc(collection(db, COL.childAssessments), {
    child_id: childId,
    school_year_id: schoolYearId,
    period,
    domain,
    result,
    note: note ?? null,
    assessed_by: assessedBy,
    assessed_by_name: await getUserName(assessedBy),
    assessed_at: nowIso(),
  });
}
