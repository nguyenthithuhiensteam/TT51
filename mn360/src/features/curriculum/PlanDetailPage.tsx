import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Field, Textarea } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import {
  changeEducationPlanStatus,
  getEducationPlanById,
  listPlanApprovals,
  updateEducationPlanContent,
  type EducationPlanRow,
  type PlanApprovalRow,
} from "../../lib/db/curriculumRepo";
import { PLAN_TYPE_LABELS } from "../../lib/db/types";
import type { RecordStatus } from "../../lib/db/types";
import { exportEducationPlanToWord } from "../../lib/export/word";

interface PlanAction {
  label: string;
  toStatus: RecordStatus;
  action: "submit" | "approve" | "reject" | "publish";
  requiresComment?: boolean;
  variant?: "primary" | "danger" | "success";
}

const PLAN_ACTIONS: Record<string, PlanAction[]> = {
  draft: [{ label: "Gửi tổ trưởng góp ý", toStatus: "submitted", action: "submit" }],
  submitted: [
    { label: "Góp ý xong, gửi phê duyệt", toStatus: "pending_approval", action: "approve" },
    {
      label: "Yêu cầu điều chỉnh",
      toStatus: "needs_revision",
      action: "reject",
      requiresComment: true,
      variant: "danger",
    },
  ],
  pending_approval: [
    { label: "Phê duyệt", toStatus: "approved", action: "approve", variant: "success" },
    {
      label: "Yêu cầu điều chỉnh",
      toStatus: "needs_revision",
      action: "reject",
      requiresComment: true,
      variant: "danger",
    },
  ],
  needs_revision: [{ label: "Gửi duyệt lại", toStatus: "submitted", action: "submit" }],
  approved: [{ label: "Ban hành, áp dụng", toStatus: "published", action: "publish" }],
  published: [{ label: "Lưu trữ", toStatus: "archived", action: "publish" }],
};

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [plan, setPlan] = useState<EducationPlanRow | null>(null);
  const [approvals, setApprovals] = useState<PlanApprovalRow[]>([]);
  const [fields, setFields] = useState({
    objectives: "",
    requirements: "",
    content: "",
    activities: "",
    environment: "",
    materials: "",
    methods: "",
    evaluation: "",
    adjustment: "",
  });
  const [actionModal, setActionModal] = useState<PlanAction | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!id) return;
    const p = await getEducationPlanById(id);
    setPlan(p);
    if (p) {
      setFields({
        objectives: p.objectives ?? "",
        requirements: p.requirements ?? "",
        content: p.content ?? "",
        activities: p.activities ?? "",
        environment: p.environment ?? "",
        materials: p.materials ?? "",
        methods: p.methods ?? "",
        evaluation: p.evaluation ?? "",
        adjustment: p.adjustment ?? "",
      });
    }
    setApprovals(await listPlanApprovals(id));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!plan) return <p className="text-navy/60">Đang tải...</p>;

  const editable = plan.status === "draft" || plan.status === "needs_revision";
  const availableActions = (PLAN_ACTIONS[plan.status] ?? []).filter((a) =>
    hasPermission(a.action === "submit" ? "curriculum.submit" : "curriculum.approve"),
  );

  async function runAction(action: PlanAction) {
    if (!user || !plan) return;
    setBusy(true);
    try {
      await changeEducationPlanStatus(
        plan.id,
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

  async function saveContent() {
    if (!user || !plan) return;
    setBusy(true);
    try {
      await updateEducationPlanContent(plan.id, fields, user.id, sessionId);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/chuyen-mon")}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </Button>
        <div className="flex flex-wrap gap-2">
          {hasPermission("curriculum.export") && (
            <Button variant="secondary" size="sm" onClick={() => exportEducationPlanToWord(plan)}>
              <FileDown size={14} /> Xuất Word
            </Button>
          )}
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
        </div>
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-navy/50">{plan.code}</span>
          <StatusBadge status={plan.status} />
          <span className="text-xs text-navy/50">{PLAN_TYPE_LABELS[plan.plan_type]}</span>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-navy">{plan.title}</h1>
        <p className="text-sm text-navy/60">
          Lớp: {plan.class_name ?? "Toàn khối"} · Độ tuổi: {plan.age_group ?? "—"} · Người soạn:{" "}
          {plan.created_by_name}
          {plan.period_start && ` · ${plan.period_start} → ${plan.period_end}`}
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-navy">Nội dung kế hoạch</h2>
        <div className="grid grid-cols-1 gap-3">
          <PlanField label="Mục tiêu" value={fields.objectives} editable={editable} onChange={(v) => setFields((p) => ({ ...p, objectives: v }))} />
          <PlanField label="Yêu cầu cần đạt" value={fields.requirements} editable={editable} onChange={(v) => setFields((p) => ({ ...p, requirements: v }))} />
          <PlanField label="Nội dung" value={fields.content} editable={editable} onChange={(v) => setFields((p) => ({ ...p, content: v }))} />
          <PlanField label="Hoạt động" value={fields.activities} editable={editable} onChange={(v) => setFields((p) => ({ ...p, activities: v }))} />
          <PlanField label="Môi trường" value={fields.environment} editable={editable} onChange={(v) => setFields((p) => ({ ...p, environment: v }))} />
          <PlanField label="Học liệu" value={fields.materials} editable={editable} onChange={(v) => setFields((p) => ({ ...p, materials: v }))} />
          <PlanField label="Phương pháp" value={fields.methods} editable={editable} onChange={(v) => setFields((p) => ({ ...p, methods: v }))} />
          <PlanField label="Đánh giá" value={fields.evaluation} editable={editable} onChange={(v) => setFields((p) => ({ ...p, evaluation: v }))} />
          <PlanField label="Điều chỉnh" value={fields.adjustment} editable={editable} onChange={(v) => setFields((p) => ({ ...p, adjustment: v }))} />
        </div>
        {editable && (
          <div className="mt-3 flex justify-end">
            <Button size="sm" disabled={busy} onClick={saveContent}>
              Lưu nội dung
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Lịch sử góp ý / phê duyệt</h2>
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

      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={actionModal?.label ?? ""}>
        <Textarea
          placeholder="Nhập ý kiến góp ý / lý do yêu cầu điều chỉnh"
          value={actionComment}
          onChange={(e) => setActionComment(e.target.value)}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setActionModal(null)}>
            Hủy
          </Button>
          <Button variant="danger" disabled={!actionComment.trim() || busy} onClick={() => actionModal && runAction(actionModal)}>
            Xác nhận
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PlanField({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  if (!editable) {
    return (
      <div>
        <p className="text-xs text-navy/50">{label}</p>
        <p className="whitespace-pre-line text-sm text-navy">{value || "—"}</p>
      </div>
    );
  }
  return (
    <Field label={label}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
