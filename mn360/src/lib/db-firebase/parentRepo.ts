// Lớp truy cập dữ liệu Phụ huynh qua Firestore — MỌI hàm đều tự kiểm tra trẻ có thuộc quyền
// của tài khoản đăng nhập hay không (qua guardian_user_ids nhúng trên tài liệu trẻ) trước khi
// trả dữ liệu, không tin child_id gửi trực tiếp từ giao diện mà không kiểm tra.
//
// Khác với bản SQL (bảng guardians độc lập có user_id riêng), ở đây phụ huynh được nhúng theo
// từng trẻ (xem childRepo.ts) nên không có một "guardianId" ổn định dùng chung cho một người
// qua nhiều trẻ — lịch sử hỏi Trợ lý AI vì vậy khoá theo user_id thay vì guardian_id.
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import type { AttendanceStatus, LeaveRequestStatus } from "./types";

interface ChildDoc {
  id: string;
  code: string;
  full_name: string;
  dob: string;
  gender: "male" | "female";
  class_id: string | null;
  class_name: string | null;
  status: string;
  guardian_user_ids?: string[];
}

async function getOwnedChild(userId: string, childId: string): Promise<ChildDoc> {
  const snap = await getDoc(doc(db, COL.children, childId));
  if (!snap.exists()) throw new Error("Không tìm thấy trẻ");
  const data = snap.data() as Omit<ChildDoc, "id">;
  if (!(data.guardian_user_ids ?? []).includes(userId)) {
    throw new Error("Bạn không có quyền xem thông tin của trẻ này");
  }
  return { id: snap.id, ...data };
}

export interface MyChildRow {
  id: string;
  code: string;
  full_name: string;
  dob: string;
  gender: "male" | "female";
  class_id: string | null;
  class_name: string | null;
  status: string;
}

export async function listMyChildren(userId: string): Promise<MyChildRow[]> {
  const snap = await getDocs(query(collection(db, COL.children), where("guardian_user_ids", "array-contains", userId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ChildDoc, "id">) }))
    .filter((c) => !(c as unknown as { deleted_at?: string }).deleted_at)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
}

export interface MyAttendanceRow {
  attendance_date: string;
  status: AttendanceStatus;
  note: string | null;
}

export async function getMyChildAttendance(userId: string, childId: string, fromDate: string, toDate: string): Promise<MyAttendanceRow[]> {
  await getOwnedChild(userId, childId);
  const snap = await getDocs(
    query(
      collection(db, COL.attendance),
      where("child_id", "==", childId),
      where("attendance_date", ">=", fromDate),
      where("attendance_date", "<=", toDate),
    ),
  );
  return snap.docs
    .map((d) => d.data() as MyAttendanceRow)
    .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
}

export interface MyMenuRow {
  menu_date: string;
  status: string;
  items: { meal_slot: string; dish_name: string }[];
}

export async function getTodayMenuForChild(userId: string, childId: string): Promise<MyMenuRow | null> {
  const child = await getOwnedChild(userId, childId);
  if (!child.class_id) return null;

  const today = new Date().toISOString().slice(0, 10);
  const snap = await getDocs(
    query(collection(db, COL.menus), where("class_id", "==", child.class_id), where("menu_date", "==", today)),
  );
  const menuDoc = snap.docs.find((d) => ["approved", "published"].includes(d.data().status) && !d.data().deleted_at);
  if (!menuDoc) return null;

  const itemsSnap = await getDocs(query(collection(db, COL.menuItems), where("menu_id", "==", menuDoc.id)));
  const items = itemsSnap.docs
    .map((d) => ({ meal_slot: d.data().meal_slot as string, dish_name: d.data().dish_name as string }))
    .sort((a, b) => a.meal_slot.localeCompare(b.meal_slot));

  return { menu_date: menuDoc.data().menu_date, status: menuDoc.data().status, items };
}

export interface MyRevenueRow {
  code: string;
  fee_item_name: string | null;
  amount: number;
  revenue_date: string;
  status: string;
}

