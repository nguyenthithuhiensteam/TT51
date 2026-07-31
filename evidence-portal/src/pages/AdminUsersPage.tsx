import { useEffect, useState } from "react";
import { Card, Button, RoleBadge } from "../components/ui";
import { setUserRole, watchAllUsers } from "../lib/data";
import type { PortalUser, UserRole } from "../types";

export function AdminUsersPage({ currentUser }: { currentUser: PortalUser }) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => watchAllUsers(setUsers), []);

  async function changeRole(uid: string, role: UserRole) {
    setBusyUid(uid);
    try {
      await setUserRole(uid, role, currentUser.uid);
    } finally {
      setBusyUid(null);
    }
  }

  const pending = users.filter((u) => u.role === "pending");
  const approved = users.filter((u) => u.role !== "pending");

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Chờ duyệt ({pending.length})</h2>
        <div className="space-y-2">
          {pending.map((u) => (
            <div key={u.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy/10 p-2">
              <div>
                <p className="text-sm font-medium text-navy">{u.displayName}</p>
                <p className="text-xs text-navy/50">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="success" disabled={busyUid === u.uid} onClick={() => changeRole(u.uid, "staff")}>
                  Duyệt: Cán bộ
                </Button>
                <Button variant="secondary" disabled={busyUid === u.uid} onClick={() => changeRole(u.uid, "approver")}>
                  Duyệt: Người duyệt minh chứng
                </Button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-navy/50">Không có tài khoản nào đang chờ.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Tài khoản đã duyệt ({approved.length})</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-1 font-medium">Người dùng</th>
              <th className="pb-1 font-medium">Vai trò</th>
              <th className="pb-1 font-medium">Đổi vai trò</th>
            </tr>
          </thead>
          <tbody>
            {approved.map((u) => (
              <tr key={u.uid} className="border-b border-navy/5">
                <td className="py-1">
                  <p className="font-medium text-navy">{u.displayName}</p>
                  <p className="text-xs text-navy/50">{u.email}</p>
                </td>
                <td className="py-1">
                  <RoleBadge role={u.role} />
                </td>
                <td className="py-1">
                  <select
                    className="rounded-lg border border-navy/15 px-2 py-1 text-sm"
                    value={u.role}
                    disabled={u.uid === currentUser.uid || busyUid === u.uid}
                    onChange={(e) => changeRole(u.uid, e.target.value as UserRole)}
                  >
                    <option value="staff">Cán bộ</option>
                    <option value="approver">Người duyệt minh chứng</option>
                    <option value="admin">Quản trị</option>
                    <option value="pending">Thu hồi quyền (về chờ duyệt)</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
