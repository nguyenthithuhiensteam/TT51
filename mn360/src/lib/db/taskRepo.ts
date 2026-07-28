import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import type { RecordStatus, Task, TaskWithOwner } from "./types";
import { logAudit } from "./authRepo";

export type { TaskWithOwner } from "./types";

export interface TaskListParams {
  search?: string;
  status?: RecordStatus | "all";
  ownerId?: string;
  onlyMine?: string; // userId: nhiệm vụ chủ trì hoặc phối hợp
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listTasks(params: TaskListParams): Promise<PagedResult<TaskWithOwner>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: string[] = ["t.deleted_at IS NULL"];
  const args: unknown[] = [];

  if (params.search) {
    where.push("(t.title LIKE ? OR t.code LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`);
  }
  if (params.status && params.status !== "all") {
    where.push("t.status = ?");
    args.push(params.status);
  }
  if (params.ownerId) {
    where.push("t.owner_id = ?");
    args.push(params.ownerId);
  }
  if (params.onlyMine) {
    where.push(
      "(t.owner_id = ? OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?))",
    );
    args.push(params.onlyMine, params.onlyMine);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countRows = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) AS total FROM tasks t ${whereSql}`,
    args,
  );
  const total = countRows[0]?.total ?? 0;

  const items = await dbSelect<TaskWithOwner>(
    `SELECT t.*, ou.full_name AS owner_name, au.full_name AS assigned_by_name
     FROM tasks t
     LEFT JOIN users ou ON ou.id = t.owner_id
     LEFT JOIN users au ON au.id = t.assigned_by
     ${whereSql}
     ORDER BY t.due_date IS NULL, t.due_date ASC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize],
  );

  return { items, total, page, pageSize };
}

export async function getTaskById(id: string): Promise<TaskWithOwner | null> {
  const rows = await dbSelect<TaskWithOwner>(
    `SELECT t.*, ou.full_name AS owner_name, au.full_name AS assigned_by_name
     FROM tasks t
     LEFT JOIN users ou ON ou.id = t.owner_id
     LEFT JOIN users au ON au.id = t.assigned_by
     WHERE t.id = ? AND t.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

async function nextTaskSequence(schoolYearId: string): Promise<number> {
  const rows = await dbSelect<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE school_year_id = ?",
    [schoolYearId],
  );
  return (rows[0]?.n ?? 0) + 1;
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
  const id = newId();
  const seq = await nextTaskSequence(input.schoolYearId);
  const year = new Date().getFullYear();
  const code = `NV-${year}-${String(seq).padStart(6, "0")}`;
  const ts = nowIso();

  await dbExecute(
    `INSERT INTO tasks (id, code, school_year_id, title, field, content, priority, assigned_by,
      owner_id, start_date, due_date, deliverable, done_criteria, progress_percent, status,
      version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', 1, ?, ?, ?, ?)`,
    [
      id,
      code,
      input.schoolYearId,
      input.title,
      input.field ?? null,
      input.content ?? null,
      input.priority,
      input.assignedBy,
      input.ownerId,
      input.startDate ?? null,
      input.dueDate,
      input.deliverable ?? null,
      input.doneCriteria ?? null,
      input.createdBy,
      ts,
      input.createdBy,
      ts,
    ],
  );

  await dbExecute(
    "INSERT INTO task_assignees (id, task_id, user_id, role_in_task) VALUES (?, ?, ?, 'owner')",
    [newId(), id, input.ownerId],
  );
  for (const coordinatorId of input.coordinatorIds) {
    if (coordinatorId === input.ownerId) continue;
    await dbExecute(
      "INSERT INTO task_assignees (id, task_id, user_id, role_in_task) VALUES (?, ?, ?, 'coordinator')",
      [newId(), id, coordinatorId],
    );
  }

  await logAudit({
    entityTable: "tasks",
    entityId: id,
    action: "create",
    afterJson: { code, title: input.title },
    userId: input.createdBy,
    sessionId: input.sessionId,
  });

  return id;
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
  await dbExecute(
    `UPDATE tasks SET title = ?, field = ?, content = ?, priority = ?, owner_id = ?,
     start_date = ?, due_date = ?, deliverable = ?, done_criteria = ?, version = version + 1,
     updated_by = ?, updated_at = ? WHERE id = ?`,
    [
      input.title,
      input.field ?? null,
      input.content ?? null,
      input.priority,
      input.ownerId,
      input.startDate ?? null,
      input.dueDate,
      input.deliverable ?? null,
      input.doneCriteria ?? null,
      input.updatedBy,
      nowIso(),
      id,
    ],
  );
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
  await dbExecute(
    `UPDATE tasks SET progress_percent = ?, difficulty = ?, proposal = ?, updated_by = ?,
     updated_at = ? WHERE id = ?`,
    [progressPercent, difficulty ?? null, proposal ?? null, userId, nowIso(), id],
  );
  await logAudit({
    entityTable: "tasks",
    entityId: id,
    action: "update_progress",
    afterJson: { progressPercent, difficulty, proposal },
    userId,
    sessionId,
  });
}

/**
 * Chuyển trạng thái nhiệm vụ theo quy trình gửi duyệt/phê duyệt/yêu cầu điều chỉnh.
 * Luôn ghi vào task_status_history và audit_logs — không có bước nào tự động phê duyệt.
 */
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

  await dbExecute(
    `UPDATE tasks SET status = ?, review_comment = COALESCE(?, review_comment),
     approval_result = COALESCE(?, approval_result), version = version + 1,
     updated_by = ?, updated_at = ? WHERE id = ?`,
    [toStatus, reviewComment ?? null, approvalResult ?? null, changedBy, nowIso(), id],
  );

  await dbExecute(
    `INSERT INTO task_status_history (id, task_id, from_status, to_status, changed_by, changed_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), id, fromStatus, toStatus, changedBy, nowIso(), note ?? null],
  );

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
  return dbSelect<TaskStatusHistoryRow>(
    `SELECT h.*, u.full_name AS changed_by_name FROM task_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.task_id = ? ORDER BY h.changed_at ASC`,
    [taskId],
  );
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
  return dbSelect<TaskCommentRow>(
    `SELECT c.*, u.full_name AS user_name FROM task_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.task_id = ? ORDER BY c.created_at ASC`,
    [taskId],
  );
}

export async function addTaskComment(
  taskId: string,
  userId: string,
  content: string,
): Promise<void> {
  await dbExecute(
    "INSERT INTO task_comments (id, task_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)",
    [newId(), taskId, userId, content, nowIso()],
  );
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
  return dbSelect<TaskEvidenceRow>(
    `SELECT e.*, u.full_name AS uploaded_by_name FROM task_evidence e
     JOIN users u ON u.id = e.uploaded_by
     WHERE e.task_id = ? ORDER BY e.uploaded_at DESC`,
    [taskId],
  );
}

export async function addTaskEvidence(
  taskId: string,
  filePath: string,
  fileName: string,
  uploadedBy: string,
  note?: string,
): Promise<void> {
  await dbExecute(
    `INSERT INTO task_evidence (id, task_id, file_path, file_name, uploaded_by, uploaded_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), taskId, filePath, fileName, uploadedBy, nowIso(), note ?? null],
  );
}

