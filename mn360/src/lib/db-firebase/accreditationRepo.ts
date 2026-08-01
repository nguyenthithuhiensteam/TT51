import { addDoc, collection, doc, getCountFromServer, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { RecordStatus } from "./types";

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return "";
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? "") : "";
}

// ===================== TIÊU CHUẨN / TIÊU CHÍ =====================

export interface StandardRow {
  id: string;
  code: string;
  name: string;
  order_no: number;
}

export async function listStandards(): Promise<StandardRow[]> {
  const snap = await getDocs(query(collection(db, COL.accreditationStandards), orderBy("order_no", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StandardRow, "id">) }));
}

export async function createStandard(code: string, name: string, orderNo: number): Promise<void> {
  const ts = nowIso();
  await addDoc(collection(db, COL.accreditationStandards), { code, name, order_no: orderNo, created_at: ts, updated_at: ts });
}

export interface CriteriaRow {
  id: string;
  standard_id: string;
  standard_name: string;
  code: string;
  name: string;
  order_no: number;
  current_status_note: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_plan: string | null;
  status: RecordStatus;
  version: number;
  created_by: string;
  updated_at: string;
}

export async function listCriteria(standardId?: string): Promise<CriteriaRow[]> {
  const snap = await getDocs(collection(db, COL.accreditationCriteria));
  let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CriteriaRow, "id">) }));
  if (standardId) items = items.filter((c) => c.standard_id === standardId);
  return items.sort((a, b) => a.order_no - b.order_no);
}

export async function getCriteriaById(id: string): Promise<CriteriaRow | null> {
  const snap = await getDoc(doc(db, COL.accreditationCriteria, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<CriteriaRow, "id">) };
}

export async function createCriteria(standardId: string, code: string, name: string, orderNo: number, createdBy: string): Promise<string> {
  const standardSnap = await getDoc(doc(db, COL.accreditationStandards, standardId));
  const ts = nowIso();
  const ref = await addDoc(collection(db, COL.accreditationCriteria), {
    standard_id: standardId,
    standard_name: standardSnap.exists() ? (standardSnap.data().name as string) : "",
    code,
    name,
    order_no: orderNo,
    current_status_note: null,
    strengths: null,
    weaknesses: null,
    improvement_plan: null,
    status: "draft" as RecordStatus,
    version: 1,
    created_by: createdBy,
    created_at: ts,
    updated_by: createdBy,
    updated_at: ts,
  });
  return ref.id;
}

export async function updateCriteriaSelfAssessment(
  id: string,
  fields: { currentStatusNote?: string; strengths?: string; weaknesses?: string; improvementPlan?: string },
  userId: string,
): Promise<void> {
  const before = await getCriteriaById(id);
  await updateDoc(doc(db, COL.accreditationCriteria, id), {
    current_status_note: fields.currentStatusNote ?? null,
    strengths: fields.strengths ?? null,
    weaknesses: fields.weaknesses ?? null,
    improvement_plan: fields.improvementPlan ?? null,
    version: (before?.version ?? 1) + 1,
    updated_by: userId,
    updated_at: nowIso(),
  });
  await logAudit({ entityTable: "accreditation_criteria", entityId: id, action: "update", userId, sessionId: null });
}

export async function changeCriteriaStatus(
  id: string,
  toStatus: RecordStatus,
  action: "submit" | "approve" | "reject",
  actorId: string,
  sessionId: string | null,
  comment?: string,
): Promise<void> {
  const criteria = await getCriteriaById(id);
  if (!criteria) throw new Error("Không tìm thấy tiêu chí");
  await updateDoc(doc(db, COL.accreditationCriteria, id), { status: toStatus, version: criteria.version + 1, updated_by: actorId, updated_at: nowIso() });
  await addDoc(collection(db, COL.planApprovals), {
    plan_id: id,
    approver_id: actorId,
    approver_name: await getUserName(actorId),
    action,
    comment: comment ?? null,
    from_status: criteria.status,
    to_status: toStatus,
    acted_at: nowIso(),
  });
  await logAudit({
    entityTable: "accreditation_criteria",
    entityId: id,
    action: `status_change:${criteria.status}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

export interface CriteriaAssignmentRow {
  id: string;
  assignee_id: string;
  assignee_name: string;
}

function assignmentDocId(criteriaId: string, assigneeId: string): string {
  return `${criteriaId}_${assigneeId}`;
}

export async function listCriteriaAssignments(criteriaId: string): Promise<CriteriaAssignmentRow[]> {
  const snap = await getDocs(query(collection(db, COL.criteriaAssignments), where("criteria_id", "==", criteriaId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CriteriaAssignmentRow, "id">) }));
}

export async function assignCriteria(criteriaId: string, assigneeId: string, assignedBy: string): Promise<void> {
  await setDoc(doc(db, COL.criteriaAssignments, assignmentDocId(criteriaId, assigneeId)), {
    criteria_id: criteriaId,
    assignee_id: assigneeId,
    assignee_name: await getUserName(assigneeId),
    assigned_by: assignedBy,
    created_at: nowIso(),
  });
}

// ===================== KHO MINH CHỨNG =====================

export interface EvidenceRow {
  id: string;
  code: string;
  file_name: string;
  file_path: string;
  description: string | null;
  uploaded_by_name: string;
  uploaded_at: string;
}

export async function listEvidenceFiles(search?: string): Promise<EvidenceRow[]> {
  const snap = await getDocs(collection(db, COL.evidenceFiles));
  let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EvidenceRow, "id">) }));
  if (search) {
    const s = search.toLowerCase();
    items = items.filter((e) => e.file_name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s));
  }
  return items.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

export async function createEvidence(fileName: string, filePath: string, description: string | undefined, uploadedBy: string): Promise<string> {
  const countSnap = await getCountFromServer(collection(db, COL.evidenceFiles));
  const code = `MC-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ref = await addDoc(collection(db, COL.evidenceFiles), {
    code,
    file_name: fileName,
    file_path: filePath,
    description: description ?? null,
    uploaded_by: uploadedBy,
    uploaded_by_name: await getUserName(uploadedBy),
    uploaded_at: nowIso(),
  });
  return ref.id;
}

export async function listEvidenceForCriteria(criteriaId: string): Promise<EvidenceRow[]> {
  const linksSnap = await getDocs(query(collection(db, COL.criteriaEvidenceLinks), where("criteria_id", "==", criteriaId)));
  const evidenceIds = linksSnap.docs.map((d) => d.data().evidence_id as string);
  const evidences = await Promise.all(evidenceIds.map((id) => getDoc(doc(db, COL.evidenceFiles, id))));
  return evidences
    .filter((s) => s.exists())
    .map((s) => ({ id: s.id, ...(s.data() as Omit<EvidenceRow, "id">) }))
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

export async function linkEvidenceToCriteria(criteriaId: string, evidenceId: string, linkedBy: string): Promise<void> {
  await setDoc(doc(db, COL.criteriaEvidenceLinks, `${criteriaId}_${evidenceId}`), {
    criteria_id: criteriaId,
    evidence_id: evidenceId,
    linked_by: linkedBy,
    created_at: nowIso(),
  });
}
