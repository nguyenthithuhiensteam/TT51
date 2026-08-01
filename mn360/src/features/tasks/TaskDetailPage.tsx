import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Paperclip, Copy, Printer, ArrowLeft } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge, PriorityBadge } from "../../components/ui/Badge";
import { Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import {
  addTaskComment,
  addTaskEvidence,
  changeTaskStatus,
  createTask,
  getTaskById,
  listTaskAssignees,
  listTaskComments,
  listTaskEvidence,
  listTaskStatusHistory,
  updateTaskProgress,
  type TaskAssigneeRow,
  type TaskCommentRow,
  type TaskEvidenceRow,
  type TaskStatusHistoryRow,
  type TaskWithOwner,
} from "@/lib/db/taskRepo";
import { pickAndAttachFile } from "@/lib/db/attachmentRepo";
import { updateTask } from "@/lib/db/taskRepo";
import { listActiveUsers } from "@/lib/db/systemRepo";
import type { RecordStatus, User } from "@/lib/db/types";
import { TaskFormModal } from "./TaskFormModal";
import type { TaskFormInput } from "../../lib/schemas/task";

interface StatusAction {
  label: string;
  toStatus: RecordStatus;
  permission: string;
  requiresComment?: boolean;
  variant?: "primary" | "danger" | "success";
}

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  draft: [{ label: "Gửi duyệt", toStatus: "submitted", permission: "task.submit" }],
  submitted: [
    { label: "Gửi phê duyệt", toStatus: "pending_approval", permission: "task.approve" },
    {
      label: "Yêu cầu điều chỉnh",
      toStatus: "needs_revision",
      permission: "task.approve",
      requiresComment: true,
      variant: "danger",
    },
  ],
  pending_approval: [
    { label: "Phê duyệt", toStatus: "approved", permission: "task.approve", variant: "success" },
    {
      label: "Yêu cầu điều chỉnh",
      toStatus: "needs_revision",
      permission: "task.approve",
      requiresComment: true,
      variant: "danger",
    },
  ],
  needs_revision: [{ label: "Gửi duyệt lại", toStatus: "submitted", permission: "task.submit" }],
  approved: [{ label: "Lưu trữ", toStatus: "archived", permission: "task.approve" }],
};

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [task, setTask] = useState<TaskWithOwner | null>(null);
  const [assignees, setAssignees] = useState<TaskAssigneeRow[]>([]);
  const [history, setHistory] = useState<TaskStatusHistoryRow[]>([]);
  const [comments, setComments] = useState<TaskCommentRow[]>([]);
  const [evidence, setEvidence] = useState<TaskEvidenceRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [actionModal, setActionModal] = useState<StatusAction | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!id) return;
    const t = await getTaskById(id);
    setTask(t);
    if (t) setProgress(t.progress_percent);
    setAssignees(await listTaskAssignees(id));
    setHistory(await listTaskStatusHistory(id));
    setComments(await listTaskComments(id));
    setEvidence(await listTaskEvidence(id));
  }

  useEffect(() => {
    refresh();
    listActiveUsers().then(setUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!task) {
    return <p className="text-navy/60">Đang tải...</p>;
  }

  const availableActions = (STATUS_ACTIONS[task.status] ?? []).filter((a) =>
    hasPermission(a.permission),
  );

  async function runAction(action: StatusAction) {
    if (!user || !task) return;
    setBusy(true);
    try {
      await changeTaskStatus(
        task.id,
        action.toStatus,
        user.id,
        sessionId,
        undefined,
        action.requiresComment ? actionComment : undefined,
      );
      setActionModal(null);
      setActionComment("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(data: TaskFormInput) {
    if (!user || !task) return;
    setBusy(true);
    try {
      await updateTask(task.id, {
        title: data.title,
        field: data.field,
        content: data.content,
        priority: data.priority,
        ownerId: data.ownerId,
        startDate: data.startDate,
        dueDate: data.dueDate,
        deliverable: data.deliverable,
        doneCriteria: data.doneCriteria,
        updatedBy: user.id,
        sessionId,
      });
      setEditOpen(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!user || !task || !schoolYear) return;
    const newId = await createTask({
      schoolYearId: schoolYear.id,
      title: `${task.title} (bản sao)`,
      field: task.field ?? undefined,
      content: task.content ?? undefined,
      priority: task.priority,
      assignedBy: user.id,
      ownerId: task.owner_id,
      coordinatorIds: [],
      startDate: task.start_date ?? undefined,
      dueDate: task.due_date ?? new Date().toISOString().slice(0, 10),
      deliverable: task.deliverable ?? undefined,
      doneCriteria: task.done_criteria ?? undefined,
      createdBy: user.id,
      sessionId,
    });
    navigate(`/cong-viec/${newId}`);
  }

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cong-viec")}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleDuplicate}>
            <Copy size={14} /> Sao chép
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> In
          </Button>
          {hasPermission("task.edit") && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              Chỉnh sửa
            </Button>
          )}
          {availableActions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant ?? "primary"}
              onClick={() => (action.requiresComment ? setActionModal(action) : runAction(action))}
              disabled={busy}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-navy/50">{task.code}</span>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        <h1 className="mb-3 text-xl font-semibold text-navy">{task.title}</h1>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Lĩnh vực" value={task.field ?? "—"} />
          <Info label="Người chủ trì" value={task.owner_name} />
          <Info label="Người giao" value={task.assigned_by_name ?? "—"} />
          <Info label="Ngày bắt đầu" value={task.start_date ?? "—"} />
          <Info label="Hạn hoàn thành" value={task.due_date ?? "—"} />
          <Info
            label="Người phối hợp"
            value={
              assignees
                .filter((a) => a.role_in_task === "coordinator")
                .map((a) => a.user_name)
                .join(", ") || "—"
            }
          />
          <Info label="Sản phẩm phải nộp" value={task.deliverable ?? "—"} />
          <Info label="Tiêu chí hoàn thành" value={task.done_criteria ?? "—"} />
        </div>
        {task.content && (
          <div className="mt-3 border-t border-navy/5 pt-3">
            <p className="text-sm font-medium text-navy">Nội dung</p>
            <p className="whitespace-pre-line text-sm text-navy/70">{task.content}</p>
          </div>
        )}
        {task.review_comment && (
          <div className="mt-3 rounded-lg bg-warn/10 p-3 text-sm text-navy">
            <span className="font-medium">Ý kiến kiểm tra: </span>
            {task.review_comment}
          </div>
        )}
      </Card>

      <Card className="print:hidden">
        <h2 className="mb-2 text-sm font-semibold text-navy">Cập nhật tiến độ</h2>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-12 text-sm font-medium text-navy">{progress}%</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              if (!user) return;
              await updateTaskProgress(task.id, progress, task.difficulty ?? undefined, task.proposal ?? undefined, user.id, sessionId);
              refresh();
            }}
          >
            Lưu
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:hidden">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Minh chứng đính kèm</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (!user) return;
                const res = await pickAndAttachFile("tasks", task.id, user.id);
                if (res) {
                  await addTaskEvidence(task.id, res.filePath, res.fileName, user.id);
                  refresh();
                }
              }}
            >
              <Paperclip size={14} /> Đính kèm tệp
            </Button>
          </div>
          <div className="space-y-1 text-sm">
            {evidence.length === 0 && <p className="text-navy/50">Chưa có minh chứng.</p>}
            {evidence.map((e) => (
              <div key={e.id} className="flex justify-between rounded-lg border border-navy/5 p-2">
                <span className="truncate">{e.file_name}</span>
                <span className="text-xs text-navy/50">{e.uploaded_by_name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Lịch sử trạng thái</h2>
          <div className="space-y-2 text-sm">
            {history.map((h) => (
              <div key={h.id} className="border-l-2 border-brand/30 pl-3">
                <p className="text-navy">
                  {h.from_status ? `${h.from_status} → ${h.to_status}` : `Khởi tạo: ${h.to_status}`}
                </p>
                <p className="text-xs text-navy/50">
                  {h.changed_by_name} · {new Date(h.changed_at).toLocaleString("vi-VN")}
                </p>
                {h.note && <p className="text-xs text-navy/60">{h.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="print:hidden">
        <h2 className="mb-2 text-sm font-semibold text-navy">Nhật ký công việc</h2>
        <div className="mb-3 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-cream p-2 text-sm">
              <p className="text-navy">{c.content}</p>
              <p className="text-xs text-navy/50">
                {c.user_name} · {new Date(c.created_at).toLocaleString("vi-VN")}
              </p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ghi nhật ký, khó khăn, đề xuất..."
            className="min-h-[60px]"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!comment.trim()}
            onClick={async () => {
              if (!user) return;
              await addTaskComment(task.id, user.id, comment.trim());
              setComment("");
              refresh();
            }}
          >
            Ghi nhật ký
          </Button>
        </div>
      </Card>

      <TaskFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        users={users}
        initial={task}
        submitting={busy}
      />

      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={actionModal?.label ?? ""}
      >
        <Textarea
          placeholder="Nhập ý kiến kiểm tra / lý do yêu cầu điều chỉnh"
          value={actionComment}
          onChange={(e) => setActionComment(e.target.value)}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setActionModal(null)}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={!actionComment.trim() || busy}
            onClick={() => actionModal && runAction(actionModal)}
          >
            Xác nhận
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-navy/50">{label}</p>
      <p className="text-navy">{value}</p>
    </div>
  );
}
