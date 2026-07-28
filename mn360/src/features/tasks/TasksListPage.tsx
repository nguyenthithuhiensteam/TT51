import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, Plus, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Pagination } from "../../components/ui/Pagination";
import { StatusBadge, PriorityBadge } from "../../components/ui/Badge";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import { listTasks, createTask, type TaskWithOwner } from "../../lib/db/taskRepo";
import { listActiveUsers } from "../../lib/db/systemRepo";
import type { RecordStatus, User } from "../../lib/db/types";
import { STATUS_LABELS } from "../../lib/db/types";
import { TaskFormModal } from "./TaskFormModal";
import type { TaskFormInput } from "../../lib/schemas/task";
import { exportTasksToExcel } from "../../lib/export/excel";

const PAGE_SIZE = 10;

export function TasksListPage() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RecordStatus | "all">("all");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TaskWithOwner[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    listTasks({
      search,
      status,
      onlyMine: scope === "mine" ? user?.id : undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, scope, page]);

  useEffect(() => {
    listActiveUsers().then(setUsers);
  }, []);

  async function handleCreate(data: TaskFormInput) {
    if (!schoolYear || !user) return;
    setSubmitting(true);
    try {
      await createTask({
        schoolYearId: schoolYear.id,
        title: data.title,
        field: data.field,
        content: data.content,
        priority: data.priority,
        assignedBy: user.id,
        ownerId: data.ownerId,
        coordinatorIds: data.coordinatorIds,
        startDate: data.startDate,
        dueDate: data.dueDate,
        deliverable: data.deliverable,
        doneCriteria: data.doneCriteria,
        createdBy: user.id,
        sessionId,
      });
      setModalOpen(false);
      setPage(1);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">Công việc</h1>
          <p className="text-sm text-navy/60">
            Nguyên tắc 6 rõ: rõ người, rõ việc, rõ thời gian, rõ kết quả, rõ trách nhiệm, rõ kiểm
            tra.
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission("task.export") && (
            <Button
              variant="secondary"
              onClick={async () => {
                const all = await listTasks({ search, status, onlyMine: scope === "mine" ? user?.id : undefined, page: 1, pageSize: 10000 });
                exportTasksToExcel(all.items);
              }}
            >
              <FileDown size={16} /> Xuất Excel
            </Button>
          )}
          {hasPermission("task.create") && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Tạo nhiệm vụ
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
            <Input
              className="pl-9"
              placeholder="Tìm theo tên hoặc mã nhiệm vụ"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="w-48"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as RecordStatus | "all");
              setPage(1);
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            className="w-56"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as "all" | "mine");
              setPage(1);
            }}
          >
            <option value="all">Toàn trường</option>
            <option value="mine">Của tôi (chủ trì/phối hợp)</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-2 font-medium">Mã</th>
                <th className="pb-2 font-medium">Tên nhiệm vụ</th>
                <th className="pb-2 font-medium">Người chủ trì</th>
                <th className="pb-2 font-medium">Hạn</th>
                <th className="pb-2 font-medium">Ưu tiên</th>
                <th className="pb-2 font-medium">Trạng thái</th>
                <th className="pb-2 font-medium">Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-navy/5 hover:bg-navy/5">
                  <td className="py-2 font-mono text-xs text-navy/60">{t.code}</td>
                  <td className="py-2">
                    <Link to={`/cong-viec/${t.id}`} className="font-medium text-brand hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="py-2">{t.owner_name}</td>
                  <td className="py-2">{t.due_date ?? "—"}</td>
                  <td className="py-2">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2">{t.progress_percent}%</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-navy/50">
                    Không có nhiệm vụ nào phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </Card>

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        users={users}
        submitting={submitting}
      />
    </div>
  );
}
