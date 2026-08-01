import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import { listActiveUsers } from "@/lib/db/systemRepo";
import { pickAndAttachFile } from "@/lib/db/attachmentRepo";
import {
  assignCriteria,
  changeCriteriaStatus,
  createCriteria,
  createEvidence,
  createStandard,
  getCriteriaById,
  linkEvidenceToCriteria,
  listCriteria,
  listCriteriaAssignments,
  listEvidenceForCriteria,
  listEvidenceFiles,
  listStandards,
  updateCriteriaSelfAssessment,
  type CriteriaAssignmentRow,
  type CriteriaRow,
  type EvidenceRow,
  type StandardRow,
} from "@/lib/db/accreditationRepo";
import type { RecordStatus, User } from "@/lib/db/types";

interface CriteriaAction {
  label: string;
  toStatus: RecordStatus;
  action: "submit" | "approve" | "reject";
  requiresComment?: boolean;
  variant?: "primary" | "danger" | "success";
}

const CRITERIA_ACTIONS: Record<string, CriteriaAction[]> = {
  draft: [{ label: "Gửi duyệt", toStatus: "pending_approval", action: "submit" }],
  pending_approval: [
    { label: "Phê duyệt", toStatus: "approved", action: "approve", variant: "success" },
    { label: "Yêu cầu điều chỉnh", toStatus: "needs_revision", action: "reject", requiresComment: true, variant: "danger" },
  ],
  needs_revision: [{ label: "Gửi duyệt lại", toStatus: "pending_approval", action: "submit" }],
};

