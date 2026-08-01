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
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { IncidentSeverity, PhysicalExamSpecialtyFields, RecordStatus, SafetyArea } from "./types";
import {
  ageInDays,
  calcZScore,
  classifyByIndicator,
  clampToWhoRange,
  type GrowthClassification,
  type GrowthIndicator,
} from "../utils/growth";

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return "";
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? "") : "";
}

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
  const snap = await getDoc(doc(db, COL.healthRecords, childId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<HealthRecordRow, "id">) };
}

export async function upsertHealthRecord(
  childId: string,
  data: { bloodType?: string; chronicConditions?: string; allergies?: string; note?: string },
  userId: string,
): Promise<void> {
  const existing = await getHealthRecord(childId);
  const ts = nowIso();
  await setDoc(doc(db, COL.healthRecords, childId), {
    child_id: childId,
    blood_type: data.bloodType ?? null,
    chronic_conditions: data.chronicConditions ?? null,
    allergies: data.allergies ?? null,
    note: data.note ?? null,
    version: (existing ? (existing as unknown as { version?: number }).version ?? 1 : 0) + 1,
    updated_by: userId,
    updated_at: ts,
  });
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

function growthDocId(childId: string, date: string): string {
  return `${childId}_${date}`;
}

export async function listGrowthMeasurements(childId: string): Promise<GrowthRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.growthMeasurements), where("child_id", "==", childId), orderBy("measured_date", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GrowthRow, "id">) }));
}

export async function addGrowthMeasurement(
  childId: string,
  date: string,
  heightCm: number,
  weightKg: number,
  note: string | undefined,
  measuredBy: string,
): Promise<void> {
  await setDoc(doc(db, COL.growthMeasurements, growthDocId(childId, date)), {
    child_id: childId,
    measured_date: date,
    height_cm: heightCm,
    weight_kg: weightKg,
    note: note ?? null,
    measured_by: measuredBy,
    created_at: nowIso(),
  });
}

// ===== ĐÁNH GIÁ PHÁT TRIỂN THEO CHUẨN WHO (Z-SCORE / SD) =====

interface WhoStandardTriple {
  l: number;
  m: number;
  s: number;
}

/** Đọc từ mn360_who_growth_standards/{sex}_{ageDays} (chưa có dữ liệu nhập sẵn cho bản web —
 * sẽ trả về null cho tới khi được nhập bằng script riêng; UI đã xử lý sẵn trường hợp "chưa
 * phân loại được" nên không lỗi, chỉ chưa tính được Z-score). */
async function getWhoStandards(
  sex: "male" | "female",
  ageDaysRaw: number,
): Promise<Record<GrowthIndicator, WhoStandardTriple | null>> {
  const ageDays = clampToWhoRange(ageDaysRaw);
  const snap = await getDoc(doc(db, COL.whoGrowthStandards, `${sex}_${ageDays}`));
  const empty: Record<GrowthIndicator, WhoStandardTriple | null> = { wfa: null, hfa: null, bmifa: null };
  if (!snap.exists()) return empty;
  const data = snap.data();
  return {
    wfa: (data.wfa as WhoStandardTriple) ?? null,
    hfa: (data.hfa as WhoStandardTriple) ?? null,
    bmifa: (data.bmifa as WhoStandardTriple) ?? null,
  };
}

export interface GrowthIndicatorAssessment {
  zScore: number;
  classification: GrowthClassification;
}

export interface GrowthAssessment {
  id: string;
  measured_date: string;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  age_months: number;
  wfa: GrowthIndicatorAssessment;
  hfa: GrowthIndicatorAssessment;
  bmifa: GrowthIndicatorAssessment;
}

function assessOne(indicator: GrowthIndicator, standard: WhoStandardTriple | null, value: number): GrowthIndicatorAssessment {
  if (!standard) return { zScore: NaN, classification: classifyByIndicator(indicator, NaN) };
  const z = calcZScore(standard.l, standard.m, standard.s, value);
  return { zScore: z, classification: classifyByIndicator(indicator, z) };
}

