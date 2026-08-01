import { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/Badge";
import { useAuthStore } from "../../store/authStore";
import { listActiveUsers } from "@/lib/db/systemRepo";
import {
  addResolutionTracking,
  changePartyMeetingStatus,
  changeResolutionStatus,
  createPartyMeeting,
  createPartyMember,
  createResolution,
  getMemberEvaluation,
  getPartyMeetingById,
  getPartyMeetingMinutes,
  listPartyFees,
  listPartyMeetings,
  listPartyMembers,
  listResolutionTracking,
  listResolutions,
  recordPartyFeePayment,
  savePartyMeetingMinutes,
  upsertMemberEvaluation,
  type PartyFeeRow,
  type PartyMeetingRow,
  type PartyMemberRow,
  type ResolutionRow,
  type ResolutionTrackingRow,
} from "@/lib/db/partyRepo";
import {
  PARTY_MEETING_TYPE_LABELS,
  PARTY_POSITION_LABELS,
  PARTY_RATING_LABELS,
  RESOLUTION_STATUS_LABELS,
} from "@/lib/db/types";
import type { PartyCellPosition, PartyMeetingType, PartyMemberRating, ResolutionTrackingStatus, User } from "@/lib/db/types";

type Tab = "members" | "meetings" | "fees";

export function PartyPage() {
  const [tab, setTab] = useState<Tab>("members");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Công tác Đảng</h1>
        <p className="text-sm text-navy/60">
          Phân hệ tách biệt hoàn toàn — chỉ cấp ủy (đảng viên có phân quyền) mới truy cập được.
        </p>
      </div>
      <div className="flex gap-1 border-b border-navy/10">
        {(
          [
            ["members", "Đảng viên"],
            ["meetings", "Sinh hoạt chi bộ"],
            ["fees", "Đảng phí"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "px-4 py-2 text-sm font-medium",
              tab === key ? "border-b-2 border-brand text-brand" : "text-navy/50 hover:text-navy",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "members" && <MembersTab />}
      {tab === "meetings" && <MeetingsTab />}
      {tab === "fees" && <FeesTab />}
    </div>
  );
}

function MembersTab() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [members, setMembers] = useState<PartyMemberRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ userId: "", membershipType: "chinh_thuc" as "chinh_thuc" | "du_bi", cellPosition: "dang_vien" as PartyCellPosition, joinedDate: "" });
  const [evalMember, setEvalMember] = useState<PartyMemberRow | null>(null);
  const [evalForm, setEvalForm] = useState({ rating: "hoan_thanh_tot" as PartyMemberRating, strengths: "", weaknesses: "" });
  const [busy, setBusy] = useState(false);

  const currentYear = new Date().getFullYear();
  const refresh = () => listPartyMembers().then(setMembers);
  useEffect(() => {
    refresh();
    listActiveUsers().then(setUsers);
  }, []);

  async function openEvaluation(m: PartyMemberRow) {
    setEvalMember(m);
    const existing = await getMemberEvaluation(m.id, currentYear);
    setEvalForm({
      rating: existing?.rating ?? "hoan_thanh_tot",
      strengths: existing?.strengths ?? "",
      weaknesses: existing?.weaknesses ?? "",
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        {hasPermission("party.create") && (
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-navy/10 p-3 sm:grid-cols-5">
            <Select value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}>
              <option value="">-- Cán bộ --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </Select>
            <Select value={form.membershipType} onChange={(e) => setForm((p) => ({ ...p, membershipType: e.target.value as "chinh_thuc" | "du_bi" }))}>
              <option value="chinh_thuc">Chính thức</option>
              <option value="du_bi">Dự bị</option>
            </Select>
            <Select value={form.cellPosition} onChange={(e) => setForm((p) => ({ ...p, cellPosition: e.target.value as PartyCellPosition }))}>
              {Object.entries(PARTY_POSITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input type="date" value={form.joinedDate} onChange={(e) => setForm((p) => ({ ...p, joinedDate: e.target.value }))} />
            <Button
              size="sm"
              disabled={!form.userId || busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await createPartyMember({ userId: form.userId, membershipType: form.membershipType, joinedDate: form.joinedDate || undefined, cellPosition: form.cellPosition, createdBy: user.id });
                  setForm({ userId: "", membershipType: "chinh_thuc", cellPosition: "dang_vien", joinedDate: "" });
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={14} /> Thêm đảng viên
            </Button>
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-2 font-medium">Họ và tên</th>
              <th className="pb-2 font-medium">Chức vụ trong chi bộ</th>
              <th className="pb-2 font-medium">Loại</th>
              <th className="pb-2 font-medium">Ngày vào Đảng</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-navy/5">
                <td className="py-2">{m.full_name}</td>
                <td className="py-2">{PARTY_POSITION_LABELS[m.cell_position]}</td>
                <td className="py-2">{m.membership_type === "chinh_thuc" ? "Chính thức" : "Dự bị"}</td>
                <td className="py-2">{m.joined_date ?? "—"}</td>
                <td className="py-2">
                  {hasPermission("party.approve") && (
                    <Button size="sm" variant="secondary" onClick={() => openEvaluation(m)}>
                      Đánh giá {currentYear}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {evalMember && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Đánh giá đảng viên: {evalMember.full_name} — năm {currentYear}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Xếp loại">
              <Select value={evalForm.rating} onChange={(e) => setEvalForm((p) => ({ ...p, rating: e.target.value as PartyMemberRating }))}>
                {Object.entries(PARTY_RATING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <div />
            <Field label="Ưu điểm">
              <Textarea value={evalForm.strengths} onChange={(e) => setEvalForm((p) => ({ ...p, strengths: e.target.value }))} />
            </Field>
            <Field label="Hạn chế">
              <Textarea value={evalForm.weaknesses} onChange={(e) => setEvalForm((p) => ({ ...p, weaknesses: e.target.value }))} />
            </Field>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEvalMember(null)}>Đóng</Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await upsertMemberEvaluation(evalMember.id, currentYear, evalForm, "approved", user.id);
                  setEvalMember(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lưu và thông qua
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function MeetingsTab() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [meetings, setMeetings] = useState<PartyMeetingRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PartyMeetingRow | null>(null);
  const [minutes, setMinutes] = useState("");
  const [attendeesNote, setAttendeesNote] = useState("");
  const [resolutions, setResolutions] = useState<ResolutionRow[]>([]);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);
  const [tracking, setTracking] = useState<ResolutionTrackingRow[]>([]);
  const [form, setForm] = useState({ type: "dinh_ky" as PartyMeetingType, title: "", date: "" });
  const [resolutionForm, setResolutionForm] = useState({ title: "", content: "" });
  const [trackingForm, setTrackingForm] = useState({ note: "", status: "dang_thuc_hien" as ResolutionTrackingStatus });
  const [busy, setBusy] = useState(false);

  const refreshList = () => listPartyMeetings().then(setMeetings);
  useEffect(() => {
    refreshList();
  }, []);

  async function refreshDetail(id: string) {
    setDetail(await getPartyMeetingById(id));
    const m = await getPartyMeetingMinutes(id);
    setMinutes(m?.content_html ?? "");
    setAttendeesNote(m?.attendees_note ?? "");
    setResolutions(await listResolutions(id));
  }

  useEffect(() => {
    if (selectedId) refreshDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (selectedResolution) listResolutionTracking(selectedResolution).then(setTracking);
  }, [selectedResolution]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy">Sinh hoạt chi bộ</h2>
        </div>
        {hasPermission("party.create") && (
          <div className="mb-3 space-y-2 rounded-xl border border-navy/10 p-2">
            <Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as PartyMeetingType }))}>
              {Object.entries(PARTY_MEETING_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input placeholder="Tiêu đề" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            <Button
              size="sm"
              className="w-full"
              disabled={!form.title.trim() || !form.date || busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  const id = await createPartyMeeting({ meetingType: form.type, title: form.title.trim(), meetingDate: form.date, chairPerson: user.full_name, createdBy: user.id });
                  setForm({ type: "dinh_ky", title: "", date: "" });
                  refreshList();
                  setSelectedId(id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={14} /> Tạo cuộc họp
            </Button>
          </div>
        )}
        <div className="space-y-1">
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={clsx("block w-full rounded-lg px-2 py-1.5 text-left text-sm", selectedId === m.id ? "bg-brand/10 text-brand-dark" : "hover:bg-navy/5")}
            >
              <div className="flex items-center justify-between">
                <span>{m.title}</span>
                <StatusBadge status={m.status} />
              </div>
              <span className="text-xs text-navy/50">{m.meeting_date} · {PARTY_MEETING_TYPE_LABELS[m.meeting_type]}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        {!detail ? (
          <p className="text-sm text-navy/50">Chọn một cuộc họp để xem chi tiết.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-navy">{detail.title}</h2>
              <div className="flex gap-2">
                <StatusBadge status={detail.status} />
                {detail.status === "draft" && hasPermission("party.create") && (
                  <Button size="sm" onClick={() => changePartyMeetingStatus(detail.id, "published", user!.id, sessionId).then(() => refreshDetail(detail.id))}>
                    Ban hành biên bản
                  </Button>
                )}
              </div>
            </div>

            <Field label="Biên bản cuộc họp">
              <Textarea value={minutes} onChange={(e) => setMinutes(e.target.value)} className="min-h-[100px]" disabled={!hasPermission("party.edit")} />
            </Field>
            <Field label="Thành phần tham dự">
              <Input value={attendeesNote} onChange={(e) => setAttendeesNote(e.target.value)} disabled={!hasPermission("party.edit")} />
            </Field>
            {hasPermission("party.edit") && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    if (!user) return;
                    setBusy(true);
                    try {
                      await savePartyMeetingMinutes(detail.id, minutes, attendeesNote || undefined, user.id);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Lưu biên bản
                </Button>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-navy">Nghị quyết</h3>
              {hasPermission("party.create") && (
                <div className="mb-2 space-y-2 rounded-xl border border-navy/10 p-2">
                  <Input placeholder="Tiêu đề nghị quyết" value={resolutionForm.title} onChange={(e) => setResolutionForm((p) => ({ ...p, title: e.target.value }))} />
                  <Textarea placeholder="Nội dung" value={resolutionForm.content} onChange={(e) => setResolutionForm((p) => ({ ...p, content: e.target.value }))} />
                  <Button
                    size="sm"
                    disabled={!resolutionForm.title.trim() || !resolutionForm.content.trim() || busy}
                    onClick={async () => {
                      if (!user) return;
                      setBusy(true);
                      try {
                        await createResolution(detail.id, resolutionForm.title.trim(), resolutionForm.content.trim(), user.id);
                        setResolutionForm({ title: "", content: "" });
                        refreshDetail(detail.id);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Thêm nghị quyết
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {resolutions.map((r) => (
                  <div key={r.id} className="rounded-lg border border-navy/5 p-2 text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">{r.code} — {r.title}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {r.status === "draft" && hasPermission("party.approve") && (
                          <Button size="sm" variant="success" onClick={() => changeResolutionStatus(r.id, "approved", user!.id, sessionId).then(() => refreshDetail(detail.id))}>
                            Thông qua
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-navy/70">{r.content}</p>
                    <button className="mt-1 text-xs text-brand hover:underline" onClick={() => setSelectedResolution(selectedResolution === r.id ? null : r.id)}>
                      {selectedResolution === r.id ? "Ẩn theo dõi thực hiện" : "Xem theo dõi thực hiện"}
                    </button>
                    {selectedResolution === r.id && (
                      <div className="mt-2 space-y-2 border-t border-navy/5 pt-2">
                        {hasPermission("party.edit") && (
                          <div className="flex gap-2">
                            <Input placeholder="Ghi nhận tiến độ" value={trackingForm.note} onChange={(e) => setTrackingForm((p) => ({ ...p, note: e.target.value }))} />
                            <Select value={trackingForm.status} onChange={(e) => setTrackingForm((p) => ({ ...p, status: e.target.value as ResolutionTrackingStatus }))}>
                              {Object.entries(RESOLUTION_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </Select>
                            <Button
                              size="sm"
                              disabled={!trackingForm.note.trim() || busy}
                              onClick={async () => {
                                if (!user) return;
                                await addResolutionTracking(r.id, trackingForm.note.trim(), trackingForm.status, user.id);
                                setTrackingForm({ note: "", status: "dang_thuc_hien" });
                                listResolutionTracking(r.id).then(setTracking);
                              }}
                            >
                              Ghi nhận
                            </Button>
                          </div>
                        )}
                        {tracking.map((t) => (
                          <p key={t.id} className="text-xs text-navy/60">
                            [{RESOLUTION_STATUS_LABELS[t.status]}] {t.progress_note} — {t.updated_by_name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {resolutions.length === 0 && <p className="text-sm text-navy/50">Chưa có nghị quyết.</p>}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function FeesTab() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [fees, setFees] = useState<PartyFeeRow[]>([]);
  const [members, setMembers] = useState<PartyMemberRow[]>([]);

  const refresh = () => listPartyFees(period).then(setFees);
  useEffect(() => {
    refresh();
    listPartyMembers().then(setMembers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <Card>
      <div className="mb-3">
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-48" />
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50">
            <th className="pb-2 font-medium">Đảng viên</th>
            <th className="pb-2 font-medium">Số tiền</th>
            <th className="pb-2 font-medium">Ngày nộp</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const fee = fees.find((f) => f.member_id === m.id);
            return (
              <tr key={m.id} className="border-b border-navy/5">
                <td className="py-2">{m.full_name}</td>
                <td className="py-2">{fee ? `${fee.amount.toLocaleString("vi-VN")} đ` : "—"}</td>
                <td className="py-2">{fee?.paid_date ?? "Chưa nộp"}</td>
                <td className="py-2">
                  {hasPermission("party.create") && !fee?.paid_date && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!user) return;
                        await recordPartyFeePayment(m.id, period, fee?.amount ?? 30000, new Date().toISOString().slice(0, 10), user.id);
                        refresh();
                      }}
                    >
                      Ghi nhận đã nộp
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
