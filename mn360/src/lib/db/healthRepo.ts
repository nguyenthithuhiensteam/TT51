import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { IncidentSeverity, PhysicalExamSpecialtyFields, RecordStatus, SafetyArea } from "./types";

// ===================== HỒ SƠ SỨC KHỎE =====================

export interface HealthRecordRow {
  id: string;
  child_id: string;
  blood_type: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  note: string | null;
  updated_at: string;
}

export async function getHealthRecord(childId: string): Promise<HealthRecordRow | null> {
  const rows = await dbSelect<HealthRecordRow>("SELECT * FROM health_records WHERE child_id = ?", [
    childId,
  ]);
  return rows[0] ?? null;
}

export async function upsertHealthRecord(
  childId: string,
  data: { bloodType?: string; chronicConditions?: string; allergies?: string; note?: string },
  userId: string,
): Promise<void> {
  const existing = await getHealthRecord(childId);
  const ts = nowIso();
  if (existing) {
    await dbExecute(
      `UPDATE health_records SET blood_type = ?, chronic_conditions = ?, allergies = ?, note = ?,
       version = version + 1, updated_by = ?, updated_at = ? WHERE child_id = ?`,
      [
        data.bloodType ?? null,
        data.chronicConditions ?? null,
        data.allergies ?? null,
        data.note ?? null,
        userId,
        ts,
        childId,
      ],
    );
  } else {
    await dbExecute(
      `INSERT INTO health_records (id, child_id, blood_type, chronic_conditions, allergies, note,
        version, created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        newId(),
        childId,
        data.bloodType ?? null,
        data.chronicConditions ?? null,
        data.allergies ?? null,
        data.note ?? null,
        userId,
        ts,
        userId,
        ts,
      ],
    );
  }
  await logAudit({
    entityTable: "health_records",
    entityId: childId,
    action: existing ? "update" : "create",
    userId,
    sessionId: null,
  });
}

// ===================== TĂNG TRƯỞNG =====================

export interface GrowthRow {
  id: string;
  measured_date: string;
  height_cm: number;
  weight_kg: number;
  note: string | null;
}

export async function listGrowthMeasurements(childId: string): Promise<GrowthRow[]> {
  return dbSelect<GrowthRow>(
    "SELECT id, measured_date, height_cm, weight_kg, note FROM growth_measurements WHERE child_id = ? ORDER BY measured_date ASC",
    [childId],
  );
}

export async function addGrowthMeasurement(
  childId: string,
  date: string,
  heightCm: number,
  weightKg: number,
  note: string | undefined,
  measuredBy: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO growth_measurements (id, child_id, measured_date, height_cm, weight_kg, note, measured_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(child_id, measured_date) DO UPDATE SET
       height_cm = excluded.height_cm, weight_kg = excluded.weight_kg, note = excluded.note`,
    [newId(), childId, date, heightCm, weightKg, note ?? null, measuredBy, nowIso()],
  );
}

// ===================== TIÊM CHỦNG =====================

export interface VaccinationRow {
  id: string;
  vaccine_name: string;
  dose_no: number;
  vaccinated_date: string;
  place: string | null;
  note: string | null;
}

export async function listVaccinations(childId: string): Promise<VaccinationRow[]> {
  return dbSelect<VaccinationRow>(
    "SELECT id, vaccine_name, dose_no, vaccinated_date, place, note FROM vaccinations WHERE child_id = ? ORDER BY vaccinated_date DESC",
    [childId],
  );
}

export async function addVaccination(
  childId: string,
  vaccineName: string,
  doseNo: number,
  date: string,
  place: string | undefined,
  note: string | undefined,
  createdBy: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO vaccinations (id, child_id, vaccine_name, dose_no, vaccinated_date, place, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), childId, vaccineName, doseNo, date, place ?? null, note ?? null, createdBy, nowIso()],
  );
}

// ===================== KHÁM SỨC KHỎE TOÀN DIỆN =====================