export async function getGrowthAssessments(childId: string): Promise<GrowthAssessment[]> {
  const childSnap = await getDoc(doc(db, COL.children, childId));
  if (!childSnap.exists()) return [];
  const child = childSnap.data() as { dob: string; gender: "male" | "female" };
  const measurements = await listGrowthMeasurements(childId);
  const results: GrowthAssessment[] = [];
  for (const m of measurements) {
    const ageDays = ageInDays(child.dob, m.measured_date);
    const standards = await getWhoStandards(child.gender, ageDays);
    const bmi = m.weight_kg / Math.pow(m.height_cm / 100, 2);
    results.push({
      id: m.id,
      measured_date: m.measured_date,
      height_cm: m.height_cm,
      weight_kg: m.weight_kg,
      bmi: Math.round(bmi * 100) / 100,
      age_months: Math.round((ageDays / 30.4375) * 10) / 10,
      wfa: assessOne("wfa", standards.wfa, m.weight_kg),
      hfa: assessOne("hfa", standards.hfa, m.height_cm),
      bmifa: assessOne("bmifa", standards.bmifa, bmi),
    });
  }
  return results;
}

export interface GrowthSummaryCounts {
  total: number;
  wfa: Record<string, number>;
  hfa: Record<string, number>;
  bmifa: Record<string, number>;
}

function emptyGrowthSummary(): GrowthSummaryCounts {
  return { total: 0, wfa: {}, hfa: {}, bmifa: {} };
}

function tally(counts: Record<string, number>, code: string) {
  counts[code] = (counts[code] ?? 0) + 1;
}

export async function getGrowthSummary(scope: { classId: string } | { schoolYearId: string }): Promise<GrowthSummaryCounts> {
  const childrenSnap = await getDocs(
    "classId" in scope
      ? query(collection(db, COL.children), where("class_id", "==", scope.classId))
      : query(collection(db, COL.children), where("school_year_id", "==", scope.schoolYearId)),
  );
  const summary = emptyGrowthSummary();
  for (const childDoc of childrenSnap.docs) {
    if (childDoc.data().deleted_at) continue;
    const measurements = await listGrowthMeasurements(childDoc.id);
    if (measurements.length === 0) continue;
    const latest = measurements[measurements.length - 1];
    const child = childDoc.data() as { dob: string; gender: "male" | "female" };
    const ageDays = ageInDays(child.dob, latest.measured_date);
    const standards = await getWhoStandards(child.gender, ageDays);
    const bmi = latest.weight_kg / Math.pow(latest.height_cm / 100, 2);
    summary.total += 1;
    tally(summary.wfa, assessOne("wfa", standards.wfa, latest.weight_kg).classification.code);
    tally(summary.hfa, assessOne("hfa", standards.hfa, latest.height_cm).classification.code);
    tally(summary.bmifa, assessOne("bmifa", standards.bmifa, bmi).classification.code);
  }
  return summary;
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
  const snap = await getDocs(
    query(collection(db, COL.vaccinations), where("child_id", "==", childId), orderBy("vaccinated_date", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VaccinationRow, "id">) }));
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
  await addDoc(collection(db, COL.vaccinations), {
    child_id: childId,
    vaccine_name: vaccineName,
    dose_no: doseNo,
    vaccinated_date: date,
    place: place ?? null,
    note: note ?? null,
    created_by: createdBy,
    created_at: nowIso(),
  });
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

function examDocId(childId: string, examNo: number): string {
  return `${childId}_${examNo}`;
}

export async function listPhysicalExamRounds(classId: string): Promise<PhysicalExamRound[]> {
  const snap = await getDocs(query(collection(db, COL.physicalExams), where("class_id", "==", classId)));
  const byRound = new Map<number, string>();
  for (const d of snap.docs) {
    const data = d.data();
    const examNo = data.exam_no as number;
    const examDate = data.exam_date as string;
    if (!byRound.has(examNo) || examDate > byRound.get(examNo)!) byRound.set(examNo, examDate);
  }
  return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([examNo, examDate]) => ({ examNo, examDate }));
}

