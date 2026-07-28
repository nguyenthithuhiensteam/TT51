import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { AssetStatus, FeeItem, RecordStatus } from "./types";

// ===================== KHOẢN THU =====================

export async function listFeeItems(): Promise<FeeItem[]> {
  return dbSelect<FeeItem>("SELECT * FROM fee_items WHERE is_active = 1 ORDER BY name ASC");
}

export async function createFeeItem(
  name: string,
  amount: number,
  period: "monthly" | "one_time",
  category?: string,
): Promise<void> {
  const seq = (await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM fee_items", []))[0]?.n ?? 0;
  const code = `KT-${String(seq + 1).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    "INSERT INTO fee_items (id, code, name, amount, period, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
    [newId(), code, name, amount, period, category ?? null, ts, ts],
  );
}

// ===================== PHIẾU THU (REVENUES) =====================

export interface RevenueRow {
  id: string;
  code: string;
  child_name: string | null;
  fee_item_name: string | null;
  amount: number;
  revenue_date: string;
  payer_name: string | null;
  note: string | null;
  status: RecordStatus;
  prepared_by_name: string;
  checked_by_name: string | null;
  approved_by_name: string | null;
}

export async function listRevenues(status?: RecordStatus | "all"): Promise<RevenueRow[]> {
  const where = status && status !== "all" ? "WHERE r.status = ?" : "";
  const args = status && status !== "all" ? [status] : [];
  return dbSelect<RevenueRow>(
    `SELECT r.id, r.code, ch.full_name AS child_name, fi.name AS fee_item_name, r.amount,
       r.revenue_date, r.payer_name, r.note, r.status,
       pu.full_name AS prepared_by_name, cu.full_name AS checked_by_name, au.full_name AS approved_by_name
     FROM revenues r
     LEFT JOIN children ch ON ch.id = r.child_id
     LEFT JOIN fee_items fi ON fi.id = r.fee_item_id
     JOIN users pu ON pu.id = r.prepared_by
     LEFT JOIN users cu ON cu.id = r.checked_by
     LEFT JOIN users au ON au.id = r.approved_by
     ${where}
     ORDER BY r.revenue_date DESC`,
    args,
  );
}

async function nextRevenueSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM revenues", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createRevenue(input: {
  schoolYearId: string;
  childId?: string;
  feeItemId?: string;
  amount: number;
  revenueDate: string;
  payerName?: string;
  note?: string;
  preparedBy: string;
}): Promise<void> {
  const seq = await nextRevenueSequence();
  const year = new Date().getFullYear();
  const code = `PT-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO revenues (id, code, school_year_id, child_id, fee_item_id, amount, revenue_date,
      payer_name, note, status, prepared_by, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?)`,
    [
      newId(),
      code,
      input.schoolYearId,
      input.childId ?? null,
      input.feeItemId ?? null,
      input.amount,
      input.revenueDate,
      input.payerName ?? null,
      input.note ?? null,
      input.preparedBy,
      ts,
      ts,
    ],
  );
}

/** Quy trình: Lập (draft) → Gửi kiểm tra (submitted) → Đã kiểm tra (pending_approval) → Phê duyệt (approved). */
export async function transitionRevenue(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
  extra?: { setCheckedBy?: boolean; setApprovedBy?: boolean },
): Promise<void> {
  const sets: string[] = ["status = ?", "version = version + 1", "updated_at = ?"];
  const args: unknown[] = [toStatus, nowIso()];
  if (extra?.setCheckedBy) {
    sets.push("checked_by = ?");
    args.push(actorId);
  }
  if (extra?.setApprovedBy) {
    sets.push("approved_by = ?");
    args.push(actorId);
  }
  args.push(id);
  await dbExecute(`UPDATE revenues SET ${sets.join(", ")} WHERE id = ?`, args);
  await logAudit({
    entityTable: "revenues",
    entityId: id,
    action: `status_change:->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

// ===================== PHIẾU CHI (EXPENSES) =====================

export interface ExpenseRow {
  id: string;
  code: string;
  category: string;
  amount: number;
  expense_date: string;
  payee_name: string | null;
  note: string | null;
  status: RecordStatus;
  prepared_by_name: string;
  checked_by_name: string | null;
  approved_by_name: string | null;
}

export async function listExpenses(status?: RecordStatus | "all"): Promise<ExpenseRow[]> {
  const where = status && status !== "all" ? "WHERE e.status = ?" : "";
  const args = status && status !== "all" ? [status] : [];
  return dbSelect<ExpenseRow>(
    `SELECT e.id, e.code, e.category, e.amount, e.expense_date, e.payee_name, e.note, e.status,
       pu.full_name AS prepared_by_name, cu.full_name AS checked_by_name, au.full_name AS approved_by_name
     FROM expenses e
     JOIN users pu ON pu.id = e.prepared_by
     LEFT JOIN users cu ON cu.id = e.checked_by
     LEFT JOIN users au ON au.id = e.approved_by
     ${where}
     ORDER BY e.expense_date DESC`,
    args,
  );
}

async function nextExpenseSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM expenses", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createExpense(input: {
  schoolYearId: string;
  category: string;
  amount: number;
  expenseDate: string;
  payeeName?: string;
  note?: string;
  preparedBy: string;
}): Promise<void> {
  const seq = await nextExpenseSequence();
  const year = new Date().getFullYear();
  const code = `PC-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO expenses (id, code, school_year_id, category, amount, expense_date, payee_name,
      note, status, prepared_by, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?)`,
    [
      newId(),
      code,
      input.schoolYearId,
      input.category,
      input.amount,
      input.expenseDate,
      input.payeeName ?? null,
      input.note ?? null,
      input.preparedBy,
      ts,
      ts,
    ],
  );
}

