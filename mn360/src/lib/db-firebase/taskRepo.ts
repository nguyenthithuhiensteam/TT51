import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { COL, db, nextSequence, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { RecordStatus, Task, TaskWithOwner } from "./types";

export type { TaskWithOwner } from "./types";

export interface TaskListParams {
  search?: string;
  status?: RecordStatus | "all";
  ownerId?: string;
  onlyMine?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTIVE_EXCLUDED_STATUSES: RecordStatus[] = ["approved", "published", "archived", "cancelled"];

async function getUserName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? null) : null;
}

/** Firestore không hỗ trợ JOIN/LIKE/GROUP BY — với quy mô một trường (vài trăm đến vài nghìn
 * nhiệm vụ), cách đơn giản và đúng đắn nhất là tải toàn bộ nhiệm vụ rồi lọc/sắp xếp/phân trang
 * phía client, thay vì cố ghép nhiều where() bất đẳng thức (Firestore chỉ cho phép bất đẳng
 * thức trên MỘT trường duy nhất mỗi truy vấn). Giống bản SQL gốc, không giới hạn theo năm học. */
async function listAllTasks(): Promise<TaskWithOwner[]> {
  const snap = await getDocs(collection(db, COL.tasks));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<TaskWithOwner, "id">) }))
    .filter((t) => !t.deleted_at);
}

async function listAllTasksForYear(schoolYearId: string): Promise<TaskWithOwner[]> {
  const snap = await getDocs(
    query(collection(db, COL.tasks), where("school_year_id", "==", schoolYearId)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<TaskWithOwner, "id">) }))
    .filter((t) => !t.deleted_at);
}

export async function listTasks(params: TaskListParams): Promise<PagedResult<TaskWithOwner>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  let items = await listAllTasks();

  if (params.status && params.status !== "all") {
    items = items.filter((t) => t.status === params.status);
  }
  if (params.ownerId) {
    items = items.filter((t) => t.owner_id === params.ownerId);
  }
  if (params.onlyMine) {
    const uid = params.onlyMine;
    items = items.filter(
      (t) => t.owner_id === uid || (t as unknown as { assignee_ids?: string[] }).assignee_ids?.includes(uid),
    );
  }
  if (params.search) {
    const s = params.search.toLowerCase();
    items = items.filter((t) => t.title.toLowerCase().includes(s) || t.code.toLowerCase().includes(s));
  }

  items.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

export async function getTaskById(id: string): Promise<TaskWithOwner | null> {
  const snap = await getDoc(doc(db, COL.tasks, id));
  if (!snap.exists() || snap.data().deleted_at) return null;
  return { id: snap.id, ...(snap.data() as Omit<TaskWithOwner, "id">) };
}