export async function getPhysicalExamGrid(classId: string, examNo: number): Promise<PhysicalExamRow[]> {
  const childrenSnap = await getDocs(
    query(collection(db, COL.children), where("class_id", "==", classId), where("status", "==", "studying")),
  );
  const examSnap = await getDocs(
    query(collection(db, COL.physicalExams), where("class_id", "==", classId), where("exam_no", "==", examNo)),
  );
  const examByChild = new Map(examSnap.docs.map((d) => [d.data().child_id as string, { id: d.id, ...d.data() }]));

  return childrenSnap.docs
    .filter((d) => !d.data().deleted_at)
    .map((d) => {
      const child = d.data();
      const exam = examByChild.get(d.id) as (PhysicalExamSpecialtyFields & { id: string; exam_date: string; xep_loai: string | null; ket_luan: string | null }) | undefined;
      return {
        child_id: d.id,
        code: child.code,
        full_name: child.full_name,
        exam_no: examNo,
        id: exam?.id ?? null,
        exam_date: exam?.exam_date ?? null,
        tai_mui_hong: exam?.tai_mui_hong ?? null,
        rang_ham_mat: exam?.rang_ham_mat ?? null,
        co_xuong_khop: exam?.co_xuong_khop ?? null,
        tim_mach: exam?.tim_mach ?? null,
        ho_hap: exam?.ho_hap ?? null,
        tam_than_kinh: exam?.tam_than_kinh ?? null,
        mat: exam?.mat ?? null,
        benh_khac: exam?.benh_khac ?? null,
        xep_loai: exam?.xep_loai ?? null,
        ket_luan: exam?.ket_luan ?? null,
      } as PhysicalExamRow;
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
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
  await setDoc(doc(db, COL.physicalExams, examDocId(childId, examNo)), {
    child_id: childId,
    class_id: classId,
    exam_no: examNo,
    exam_date: examDate,
    tai_mui_hong: data.tai_mui_hong || null,
    rang_ham_mat: data.rang_ham_mat || null,
    co_xuong_khop: data.co_xuong_khop || null,
    tim_mach: data.tim_mach || null,
    ho_hap: data.ho_hap || null,
    tam_than_kinh: data.tam_than_kinh || null,
    mat: data.mat || null,
    benh_khac: data.benh_khac || null,
    xep_loai: data.xepLoai || null,
    ket_luan: data.ketLuan || "Bình thường",
    created_by: userId,
    created_at: ts,
    updated_by: userId,
    updated_at: ts,
  });
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

export async function listIncidents(limitCount = 50): Promise<IncidentRow[]> {
  const snap = await getDocs(query(collection(db, COL.incidents), orderBy("occurred_at", "desc")));
  return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...(d.data() as Omit<IncidentRow, "id">) }));
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
  const countSnap = await getCountFromServer(collection(db, COL.incidents));
  const code = `SC-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const childName = input.childId ? ((await getDoc(doc(db, COL.children, input.childId))).data()?.full_name ?? null) : null;
  const className = input.classId ? ((await getDoc(doc(db, COL.classes, input.classId))).data()?.name ?? null) : null;
  await addDoc(collection(db, COL.incidents), {
    code,
    child_id: input.childId ?? null,
    child_name: childName,
    class_id: input.classId ?? null,
    class_name: className,
    occurred_at: input.occurredAt,
    category: input.category,
    severity: input.severity,
    description: input.description,
    actions_taken: input.actionsTaken ?? null,
    reported_by: input.reportedBy,
    reported_by_name: await getUserName(input.reportedBy),
    created_at: nowIso(),
  });
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

export async function listSafetyInspections(limitCount = 50): Promise<SafetyInspectionRow[]> {
  const snap = await getDocs(query(collection(db, COL.safetyInspections), orderBy("inspection_date", "desc")));
  return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...(d.data() as Omit<SafetyInspectionRow, "id">) }));
}

export async function createSafetyInspection(input: {
  area: SafetyArea;
  inspectionDate: string;
  checklistResult?: string;
  riskLevel: IncidentSeverity;
  remediationPlan?: string;
  inspectedBy: string;
}): Promise<string> {
  const countSnap = await getCountFromServer(collection(db, COL.safetyInspections));
  const code = `AT-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  const ref = await addDoc(collection(db, COL.safetyInspections), {
    code,
    area: input.area,
    inspection_date: input.inspectionDate,
    checklist_result: input.checklistResult ?? null,
    risk_level: input.riskLevel,
    remediation_plan: input.remediationPlan ?? null,
    status: "draft" as RecordStatus,
    inspected_by: input.inspectedBy,
    inspected_by_name: await getUserName(input.inspectedBy),
    version: 1,
    created_by: input.inspectedBy,
    created_at: ts,
    updated_by: input.inspectedBy,
    updated_at: ts,
  });
  return ref.id;
}

export async function changeSafetyInspectionStatus(id: string, toStatus: RecordStatus, actorId: string, sessionId: string | null): Promise<void> {
  const snap = await getDoc(doc(db, COL.safetyInspections, id));
  const fromStatus = (snap.data()?.status as RecordStatus) ?? "draft";
  await updateDoc(doc(db, COL.safetyInspections, id), {
    status: toStatus,
    version: ((snap.data()?.version as number) ?? 1) + 1,
    updated_by: actorId,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "safety_inspections",
    entityId: id,
    action: `status_change:${fromStatus}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}