export function AccreditationPage() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [criteria, setCriteria] = useState<CriteriaRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CriteriaRow | null>(null);
  const [assignments, setAssignments] = useState<CriteriaAssignmentRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [allEvidence, setAllEvidence] = useState<EvidenceRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ currentStatusNote: "", strengths: "", weaknesses: "", improvementPlan: "" });
  const [assigneeId, setAssigneeId] = useState("");
  const [linkEvidenceId, setLinkEvidenceId] = useState("");
  const [actionModal, setActionModal] = useState<CriteriaAction | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [standardModalOpen, setStandardModalOpen] = useState(false);
  const [criteriaModalOpen, setCriteriaModalOpen] = useState(false);
  const [standardForm, setStandardForm] = useState({ code: "", name: "" });
  const [criteriaForm, setCriteriaForm] = useState({ standardId: "", code: "", name: "" });
  const [busy, setBusy] = useState(false);

  const refreshList = async () => {
    setStandards(await listStandards());
    setCriteria(await listCriteria());
  };

  useEffect(() => {
    refreshList();
    listActiveUsers().then(setUsers);
    listEvidenceFiles().then(setAllEvidence);
  }, []);

  async function refreshDetail(id: string) {
    setDetail(await getCriteriaById(id));
    setAssignments(await listCriteriaAssignments(id));
    setEvidence(await listEvidenceForCriteria(id));
  }

  useEffect(() => {
    if (selectedId) refreshDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (detail) {
      setForm({
        currentStatusNote: detail.current_status_note ?? "",
        strengths: detail.strengths ?? "",
        weaknesses: detail.weaknesses ?? "",
        improvementPlan: detail.improvement_plan ?? "",
      });
    }
  }, [detail]);

  const availableActions = (CRITERIA_ACTIONS[detail?.status ?? ""] ?? []).filter((a) =>
    hasPermission(a.action === "submit" ? "accreditation.edit" : "accreditation.approve"),
  );
  const editable = detail?.status === "draft" || detail?.status === "needs_revision";

  async function runAction(action: CriteriaAction) {
    if (!user || !detail) return;
    setBusy(true);
    try {
      await changeCriteriaStatus(detail.id, action.toStatus, action.action, user.id, sessionId, action.requiresComment ? actionComment : undefined);
      setActionModal(null);
      setActionComment("");
      refreshDetail(detail.id);
      refreshList();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">Kiểm định</h1>
          <p className="text-sm text-navy/60">Tự đánh giá theo tiêu chuẩn/tiêu chí, minh chứng liên kết N-N, không tải trùng.</p>
        </div>
        {hasPermission("accreditation.create") && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setStandardModalOpen(true)}>
              <Plus size={14} /> Thêm tiêu chuẩn
            </Button>
            <Button size="sm" onClick={() => setCriteriaModalOpen(true)}>
              <Plus size={14} /> Thêm tiêu chí
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold text-navy">Danh sách tiêu chí</h2>
          <div className="space-y-3">
            {standards.map((std) => (
              <div key={std.id}>
                <p className="mb-1 text-xs font-semibold uppercase text-navy/50">{std.code} — {std.name}</p>
                <div className="space-y-1">
                  {criteria
                    .filter((c) => c.standard_id === std.id)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                          selectedId === c.id ? "bg-brand/10 text-brand-dark" : "hover:bg-navy/5"
                        }`}
                      >
                        <span>{c.code} — {c.name}</span>
                        <StatusBadge status={c.status} />
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          {!detail ? (
            <p className="text-sm text-navy/50">Chọn một tiêu chí để xem chi tiết.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-navy/50">{detail.code}</span>
                  <h2 className="text-lg font-semibold text-navy">{detail.name}</h2>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={detail.status} />
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

              <div className="grid grid-cols-1 gap-3">
                {(
                  [
                    ["currentStatusNote", "Mô tả hiện trạng"],
                    ["strengths", "Điểm mạnh"],
                    ["weaknesses", "Điểm yếu"],
                    ["improvementPlan", "Kế hoạch cải tiến"],
                  ] as [keyof typeof form, string][]
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <Textarea
                      disabled={!editable || !hasPermission("accreditation.edit")}
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </Field>
                ))}
                {editable && hasPermission("accreditation.edit") && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        if (!user) return;
                        setBusy(true);
                        try {
                          await updateCriteriaSelfAssessment(detail.id, form, user.id);
                          refreshDetail(detail.id);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Lưu tự đánh giá
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-navy">Phân công phụ trách</h3>
                {hasPermission("accreditation.create") && (
                  <div className="mb-2 flex gap-2">
                    <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-64">
                      <option value="">-- Chọn người phụ trách --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!assigneeId || busy}
                      onClick={async () => {
                        if (!user) return;
                        await assignCriteria(detail.id, assigneeId, user.id);
                        setAssigneeId("");
                        refreshDetail(detail.id);
                      }}
                    >
                      Phân công
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {assignments.map((a) => (
                    <span key={a.id} className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">
                      {a.assignee_name}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-navy">Minh chứng</h3>
                {hasPermission("accreditation.edit") && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Select value={linkEvidenceId} onChange={(e) => setLinkEvidenceId(e.target.value)} className="w-64">
                      <option value="">-- Chọn minh chứng có sẵn --</option>
                      {allEvidence.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.code} — {e.file_name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!linkEvidenceId || busy}
                      onClick={async () => {
                        if (!user) return;
                        await linkEvidenceToCriteria(detail.id, linkEvidenceId, user.id);
                        setLinkEvidenceId("");
                        refreshDetail(detail.id);
                      }}
                    >
                      Liên kết
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!user) return;
                        const res = await pickAndAttachFile("accreditation", detail.id, user.id);
                        if (res) {
                          const evidenceId = await createEvidence(res.fileName, res.filePath, undefined, user.id);
                          await linkEvidenceToCriteria(detail.id, evidenceId, user.id);
                          listEvidenceFiles().then(setAllEvidence);
                          refreshDetail(detail.id);
                        }
                      }}
                    >
                      Tải minh chứng mới
                    </Button>
                  </div>
                )}
                <div className="space-y-1 text-sm">
                  {evidence.map((e) => (
                    <div key={e.id} className="flex justify-between rounded-lg border border-navy/5 p-2">
                      <span>{e.code} — {e.file_name}</span>
                      <span className="text-xs text-navy/50">{e.uploaded_by_name}</span>
                    </div>
                  ))}
                  {evidence.length === 0 && <p className="text-navy/50">Chưa có minh chứng.</p>}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={standardModalOpen} onClose={() => setStandardModalOpen(false)} title="Thêm tiêu chuẩn">
        <div className="space-y-3">
          <Field label="Mã tiêu chuẩn" required>
            <Input value={standardForm.code} onChange={(e) => setStandardForm((p) => ({ ...p, code: e.target.value }))} placeholder="VD: TC4" />
          </Field>
          <Field label="Tên tiêu chuẩn" required>
            <Input value={standardForm.name} onChange={(e) => setStandardForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStandardModalOpen(false)}>Hủy</Button>
            <Button
              disabled={!standardForm.code.trim() || !standardForm.name.trim() || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await createStandard(standardForm.code.trim(), standardForm.name.trim(), standards.length + 1);
                  setStandardForm({ code: "", name: "" });
                  setStandardModalOpen(false);
                  refreshList();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lưu
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={criteriaModalOpen} onClose={() => setCriteriaModalOpen(false)} title="Thêm tiêu chí">
        <div className="space-y-3">
          <Field label="Tiêu chuẩn" required>
            <Select value={criteriaForm.standardId} onChange={(e) => setCriteriaForm((p) => ({ ...p, standardId: e.target.value }))}>
              <option value="">-- Chọn tiêu chuẩn --</option>
              {standards.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Mã tiêu chí" required>
            <Input value={criteriaForm.code} onChange={(e) => setCriteriaForm((p) => ({ ...p, code: e.target.value }))} placeholder="VD: TC1.3" />
          </Field>
          <Field label="Tên tiêu chí" required>
            <Input value={criteriaForm.name} onChange={(e) => setCriteriaForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCriteriaModalOpen(false)}>Hủy</Button>
            <Button
              disabled={!criteriaForm.standardId || !criteriaForm.code.trim() || !criteriaForm.name.trim() || busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await createCriteria(criteriaForm.standardId, criteriaForm.code.trim(), criteriaForm.name.trim(), criteria.length + 1, user.id);
                  setCriteriaForm({ standardId: "", code: "", name: "" });
                  setCriteriaModalOpen(false);
                  refreshList();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lưu
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={actionModal?.label ?? ""}>
        <Textarea placeholder="Nhập lý do yêu cầu điều chỉnh" value={actionComment} onChange={(e) => setActionComment(e.target.value)} />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setActionModal(null)}>Hủy</Button>
          <Button variant="danger" disabled={!actionComment.trim() || busy} onClick={() => actionModal && runAction(actionModal)}>
            Xác nhận
          </Button>
        </div>
      </Modal>
    </div>
  );
}
