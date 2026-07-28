import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pagination } from "../../components/ui/Pagination";
import { useAuthStore } from "../../store/authStore";
import { createStaff, listStaff, type StaffWithUser } from "../../lib/db/staffRepo";
import { listActiveUsers } from "../../lib/db/systemRepo";
import { EMPLOYMENT_TYPE_LABELS } from "../../lib/db/types";
import type { User } from "../../lib/db/types";
import { StaffFormModal, type StaffFormValues } from "./StaffFormModal";

const PAGE_SIZE = 15;

export function StaffListPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StaffWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    listStaff({ search, page, pageSize: PAGE_SIZE }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    listActiveUsers().then(setUsers);
  }, []);

  async function handleCreate(data: StaffFormValues) {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await createStaff({
        userId: data.userId,
        employeeCode: data.employeeCode,
        position: data.position,
        employmentType: data.employmentType,
        degree: data.degree || undefined,
        startDate: data.startDate || undefined,
        createdBy: user.id,
      });
      setModalOpen(false);
      setPage(1);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu hồ sơ (mã hoặc người dùng đã tồn tại)");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">Đội ngũ</h1>
          <p className="text-sm text-navy/60">Hồ sơ cán bộ, giáo viên, nhân viên nhà trường.</p>
        </div>
        {hasPermission("staff.create") && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Tạo hồ sơ cán bộ
          </Button>
        )}
      </div>

      <Card>
        <div className="relative mb-4 w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên, mã viên chức, chức vụ"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-2 font-medium">Mã viên chức</th>
                <th className="pb-2 font-medium">Họ và tên</th>
                <th className="pb-2 font-medium">Chức vụ</th>
                <th className="pb-2 font-medium">Loại hợp đồng</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-navy/5 hover:bg-navy/5">
                  <td className="py-2 font-mono text-xs text-navy/60">{s.employee_code}</td>
                  <td className="py-2">
                    <Link to={`/doi-ngu/${s.id}`} className="font-medium text-brand hover:underline">
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="py-2">{s.position}</td>
                  <td className="py-2">{EMPLOYMENT_TYPE_LABELS[s.employment_type]}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-navy/50">
                    Không có cán bộ nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </Card>

      <StaffFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        users={users}
        submitting={submitting}
        error={error}
      />
    </div>
  );
}
