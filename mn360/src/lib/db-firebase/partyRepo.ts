// Lớp truy cập dữ liệu Công tác Đảng qua Firestore — TÁCH BIỆT HOÀN TOÀN khỏi các repo nghiệp
// vụ khác (collection riêng, không JOIN/reuse), đúng nguyên tắc của bản SQL gốc. Chỉ được gọi
// từ các trang đã được RequirePermission("party.*") bảo vệ; firestore.rules chặn thêm ở tầng
// dữ liệu (chỉ tài khoản có permissionCodes chứa "party.*" mới đọc/ghi được các collection này).
import { addDoc, collection, doc, getCountFromServer, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type {
  PartyCellPosition,
  PartyMeetingType,
  PartyMemberRating,
  RecordStatus,
  ResolutionTrackingStatus,
} from "./types";

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return "";
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? "") : "";
}

// ===================== ĐẢNG VIÊN =====================

export interface PartyMemberRow {
  id: string;
  user_id: string;
  full_name: string;
  membership_type: "chinh_thuc" | "du_bi";
  joined_date: string | null;
  cell_position: PartyCellPosition;
  status: "active" | "transferred" | "suspended";
  note: string | null;
}

const CELL_POSITION_ORDER: Record<PartyCellPosition, number> = {
  bi_thu: 1,
  pho_bi_thu: 2,
  chi_uy_vien: 3,
  dang_vien: 4,
};

export async function listPartyMembers(): Promise<PartyMemberRow[]> {
  const snap = await getDocs(collection(db, COL.partyMembers));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PartyMemberRow, "id">) }))
    .sort(
      (a, b) =>
        CELL_POSITION_ORDER[a.cell_position] - CELL_POSITION_ORDER[b.cell_position] ||
        a.full_name.localeCompare(b.full_name, "vi"),
    );
}

export async function getPartyMemberByUserId(userId: string): Promise<PartyMemberRow | null> {
  const snap = await getDocs(query(collection(db, COL.partyMembers), where("user_id", "==", userId)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<PartyMemberRow, "id">) };
}

export async function createPartyMember(input: {
  userId: string;
  membershipType: "chinh_thuc" | "du_bi";
  joinedDate?: string;
  cellPosition: PartyCellPosition;
  createdBy: string;
}): Promise<void> {
  const ts = nowIso();
  await addDoc(collection(db, COL.partyMembers), {
    user_id: input.userId,
    full_name: await getUserName(input.userId),
    membership_type: input.membershipType,
    joined_date: input.joinedDate ?? null,
    cell_position: input.cellPosition,
    status: "active",
    note: null,
    version: 1,
    created_by: input.createdBy,
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
  });
}

// ===================== SINH HOẠT CHI BỘ =====================

export interface PartyMeetingRow {
  id: string;
  code: string;
  meeting_type: PartyMeetingType;
  title: string;
  meeting_date: string;
  location: string | null;
  chair_person: string | null;
  content: string | null;
  status: RecordStatus;
  version: number;
}