export interface CreateTaskInput {
  schoolYearId: string;
  title: string;
  field?: string;
  content?: string;
  priority: Task["priority"];
  assignedBy: string | null;
  ownerId: string;
  coordinatorIds: string[];
  startDate?: string;
  dueDate: string;
  deliverable?: string;
  doneCriteria?: string;
  createdBy: string;
  sessionId: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<string> {
  const seq = await nextSequence(`task-${input.schoolYearId}`);
  const year = new Date().getFullYear();
  const code = `NV-${year}-${String(seq).padStart(6, "0")}`;
  const ts = nowIso();

  const [ownerName, assignedByName] = await Promise.all([
    getUserName(input.ownerId),
    getUserName(input.assignedBy),
  ]);

  const assigneeIds = Array.from(new Set([input.ownerId, ...input.coordinatorIds]));
  const assignees = await Promise.all(
    assigneeIds.map(async (userId) => ({
      user_id: userId,
      user_name: await getUserName(userId),
      role_in_task: userId === input.ownerId ? ("owner" as const) : ("coordinator" as const),
    })),
  );

  const ref = await addDoc(collection(db, COL.tasks), {
    code,
    school_year_id: input.schoolYearId,
    title: input.title,
    field: input.field ?? null,
    content: input.content ?? null,
    priority: input.priority,
    assigned_by: input.assignedBy,
    assigned_by_name: assignedByName,
    owner_id: input.ownerId,
    owner_name: ownerName,
    assignee_ids: assigneeIds,
    assignees,
    start_date: input.startDate ?? null,
    due_date: input.dueDate,
    deliverable: input.deliverable ?? null,
    done_criteria: input.doneCriteria ?? null,
    progress_percent: 0,
    difficulty: null,
    proposal: null,
    review_comment: null,
    approval_result: null,
    status: "draft" as RecordStatus,
    version: 1,
    created_by: input.createdBy,
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
    deleted_at: null,
  });

  await logAudit({
    entityTable: "tasks",
    entityId: ref.id,
    action: "create",
    afterJson: { code, title: input.title },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return ref.id;
}

export interface UpdateTaskInput {
  title: string;
  field?: string;
  content?: string;
  priority: Task["priority"];
  ownerId: string;
  startDate?: string;
  dueDate: string;
  deliverable?: string;
  doneCriteria?: string;
  updatedBy: string;
  sessionId: string | null;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<void> {
  const before = await getTaskById(id);
  const ownerName = await getUserName(input.ownerId);
  await updateDoc(doc(db, COL.tasks, id), {
    title: input.title,
    field: input.field ?? null,
    content: input.content ?? null,
    priority: input.priority,
    owner_id: input.ownerId,
    owner_name: ownerName,
    start_date: input.startDate ?? null,
    due_date: input.dueDate,
    deliverable: input.deliverable ?? null,
    done_criteria: input.doneCriteria ?? null,
    version: (before?.version ?? 1) + 1,
    updated_by: input.updatedBy,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "tasks",
    entityId: id,
    action: "update",
    beforeJson: before,
    afterJson: input,
    userId: input.updatedBy,
    sessionId: input.sessionId,
  });
}

export async function updateTaskProgress(
  id: string,
  progressPercent: number,
  difficulty: string | undefined,
  proposal: string | undefined,
  userId: string,
  sessionId: string | null,
): Promise<void> {
  await updateDoc(doc(db, COL.tasks, id), {
    progress_percent: progressPercent,
    difficulty: difficulty ?? null,
    proposal: proposal ?? null,
    updated_by: userId,
    updated_at: nowIso(),
  });
  await logAudit({
    entityTable: "tasks",
    entityId: id,
    action: "update_progress",
    afterJson: { progressPercent, difficulty, proposal },
    userId,
    sessionId,
  });
}

export async function changeTaskStatus(
  id: string,
  toStatus: RecordStatus,
  changedBy: string,
  sessionId: string | null,
  note?: string,
  reviewComment?: string,
  approvalResult?: string,
): Promise<void> {
  const task = await getTaskById(id);
  if (!task) throw new Error("Không tìm thấy nhiệm vụ");
  const fromStatus = task.status;

  await updateDoc(doc(db, COL.tasks, id), {
    status: toStatus,
    ...(reviewComment !== undefined ? { review_comment: reviewComment } : {}),
    ...(approvalResult !== undefined ? { approval_result: approvalResult } : {}),
    version: task.version + 1,
    updated_by: changedBy,
    updated_at: nowIso(),
  });

  await addDoc(collection(db, COL.taskStatusHistory), {
    task_id: id,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    changed_by_name: await getUserName(changedBy),
    changed_at: nowIso(),
    note: note ?? null,
  });

  await logAudit({
    entityTable: "tasks",
    entityId: id,
    action: `status_change:${fromStatus}->${toStatus}`,
    beforeJson: { status: fromStatus },
    afterJson: { status: toStatus, note },
    userId: changedBy,
    sessionId,
  });
}

export interface TaskStatusHistoryRow {
  id: string;
  task_id: string;
  from_status: RecordStatus | null;
  to_status: RecordStatus;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
  note: string | null;
}

export async function listTaskStatusHistory(taskId: string): Promise<TaskStatusHistoryRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.taskStatusHistory), where("task_id", "==", taskId), orderBy("changed_at", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskStatusHistoryRow, "id">) }));
}

export interface TaskCommentRow {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export async function listTaskComments(taskId: string): Promise<TaskCommentRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.taskComments), where("task_id", "==", taskId), orderBy("created_at", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskCommentRow, "id">) }));
}

export async function addTaskComment(taskId: string, userId: string, content: string): Promise<void> {
  await addDoc(collection(db, COL.taskComments), {
    task_id: taskId,
    user_id: userId,
    user_name: await getUserName(userId),
    content,
    created_at: nowIso(),
  });
}

