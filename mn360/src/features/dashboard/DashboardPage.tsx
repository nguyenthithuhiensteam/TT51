import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { StatTile, Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/Badge";
import {
  getTaskDashboardStats,
  listTasks,
  type DashboardTaskStats,
  type TaskWithOwner,
} from "../../lib/db/taskRepo";
import { countPendingApprovalDocuments } from "../../lib/db/documentRepo";
import { STATUS_LABELS } from "../../lib/db/types";

const DUE_SOON_DAYS = 7;

export function DashboardPage() {
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<DashboardTaskStats | null>(null);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [myTasks, setMyTasks] = useState<TaskWithOwner[]>([]);

  useEffect(() => {
    if (!schoolYear || !user) return;
    const today = new Date().toISOString().slice(0, 10);
    getTaskDashboardStats(schoolYear.id, today, DUE_SOON_DAYS).then(setStats);
    countPendingApprovalDocuments(schoolYear.id).then(setPendingDocs);
    listTasks({ onlyMine: user.id, status: "all", pageSize: 6 }).then((r) => setMyTasks(r.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id, user?.id]);

  const chartData =
    stats?.byStatus.map((s) => ({ name: STATUS_LABELS[s.status], count: s.count })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Tổng quan</h1>
        <p className="text-sm text-navy/60">
          Số liệu được lấy trực tiếp từ phân hệ Công việc và Văn phòng số.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Tổng nhiệm vụ trong năm học" value={stats?.total ?? "—"} />
        <StatTile label="Nhiệm vụ quá hạn" value={stats?.overdue ?? "—"} tone="danger" />
        <StatTile
          label={`Sắp đến hạn (${DUE_SOON_DAYS} ngày tới)`}
          value={stats?.dueSoon ?? "—"}
          tone="warn"
        />
        <StatTile label="Văn bản chờ duyệt" value={pendingDocs} tone="mint" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-navy">
            Tiến độ công việc theo trạng thái
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0A1F4E10" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1A6BDB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-navy">Việc cần xử lý của tôi</h2>
          <div className="space-y-2">
            {myTasks.length === 0 && (
              <p className="text-sm text-navy/50">Không có nhiệm vụ nào.</p>
            )}
            {myTasks.map((t) => (
              <Link
                key={t.id}
                to={`/cong-viec/${t.id}`}
                className="block rounded-lg border border-navy/5 p-2 hover:bg-navy/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-navy">{t.title}</span>
                  <StatusBadge status={t.status} />
                </div>
                <span className="text-xs text-navy/50">
                  Hạn: {t.due_date ?? "chưa đặt"} · {t.code}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to="/cong-viec">
          <Card className="hover:shadow-lg transition-shadow">
            <h3 className="text-sm font-semibold text-navy">Thao tác nhanh</h3>
            <p className="mt-1 text-sm text-navy/60">Tạo nhiệm vụ mới hoặc xem danh sách công việc</p>
          </Card>
        </Link>
        <Link to="/van-phong-so">
          <Card className="hover:shadow-lg transition-shadow">
            <h3 className="text-sm font-semibold text-navy">Văn phòng số</h3>
            <p className="mt-1 text-sm text-navy/60">Soạn thảo, gửi duyệt và ban hành văn bản</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