export async function listPartyMeetings(): Promise<PartyMeetingRow[]> {
  const snap = await getDocs(query(collection(db, COL.partyMeetings), orderBy("meeting_date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PartyMeetingRow, "id">) }));
}

export async function getPartyMeetingById(id: string): Promise<PartyMeetingRow | null> {
  const snap = await getDoc(doc(db, COL.partyMeetings, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<PartyMeetingRow, "id">) };
}

export async function createPartyMeeting(input: {
  meetingType: PartyMeetingType;
  title: string;
  meetingDate: string;
  location?: string;
  chairPerson?: string;
  content?: string;
  createdBy: string;
}): Promise<string> {
  const prefix = input.meetingType === "dinh_ky" ? "SHCB" : "SHCD";
  const countSnap = await getCountFromServer(collection(db, COL.partyMeetings));
  const seq = countSnap.data().count + 1;
  const year = new Date().getFullYear();
  const code = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  const ref = await addDoc(collection(db, COL.partyMeetings), {
    code,
    meeting_type: input.meetingType,
    title: input.title,
    meeting_date: input.meetingDate,
    location: input.location ?? null,
    chair_person: input.chairPerson ?? null,
    content: input.content ?? null,
    status: "draft" as RecordStatus,
    version: 1,
    created_by: input.createdBy,
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
  });
  return ref.id;
}

export async function changePartyMeetingStatus(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
): Promise<void> {
  const meeting = await getPartyMeetingById(id);
  if (!meeting) throw new Error("Không tìm thấy cuộc họp");
  await updateDoc(doc(db, COL.partyMeetings, id), {
    status: toStatus,
    version: meeting.version + 1,
    updated_by: actorId,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "party_meetings",
    entityId: id,
    action: `status_change:${meeting.status}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

export interface PartyMinutesRow {
  id: string;
  content_html: string | null;
  attendees_note: string | null;
  created_by_name: string;
  created_at: string;
}

export async function getPartyMeetingMinutes(meetingId: string): Promise<PartyMinutesRow | null> {
  const snap = await getDocs(
    query(collection(db, COL.partyMeetingMinutes), where("meeting_id", "==", meetingId), orderBy("created_at", "desc")),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<PartyMinutesRow, "id">) };
}

export async function savePartyMeetingMinutes(
  meetingId: string,
  contentHtml: string,
  attendeesNote: string | undefined,
  createdBy: string,
): Promise<void> {
  await addDoc(collection(db, COL.partyMeetingMinutes), {
    meeting_id: meetingId,
    content_html: contentHtml,
    attendees_note: attendeesNote ?? null,
    created_by: createdBy,
    created_by_name: await getUserName(createdBy),
    created_at: nowIso(),
  });
}

// ===================== NGHỊ QUYẾT =====================

export interface ResolutionRow {
  id: string;
  meeting_id: string;
  code: string;
  title: string;
  content: string;
  status: RecordStatus;
}

export async function listResolutions(meetingId?: string): Promise<ResolutionRow[]> {
  const base = collection(db, COL.partyResolutions);
  const snap = await getDocs(
    meetingId ? query(base, where("meeting_id", "==", meetingId), orderBy("created_at", "desc")) : query(base, orderBy("created_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ResolutionRow, "id">) }));
}

export async function createResolution(meetingId: string, title: string, content: string, createdBy: string): Promise<void> {
  const countSnap = await getCountFromServer(collection(db, COL.partyResolutions));
  const seq = countSnap.data().count + 1;
  const year = new Date().getFullYear();
  const code = `NQ-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await addDoc(collection(db, COL.partyResolutions), {
    meeting_id: meetingId,
    code,
    title,
    content,
    status: "draft" as RecordStatus,
    created_by: createdBy,
    created_at: ts,
    updated_by: createdBy,
    updated_at: ts,
  });
}

export async function changeResolutionStatus(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
): Promise<void> {
  await updateDoc(doc(db, COL.partyResolutions, id), {
    status: toStatus,
    updated_by: actorId,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "party_resolutions",
    entityId: id,
    action: `status_change:->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

export interface ResolutionTrackingRow {
  id: string;
  progress_note: string;
  status: ResolutionTrackingStatus;
  updated_by_name: string;
  updated_at: string;
}

export async function listResolutionTracking(resolutionId: string): Promise<ResolutionTrackingRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.resolutionTracking), where("resolution_id", "==", resolutionId), orderBy("updated_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ResolutionTrackingRow, "id">) }));
}

export async function addResolutionTracking(
  resolutionId: string,
  progressNote: string,
  status: ResolutionTrackingStatus,
  updatedBy: string,
): Promise<void> {
  await addDoc(collection(db, COL.resolutionTracking), {
    resolution_id: resolutionId,
    progress_note: progressNote,
    status,
    updated_by: updatedBy,
    updated_by_name: await getUserName(updatedBy),
    updated_at: nowIso(),
  });
}

// ===================== ĐÁNH GIÁ ĐẢNG VIÊN =====================

export interface MemberEvaluationRow {
  id: string;
  member_id: string;
  year: number;
  rating: PartyMemberRating | null;
  strengths: string | null;
  weaknesses: string | null;
  status: RecordStatus;
}

function evaluationDocId(memberId: string, year: number): string {
  return `${memberId}_${year}`;
}

export async function getMemberEvaluation(memberId: string, year: number): Promise<MemberEvaluationRow | null> {
  const snap = await getDoc(doc(db, COL.partyMemberEvaluations, evaluationDocId(memberId, year)));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<MemberEvaluationRow, "id">) };
}

export async function upsertMemberEvaluation(
  memberId: string,
  year: number,
  data: { rating?: PartyMemberRating; strengths?: string; weaknesses?: string },
  status: RecordStatus,
  evaluatedBy: string,
): Promise<void> {
  const ts = nowIso();
  const id = evaluationDocId(memberId, year);
  const existing = await getDoc(doc(db, COL.partyMemberEvaluations, id));
  await setDoc(doc(db, COL.partyMemberEvaluations, id), {
    member_id: memberId,
    year,
    rating: data.rating ?? null,
    strengths: data.strengths ?? null,
    weaknesses: data.weaknesses ?? null,
    status,
    evaluated_by: evaluatedBy,
    created_at: existing.exists() ? existing.data().created_at : ts,
    updated_at: ts,
  });
}

// ===================== ĐẢNG PHÍ =====================

export interface PartyFeeRow {
  id: string;
  member_id: string;
  member_name: string;
  period: string;
  amount: number;
  paid_date: string | null;
}

function feeDocId(memberId: string, period: string): string {
  return `${memberId}_${period}`;
}

export async function listPartyFees(period: string): Promise<PartyFeeRow[]> {
  const snap = await getDocs(query(collection(db, COL.partyFees), where("period", "==", period)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PartyFeeRow, "id">) }))
    .sort((a, b) => a.member_name.localeCompare(b.member_name, "vi"));
}

export async function recordPartyFeePayment(
  memberId: string,
  period: string,
  amount: number,
  paidDate: string,
  collectedBy: string,
): Promise<void> {
  const member = await getDoc(doc(db, COL.partyMembers, memberId));
  await setDoc(doc(db, COL.partyFees, feeDocId(memberId, period)), {
    member_id: memberId,
    member_name: member.exists() ? (member.data().full_name as string) : "",
    period,
    amount,
    paid_date: paidDate,
    collected_by: collectedBy,
    created_at: nowIso(),
  });
}
