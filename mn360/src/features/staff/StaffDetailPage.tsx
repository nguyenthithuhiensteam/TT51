import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import {
  addStaffAssignment,
  decideStaffLeave,
  finalizeStaffEvaluation,
  getStaffById,
  listStaffAssignments,
  listStaffEvaluations,
  listStaffLeaves,
  requestStaffLeave,
  upsertStaffEvaluation,
  type StaffAssignmentRow,
  type StaffEvaluationRow,
  type StaffLeaveRow,
  type StaffWithUser,
} from "@/lib/db/staffRepo";
import { listClasses, type ClassWithTeacher } from "@/lib/db/childRepo";
import { EMPLOYMENT_TYPE_LABELS, EVALUATOR_ROLE_LABELS } from "@/lib/db/types";
import { StatusBadge } from "../../components/ui/Badge";
import type { EvaluatorRole } from "@/lib/db/types";

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const roles = useAuthStore((s) => s.roles);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [staff, setStaff] = useState<StaffWithUser | null>(null);
  const [assignments, setAssignments] = useState<StaffAssignmentRow[]>([]);
  const [leaves, setLeaves] = useState<StaffLeaveRow[]>([]);
  const [evaluations, setEvaluations] = useState<StaffEvaluationRow[]>([]);
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);

  const [assignForm, setAssignForm] = useState({ classId: "", type: "subject" as StaffAssignmentRow["assignment_type"], description: "" });
  const [leaveForm, setLeaveForm] = useState({ type: "", start: "", end: "", reason: "" });
  const [evalDrafts, setEvalDrafts] = useState<Record<EvaluatorRole, { rating: string; strengths: string; weaknesses: string; plan: string }>>({
    self: { rating: "", strengths: "", weaknesses: "", plan: "" },
    team_lead: { rating: "", strengths: "", weaknesses: "", plan: "" },
    principal: { rating: "", strengths: "", weaknesses: "", plan: "" },
  });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!id || !schoolYear) return;
    const s = await getStaffById(id);
    setStaff(s);
    setAssignments(await listStaffAssignments(id));
    setLeaves(await listStaffLeaves(id));
    const evals = await listStaffEvaluations(id, schoolYear.id);
    setEvaluations(evals);
    const next = { ...evalDrafts };
    for (const e of evals) {
      next[e.evaluator_role] = {
        rating: e.rating ?? "",
        strengths: e.strengths ?? "",
        weaknesses: e.weaknesses ?? "",
        plan: e.improvement_plan ?? "",
      };
    }
    setEvalDrafts(next);
  }

  useEffect(() => {
    refresh();
    if (schoolYear) listClasses(schoolYear.id).then(setClasses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, schoolYear?.id]);

  if (!staff) return <p className="text-navy/60">Đang tải...</p>;

  const isSelf = user?.id === staff.user_id;
  const canEditRole = (role: EvaluatorRole) => {
    if (role === "self") return isSelf;
    if (role === "team_lead") return roles.includes("team_lead") || hasPermission("staff.approve");
    return roles.includes("principal") || roles.includes("vice_principal") || hasPermission("staff.approve");
  };

  async function saveEvaluation(role: EvaluatorRole, submit: boolean) {
    if (!user || !staff || !schoolYear) return;
    setBusy(true);
    try {
      const draft = evalDrafts[role];
      await upsertStaffEvaluation(
        staff.id,
        schoolYear.id,
        role,
        user.id,
        { rating: draft.rating, strengths: draft.strengths, weaknesses: draft.weaknesses, improvementPlan: draft.plan },
        submit,
      );
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approveEvaluation(role: EvaluatorRole) {
    if (!user || !staff || !schoolYear) return;
    setBusy(true);
    try {
      await finalizeStaffEvaluation(staff.id, schoolYear.id, role, user.id, sessionId);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/doi-ngu")}>
        <ArrowLeft size={16} /> Quay lại danh sách
      </Button>

      <Card>
        <span className="font-mono text-xs text-navy/50">{staff.employee_code}</span>
        <h1 className="mb-2 text-xl font-semibold text-navy">{staff.full_name}</h1>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Info label="Chức vụ" value={staff.position} />
          <Info label="Loại hợp đồng" value={EMPLOYMENT_TYPE_LABELS[staff.employment_type]} />
          <Info label="Trình độ" value={staff.degree ?? "—"} />
          <Info label="Ngày vào trường" value={staff.start_date ?? "—"} />
          <Info label="Tài khoản" value={staff.username} />
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy">Phân công</h2>
        </div>
        {hasPermission("staff.edit") && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Select
              value={assignForm.type}
              onChange={(e) => setAssignForm((p) => ({ ...p, type: e.target.value as StaffAssignmentRow["assignment_type"] }))}
            >
              <option value="homeroom">Chủ nhiệm lớp</option>
              <option value="subject">Chuyên môn</option>
              <option value="support">Hỗ trợ</option>
              <option value="management">Quản lý</option>
            </Select>
            <Select value={assignForm.classId} onChange={(e) => setAssignForm((p) => ({ ...p, classId: e.target.value }))}>
              <option value="">-- Không gắn lớp --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Mô tả phân công"
              value={assignForm.description}
              onChange={(e) => setAssignForm((p) => ({ ...p, description: e.target.value }))}
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (!user || !schoolYear) return;
                setBusy(true);
                try {
                  await addStaffAssignment(
                    staff.id,
                    schoolYear.id,
                    assignForm.type,
                    assignForm.description || undefined,
                    assignForm.classId || undefined,
                    user.id,
                  );
                  setAssignForm({ classId: "", type: "subject", description: "" });
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Thêm
            </Button>
          </div>
        )}
        <div className="space-y-1 text-sm">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-lg border border-navy/5 p-2">
              {a.assignment_type} {a.class_name ? `— ${a.class_name}` : ""} {a.description ? `— ${a.description}` : ""}
            </div>
          ))}
          {assignments.length === 0 && <p className="text-navy/50">Chưa có phân công.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Nghỉ phép</h2>
        {isSelf && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
            <Input placeholder="Loại nghỉ" value={leaveForm.type} onChange={(e) => setLeaveForm((p) => ({ ...p, type: e.target.value }))} />
            <Input type="date" value={leaveForm.start} onChange={(e) => setLeaveForm((p) => ({ ...p, start: e.target.value }))} />
            <Input type="date" value={leaveForm.end} onChange={(e) => setLeaveForm((p) => ({ ...p, end: e.target.value }))} />
            <Input placeholder="Lý do" value={leaveForm.reason} onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))} />
            <Button
              size="sm"
              disabled={!leaveForm.type || !leaveForm.start || !leaveForm.end || busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await requestStaffLeave(staff.id, leaveForm.type, leaveForm.start, leaveForm.end, leaveForm.reason, user.id);
                  setLeaveForm({ type: "", start: "", end: "", reason: "" });
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Gửi đề nghị
            </Button>
          </div>
        )}
        <div className="space-y-2 text-sm">
          {leaves.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-navy/5 p-2">
              <div>
                <p className="font-medium text-navy">
                  {l.leave_type}: {l.start_date} → {l.end_date}
                </p>
                <p className="text-xs text-navy/50">{l.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={l.status} />
                {l.status === "pending_approval" && hasPermission("staff.approve") && (
                  <>
                    <Button size="sm" variant="success" onClick={() => decideStaffLeave(l.id, true, user!.id, sessionId).then(refresh)}>
                      Duyệt
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => decideStaffLeave(l.id, false, user!.id, sessionId).then(refresh)}>
                      Từ chối
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {leaves.length === 0 && <p className="text-navy/50">Chưa có đề nghị nghỉ phép.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-navy">Đánh giá viên chức năm học {schoolYear?.code}</h2>
        <div className="space-y-4">
          {(["self", "team_lead", "principal"] as EvaluatorRole[]).map((role) => {
            const existing = evaluations.find((e) => e.evaluator_role === role);
            const editable = canEditRole(role);
            const draft = evalDrafts[role];
            return (
              <div key={role} className="rounded-xl border border-navy/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy">{EVALUATOR_ROLE_LABELS[role]}</span>
                  {existing && <StatusBadge status={existing.status} />}
                </div>
                {editable ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="Xếp loại">
                      <Input
                        value={draft.rating}
                        onChange={(e) =>
                          setEvalDrafts((p) => ({ ...p, [role]: { ...p[role], rating: e.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Điểm mạnh">
                      <Textarea
                        value={draft.strengths}
                        onChange={(e) =>
                          setEvalDrafts((p) => ({ ...p, [role]: { ...p[role], strengths: e.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Hạn chế">
                      <Textarea
                        value={draft.weaknesses}
                        onChange={(e) =>
                          setEvalDrafts((p) => ({ ...p, [role]: { ...p[role], weaknesses: e.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Kế hoạch khắc phục">
                      <Textarea
                        value={draft.plan}
                        onChange={(e) =>
                          setEvalDrafts((p) => ({ ...p, [role]: { ...p[role], plan: e.target.value } }))
                        }
                      />
                    </Field>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => saveEvaluation(role, false)}>
                        Lưu nháp
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => saveEvaluation(role, true)}>
                        Gửi đánh giá
                      </Button>
                      {existing?.status === "submitted" && hasPermission("staff.approve") && (
                        <Button size="sm" variant="success" disabled={busy} onClick={() => approveEvaluation(role)}>
                          Xác nhận hoàn tất
                        </Button>
                      )}
                    </div>
                  </div>
                ) : existing ? (
                  <div className="text-sm text-navy/70">
                    <p>Xếp loại: {existing.rating ?? "—"}</p>
                    <p>Điểm mạnh: {existing.strengths ?? "—"}</p>
                    <p>Hạn chế: {existing.weaknesses ?? "—"}</p>
                  </div>
                ) : (
                  <p className="text-sm text-navy/50">Chưa có đánh giá.</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
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
