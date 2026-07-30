import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, Plus, Search } from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Pagination } from "../../components/ui/Pagination";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import {
  createChild,
  createClass,
  getAttendanceForClassDate,
  getClassAttendanceStats,
  getChildrenAttendanceSummary,
  listChildren,
  listClasses,
  recordAttendance,
  type AttendanceRow,
  type ChildWithClass,
  type ClassWithTeacher,
} from "../../lib/db/childRepo";
import { listActiveUsers } from "../../lib/db/systemRepo";
import { CHILD_STATUS_LABELS, ATTENDANCE_LABELS } from "../../lib/db/types";
import type { AttendanceStatus, ChildStatus, User } from "../../lib/db/types";
import { ClassFormModal, type ClassFormValues } from "./ClassFormModal";
import { ChildFormModal, type ChildFormValues } from "./ChildFormModal";
import { AttendanceReportsTab } from "./AttendanceReportsTab";
import { exportAttendanceReportToExcel, exportChildrenToExcel } from "../../lib/export/excel";

const PAGE_SIZE = 10;
type Tab = "classes" | "children" | "attendance" | "attendanceReports";

export function ChildrenPage() {
  const [tab, setTab] = useState<Tab>("children");
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);

  const refreshClasses = () => {
    if (schoolYear) listClasses(schoolYear.id).then(setClasses);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshClasses, [schoolYear?.id]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Trẻ em</h1>
        <p className="text-sm text-navy/60">
          Mỗi trẻ có mã định danh riêng biệt; điểm danh liên kết trực tiếp với chuyên cần.
        </p>
      </div>

      <div className="flex gap-1 border-b border-navy/10">
        {(
          [
            ["classes", "Nhóm, lớp"],
            ["children", "Hồ sơ trẻ"],
            ["attendance", "Điểm danh"],
            ["attendanceReports", "Báo cáo chuyên cần"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "px-4 py-2 text-sm font-medium",
              tab === key
                ? "border-b-2 border-brand text-brand"
                : "text-navy/50 hover:text-navy",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "classes" && <ClassesTab classes={classes} onChanged={refreshClasses} />}
      {tab === "children" && <ChildrenTab classes={classes} />}
      {tab === "attendance" && <AttendanceTab classes={classes} />}
      {tab === "attendanceReports" && <AttendanceReportsTab classes={classes} />}
    </div>
  );
}

function ClassesTab({
  classes,
  onChanged,
}: {
  classes: ClassWithTeacher[];
  onChanged: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listActiveUsers().then(setTeachers);
  }, []);

  async function handleCreate(data: ClassFormValues) {
    if (!schoolYear || !user) return;
    setSubmitting(true);
    try {
      await createClass({
        schoolYearId: schoolYear.id,
        code: data.code,
        name: data.name,
        ageGroup: data.ageGroup,
        homeroomTeacherId: data.homeroomTeacherId || undefined,
        room: data.room || undefined,
        capacity: data.capacity ? Number(data.capacity) : undefined,
        createdBy: user.id,
      });
      setModalOpen(false);
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy">Danh sách nhóm, lớp</h2>
        {hasPermission("children.create") && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Thêm lớp
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <div key={c.id} className="rounded-xl border border-navy/10 p-4">
            <p className="font-semibold text-navy">{c.name}</p>
            <p className="text-xs text-navy/50">{c.age_group}</p>
            <p className="mt-2 text-sm text-navy/70">GVCN: {c.teacher_name ?? "Chưa phân công"}</p>
            <p className="text-sm text-navy/70">Phòng: {c.room ?? "—"}</p>
            <p className="mt-1 text-sm font-medium text-brand">
              {c.child_count}/{c.capacity ?? "—"} trẻ
            </p>
          </div>
        ))}
        {classes.length === 0 && <p className="text-sm text-navy/50">Chưa có lớp nào.</p>}
      </div>
      <ClassFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        teachers={teachers}
        submitting={submitting}
      />
    </Card>
  );
}

