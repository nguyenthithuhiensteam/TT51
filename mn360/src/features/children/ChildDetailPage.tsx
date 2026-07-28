import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import {
  addGuardianToChild,
  changeChildStatus,
  decideLeaveRequest,
  getChildById,
  listChildStatusHistory,
  listClasses,
  listGuardiansOfChild,
  listLeaveRequestsForChild,
  listMessagesForChild,
  replyAsTeacher,
  type ChildStatusHistoryRow,
  type ChildWithClass,
  type ClassWithTeacher,
  type GuardianOfChild,
  type StaffLeaveRequestRow,
  type StaffMessageRow,
} from "../../lib/db/childRepo";
import {
  addChildAssessment,
  addObservation,
  listChildAssessments,
  listObservationsByChild,
  type ChildAssessmentRow,
  type ObservationRow,
} from "../../lib/db/curriculumRepo";
import { CHILD_STATUS_LABELS, ASSESSMENT_DOMAIN_LABELS, LEAVE_REQUEST_STATUS_LABELS } from "../../lib/db/types";
import type { AssessmentDomain, ChildStatus } from "../../lib/db/types";

export function ChildDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [child, setChild] = useState<ChildWithClass | null>(null);
  const [guardians, setGuardians] = useState<GuardianOfChild[]>([]);
  const [history, setHistory] = useState<ChildStatusHistoryRow[]>([]);
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [assessments, setAssessments] = useState<ChildAssessmentRow[]>([]);
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ChildStatus>("transferred_class");
  const [newClassId, setNewClassId] = useState("");
  const [statusNote, setStatusNote] = useState("");

  const [guardianModalOpen, setGuardianModalOpen] = useState(false);
  const [guardianForm, setGuardianForm] = useState({ fullName: "", relationship: "", phone: "" });

  const [obsContent, setObsContent] = useState("");
  const [assessForm, setAssessForm] = useState({ period: "", domain: "the_chat" as AssessmentDomain, result: "", note: "" });
  const [leaveRequests, setLeaveRequests] = useState<StaffLeaveRequestRow[]>([]);
  const [messages, setMessages] = useState<StaffMessageRow[]>([]);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!id) return;
    const c = await getChildById(id);
    setChild(c);
    setGuardians(await listGuardiansOfChild(id));
    setHistory(await listChildStatusHistory(id));
    setObservations(await listObservationsByChild(id));
    setAssessments(await listChildAssessments(id));
    setLeaveRequests(await listLeaveRequestsForChild(id));
    setMessages(await listMessagesForChild(id));
  }

  useEffect(() => {
    refresh();
    if (schoolYear) listClasses(schoolYear.id).then(setClasses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!child) return <p className="text-navy/60">Đang tải...</p>;

  async function submitStatusChange() {
    if (!user || !child) return;
    setBusy(true);
    try {
      await changeChildStatus(child.id, newStatus, user.id, sessionId, statusNote, newClassId || undefined);
      setStatusModalOpen(false);
      setStatusNote("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitGuardian() {
    if (!child || !guardianForm.fullName.trim()) return;
    setBusy(true);
    try {
      await addGuardianToChild(
        child.id,
        guardianForm.fullName.trim(),
        guardianForm.relationship,
        guardianForm.phone || undefined,
        guardians.length === 0,
      );
      setGuardianModalOpen(false);
      setGuardianForm({ fullName: "", relationship: "", phone: "" });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitObservation() {
    if (!user || !child || !child.class_id || !obsContent.trim()) return;
    setBusy(true);
    try {
      await addObservation(
        child.id,
        child.class_id,
        new Date().toISOString().slice(0, 10),
        obsContent.trim(),
        user.id,
      );
      setObsContent("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitAssessment() {
    if (!user || !child || !schoolYear || !assessForm.period.trim() || !assessForm.result.trim()) return;
    setBusy(true);
    try {
      await addChildAssessment(
        child.id,
        schoolYear.id,
        assessForm.period.trim(),
        assessForm.domain,
        assessForm.result.trim(),
        assessForm.note || undefined,
        user.id,
      );
      setAssessForm({ period: "", domain: "the_chat", result: "", note: "" });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/tre-em")}>
        <ArrowLeft size={16} /> Quay lại danh sách
      </Button>

      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-navy/50">{child.code}</span>
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand-dark">
            {CHILD_STATUS_LABELS[child.status]}
          </span>
        </div>
        <h1 className="mb-3 text-xl font-semibold text-navy">{child.full_name}</h1>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Info label="Ngày sinh" value={child.dob} />
          <Info label="Giới tính" value={child.gender === "male" ? "Nam" : "Nữ"} />
          <Info label="Lớp" value={child.class_name ?? "Chưa xếp lớp"} />
          <Info label="Ngày tiếp nhận" value={child.enrollment_date} />
        </div>
        {hasPermission("children.approve") && (
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => setStatusModalOpen(true)}>
              Chuyển lớp / Bảo lưu / Chuyển trường / Thôi học / Hoàn thành
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Phụ huynh</h2>
            {hasPermission("children.edit") && (
              <Button size="sm" variant="secondary" onClick={() => setGuardianModalOpen(true)}>
                <Plus size={14} /> Thêm phụ huynh
              </Button>
            )}
          </div>
          <div className="space-y-1 text-sm">
            {guardians.map((g) => (
              <div key={g.id} className="rounded-lg border border-navy/5 p-2">
                <span className="font-medium">{g.full_name}</span> — {g.relationship}
                {g.phone && <span className="text-navy/50"> · {g.phone}</span>}
                {g.is_primary === 1 && (
                  <span className="ml-2 rounded-full bg-mint/15 px-2 py-0.5 text-xs text-mint">
                    Liên hệ chính
                  </span>
                )}
              </div>
            ))}
            {guardians.length === 0 && <p className="text-navy/50">Chưa có thông tin phụ huynh.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Lịch sử chuyển trạng thái</h2>
          <div className="space-y-2 text-sm">
            {history.map((h) => (
              <div key={h.id} className="border-l-2 border-brand/30 pl-3">
                <p className="text-navy">
                  {h.from_status ? CHILD_STATUS_LABELS[h.from_status] : "Khởi tạo"} →{" "}
                  {CHILD_STATUS_LABELS[h.to_status]}
                </p>
                <p className="text-xs text-navy/50">
                  {h.changed_by_name} · {new Date(h.changed_at).toLocaleString("vi-VN")}
                </p>
                {h.note && <p className="text-xs text-navy/60">{h.note}</p>}
              </div>
            ))}
            {history.length === 0 && <p className="text-navy/50">Chưa có thay đổi trạng thái.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Nhật ký quan sát trẻ</h2>
        {hasPermission("curriculum.create") && child.class_id && (
          <div className="mb-3 flex gap-2">
            <Textarea
              value={obsContent}
              onChange={(e) => setObsContent(e.target.value)}
              placeholder="Ghi nhận quan sát về trẻ hôm nay..."
              className="min-h-[60px]"
            />
            <Button size="sm" disabled={!obsContent.trim() || busy} onClick={submitObservation}>
              Ghi
            </Button>
          </div>
        )}
        <div className="space-y-2 text-sm">
          {observations.map((o) => (
            <div key={o.id} className="rounded-lg bg-cream p-2">
              <p className="text-navy">{o.content}</p>
              <p className="text-xs text-navy/50">
                {o.teacher_name} · {o.observed_date}
              </p>
            </div>
          ))}
          {observations.length === 0 && <p className="text-navy/50">Chưa có nhật ký quan sát.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Đánh giá sự phát triển</h2>
        {hasPermission("curriculum.create") && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
            <Input
              placeholder="Giai đoạn (VD: Học kỳ 2)"
              value={assessForm.period}
              onChange={(e) => setAssessForm((p) => ({ ...p, period: e.target.value }))}
            />
            <Select
              value={assessForm.domain}
              onChange={(e) =>
                setAssessForm((p) => ({ ...p, domain: e.target.value as AssessmentDomain }))
              }
            >
              {Object.entries(ASSESSMENT_DOMAIN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Kết quả (VD: Đạt)"
              value={assessForm.result}
              onChange={(e) => setAssessForm((p) => ({ ...p, result: e.target.value }))}
            />
            <Input
              placeholder="Ghi chú"
              value={assessForm.note}
              onChange={(e) => setAssessForm((p) => ({ ...p, note: e.target.value }))}
            />
            <Button
              size="sm"
              disabled={!assessForm.period.trim() || !assessForm.result.trim() || busy}
              onClick={submitAssessment}
            >
              Thêm
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-2 font-medium">Giai đoạn</th>
                <th className="pb-2 font-medium">Lĩnh vực</th>
                <th className="pb-2 font-medium">Kết quả</th>
                <th className="pb-2 font-medium">Người đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b border-navy/5">
                  <td className="py-2">{a.period}</td>
                  <td className="py-2">{ASSESSMENT_DOMAIN_LABELS[a.domain]}</td>
                  <td className="py-2">{a.result}</td>
                  <td className="py-2">{a.assessed_by_name}</td>
                </tr>
              ))}
              {assessments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-navy/50">
                    Chưa có đánh giá.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Đơn xin nghỉ từ phụ huynh</h2>
          <div className="space-y-2 text-sm">
            {leaveRequests.map((l) => (
              <div key={l.id} className="rounded-lg border border-navy/5 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-navy/50">{l.code}</span>
                  <span className="text-xs text-navy/60">{LEAVE_REQUEST_STATUS_LABELS[l.status]}</span>
                </div>
                <p className="text-navy">{l.start_date} → {l.end_date}: {l.reason}</p>
                {l.status === "pending_approval" && hasPermission("children.approve") && (
                  <div className="mt-1 flex gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={async () => {
                        if (!user) return;
                        await decideLeaveRequest(l.id, true, user.id, undefined);
                        refresh();
                      }}
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (!user) return;
                        await decideLeaveRequest(l.id, false, user.id, "Không phù hợp, đề nghị liên hệ giáo viên");
                        refresh();
                      }}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {leaveRequests.length === 0 && <p className="text-navy/50">Chưa có đơn xin nghỉ.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Trao đổi với phụ huynh</h2>
          <div className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
            {messages.map((m) => (
              <div key={m.id} className={`rounded-lg p-2 ${m.sender_role === "teacher" ? "bg-brand/10" : "bg-cream"}`}>
                <p className="text-navy">{m.content}</p>
                <p className="text-xs text-navy/50">{m.sender_name} · {new Date(m.created_at).toLocaleString("vi-VN")}</p>
              </div>
            ))}
            {messages.length === 0 && <p className="text-navy/50">Chưa có trao đổi nào.</p>}
          </div>
          {hasPermission("children.edit") && (
            <div className="flex gap-2">
              <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Trả lời phụ huynh..." className="min-h-[50px]" />
              <Button
                size="sm"
                disabled={!replyText.trim() || busy}
                onClick={async () => {
                  if (!user || !child) return;
                  setBusy(true);
                  try {
                    await replyAsTeacher(child.id, user.id, replyText.trim());
                    setReplyText("");
                    refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Gửi
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Chuyển trạng thái trẻ">
        <div className="space-y-3">
          <Field label="Trạng thái mới" required>
            <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ChildStatus)}>
              {Object.entries(CHILD_STATUS_LABELS)
                .filter(([value]) => value !== "studying")
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              <option value="studying">Đang học (chuyển lớp trong trường)</option>
            </Select>
          </Field>
          {(newStatus === "transferred_class" || newStatus === "studying") && (
            <Field label="Lớp mới">
              <Select value={newClassId} onChange={(e) => setNewClassId(e.target.value)}>
                <option value="">-- Giữ nguyên lớp hiện tại --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Lý do / ghi chú">
            <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
              Hủy
            </Button>
            <Button disabled={busy} onClick={submitStatusChange}>
              Xác nhận
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={guardianModalOpen} onClose={() => setGuardianModalOpen(false)} title="Thêm phụ huynh">
        <div className="space-y-3">
          <Field label="Họ và tên" required>
            <Input
              value={guardianForm.fullName}
              onChange={(e) => setGuardianForm((p) => ({ ...p, fullName: e.target.value }))}
            />
          </Field>
          <Field label="Quan hệ với trẻ">
            <Input
              placeholder="VD: Bố, Mẹ, Ông, Bà"
              value={guardianForm.relationship}
              onChange={(e) => setGuardianForm((p) => ({ ...p, relationship: e.target.value }))}
            />
          </Field>
          <Field label="Số điện thoại">
            <Input
              value={guardianForm.phone}
              onChange={(e) => setGuardianForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGuardianModalOpen(false)}>
              Hủy
            </Button>
            <Button disabled={!guardianForm.fullName.trim() || busy} onClick={submitGuardian}>
              Lưu
            </Button>
          </div>
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