export async function transitionExpense(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
  extra?: { setCheckedBy?: boolean; setApprovedBy?: boolean },
): Promise<void> {
  const sets: string[] = ["status = ?", "version = version + 1", "updated_at = ?"];
  const args: unknown[] = [toStatus, nowIso()];
  if (extra?.setCheckedBy) {
    sets.push("checked_by = ?");
    args.push(actorId);
  }
  if (extra?.setApprovedBy) {
    sets.push("approved_by = ?");
    args.push(actorId);
  }
  args.push(id);
  await dbExecute(`UPDATE expenses SET ${sets.join(", ")} WHERE id = ?`, args);
  await logAudit({
    entityTable: "expenses",
    entityId: id,
    action: `status_change:->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

// ===================== TÀI SẢN =====================

export interface AssetRow {
  id: string;
  code: string;
  name: string;
  category: string | null;
  quantity: number;
  unit_price: number | null;
  location: string | null;
  status: AssetStatus;
  note: string | null;
}

export async function listAssets(search?: string): Promise<AssetRow[]> {
  if (search) {
    return dbSelect<AssetRow>(
      "SELECT * FROM assets WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ?) ORDER BY name ASC",
      [`%${search}%`, `%${search}%`],
    );
  }
  return dbSelect<AssetRow>("SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY name ASC");
}

async function nextAssetSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM assets", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createAsset(input: {
  name: string;
  category?: string;
  quantity: number;
  unitPrice?: number;
  purchaseDate?: string;
  location?: string;
  createdBy: string;
}): Promise<void> {
  const seq = await nextAssetSequence();
  const code = `TS-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO assets (id, code, name, category, quantity, unit_price, purchase_date, location,
      status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`,
    [
      newId(),
      code,
      input.name,
      input.category ?? null,
      input.quantity,
      input.unitPrice ?? null,
      input.purchaseDate ?? null,
      input.location ?? null,
      input.createdBy,
      ts,
      input.createdBy,
      ts,
    ],
  );
}

/** Chuyển trạng thái tài sản (kiểm kê phát hiện hỏng, điều chuyển, thanh lý) — luôn ghi lịch sử. */
export async function changeAssetStatus(
  id: string,
  toStatus: AssetStatus,
  changedBy: string,
  sessionId: string | null,
  note?: string,
): Promise<void> {
  const rows = await dbSelect<{ status: AssetStatus }>("SELECT status FROM assets WHERE id = ?", [id]);
  const fromStatus = rows[0]?.status ?? "active";
  await dbExecute(
    "UPDATE assets SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, changedBy, nowIso(), id],
  );
  await dbExecute(
    `INSERT INTO asset_status_history (id, asset_id, from_status, to_status, changed_by, changed_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), id, fromStatus, toStatus, changedBy, nowIso(), note ?? null],
  );
  await logAudit({
    entityTable: "assets",
    entityId: id,
    action: `status_change:${fromStatus}->${toStatus}`,
    userId: changedBy,
    sessionId,
  });
}

export interface AssetStatusHistoryRow {
  id: string;
  from_status: AssetStatus | null;
  to_status: AssetStatus;
  changed_by_name: string;
  changed_at: string;
  note: string | null;
}

export async function listAssetStatusHistory(assetId: string): Promise<AssetStatusHistoryRow[]> {
  return dbSelect<AssetStatusHistoryRow>(
    `SELECT h.*, u.full_name AS changed_by_name FROM asset_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.asset_id = ? ORDER BY h.changed_at ASC`,
    [assetId],
  );
}
