import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import {
  askAiParentingQuestion,
  createLeaveRequest,
  getMyChildAttendance,
  getMyChildRevenues,
  getTodayMenuForChild,
  listAllAiConsultationsForReview,
  listMyAiConsultations,
  listMyChildren,
  listMyLeaveRequests,
  listMyMessages,
  sendMessageAsParent,
  type AiConsultationReviewRow,
  type AiConsultationRow,
  type MyAttendanceRow,
  type MyChildRow,
  type MyLeaveRequestRow,
  type MyMenuRow,
  type MyRevenueRow,
  type ParentMessageRow,
} from "@/lib/db/parentRepo";
import { ATTENDANCE_LABELS, LEAVE_REQUEST_STATUS_LABELS, MEAL_SLOT_LABELS } from "@/lib/db/types";

function ParentAiAssistant({ userId }: { userId: string }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AiConsultationRow[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setHistory(await listMyAiConsultations(userId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function ask() {
    if (!question.trim() || asking) return;
    setAsking(true);
    setError(null);
    try {
      await askAiParentingQuestion(userId, question.trim());
      setQuestion("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể hỏi Trợ lý AI lúc này");
    } finally {
      setAsking(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-navy">Trợ lý AI tư vấn nuôi dạy trẻ</h3>
      <p className="mb-2 text-xs text-navy/50">
        Hỏi đáp kiến thức nuôi dạy trẻ mầm non chung (dinh dưỡng, giấc ngủ, tâm lý, thói quen...).
        Không dùng để chẩn đoán bệnh hay thay thế tư vấn của giáo viên/bác sĩ — với dấu hiệu đáng lo
        ngại, vui lòng liên hệ trực tiếp giáo viên chủ nhiệm hoặc nhân viên y tế của trường.
      </p>
      <div className="flex gap-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ví dụ: Con 4 tuổi biếng ăn rau, nên làm thế nào?"
          className="min-h-[60px]"
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={!question.trim() || asking} onClick={ask}>
          {asking ? "Đang hỏi..." : "Hỏi Trợ lý AI"}
        </Button>
      </div>
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
        {history.map((h) => (
          <div key={h.id} className="rounded-lg border border-navy/10 p-2">
            <p className="text-sm font-medium text-navy">Hỏi: {h.question}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-navy/80">{h.answer}</p>
            <p className="mt-1 text-xs text-mint">Nội dung do AI hỗ trợ · {new Date(h.created_at).toLocaleString("vi-VN")}</p>
          </div>
        ))}
        {history.length === 0 && <p className="text-sm text-navy/50">Chưa có câu hỏi nào.</p>}
      </div>
    </Card>
  );
}

function ParentAiReviewPanel() {
  const [rows, setRows] = useState<AiConsultationReviewRow[]>([]);

  useEffect(() => {
    listAllAiConsultationsForReview().then(setRows);
  }, []);

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-navy">Lịch sử hỏi Trợ lý AI của phụ huynh</h3>
      <p className="mb-3 text-xs text-navy/50">
        Chỉ hiển thị với Hiệu trưởng/Quản trị hệ thống — dùng để theo dõi và kịp thời hỗ trợ nếu phụ
        huynh hỏi điều đáng lo ngại.
      </p>
      <div className="max-h-[32rem] space-y-3 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-navy/10 p-2">
            <p className="text-xs font-semibold text-navy/60">
              {r.guardian_name} · {new Date(r.created_at).toLocaleString("vi-VN")}
            </p>
            <p className="mt-1 text-sm font-medium text-navy">Hỏi: {r.question}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-navy/80">{r.answer}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-navy/50">Chưa có câu hỏi nào từ phụ huynh.</p>}
      </div>
    </Card>
  );
}

export function ParentPortalPage() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const isParent = roles.includes("parent");
  const [children, setChildren] = useState<MyChildRow[]>([]);
  const [childId, setChildId] = useState("");
  const [attendance, setAttendance] = useState<MyAttendanceRow[]>([]);
  const [menu, setMenu] = useState<MyMenuRow | null>(null);
  const [revenues, setRevenues] = useState<MyRevenueRow[]>([]);
  const [leaves, setLeaves] = useState<MyLeaveRequestRow[]>([]);
  const [messages, setMessages] = useState<ParentMessageRow[]>([]);
  const [leaveForm, setLeaveForm] = useState({ start: "", end: "", reason: "" });
  const [messageText, setMessageText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !isParent) return;
    listMyChildren(user.id).then((rows) => {
      setChildren(rows);
      if (rows[0]) setChildId(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isParent]);

  async function refresh() {
    if (!user || !childId) return;
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    setAttendance(await getMyChildAttendance(user.id, childId, monthAgo, today));
    setMenu(await getTodayMenuForChild(user.id, childId));
    setRevenues(await getMyChildRevenues(user.id, childId));
    setLeaves(await listMyLeaveRequests(user.id, childId));
    setMessages(await listMyMessages(user.id, childId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const child = children.find((c) => c.id === childId);

  if (!user) return null;

  if (!isParent) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-navy">Phân hệ Phụ huynh</h1>
          <p className="text-sm text-navy/60">Chế độ xem của nhà trường — dữ liệu theo dõi từng con thuộc về tài khoản phụ huynh.</p>
        </div>
        <ParentAiReviewPanel />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Góc phụ huynh</h1>
        <p className="text-sm text-navy/60">Chỉ hiển thị thông tin của con bạn.</p>
      </div>

      {children.length > 1 && (
        <Select value={childId} onChange={(e) => setChildId(e.target.value)} className="w-64">
          {children.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </Select>
      )}

      {child && (
        <Card>
          <h2 className="text-lg font-semibold text-navy">{child.full_name}</h2>
          <p className="text-sm text-navy/60">
            Lớp: {child.class_name ?? "Chưa xếp lớp"} · Ngày sinh: {child.dob}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-navy">Thực đơn hôm nay</h3>
          {menu ? (
            <ul className="text-sm text-navy/70">
              {menu.items.map((item, idx) => (
                <li key={idx}>
                  {MEAL_SLOT_LABELS[item.meal_slot as keyof typeof MEAL_SLOT_LABELS]}: {item.dish_name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-navy/50">Thực đơn hôm nay chưa được công khai.</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold text-navy">Chuyên cần 30 ngày gần đây</h3>
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {attendance.map((a, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{a.attendance_date}</span>
                <span>{ATTENDANCE_LABELS[a.status]}</span>
              </div>
            ))}
            {attendance.length === 0 && <p className="text-navy/50">Chưa có dữ liệu điểm danh.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-navy">Khoản thu</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-1 font-medium">Số phiếu</th>
              <th className="pb-1 font-medium">Khoản thu</th>
              <th className="pb-1 font-medium">Số tiền</th>
              <th className="pb-1 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {revenues.map((r) => (
              <tr key={r.code} className="border-b border-navy/5">
                <td className="py-1 font-mono text-xs">{r.code}</td>
                <td className="py-1">{r.fee_item_name ?? "—"}</td>
                <td className="py-1">{r.amount.toLocaleString("vi-VN")} đ</td>
                <td className="py-1">{r.status === "approved" ? "Đã thu" : "Chờ xử lý"}</td>
              </tr>
            ))}
            {revenues.length === 0 && (
              <tr><td colSpan={4} className="py-2 text-center text-navy/50">Chưa có khoản thu.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-navy">Xin nghỉ</h3>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Input type="date" value={leaveForm.start} onChange={(e) => setLeaveForm((p) => ({ ...p, start: e.target.value }))} />
          <Input type="date" value={leaveForm.end} onChange={(e) => setLeaveForm((p) => ({ ...p, end: e.target.value }))} />
          <Input className="sm:col-span-1" placeholder="Lý do" value={leaveForm.reason} onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))} />
          <Button
            size="sm"
            disabled={!leaveForm.start || !leaveForm.end || !leaveForm.reason.trim() || busy}
            onClick={async () => {
              if (!user) return;
              setBusy(true);
              try {
                await createLeaveRequest(user.id, childId, leaveForm.start, leaveForm.end, leaveForm.reason.trim());
                setLeaveForm({ start: "", end: "", reason: "" });
                refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            Gửi đơn
          </Button>
        </div>
        <div className="space-y-1 text-sm">
          {leaves.map((l) => (
            <div key={l.id} className="flex justify-between rounded-lg border border-navy/5 p-2">
              <span>{l.start_date} → {l.end_date}: {l.reason}</span>
              <span className="text-navy/60">{LEAVE_REQUEST_STATUS_LABELS[l.status]}</span>
            </div>
          ))}
          {leaves.length === 0 && <p className="text-navy/50">Chưa có đơn xin nghỉ.</p>}
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-navy">Trao đổi với giáo viên</h3>
        <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className={`rounded-lg p-2 text-sm ${m.sender_role === "parent" ? "bg-brand/10" : "bg-cream"}`}>
              <p className="text-navy">{m.content}</p>
              <p className="text-xs text-navy/50">{m.sender_name} · {new Date(m.created_at).toLocaleString("vi-VN")}</p>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-navy/50">Chưa có trao đổi nào.</p>}
        </div>
        <div className="flex gap-2">
          <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Nhắn cho giáo viên..." className="min-h-[60px]" />
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!messageText.trim() || busy}
            onClick={async () => {
              if (!user) return;
              setBusy(true);
              try {
                await sendMessageAsParent(user.id, childId, messageText.trim());
                setMessageText("");
                refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            Gửi
          </Button>
        </div>
      </Card>

      <ParentAiAssistant userId={user.id} />
    </div>
  );
}
