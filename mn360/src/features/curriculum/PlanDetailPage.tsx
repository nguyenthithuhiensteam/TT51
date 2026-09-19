import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Sparkles, Undo2, ShieldCheck } from "lucide-react";
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
import { exportEducationPlanToPdf } from "../../lib/export/pdf";
import { editSection, validatePlan, type SectionEditMode } from "../../lib/ai/curriculumAi";
import { describeAiError } from "../../lib/ai/gateway";

type PlanFieldKey =
  | "objectives"
  | "requirements"
  | "content"
  | "activities"
  | "environment"
  | "materials"
  | "methods"
  | "evaluation"
  | "adjustment";

const FIELD_LABELS: Record<PlanFieldKey, string> = {
  objectives: "Mục tiêu",
  requirements: "Yêu cầu cần đạt",
  content: "Nội dung",
  activities: "Hoạt động",
  environment: "Môi trường",
  materials: "Học liệu",
  methods: "Phương pháp",
  evaluation: "Đánh giá",
  adjustment: "Điều chỉnh",
};

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

  const [aiFieldBusy, setAiFieldBusy] = useState<Partial<Record<PlanFieldKey, boolean>>>({});
  const [aiFieldError, setAiFieldError] = useState<Partial<Record<PlanFieldKey, string>>>({});
  const [aiFieldHistory, setAiFieldHistory] = useState<Partial<Record<PlanFieldKey, string[]>>>({});
  const [validateOpen, setValidateOpen] = useState(false);
  const [validateBusy, setValidateBusy] = useState(false);
  const [validateResult, setValidateResult] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

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

  async function runFieldAi(key: PlanFieldKey, mode: SectionEditMode) {
    if (!plan) return;
    setAiFieldError((p) => ({ ...p, [key]: undefined }));
    setAiFieldBusy((p) => ({ ...p, [key]: true }));
    const previousValue = fields[key];
    try {
      const updated = await editSection(
        {
          planType: plan.plan_type,
          title: plan.title,
          ageGroup: plan.age_group ?? undefined,
          className: plan.class_name ?? undefined,
          periodStart: plan.period_start ?? undefined,
          periodEnd: plan.period_end ?? undefined,
        },
        FIELD_LABELS[key],
        previousValue,
        mode,
      );
      // Chỉ thay đổi đúng mục đang chọn — các mục khác giữ nguyên.
      setFields((p) => ({ ...p, [key]: updated }));
      setAiFieldHistory((p) => ({ ...p, [key]: [...(p[key] ?? []), previousValue] }));
    } catch (err) {
      setAiFieldError((p) => ({ ...p, [key]: describeAiError(err) }));
    } finally {
      setAiFieldBusy((p) => ({ ...p, [key]: false }));
    }
  }

  function undoFieldAi(key: PlanFieldKey) {
    setAiFieldHistory((p) => {
      const stack = p[key] ?? [];
      if (stack.length === 0) return p;
      const previous = stack[stack.length - 1];
      setFields((f) => ({ ...f, [key]: previous }));
      return { ...p, [key]: stack.slice(0, -1) };
    });
  }

  async function runValidatePlan() {
    if (!plan) return;
    setValidateOpen(true);
    setValidateBusy(true);
    setValidateError(null);
    setValidateResult(null);
    try {
      const result = await validatePlan(
        {
          planType: plan.plan_type,
          title: plan.title,
          ageGroup: plan.age_group ?? undefined,
          className: plan.class_name ?? undefined,
          periodStart: plan.period_start ?? undefined,
          periodEnd: plan.period_end ?? undefined,
          objectives: fields.objectives,
          requirements: fields.requirements,
          content: fields.content,
        },
        fields,
      );
      setValidateResult(result);
    } catch (err) {
      setValidateError(describeAiError(err));
    } finally {
      setValidateBusy(false);
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
          {hasPermission("curriculum.export") && (
            <Button
              variant="secondary"
              size="sm"
              disabled={pdfBusy}
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await exportEducationPlanToPdf(plan);
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              <FileDown size={14} /> {pdfBusy ? "Đang xuất PDF..." : "Xuất PDF"}
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled={validateBusy} onClick={runValidatePlan}>
            <ShieldCheck size={14} /> Kiểm tra tính thống nhất
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
          {(Object.keys(FIELD_LABELS) as PlanFieldKey[]).map((key) => (
            <PlanField
              key={key}
              label={FIELD_LABELS[key]}
              value={fields[key]}
              editable={editable}
              onChange={(v) => setFields((p) => ({ ...p, [key]: v }))}
              aiBusy={!!aiFieldBusy[key]}
              aiError={aiFieldError[key]}
              canUndo={(aiFieldHistory[key]?.length ?? 0) > 0}
              onAi={(mode) => runFieldAi(key, mode)}
              onUndo={() => undoFieldAi(key)}
            />
          ))}
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

      <Modal open={validateOpen} onClose={() => setValidateOpen(false)} title="Kiểm tra tính thống nhất (AI)">
        {validateBusy && <p className="text-sm text-navy/60">Đang phân tích kế hoạch...</p>}
        {validateError && <p className="text-sm text-danger">{validateError}</p>}
        {validateResult && <p className="whitespace-pre-line text-sm text-navy">{validateResult}</p>}
        <p className="mt-3 text-xs text-navy/40">
          Đây chỉ là nhận xét gợi ý từ AI, không tự động thay đổi nội dung kế hoạch.
        </p>
      </Modal>
    </div>
  );
}

function PlanField({
  label,
  value,
  editable,
  onChange,
  aiBusy,
  aiError,
  canUndo,
  onAi,
  onUndo,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  aiBusy?: boolean;
  aiError?: string;
  canUndo?: boolean;
  onAi?: (mode: SectionEditMode) => void;
  onUndo?: () => void;
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
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={aiBusy} />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => onAi?.("rewrite")}>
          <Sparkles size={12} /> {aiBusy ? "Đang xử lý..." : "Viết lại bằng AI"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => onAi?.("shorten")}>
          Rút gọn
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => onAi?.("expand")}>
          Mở rộng
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => onAi?.("age_fit")}>
          Điều chỉnh theo độ tuổi
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => onAi?.("steam")}>
          Tích hợp STEAM
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => onAi?.("sel")}>
          Tích hợp SEL
        </Button>
        {canUndo && (
          <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={onUndo}>
            <Undo2 size={12} /> Hoàn tác
          </Button>
        )}
      </div>
      {aiError && <p className="mt-1 text-xs text-danger">{aiError}</p>}
    </Field>
  );
}