export interface TaskAssigneeRow {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  role_in_task: "owner" | "coordinator";
}

export async function listTaskAssignees(taskId: string): Promise<TaskAssigneeRow[]> {
  return dbSelect<TaskAssigneeRow>(
    `SELECT a.*, u.full_name AS user_name FROM task_assignees a
     JOIN users u ON u.id = a.user_id
     WHERE a.task_id = ?`,
    [taskId],
  );
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
  const totalRows = await dbSelect<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE school_year_id = ? AND deleted_at IS NULL",
    [schoolYearId],
  );
  const overdueRows = await dbSelect<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tasks WHERE school_year_id = ? AND deleted_at IS NULL
     AND due_date < ? AND status NOT IN ('approved','published','archived','cancelled')`,
    [schoolYearId, todayIso],
  );
  const dueSoonDate = new Date(todayIso);
  dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);
  const dueSoonRows = await dbSelect<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tasks WHERE school_year_id = ? AND deleted_at IS NULL
     AND due_date >= ? AND due_date <= ? AND status NOT IN ('approved','published','archived','cancelled')`,
    [schoolYearId, todayIso, dueSoonDate.toISOString().slice(0, 10)],
  );
  const pendingRows = await dbSelect<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tasks WHERE school_year_id = ? AND deleted_at IS NULL
     AND status = 'pending_approval'`,
    [schoolYearId],
  );
  const byStatus = await dbSelect<{ status: RecordStatus; count: number }>(
    `SELECT status, COUNT(*) AS count FROM tasks WHERE school_year_id = ? AND deleted_at IS NULL
     GROUP BY status`,
    [schoolYearId],
  );

  return {
    total: totalRows[0]?.n ?? 0,
    overdue: overdueRows[0]?.n ?? 0,
    dueSoon: dueSoonRows[0]?.n ?? 0,
    pendingApproval: pendingRows[0]?.n ?? 0,
    byStatus,
  };
}

export interface OverdueTaskRow {
  id: string;
  code: string;
  title: string;
  due_date: string;
  owner_id: string;
}

export async function listOverdueTasks(
  schoolYearId: string,
  todayIso: string,
): Promise<OverdueTaskRow[]> {
  return dbSelect<OverdueTaskRow>(
    `SELECT id, code, title, due_date, owner_id FROM tasks
     WHERE school_year_id = ? AND deleted_at IS NULL AND due_date < ?
     AND status NOT IN ('approved','published','archived','cancelled')`,
    [schoolYearId, todayIso],
  );
}

/**
 * Sinh thông báo "quá hạn" cho chủ trì nhiệm vụ. Nhờ UNIQUE(user_id, dedup_key) ở tầng CSDL,
 * chạy lại hàm này nhiều lần (VD: mỗi lần mở ứng dụng) sẽ không tạo thông báo trùng.
 */
export async function generateOverdueNotifications(
  schoolYearId: string,
  todayIso: string,
): Promise<number> {
  const overdue = await listOverdueTasks(schoolYearId, todayIso);
  let created = 0;
  for (const task of overdue) {
    const dedupKey = `task-overdue-${task.id}-${todayIso}`;
    try {
      await dbExecute(
        `INSERT OR IGNORE INTO notifications (id, user_id, title, body, link, level, is_read, created_at, dedup_key)
         VALUES (?, ?, ?, ?, ?, 'danger', 0, ?, ?)`,
        [
          newId(),
          task.owner_id,
          "Nhiệm vụ quá hạn",
          `Nhiệm vụ "${task.title}" (${task.code}) đã quá hạn hoàn thành`,
          `/cong-viec/${task.id}`,
          nowIso(),
          dedupKey,
        ],
      );
      created += 1;
    } catch {
      // đã tồn tại thông báo cho ngày hôm nay — bỏ qua để không trùng lặp
    }
  }
  return created;
}
