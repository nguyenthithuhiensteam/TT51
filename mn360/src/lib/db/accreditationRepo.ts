import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { RecordStatus } from "./types";

// ===================== TIÊU CHUẨN / TIÊU CHÍ =====================

export interface StandardRow {
  id: string;
  code: string;
  name: string;
  order_no: number;
}

export async function listStandards(): Promise<StandardRow[]> {
  return dbSelect<StandardRow>("SELECT * FROM accreditation_standards ORDER BY order_no ASC");
}

export async function createStandard(code: string, name: string, orderNo: number): Promise<void> {
  const ts = nowIso();
  await dbExecute(
    "INSERT INTO accreditation_standards (id, code, name, order_no, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [newId(), code, name, orderNo, ts, ts],
  );
}

export interface CriteriaRow {
  id: string;
  standard_id: string;
  standard_name: string;
  code: string;
  name: string;
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
  const where = standardId ? "WHERE c.standard_id = ?" : "";
  const args = standardId ? [standardId] : [];
  return dbSelect<CriteriaRow>(
    `SELECT c.*, s.name AS standard_name FROM accreditation_criteria c
     JOIN accreditation_standards s ON s.id = c.standard_id
     ${where}
     ORDER BY s.order_no ASC, c.order_no ASC`,
    args,
  );
}

export async function getCriteriaById(id: string): Promise<CriteriaRow | null> {
  const rows = await dbSelect<CriteriaRow>(
    `SELECT c.*, s.name AS standard_name FROM accreditation_criteria c
     JOIN accreditation_standards s ON s.id = c.standard_id
     WHERE c.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createCriteria(
  standardId: string,
  code: string,
  name: string,
  orderNo: number,
  createdBy: string,
): Promise<string> {
  const id = newId();
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO accreditation_criteria (id, standard_id, code, name, order_no, status, version,
      created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`,
    [id, standardId, code, name, orderNo, createdBy, ts, createdBy, ts],
  );
  return id;
}

export async function updateCriteriaSelfAssessment(
  id: string,
  fields: {
    currentStatusNote?: string;
    strengths?: string;
    weaknesses?: string;
    improvementPlan?: string;
  },
  userId: string,
): Promise<void> {
  await dbExecute(
    `UPDATE accreditation_criteria SET current_status_note = ?, strengths = ?, weaknesses = ?,
     improvement_plan = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?`,
    [
      fields.currentStatusNote ?? null,
      fields.strengths ?? null,
      fields.weaknesses ?? null,
      fields.improvementPlan ?? null,
      userId,
      nowIso(),
      id,
    ],
  );
  await logAudit({
    entityTable: "accreditation_criteria",
    entityId: id,
    action: "update",
    userId,
    sessionId: null,
  });
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
  await dbExecute(
    "UPDATE accreditation_criteria SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, actorId, nowIso(), id],
  );
  await dbExecute(
    `INSERT INTO approvals (id, entity_table, entity_id, step_no, approver_id, action, comment, from_status, to_status, acted_at)
     VALUES (?, 'accreditation_criteria', ?, 1, ?, ?, ?, ?, ?, ?)`,
    [newId(), id, actorId, action, comment ?? null, criteria.status, toStatus, nowIso()],
  );
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

export async function listCriteriaAssignments(criteriaId: string): Promise<CriteriaAssignmentRow[]> {
  return dbSelect<CriteriaAssignmentRow>(
    `SELECT ca.id, ca.assignee_id, u.full_name AS assignee_name FROM criteria_assignments ca
     JOIN users u ON u.id = ca.assignee_id
     WHERE ca.criteria_id = ?`,
    [criteriaId],
  );
}

export async function assignCriteria(criteriaId: string, assigneeId: string, assignedBy: string): Promise<void> {
  await dbExecute(
    "INSERT OR IGNORE INTO criteria_assignments (id, criteria_id, assignee_id, assigned_by, created_at) VALUES (?, ?, ?, ?, ?)",
    [newId(), criteriaId, assigneeId, assignedBy, nowIso()],
  );
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
  const where = search ? "WHERE (e.file_name LIKE ? OR e.code LIKE ?)" : "";
  const args = search ? [`%${search}%`, `%${search}%`] : [];
  return dbSelect<EvidenceRow>(
    `SELECT e.*, u.full_name AS uploaded_by_name FROM evidence_files e
     JOIN users u ON u.id = e.uploaded_by
     ${where}
     ORDER BY e.uploaded_at DESC`,
    args,
  );
}

async function nextEvidenceSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM evidence_files", []);
  return (rows[0]?.n ?? 0) + 1;
}

/** Đăng ký một minh chứng mới trong kho — mỗi tệp chỉ tải lên một lần, sau đó liên kết N-N với tiêu chí. */
export async function createEvidence(
  fileName: string,
  filePath: string,
  description: string | undefined,
  uploadedBy: string,
): Promise<string> {
  const id = newId();
  const seq = await nextEvidenceSequence();
  const code = `MC-${String(seq).padStart(4, "0")}`;
  await dbExecute(
    "INSERT INTO evidence_files (id, code, file_name, file_path, description, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, code, fileName, filePath, description ?? null, uploadedBy, nowIso()],
  );
  return id;
}

export async function listEvidenceForCriteria(criteriaId: string): Promise<EvidenceRow[]> {
  return dbSelect<EvidenceRow>(
    `SELECT e.*, u.full_name AS uploaded_by_name FROM criteria_evidence_links cel
     JOIN evidence_files e ON e.id = cel.evidence_id
     JOIN users u ON u.id = e.uploaded_by
     WHERE cel.criteria_id = ?
     ORDER BY e.uploaded_at DESC`,
    [criteriaId],
  );
}

/** Liên kết một minh chứng có sẵn với tiêu chí — không tạo bản sao, không tải lại tệp. */
export async function linkEvidenceToCriteria(
  criteriaId: string,
  evidenceId: string,
  linkedBy: string,
): Promise<void> {
  await dbExecute(
    "INSERT OR IGNORE INTO criteria_evidence_links (id, criteria_id, evidence_id, linked_by, created_at) VALUES (?, ?, ?, ?, ?)",
    [newId(), criteriaId, evidenceId, linkedBy, nowIso()],
  );
}