export async function getMyChildRevenues(userId: string, childId: string): Promise<MyRevenueRow[]> {
  await getOwnedChild(userId, childId);
  const snap = await getDocs(query(collection(db, COL.revenues), where("child_id", "==", childId)));
  return snap.docs
    .map((d) => d.data() as MyRevenueRow)
    .sort((a, b) => b.revenue_date.localeCompare(a.revenue_date));
}

export interface MyLeaveRequestRow {
  id: string;
  code: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveRequestStatus;
  decision_note: string | null;
}

export async function listMyLeaveRequests(userId: string, childId: string): Promise<MyLeaveRequestRow[]> {
  await getOwnedChild(userId, childId);
  const snap = await getDocs(
    query(collection(db, COL.childLeaveRequests), where("child_id", "==", childId), orderBy("created_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MyLeaveRequestRow, "id">) }));
}

export async function createLeaveRequest(userId: string, childId: string, startDate: string, endDate: string, reason: string): Promise<void> {
  const child = await getOwnedChild(userId, childId);
  const guardian = (
    (await getDoc(doc(db, COL.children, childId))).data()?.guardians as { user_id: string | null; id: string }[] | undefined
  )?.find((g) => g.user_id === userId);

  const countSnap = await getDocs(collection(db, COL.childLeaveRequests));
  const year = new Date().getFullYear();
  const code = `XN-${year}-${String(countSnap.size + 1).padStart(4, "0")}`;
  await addDoc(collection(db, COL.childLeaveRequests), {
    code,
    child_id: child.id,
    child_name: child.full_name,
    guardian_id: guardian?.id ?? null,
    start_date: startDate,
    end_date: endDate,
    reason,
    status: "pending_approval" as LeaveRequestStatus,
    decided_by: null,
    decided_at: null,
    decision_note: null,
    created_at: nowIso(),
  });
}

export interface ParentMessageRow {
  id: string;
  sender_role: "parent" | "teacher";
  sender_name: string;
  content: string;
  created_at: string;
}

export async function listMyMessages(userId: string, childId: string): Promise<ParentMessageRow[]> {
  await getOwnedChild(userId, childId);
  const snap = await getDocs(
    query(collection(db, COL.parentMessages), where("child_id", "==", childId), orderBy("created_at", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ParentMessageRow, "id">) }));
}

export async function sendMessageAsParent(userId: string, childId: string, content: string): Promise<void> {
  const child = await getOwnedChild(userId, childId);
  const guardian = (
    (await getDoc(doc(db, COL.children, childId))).data()?.guardians as { user_id: string | null; id: string; full_name: string }[] | undefined
  )?.find((g) => g.user_id === userId);
  await addDoc(collection(db, COL.parentMessages), {
    child_id: child.id,
    guardian_id: guardian?.id ?? null,
    sender_role: "parent",
    sender_user_id: userId,
    sender_name: guardian?.full_name ?? "",
    content,
    is_read: 0,
    created_at: nowIso(),
  });
}

// ===================== TRỢ LÝ AI TƯ VẤN NUÔI DẠY TRẺ =====================
// Chưa hỗ trợ trên bản web — cần cơ chế gọi AI khác (Cloud Function hoặc gọi thẳng API AI từ
// trình duyệt), khác với bản desktop gọi qua lệnh Rust "ai_generate". Lịch sử cũ vẫn đọc được
// bình thường, chỉ chưa hỏi được câu mới.

export interface AiConsultationRow {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export async function listMyAiConsultations(userId: string): Promise<AiConsultationRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.aiConsultations), where("user_id", "==", userId), orderBy("created_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiConsultationRow, "id">) }));
}

export async function askAiParentingQuestion(_userId: string, _question: string): Promise<string> {
  throw new Error("Trợ lý AI tư vấn nuôi dạy trẻ: chưa hỗ trợ trên bản web (đang được xây dựng).");
}

export interface AiConsultationReviewRow extends AiConsultationRow {
  guardian_name: string;
}

export async function listAllAiConsultationsForReview(): Promise<AiConsultationReviewRow[]> {
  const snap = await getDocs(query(collection(db, COL.aiConsultations), orderBy("created_at", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiConsultationReviewRow, "id">) }));
}
