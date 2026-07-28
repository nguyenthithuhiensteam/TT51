import { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/Badge";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import { listChildren, type ChildWithClass } from "../../lib/db/childRepo";
import {
  createAsset,
  createExpense,
  createFeeItem,
  createRevenue,
  changeAssetStatus,
  listAssets,
  listExpenses,
  listFeeItems,
  listRevenues,
  transitionExpense,
  transitionRevenue,
  type AssetRow,
  type ExpenseRow,
  type RevenueRow,
} from "../../lib/db/financeRepo";
import { ASSET_STATUS_LABELS } from "../../lib/db/types";
import type { FeeItem } from "../../lib/db/types";
import { exportFinanceReportToExcel } from "../../lib/export/excel";

type Tab = "revenues" | "expenses" | "fees" | "assets";

function formatVnd(amount: number): string {
  return amount.toLocaleString("vi-VN") + " đ";
}

export function FinancePage() {
  const [tab, setTab] = useState<Tab>("revenues");
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!hasPermission("finance.view")) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Tài chính – Tài sản</h1>
        <p className="text-sm text-navy/60">
          Mọi phiếu thu/chi đều có người lập, kiểm tra và phê duyệt riêng biệt.
        </p>
      </div>
      <div className="flex gap-1 border-b border-navy/10">
        {(
          [
            ["revenues", "Phiếu thu"],
            ["expenses", "Phiếu chi"],
            ["fees", "Khoản thu"],
            ["assets", "Tài sản"],
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
      {tab === "revenues" && <RevenuesTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "assets" && <AssetsTab />}
    </div>
  );
}

function RevenuesTab() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [revenues, setRevenues] = useState<RevenueRow[]>([]);
  const [children, setChildren] = useState<ChildWithClass[]>([]);
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [form, setForm] = useState({ childId: "", feeItemId: "", amount: "", date: new Date().toISOString().slice(0, 10), payer: "" });
  const [busy, setBusy] = useState(false);

  const refresh = () => listRevenues().then(setRevenues);
  useEffect(() => {
    refresh();
    listChildren({ page: 1, pageSize: 200 }).then((r) => setChildren(r.items));
    listFeeItems().then(setFeeItems);
  }, []);

  return (
    <Card>
      <div className="mb-3 flex justify-end">
        {hasPermission("finance.export") && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => exportFinanceReportToExcel("Phiếu thu", revenues.map((r) => [r.code, r.child_name ?? "", r.fee_item_name ?? "", r.amount, r.revenue_date, r.status]), ["Mã", "Trẻ", "Khoản thu", "Số tiền", "Ngày", "Trạng thái"])}
          >
            Xuất Excel
          </Button>
        )}
      </div>
      {hasPermission("finance.create") && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-navy/10 p-3 sm:grid-cols-6">
          <Select value={form.childId} onChange={(e) => setForm((p) => ({ ...p, childId: e.target.value }))}>
            <option value="">-- Trẻ --</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </Select>
          <Select value={form.feeItemId} onChange={(e) => setForm((p) => ({ ...p, feeItemId: e.target.value }))}>
            <option value="">-- Khoản thu --</option>
            {feeItems.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({formatVnd(f.amount)})
              </option>
            ))}
          </Select>
          <Input placeholder="Số tiền" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          <Input placeholder="Người nộp" value={form.payer} onChange={(e) => setForm((p) => ({ ...p, payer: e.target.value }))} />
          <Button
            size="sm"
            disabled={!form.amount || busy}
            onClick={async () => {
              if (!user || !schoolYear) return;
              setBusy(true);
              try {
                await createRevenue({
                  schoolYearId: schoolYear.id,
                  childId: form.childId || undefined,
                  feeItemId: form.feeItemId || undefined,
                  amount: Number(form.amount),
                  revenueDate: form.date,
                  payerName: form.payer || undefined,
                  preparedBy: user.id,
                });
                setForm({ childId: "", feeItemId: "", amount: "", date: new Date().toISOString().slice(0, 10), payer: "" });
                refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus size={14} /> Lập phiếu thu
          </Button>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50">
            <th className="pb-2 font-medium">Số phiếu</th>
            <th className="pb-2 font-medium">Trẻ / Người nộp</th>
            <th className="pb-2 font-medium">Số tiền</th>
            <th className="pb-2 font-medium">Trạng thái</th>
            <th className="pb-2 font-medium">Lập / Kiểm tra / Duyệt</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {revenues.map((r) => (
            <tr key={r.id} className="border-b border-navy/5">
              <td className="py-2 font-mono text-xs text-navy/60">{r.code}</td>
              <td className="py-2">{r.child_name ?? r.payer_name ?? "—"}</td>
              <td className="py-2">{formatVnd(r.amount)}</td>
              <td className="py-2">
                <StatusBadge status={r.status} />
              </td>
              <td className="py-2 text-xs text-navy/50">
                {r.prepared_by_name} / {r.checked_by_name ?? "—"} / {r.approved_by_name ?? "—"}
              </td>
              <td className="py-2">
                {r.status === "draft" && hasPermission("finance.create") && (
                  <Button size="sm" onClick={() => transitionRevenue(r.id, "submitted", user!.id, sessionId).then(refresh)}>
                    Gửi kiểm tra
                  </Button>
                )}
                {r.status === "submitted" && hasPermission("finance.edit") && (
                  <Button size="sm" onClick={() => transitionRevenue(r.id, "pending_approval", user!.id, sessionId, { setCheckedBy: true }).then(refresh)}>
                    Xác nhận đã kiểm tra
                  </Button>
                )}
                {r.status === "pending_approval" && hasPermission("finance.approve") && (
                  <Button size="sm" variant="success" onClick={() => transitionRevenue(r.id, "approved", user!.id, sessionId, { setApprovedBy: true }).then(refresh)}>
                    Phê duyệt
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {revenues.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-navy/50">Chưa có phiếu thu.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function ExpensesTab() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [form, setForm] = useState({ category: "", amount: "", date: new Date().toISOString().slice(0, 10), payee: "", note: "" });
  const [busy, setBusy] = useState(false);

  const refresh = () => listExpenses().then(setExpenses);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card>
      {hasPermission("finance.create") && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-navy/10 p-3 sm:grid-cols-6">
          <Input placeholder="Khoản mục" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          <Input placeholder="Số tiền" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          <Input placeholder="Người/đơn vị nhận" value={form.payee} onChange={(e) => setForm((p) => ({ ...p, payee: e.target.value }))} />
          <Input className="sm:col-span-2" placeholder="Nội dung chi" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          <Button
            size="sm"
            disabled={!form.category.trim() || !form.amount || busy}
            onClick={async () => {
              if (!user || !schoolYear) return;
              setBusy(true);
              try {
                await createExpense({
                  schoolYearId: schoolYear.id,
                  category: form.category.trim(),
                  amount: Number(form.amount),
                  expenseDate: form.date,
                  payeeName: form.payee || undefined,
                  note: form.note || undefined,
                  preparedBy: user.id,
                });
                setForm({ category: "", amount: "", date: new Date().toISOString().slice(0, 10), payee: "", note: "" });
                refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus size={14} /> Lập phiếu chi
          </Button>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50">
            <th className="pb-2 font-medium">Số phiếu</th>
            <th className="pb-2 font-medium">Khoản mục</th>
            <th className="pb-2 font-medium">Số tiền</th>
            <th className="pb-2 font-medium">Trạng thái</th>
            <th className="pb-2 font-medium">Lập / Kiểm tra / Duyệt</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id} className="border-b border-navy/5">
              <td className="py-2 font-mono text-xs text-navy/60">{e.code}</td>
              <td className="py-2">{e.category}</td>
              <td className="py-2">{formatVnd(e.amount)}</td>
              <td className="py-2">
                <StatusBadge status={e.status} />
              </td>
              <td className="py-2 text-xs text-navy/50">
                {e.prepared_by_name} / {e.checked_by_name ?? "—"} / {e.approved_by_name ?? "—"}
              </td>
              <td className="py-2">
                {e.status === "draft" && hasPermission("finance.create") && (
                  <Button size="sm" onClick={() => transitionExpense(e.id, "submitted", user!.id, sessionId).then(refresh)}>
                    Gửi kiểm tra
                  </Button>
                )}
                {e.status === "submitted" && hasPermission("finance.edit") && (
                  <Button size="sm" onClick={() => transitionExpense(e.id, "pending_approval", user!.id, sessionId, { setCheckedBy: true }).then(refresh)}>
                    Xác nhận đã kiểm tra
                  </Button>
                )}
                {e.status === "pending_approval" && hasPermission("finance.approve") && (
                  <Button size="sm" variant="success" onClick={() => transitionExpense(e.id, "approved", user!.id, sessionId, { setApprovedBy: true }).then(refresh)}>
                    Phê duyệt
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {expenses.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-navy/50">Chưa có phiếu chi.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function FeesTab() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [items, setItems] = useState<FeeItem[]>([]);
  const [form, setForm] = useState({ name: "", amount: "", period: "monthly" as "monthly" | "one_time" });
  const [busy, setBusy] = useState(false);

  const refresh = () => listFeeItems().then(setItems);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card>
      {hasPermission("finance.create") && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Input placeholder="Tên khoản thu" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Số tiền" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          <Select value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value as "monthly" | "one_time" }))}>
            <option value="monthly">Hàng tháng</option>
            <option value="one_time">Một lần</option>
          </Select>
          <Button
            size="sm"
            disabled={!form.name.trim() || !form.amount || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await createFeeItem(form.name.trim(), Number(form.amount), form.period);
                setForm({ name: "", amount: "", period: "monthly" });
                refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus size={14} /> Thêm khoản thu
          </Button>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50">
            <th className="pb-2 font-medium">Mã</th>
            <th className="pb-2 font-medium">Tên khoản thu</th>
            <th className="pb-2 font-medium">Số tiền</th>
            <th className="pb-2 font-medium">Định kỳ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id} className="border-b border-navy/5">
              <td className="py-2 font-mono text-xs text-navy/60">{f.code}</td>
              <td className="py-2">{f.name}</td>
              <td className="py-2">{formatVnd(f.amount)}</td>
              <td className="py-2">{f.period === "monthly" ? "Hàng tháng" : "Một lần"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AssetsTab() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", category: "", quantity: "1", unitPrice: "", location: "" });
  const [busy, setBusy] = useState(false);

  const refresh = () => listAssets(search).then(setAssets);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <Card>
      <div className="mb-3">
        <Input placeholder="Tìm theo tên hoặc mã tài sản" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      {hasPermission("finance.create") && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-navy/10 p-3 sm:grid-cols-5">
          <Input placeholder="Tên tài sản" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Loại" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          <Input placeholder="Số lượng" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          <Input placeholder="Đơn giá" type="number" value={form.unitPrice} onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))} />
          <Input placeholder="Vị trí" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
          <Button
            size="sm"
            className="sm:col-span-5"
            disabled={!form.name.trim() || busy}
            onClick={async () => {
              if (!user) return;
              setBusy(true);
              try {
                await createAsset({
                  name: form.name.trim(),
                  category: form.category || undefined,
                  quantity: Number(form.quantity || 1),
                  unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
                  location: form.location || undefined,
                  createdBy: user.id,
                });
                setForm({ name: "", category: "", quantity: "1", unitPrice: "", location: "" });
                refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus size={14} /> Thêm tài sản
          </Button>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50">
            <th className="pb-2 font-medium">Mã</th>
            <th className="pb-2 font-medium">Tên tài sản</th>
            <th className="pb-2 font-medium">SL</th>
            <th className="pb-2 font-medium">Vị trí</th>
            <th className="pb-2 font-medium">Trạng thái</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-b border-navy/5">
              <td className="py-2 font-mono text-xs text-navy/60">{a.code}</td>
              <td className="py-2">{a.name}</td>
              <td className="py-2">{a.quantity}</td>
              <td className="py-2">{a.location ?? "—"}</td>
              <td className="py-2">
                <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">
                  {ASSET_STATUS_LABELS[a.status]}
                </span>
              </td>
              <td className="py-2">
                {hasPermission("finance.approve") && a.status === "active" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => changeAssetStatus(a.id, "repair", user!.id, sessionId, "Phát hiện khi kiểm kê").then(refresh)}>
                      Báo hỏng
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => changeAssetStatus(a.id, "disposed", user!.id, sessionId, "Thanh lý theo quyết định").then(refresh)}>
                      Thanh lý
                    </Button>
                  </div>
                )}
                {hasPermission("finance.approve") && a.status === "repair" && (
                  <Button size="sm" variant="success" onClick={() => changeAssetStatus(a.id, "active", user!.id, sessionId, "Đã sửa chữa xong").then(refresh)}>
                    Đã sửa xong
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {assets.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-navy/50">Chưa có tài sản.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