export interface PhysicalExamRow extends PhysicalExamSpecialtyFields {
  id: string | null;
  child_id: string;
  full_name: string;
  code: string;
  exam_no: number;
  exam_date: string | null;
  xep_loai: string | null;
  ket_luan: string | null;
}

export interface PhysicalExamRound {
  examNo: number;
  examDate: string;
}

export async function listPhysicalExamRounds(classId: string): Promise<PhysicalExamRound[]> {
  const rows = await dbSelect<{ exam_no: number; exam_date: string }>(
    `SELECT exam_no, MAX(exam_date) AS exam_date FROM physical_exams
     WHERE class_id = ? GROUP BY exam_no ORDER BY exam_no ASC`,
    [classId],
  );
  return rows.map((r) => ({ examNo: r.exam_no, examDate: r.exam_date }));
}

/** Lưới khám sức khỏe của một lớp cho một đợt khám (Lần N) — trẻ đang học trong lớp, kèm kết
 * quả đã có (nếu đợt khám đó đã nhập cho trẻ này). */
export async function getPhysicalExamGrid(classId: string, examNo: number): Promise<PhysicalExamRow[]> {
  return dbSelect<PhysicalExamRow>(
    `SELECT ch.id AS child_id, ch.code AS code, ch.full_name AS full_name,
       ? AS exam_no, pe.id AS id, pe.exam_date AS exam_date,
       pe.tai_mui_hong AS tai_mui_hong, pe.rang_ham_mat AS rang_ham_mat,
       pe.co_xuong_khop AS co_xuong_khop, pe.tim_mach AS tim_mach, pe.ho_hap AS ho_hap,
       pe.tam_than_kinh AS tam_than_kinh, pe.mat AS mat, pe.benh_khac AS benh_khac,
       pe.xep_loai AS xep_loai, pe.ket_luan AS ket_luan
     FROM children ch
     LEFT JOIN physical_exams pe ON pe.child_id = ch.id AND pe.exam_no = ?
     WHERE ch.class_id = ? AND ch.deleted_at IS NULL AND ch.status = 'studying'
     ORDER BY ch.full_name ASC`,
    [examNo, examNo, classId],
  );
}

export interface UpsertPhysicalExamInput extends PhysicalExamSpecialtyFields {
  xepLoai: string;
  ketLuan: string;
}

export async function upsertPhysicalExam(
  childId: string,
  classId: string,
  examNo: number,
  examDate: string,
  data: UpsertPhysicalExamInput,
  userId: string,
): Promise<void> {
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO physical_exams (id, child_id, class_id, exam_no, exam_date, tai_mui_hong,
       rang_ham_mat, co_xuong_khop, tim_mach, ho_hap, tam_than_kinh, mat, benh_khac, xep_loai,
       ket_luan, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(child_id, exam_no) DO UPDATE SET
       class_id = excluded.class_id, exam_date = excluded.exam_date,
       tai_mui_hong = excluded.tai_mui_hong, rang_ham_mat = excluded.rang_ham_mat,
       co_xuong_khop = excluded.co_xuong_khop, tim_mach = excluded.tim_mach,
       ho_hap = excluded.ho_hap, tam_than_kinh = excluded.tam_than_kinh, mat = excluded.mat,
       benh_khac = excluded.benh_khac, xep_loai = excluded.xep_loai, ket_luan = excluded.ket_luan,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    [
      newId(),
      childId,
      classId,
      examNo,
      examDate,
      data.tai_mui_hong || null,
      data.rang_ham_mat || null,
      data.co_xuong_khop || null,
      data.tim_mach || null,
      data.ho_hap || null,
      data.tam_than_kinh || null,
      data.mat || null,
      data.benh_khac || null,
      data.xepLoai || null,
      data.ketLuan || "Bình thường",
      userId,
      ts,
      userId,
      ts,
    ],
  );
  await logAudit({
    entityTable: "physical_exams",
    entityId: `${childId}:${examNo}`,
    action: "upsert",
    userId,
    sessionId: null,
  });
}