export interface TaskEvidenceRow {
  id: string;
  task_id: string;
  file_path: string;
  file_name: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  note: string | null;
}

export async function listTaskEvidence(taskId: string): Promise<TaskEvidenceRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.taskEvidence), where("task_id", "==", taskId), orderBy("uploaded_at", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskEvidenceRow, "id">) }));
}

export async function addTaskEvidence(
  taskId: string,
  filePath: string,
  fileName: string,
  uploadedBy: string,
  note?: string,
): Promise<void> {
  await addDoc(collection(db, COL.taskEvidence), {
    task_id: taskId,
    file_path: filePath,
    file_name: fileName,
    uploaded_by: uploadedBy,
    uploaded_by_name: await getUserName(uploadedBy),
    uploaded_at: nowIso(),
    note: note ?? null,
  });
}

export interface TaskAssigneeRow {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  role_in_task: "owner" | "coordinator";
}

export async function listTaskAssignees(taskId: string): Promise<TaskAssigneeRow[]> {
  const task = await getTaskById(taskId);
  const assignees = (task as unknown as { assignees?: { user_id: string; user_name: string | null; role_in_task: "owner" | "coordinator" }[] })?.assignees ?? [];
  return assignees.map((a, i) => ({
    id: `${taskId}-${i}`,
    task_id: taskId,
    user_id: a.user_id,
    user_name: a.user_name ?? "",
    role_in_task: a.role_in_task,
  }));
}

export interface DashboardTaskStats {
  total: number;
  overdue: number;
  dueSoon: number;
  pendingApproval: number;
  byStatus: { status: RecordStatus; count: number }[];
}

export async function getTaskDashboardStats(
  schoolYearId: string,
  todayIso: string,
  dueSoonDays: number,
): Promise<DashboardTaskStats> {
  const all = await listAllTasksForYear(schoolYearId);
  const dueSoonDate = new Date(todayIso);
  dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);
  const dueSoonIso = dueSoonDate.toISOString().slice(0, 10);

  const isActive = (t: TaskWithOwner) => !ACTIVE_EXCLUDED_STATUSES.includes(t.status);
  const overdue = all.filter((t) => t.due_date && t.due_date < todayIso && isActive(t)).length;
  const dueSoon = all.filter((t) => t.due_date && t.due_date >= todayIso && t.due_date <= dueSoonIso && isActive(t)).length;
  const pendingApproval = all.filter((t) => t.status === "pending_approval").length;

  const byStatusMap = new Map<RecordStatus, number>();
  for (const t of all) byStatusMap.set(t.status, (byStatusMap.get(t.status) ?? 0) + 1);

  return {
    total: all.length,
    overdue,
    dueSoon,
    pendingApproval,
    byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
  };
}

export interface OverdueTaskRow {
  id: string;
  code: string;
  title: string;
  due_date: string;
  owner_id: string;
}

export async function listOverdueTasks(schoolYearId: string, todayIso: string): Promise<OverdueTaskRow[]> {
  const all = await listAllTasksForYear(schoolYearId);
  return all
    .filter((t) => t.due_date && t.due_date < todayIso && !ACTIVE_EXCLUDED_STATUSES.includes(t.status))
    .map((t) => ({ id: t.id, code: t.code, title: t.title, due_date: t.due_date as string, owner_id: t.owner_id }));
}

export async function generateOverdueNotifications(schoolYearId: string, todayIso: string): Promise<number> {
  const overdue = await listOverdueTasks(schoolYearId, todayIso);
  let created = 0;
  for (const task of overdue) {
    const dedupKey = `task-overdue-${task.id}-${todayIso}`;
    await setDoc(
      doc(db, COL.notifications, dedupKey),
      {
        user_id: task.owner_id,
        title: "Nhiệm vụ quá hạn",
        body: `Nhiệm vụ "${task.title}" (${task.code}) đã quá hạn hoàn thành`,
        link: `/cong-viec/${task.id}`,
        level: "danger",
        is_read: 0,
        created_at: nowIso(),
        dedup_key: dedupKey,
      },
      { merge: true },
    );
    created += 1;
  }
  return created;
}
