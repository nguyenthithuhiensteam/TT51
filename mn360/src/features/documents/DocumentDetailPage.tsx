import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ListChecks, Printer, Sparkles } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Field, Textarea } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import {
  addDocumentVersion,
  archiveDocument,
  changeDocumentStatus,
  getDocumentById,
  listDocumentApprovals,
  listDocumentVersions,
  type DocumentApprovalRow,
  type DocumentVersionRow,
  type DocumentWithCreator,
} from "../../lib/db/documentRepo";
import { createTask } from "../../lib/db/taskRepo";
import { linkDocumentToTask } from "../../lib/db/documentRepo";
import { DOC_TYPE_LABELS } from "../../lib/db/types";
import { generateWithAi } from "../../lib/ai/gateway";
import { redactText } from "../../lib/ai/redact";

interface DocAction {
  label: string;
  toStatus: DocumentWithCreator["status"];
  action: "submit" | "approve" | "reject" | "sign" | "publish";
  permission: string;
  requiresComment?: boolean;
  variant?: "primary" | "danger" | "success";
}

const DOC_STATUS_ACTIONS: Record<string, DocAction[]> = {
  draft: [
    { label: "Gửi duyệt", toStatus: "pending_approval", action: "submit", permission: "document.submit" },
  ],
  pending_approval: [
    { label: "Phê duyệt", toStatus: "approved", action: "approve", permission: "document.approve", variant: "success" },
    {
      label: "Góp ý / yêu cầu điều chỉnh",
      toStatus: "needs_revision",
      action: "reject",
      permission: "document.approve",
      requiresComment: true,
      variant: "danger",
    },
  ],
  needs_revision: [
    { label: "Hoàn thiện, gửi lại", toStatus: "pending_approval", action: "submit", permission: "document.submit" },
  ],
  approved: [{ label: "Ký", toStatus: "signed", action: "sign", permission: "document.approve" }],
  signed: [{ label: "Ban hành", toStatus: "published", action: "publish", permission: "document.publish" }],
};

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [doc, setDoc] = useState<DocumentWithCreator | null>(null);
  const [versions, setVersions] = useState<DocumentVersionRow[]>([]);
  const [approvals, setApprovals] = useState<DocumentApprovalRow[]>([]);
  const [editingContent, setEditingContent] = useState("");
  const [actionModal, setActionModal] = useState<DocAction | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function refresh() {
    if (!id) return;
    setDoc(await getDocumentById(id));
    const v = await listDocumentVersions(id);
    setVersions(v);
    setEditingContent(v[0]?.content_html ?? "");
    setApprovals(await listDocumentApprovals(id));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!doc) return <p className="text-navy/60">Đang tải...</p>;

  const availableActions = (DOC_STATUS_ACTIONS[doc.status] ?? []).filter((a) =>
    hasPermission(a.permission),
  );
  const canArchive = doc.status === "published" && hasPermission("document.publish");

  async function runAction(action: DocAction) {
    if (!user || !doc) return;
    setBusy(true);
    try {
      await changeDocumentStatus(
        doc.id,
        action.toStatus,
        action.action,
        user.id,
        sessionId,
        action.requiresComment ? actionComment : undefined,
      );
      setActionModal(null);
      setActionComment("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveVersion() {
    if (!user || !doc) return;
    setBusy(true);
    try {
      await addDocumentVersion(doc.id, editingContent, user.id, "Chỉnh sửa nội dung", sessionId);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  function buildAiUserPrompt(): string {
    if (!doc) return "";
    const raw = [
      `Loại văn bản: ${DOC_TYPE_LABELS[doc.doc_type]}`,
      `Tiêu đề: ${doc.title}`,
      doc.summary ? `Trích yếu: ${doc.summary}` : "",
      `Yêu cầu cụ thể: ${aiInstruction || "Soạn nội dung phù hợp với tiêu đề và trích yếu trên"}`,
    ]
      .filter(Boolean)
      .join("\n");
    return redactText(raw).redacted;
  }

  async function runAiDraft() {
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const systemPrompt =
        "Bạn là trợ lý soạn thảo văn bản hành chính cho trường mầm non công lập tại Việt Nam. " +
        "Viết văn phong trang trọng, đúng thể thức văn bản hành chính, tiếng Việt chuẩn, không bịa đặt số liệu.";
      const result = await generateWithAi(systemPrompt, buildAiUserPrompt());
      setAiResult(result.content);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Không thể tạo nội dung AI");
    } finally {
      setAiLoading(false);
    }
  }

  async function convertToTask() {
    if (!user || !doc || !schoolYear || !taskTitle.trim() || !taskDueDate) return;
    setBusy(true);
    try {
      const taskId = await createTask({
        schoolYearId: schoolYear.id,
        title: taskTitle.trim(),
        content: `Chuyển từ văn bản ${doc.code}: ${doc.title}`,
        priority: "normal",
        assignedBy: user.id,
        ownerId: user.id,
        coordinatorIds: [],
        dueDate: taskDueDate,
        createdBy: user.id,
        sessionId,
      });
      await linkDocumentToTask(taskId, doc.id);
      setTaskModalOpen(false);
      navigate(`/cong-viec/${taskId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/van-phong-so")}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> In
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTaskModalOpen(true)}>
            <ListChecks size={14} /> Chuyển thành nhiệm vụ
          </Button>
          {availableActions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.variant ?? "primary"}
              disabled={busy}
              onClick={() => (a.requiresComment ? setActionModal(a) : runAction(a))}
            >
              {a.label}
            </Button>
          ))}
          {canArchive && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (!user) return;
                await archiveDocument(doc.id, user.id, sessionId);
                refresh();
              }}
            >
              Lưu trữ
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-navy/50">{doc.code}</span>
          <StatusBadge status={doc.status} />
          <span className="text-xs text-navy/50">{DOC_TYPE_LABELS[doc.doc_type]}</span>
        </div>
        <h1 className="mb-3 text-xl font-semibold text-navy">{doc.title}</h1>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Info label="Đơn vị ban hành" value={doc.issuing_unit ?? "—"} />
          <Info label="Nơi nhận" value={doc.recipient ?? "—"} />
          <Info label="Người soạn" value={doc.created_by_name} />
          <Info label="Danh mục" value={doc.category ?? "—"} />
        </div>
        {doc.summary && (
          <p className="mt-3 border-t border-navy/5 pt-3 text-sm text-navy/70">{doc.summary}</p>
        )}
      </Card>

      <Card className="print:hidden">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy">Nội dung (phiên bản mới nhất)</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy/50">
              {versions.length > 0 ? `Phiên bản ${versions[0].version_no}` : "Chưa có nội dung"}
            </span>
            {doc.status !== "published" && doc.status !== "archived" && hasPermission("document.create") && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAiResult(null);
                  setAiError(null);
                  setAiModalOpen(true);
                }}
              >
                <Sparkles size={14} /> Soạn dự thảo bằng AI
              </Button>
            )}
          </div>
        </div>
        <Textarea
          value={editingContent}
          onChange={(e) => setEditingContent(e.target.value)}
          className="min-h-[160px]"
          disabled={!hasPermission("document.create") || doc.status === "published" || doc.status === "archived"}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={busy || doc.status === "published" || doc.status === "archived"}
            onClick={saveVersion}
          >
            Lưu bản chỉnh sửa
          </Button>
        </div>
      </Card>

      <div className="print:hidden">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Lịch sử phê duyệt</h2>
          <div className="space-y-2 text-sm">
            {approvals.length === 0 && <p className="text-navy/50">Chưa có lịch sử.</p>}
            {approvals.map((a) => (
              <div key={a.id} className="border-l-2 border-brand/30 pl-3">
                <p className="text-navy">
                  {a.action} · {a.from_status} → {a.to_status}
                </p>
                <p className="text-xs text-navy/50">
                  {a.approver_name} · {new Date(a.acted_at).toLocaleString("vi-VN")}
                </p>
                {a.comment && <p className="text-xs text-navy/60">{a.comment}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={actionModal?.label ?? ""}>
        <Textarea
          placeholder="Nhập ý kiến góp ý"
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

      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="Chuyển thành nhiệm vụ">
        <div className="space-y-3">
          <Field label="Tên nhiệm vụ" required>
            <input
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={`Thực hiện nội dung văn bản ${doc.code}`}
            />
          </Field>
          <Field label="Hạn hoàn thành" required>
            <input
              type="date"
              className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTaskModalOpen(false)}>
              Hủy
            </Button>
            <Button disabled={!taskTitle.trim() || !taskDueDate || busy} onClick={convertToTask}>
              Tạo nhiệm vụ
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={aiModalOpen} onClose={() => setAiModalOpen(false)} title="Soạn dự thảo bằng AI" wide>
        <div className="space-y-3">
          <Field label="Yêu cầu cụ thể (tùy chọn)">
            <Textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="VD: Soạn theo thể thức công văn, nhấn mạnh mốc thời gian thực hiện..."
            />
          </Field>
          <div>
            <p className="mb-1 text-xs font-medium text-navy/60">
              Nội dung sẽ gửi cho AI (đã ẩn danh số điện thoại/ngày tháng nếu có):
            </p>
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-cream p-2 text-xs text-navy/70">
              {buildAiUserPrompt()}
            </pre>
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={aiLoading} onClick={runAiDraft}>
              {aiLoading ? "Đang tạo..." : "Tạo dự thảo"}
            </Button>
          </div>
          {aiError && <p className="text-sm text-danger">{aiError}</p>}
          {aiResult && (
            <div className="space-y-2 rounded-lg border border-mint/30 bg-mint/5 p-3">
              <p className="text-xs font-semibold text-mint">Nội dung do AI hỗ trợ — cần kiểm tra trước khi lưu</p>
              <p className="whitespace-pre-wrap text-sm text-navy">{aiResult}</p>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingContent(
                      (prev) =>
                        `${prev ? prev + "\n\n" : ""}[Nội dung do AI hỗ trợ — đã kiểm tra]\n${aiResult}`,
                    );
                    setAiModalOpen(false);
                  }}
                >
                  Chèn vào nội dung
                </Button>
              </div>
            </div>
          )}
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
