// Lớp truy cập dữ liệu Công tác Đảng — TÁCH BIỆT HOÀN TOÀN khỏi các repo nghiệp vụ khác.
// Chỉ được gọi từ các trang đã được RequirePermission("party.*") bảo vệ.
import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type {
  PartyCellPosition,
  PartyMeetingType,
  PartyMemberRating,
  RecordStatus,
  ResolutionTrackingStatus,
} from "./types";

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

export async function listPartyMembers(): Promise<PartyMemberRow[]> {
  return dbSelect<PartyMemberRow>(
    `SELECT pm.*, u.full_name AS full_name FROM party_members pm
     JOIN users u ON u.id = pm.user_id
     ORDER BY CASE pm.cell_position WHEN 'bi_thu' THEN 1 WHEN 'pho_bi_thu' THEN 2 WHEN 'chi_uy_vien' THEN 3 ELSE 4 END, u.full_name`,
  );
}

export async function getPartyMemberByUserId(userId: string): Promise<PartyMemberRow | null> {
  const rows = await dbSelect<PartyMemberRow>(
    `SELECT pm.*, u.full_name AS full_name FROM party_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.user_id = ?`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function createPartyMember(input: {
  userId: string;
  membershipType: "chinh_thuc" | "du_bi";
  joinedDate?: string;
  cellPosition: PartyCellPosition;
  createdBy: string;
}): Promise<void> {
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO party_members (id, user_id, membership_type, joined_date, cell_position, status,
      version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`,
    [newId(), input.userId, input.membershipType, input.joinedDate ?? null, input.cellPosition, input.createdBy, ts, input.createdBy, ts],
  );
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
  return dbSelect<PartyMeetingRow>("SELECT * FROM party_meetings ORDER BY meeting_date DESC");
}

export async function getPartyMeetingById(id: string): Promise<PartyMeetingRow | null> {
  const rows = await dbSelect<PartyMeetingRow>("SELECT * FROM party_meetings WHERE id = ?", [id]);
  return rows[0] ?? null;
}

async function nextPartyMeetingSequence(type: PartyMeetingType): Promise<number> {
  const prefix = type === "dinh_ky" ? "SHCB" : "SHCD";
  const rows = await dbSelect<{ n: number }>(
    "SELECT COUNT(*) AS n FROM party_meetings WHERE code LIKE ?",
    [`${prefix}-%`],
  );
  return (rows[0]?.n ?? 0) + 1;
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
  const id = newId();
  const seq = await nextPartyMeetingSequence(input.meetingType);
  const year = new Date().getFullYear();
  const prefix = input.meetingType === "dinh_ky" ? "SHCB" : "SHCD";
  const code = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO party_meetings (id, code, meeting_type, title, meeting_date, location, chair_person,
      content, status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`,
    [id, code, input.meetingType, input.title, input.meetingDate, input.location ?? null, input.chairPerson ?? null, input.content ?? null, input.createdBy, ts, input.createdBy, ts],
  );
  return id;
}

export async function changePartyMeetingStatus(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
): Promise<void> {
  const meeting = await getPartyMeetingById(id);
  if (!meeting) throw new Error("Không tìm thấy cuộc họp");
  await dbExecute(
    "UPDATE party_meetings SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, actorId, nowIso(), id],
  );
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
  const rows = await dbSelect<PartyMinutesRow>(
    `SELECT m.id, m.content_html, m.attendees_note, u.full_name AS created_by_name, m.created_at
     FROM party_meeting_minutes m JOIN users u ON u.id = m.created_by
     WHERE m.meeting_id = ? ORDER BY m.created_at DESC LIMIT 1`,
    [meetingId],
  );
  return rows[0] ?? null;
}

export async function savePartyMeetingMinutes(
  meetingId: string,
  contentHtml: string,
  attendeesNote: string | undefined,
  createdBy: string,
): Promise<void> {
  await dbExecute(
    "INSERT INTO party_meeting_minutes (id, meeting_id, content_html, attendees_note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [newId(), meetingId, contentHtml, attendeesNote ?? null, createdBy, nowIso()],
  );
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
  const where = meetingId ? "WHERE meeting_id = ?" : "";
  const args = meetingId ? [meetingId] : [];
  return dbSelect<ResolutionRow>(`SELECT * FROM party_resolutions ${where} ORDER BY created_at DESC`, args);
}

async function nextResolutionSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM party_resolutions", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createResolution(
  meetingId: string,
  title: string,
  content: string,
  createdBy: string,
): Promise<void> {
  const seq = await nextResolutionSequence();
  const year = new Date().getFullYear();
  const code = `NQ-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO party_resolutions (id, meeting_id, code, title, content, status, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    [newId(), meetingId, code, title, content, createdBy, ts, createdBy, ts],
  );
}

export async function changeResolutionStatus(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
): Promise<void> {
  await dbExecute(
    "UPDATE party_resolutions SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, actorId, nowIso(), id],
  );
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
  return dbSelect<ResolutionTrackingRow>(
    `SELECT rt.id, rt.progress_note, rt.status, u.full_name AS updated_by_name, rt.updated_at
     FROM resolution_tracking rt JOIN users u ON u.id = rt.updated_by
     WHERE rt.resolution_id = ? ORDER BY rt.updated_at DESC`,
    [resolutionId],
  );
}

export async function addResolutionTracking(
  resolutionId: string,
  progressNote: string,
  status: ResolutionTrackingStatus,
  updatedBy: string,
): Promise<void> {
  await dbExecute(
    "INSERT INTO resolution_tracking (id, resolution_id, progress_note, status, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [newId(), resolutionId, progressNote, status, updatedBy, nowIso()],
  );
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

export async function getMemberEvaluation(memberId: string, year: number): Promise<MemberEvaluationRow | null> {
  const rows = await dbSelect<MemberEvaluationRow>(
    "SELECT * FROM party_member_evaluations WHERE member_id = ? AND year = ?",
    [memberId, year],
  );
  return rows[0] ?? null;
}

export async function upsertMemberEvaluation(
  memberId: string,
  year: number,
  data: { rating?: PartyMemberRating; strengths?: string; weaknesses?: string },
  status: RecordStatus,
  evaluatedBy: string,
): Promise<void> {
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO party_member_evaluations (id, member_id, year, rating, strengths, weaknesses, status, evaluated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(member_id, year) DO UPDATE SET
       rating = excluded.rating, strengths = excluded.strengths, weaknesses = excluded.weaknesses,
       status = excluded.status, evaluated_by = excluded.evaluated_by, updated_at = excluded.updated_at`,
    [newId(), memberId, year, data.rating ?? null, data.strengths ?? null, data.weaknesses ?? null, status, evaluatedBy, ts, ts],
  );
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

export async function listPartyFees(period: string): Promise<PartyFeeRow[]> {
  return dbSelect<PartyFeeRow>(
    `SELECT pf.id, pf.member_id, u.full_name AS member_name, pf.period, pf.amount, pf.paid_date
     FROM party_fees pf
     JOIN party_members pm ON pm.id = pf.member_id
     JOIN users u ON u.id = pm.user_id
     WHERE pf.period = ? ORDER BY u.full_name`,
    [period],
  );
}

export async function recordPartyFeePayment(
  memberId: string,
  period: string,
  amount: number,
  paidDate: string,
  collectedBy: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO party_fees (id, member_id, period, amount, paid_date, collected_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(member_id, period) DO UPDATE SET
       amount = excluded.amount, paid_date = excluded.paid_date, collected_by = excluded.collected_by`,
    [newId(), memberId, period, amount, paidDate, collectedBy, nowIso()],
  );
}