// ===================== SỰ CỐ / TAI NẠN =====================

export interface IncidentRow {
  id: string;
  code: string;
  child_name: string | null;
  class_name: string | null;
  occurred_at: string;
  category: "accident" | "health" | "other";
  severity: IncidentSeverity;
  description: string;
  actions_taken: string | null;
  reported_by_name: string;
}

export async function listIncidents(limit = 50): Promise<IncidentRow[]> {
  return dbSelect<IncidentRow>(
    `SELECT i.id, i.code, ch.full_name AS child_name, cl.name AS class_name, i.occurred_at,
       i.category, i.severity, i.description, i.actions_taken, u.full_name AS reported_by_name
     FROM incidents i
     LEFT JOIN children ch ON ch.id = i.child_id
     LEFT JOIN classes cl ON cl.id = i.class_id
     JOIN users u ON u.id = i.reported_by
     ORDER BY i.occurred_at DESC LIMIT ?`,
    [limit],
  );
}

async function nextIncidentSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM incidents", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createIncident(input: {
  childId?: string;
  classId?: string;
  occurredAt: string;
  category: "accident" | "health" | "other";
  severity: IncidentSeverity;
  description: string;
  actionsTaken?: string;
  reportedBy: string;
}): Promise<void> {
  const seq = await nextIncidentSequence();
  const year = new Date().getFullYear();
  const code = `SC-${year}-${String(seq).padStart(4, "0")}`;
  await dbExecute(
    `INSERT INTO incidents (id, code, child_id, class_id, occurred_at, category, severity,
      description, actions_taken, reported_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      code,
      input.childId ?? null,
      input.classId ?? null,
      input.occurredAt,
      input.category,
      input.severity,
      input.description,
      input.actionsTaken ?? null,
      input.reportedBy,
      nowIso(),
    ],
  );
}

// ===================== KIỂM TRA AN TOÀN =====================

export interface SafetyInspectionRow {
  id: string;
  code: string;
  area: SafetyArea;
  inspection_date: string;
  checklist_result: string | null;
  risk_level: IncidentSeverity;
  remediation_plan: string | null;
  status: RecordStatus;
  inspected_by_name: string;
  created_at: string;
}

export async function listSafetyInspections(limit = 50): Promise<SafetyInspectionRow[]> {
  return dbSelect<SafetyInspectionRow>(
    `SELECT s.*, u.full_name AS inspected_by_name FROM safety_inspections s
     JOIN users u ON u.id = s.inspected_by
     ORDER BY s.inspection_date DESC LIMIT ?`,
    [limit],
  );
}

async function nextSafetyInspectionSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM safety_inspections", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createSafetyInspection(input: {
  area: SafetyArea;
  inspectionDate: string;
  checklistResult?: string;
  riskLevel: IncidentSeverity;
  remediationPlan?: string;
  inspectedBy: string;
}): Promise<string> {
  const id = newId();
  const seq = await nextSafetyInspectionSequence();
  const year = new Date().getFullYear();
  const code = `AT-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO safety_inspections (id, code, area, inspection_date, checklist_result, risk_level,
      remediation_plan, status, inspected_by, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?, ?, ?)`,
    [
      id,
      code,
      input.area,
      input.inspectionDate,
      input.checklistResult ?? null,
      input.riskLevel,
      input.remediationPlan ?? null,
      input.inspectedBy,
      input.inspectedBy,
      ts,
      input.inspectedBy,
      ts,
    ],
  );
  return id;
}

export async function changeSafetyInspectionStatus(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
): Promise<void> {
  const rows = await dbSelect<{ status: RecordStatus }>(
    "SELECT status FROM safety_inspections WHERE id = ?",
    [id],
  );
  const fromStatus = rows[0]?.status ?? "draft";
  await dbExecute(
    "UPDATE safety_inspections SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, actorId, nowIso(), id],
  );
  await logAudit({
    entityTable: "safety_inspections",
    entityId: id,
    action: `status_change:${fromStatus}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}
