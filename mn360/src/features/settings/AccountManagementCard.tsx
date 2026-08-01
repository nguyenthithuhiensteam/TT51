import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  approveUserAccount,
  listAllUserAccounts,
  setUserAccountActive,
  updateUserPermissions,
} from "@/lib/db/systemRepo";
import type { UserAccountWithAccess } from "@/lib/db/types";
import { PERMISSION_CATALOG } from "../../lib/permissionCatalog";
import { useAuthStore } from "../../store/authStore";

function AccountRow({
  account,
  onChanged,
}: {
  account: UserAccountWithAccess;
  onChanged: () => Promise<void>;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const [codes, setCodes] = useState<Set<string>>(new Set(account.permissionCodes));
  const [busy, setBusy] = useState(false);
  const isPending = !account.is_active;

  function toggle(code: string) {
    setCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function onApprove() {
    if (!currentUser) return;
    setBusy(true);
    try {
      await approveUserAccount(account.id, Array.from(codes), currentUser.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function onSavePermissions() {
    if (!currentUser) return;
    setBusy(true);
    try {
      await updateUserPermissions(account.id, Array.from(codes), currentUser.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive() {
    if (!currentUser) return;
    setBusy(true);
    try {
      await setUserAccountActive(account.id, isPending, currentUser.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-navy/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-navy">{account.full_name}</p>
          <p className="text-xs text-navy/50">
            {account.email ?? account.username}
            {" · "}
            {account.authProvider === "google" ? "Đăng nhập Google" : "Tên đăng nhập/mật khẩu"}
          </p>
        </div>
        <span
          className={
            isPending
              ? "rounded-full bg-warn/15 px-2 py-0.5 text-xs text-warn"
              : "rounded-full bg-mint/15 px-2 py-0.5 text-xs text-mint"
          }
        >
          {isPending ? "Chờ phê duyệt" : "Đang hoạt động"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSION_CATALOG.map((group) => (
          <div key={group.group} className="rounded-lg bg-cream/60 p-2">
            <p className="mb-1 text-xs font-semibold text-navy/70">{group.group}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {group.codes.map(({ code, label }) => (
                <label key={code} className="flex items-center gap-1 text-xs text-navy/80">
                  <input
                    type="checkbox"
                    checked={codes.has(code)}
                    onChange={() => toggle(code)}
                    disabled={account.id === currentUser?.id}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isPending ? (
          <Button size="sm" disabled={busy} onClick={onApprove}>
            {busy ? "Đang duyệt..." : "Phê duyệt & cấp quyền"}
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={onSavePermissions}>
            {busy ? "Đang lưu..." : "Lưu quyền"}
          </Button>
        )}
        {account.id !== currentUser?.id && (
          <Button size="sm" variant={isPending ? "secondary" : "danger"} disabled={busy} onClick={onToggleActive}>
            {isPending ? "Từ chối" : "Khoá tài khoản"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** "Quản lý tài khoản & phân quyền" — chỉ hiển thị cho người có quyền system.edit trên bản web
 * thật (đăng nhập Google). Tài khoản Google đăng nhập lần đầu vào đây ở trạng thái chờ duyệt,
 * quản trị viên chọn quyền rồi bấm Phê duyệt để cấp quyền truy cập. */
export function AccountManagementCard() {
  const [accounts, setAccounts] = useState<UserAccountWithAccess[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setAccounts(await listAllUserAccounts());
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const pending = accounts.filter((a) => !a.is_active);
  const active = accounts.filter((a) => a.is_active);

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-navy">Quản lý tài khoản & phân quyền</h2>
      <p className="mb-3 text-sm text-navy/60">
        Tài khoản đăng nhập bằng Google lần đầu sẽ ở trạng thái chờ duyệt cho tới khi được chọn
        quyền và phê duyệt tại đây.
      </p>
      {loading ? (
        <p className="text-sm text-navy/50">Đang tải...</p>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-warn">
                Đang chờ phê duyệt ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map((a) => (
                  <AccountRow key={a.id} account={a} onChanged={refresh} />
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-navy/50">
              Tài khoản đang hoạt động ({active.length})
            </h3>
            <div className="space-y-2">
              {active.map((a) => (
                <AccountRow key={a.id} account={a} onChanged={refresh} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
