import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileUp, Plus, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pagination } from "../../components/ui/Pagination";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../../store/authStore";
import { createStaff, listStaff, type StaffWithUser } from "../../lib/db/staffRepo";
import { createUserAccount, isUsernameTaken, listActiveUsers, listRoles } from "../../lib/db/systemRepo";
import { EMPLOYMENT_TYPE_LABELS } from "../../lib/db/types";
import type { Role, User } from "../../lib/db/types";
import { StaffFormModal, type StaffFormValues } from "./StaffFormModal";
import { CreateStaffAccountModal, type CreateStaffAccountValues } from "./CreateStaffAccountModal";
import { ImportStaffModal } from "./ImportStaffModal";

const PAGE_SIZE = 15;

export function StaffListPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StaffWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const sessionId = useAuthStore((s) => s.sessionId);

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
    listRoles().then(setRoles);
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

  async function handleCreateAccount(data: CreateStaffAccountValues) {
    if (!user) return;
    setAccountSubmitting(true);
    setAccountError(null);
    try {
      if (await isUsernameTaken(data.username)) {
        setAccountError("Tên đăng nhập đã tồn tại, vui lòng chọn tên khác");
        return;
      }
      const passwordHash = await invoke<string>("hash_password", { password: data.tempPassword });
      const newUserId = await createUserAccount({
        username: data.username,
        fullName: data.fullName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        roleId: data.roleId,
        passwordHash,
        createdBy: user.id,
        sessionId,
      });
      await createStaff({
        userId: newUserId,
        employeeCode: data.employeeCode,
        position: data.position,
        employmentType: data.employmentType,
        degree: data.degree || undefined,
        startDate: data.startDate || undefined,
        createdBy: user.id,
      });
      setAccountModalOpen(false);
      setPage(1);
      refresh();
      listActiveUsers().then(setUsers);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Không thể tạo tài khoản (mã viên chức có thể đã tồn tại)");
    } finally {
      setAccountSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">Đội ngũ</h1>
          <p className="text-sm text-navy/60">Hồ sơ cán bộ, giáo viên, nhân viên nhà trường.</p>
        </div>
        <div className="flex gap-2">
          {hasPermission("system.edit") && (
            <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
              <FileUp size={16} /> Nhập từ Excel
            </Button>
          )}
          {hasPermission("system.edit") && (
            <Button variant="secondary" onClick={() => setAccountModalOpen(true)}>
              <Plus size={16} /> Thêm cán bộ mới (tài khoản mới)
            </Button>
          )}
          {hasPermission("staff.create") && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Tạo hồ sơ cán bộ
            </Button>
          )}
        </div>
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

      <CreateStaffAccountModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        onSubmit={handleCreateAccount}
        roles={roles}
        submitting={accountSubmitting}
        error={accountError}
      />

      <ImportStaffModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        roles={roles}
        createdBy={user?.id ?? ""}
        sessionId={sessionId}
        onImported={() => {
          setPage(1);
          refresh();
          listActiveUsers().then(setUsers);
        }}
      />
    </div>
  );
}