function ChildrenTab({ classes }: { classes: ClassWithTeacher[] }) {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string>("all");
  const [status, setStatus] = useState<ChildStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ChildWithClass[]>([]);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    listChildren({ search, classId, status, page, pageSize: PAGE_SIZE }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classId, status, page]);

  async function handleCreate(data: ChildFormValues) {
    if (!schoolYear || !user) return;
    setSubmitting(true);
    try {
      await createChild({
        schoolYearId: schoolYear.id,
        classId: data.classId || undefined,
        fullName: data.fullName,
        dob: data.dob,
        gender: data.gender,
        enrollmentDate: data.enrollmentDate,
        createdBy: user.id,
        sessionId: useAuthStore.getState().sessionId,
      });
      setModalOpen(false);
      setPage(1);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
            <Input
              className="pl-9"
              placeholder="Tìm theo tên hoặc mã trẻ"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="w-48"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-48"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ChildStatus | "all");
              setPage(1);
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(CHILD_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          {hasPermission("children.export") && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const all = await listChildren({ search, classId, status, page: 1, pageSize: 10000 });
                exportChildrenToExcel(all.items);
              }}
            >
              <FileDown size={14} /> Xuất Excel
            </Button>
          )}
          {hasPermission("children.create") && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Tiếp nhận trẻ
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-2 font-medium">Mã trẻ</th>
              <th className="pb-2 font-medium">Họ và tên</th>
              <th className="pb-2 font-medium">Ngày sinh</th>
              <th className="pb-2 font-medium">Lớp</th>
              <th className="pb-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-navy/5 hover:bg-navy/5">
                <td className="py-2 font-mono text-xs text-navy/60">{c.code}</td>
                <td className="py-2">
                  <Link to={`/tre-em/${c.id}`} className="font-medium text-brand hover:underline">
                    {c.full_name}
                  </Link>
                </td>
                <td className="py-2">{c.dob}</td>
                <td className="py-2">{c.class_name ?? "—"}</td>
                <td className="py-2">{CHILD_STATUS_LABELS[c.status]}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-navy/50">
                  Không có trẻ nào phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <ChildFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        classes={classes}
        submitting={submitting}
      />
    </Card>
  );
}

function AttendanceTab({ classes }: { classes: ClassWithTeacher[] }) {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [pending, setPending] = useState<Record<string, AttendanceStatus>>({});
  const [stats, setStats] = useState({ present: 0, absentExcused: 0, absentUnexcused: 0, late: 0, total: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);

  const refresh = () => {
    if (!classId || !date) return;
    getAttendanceForClassDate(classId, date).then(setRows);
    getClassAttendanceStats(classId, date, date).then(setStats);
  };
  useEffect(refresh, [classId, date]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      for (const row of rows) {
        const status = pending[row.child_id] ?? row.status;
        if (status) {
          await recordAttendance(row.child_id, classId, date, status, undefined, user.id);
        }
      }
      setPending({});
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-56" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input type="date" className="w-48" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="text-sm text-navy/60">
          Có mặt: {stats.present} · Phép: {stats.absentExcused} · Không phép: {stats.absentUnexcused} · Muộn: {stats.late}
        </span>
        {hasPermission("children.export") && (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={async () => {
              const className = classes.find((c) => c.id === classId)?.name ?? classId;
              const monthStart = `${date.slice(0, 7)}-01`;
              const summary = await getChildrenAttendanceSummary(classId, monthStart, date);
              exportAttendanceReportToExcel(
                className,
                monthStart,
                date,
                summary.map((s) => ({
                  code: s.code,
                  fullName: s.full_name,
                  present: s.present,
                  absentExcused: s.absent_excused,
                  absentUnexcused: s.absent_unexcused,
                  late: s.late,
                })),
              );
            }}
          >
            <FileDown size={14} /> Xuất báo cáo chuyên cần tháng
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-2 font-medium">Trẻ</th>
              <th className="pb-2 font-medium">Trạng thái điểm danh</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.child_id} className="border-b border-navy/5">
                <td className="py-2">{r.child_name}</td>
                <td className="py-2">
                  <Select
                    className="w-52"
                    value={pending[r.child_id] ?? r.status ?? "present"}
                    disabled={!hasPermission("children.edit")}
                    onChange={(e) =>
                      setPending((prev) => ({
                        ...prev,
                        [r.child_id]: e.target.value as AttendanceStatus,
                      }))
                    }
                  >
                    {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="py-6 text-center text-navy/50">
                  Lớp chưa có trẻ đang học.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hasPermission("children.edit") && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu điểm danh"}
          </Button>
        </div>
      )}
    </Card>
  );
}
