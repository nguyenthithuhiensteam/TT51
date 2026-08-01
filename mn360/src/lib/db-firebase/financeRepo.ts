import { addDoc, collection, doc, getCountFromServer, getDoc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { AssetStatus, FeeItem, RecordStatus } from "./types";

async function getUserName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? null) : null;
}

// ===================== KHOẢN THU =====================

export async function listFeeItems(): Promise<FeeItem[]> {
  const snap = await getDocs(query(collection(db, COL.feeItems), where("is_active", "==", 1)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeeItem, "id">) })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function createFeeItem(name: string, amount: number, period: "monthly" | "one_time", category?: string): Promise<void> {
  const countSnap = await getCountFromServer(collection(db, COL.feeItems));
  const code = `KT-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  await addDoc(collection(db, COL.feeItems), { code, name, amount, period, category: category ?? null, is_active: 1, created_at: ts, updated_at: ts });
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
  payer_address: string | null;
  reason: string | null;
  attachment_count: number | null;
  note: string | null;
  status: RecordStatus;
  prepared_by_name: string;
  checked_by_name: string | null;
  approved_by_name: string | null;
}

export async function listRevenues(status?: RecordStatus | "all"): Promise<RevenueRow[]> {
  const snap = await getDocs(collection(db, COL.revenues));
  let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RevenueRow, "id">) }));
  if (status && status !== "all") items = items.filter((r) => r.status === status);
  return items.sort((a, b) => b.revenue_date.localeCompare(a.revenue_date));
}

export async function createRevenue(input: {
  schoolYearId: string;
  childId?: string;
  feeItemId?: string;
  amount: number;
  revenueDate: string;
  payerName?: string;
  payerAddress?: string;
  reason?: string;
  attachmentCount?: number;
  note?: string;
  preparedBy: string;
}): Promise<void> {
  const countSnap = await getCountFromServer(collection(db, COL.revenues));
  const year = new Date().getFullYear();
  const code = `PT-${year}-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  const [childName, feeItemName] = await Promise.all([
    input.childId ? getDoc(doc(db, COL.children, input.childId)).then((s) => (s.exists() ? (s.data().full_name as string) : null)) : Promise.resolve(null),
    input.feeItemId ? getDoc(doc(db, COL.feeItems, input.feeItemId)).then((s) => (s.exists() ? (s.data().name as string) : null)) : Promise.resolve(null),
  ]);
  await addDoc(collection(db, COL.revenues), {
    code,
    school_year_id: input.schoolYearId,
    child_id: input.childId ?? null,
    child_name: childName,
    fee_item_id: input.feeItemId ?? null,
    fee_item_name: feeItemName,
    amount: input.amount,
    revenue_date: input.revenueDate,
    payer_name: input.payerName ?? null,
    payer_address: input.payerAddress ?? null,
    reason: input.reason ?? null,
    attachment_count: input.attachmentCount ?? null,
    note: input.note ?? null,
    status: "draft" as RecordStatus,
    prepared_by: input.preparedBy,
    prepared_by_name: await getUserName(input.preparedBy),
    checked_by: null,
    checked_by_name: null,
    approved_by: null,
    approved_by_name: null,
    version: 1,
    created_at: ts,
    updated_at: ts,
  });
}

export async function transitionRevenue(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
  extra?: { setCheckedBy?: boolean; setApprovedBy?: boolean },
): Promise<void> {
  const before = await getDoc(doc(db, COL.revenues, id));
  const patch: Record<string, unknown> = { status: toStatus, version: ((before.data()?.version as number) ?? 1) + 1, updated_at: nowIso() };
  if (extra?.setCheckedBy) {
    patch.checked_by = actorId;
    patch.checked_by_name = await getUserName(actorId);
  }
  if (extra?.setApprovedBy) {
    patch.approved_by = actorId;
    patch.approved_by_name = await getUserName(actorId);
  }
  await updateDoc(doc(db, COL.revenues, id), patch);
  await logAudit({ entityTable: "revenues", entityId: id, action: `status_change:->${toStatus}`, userId: actorId, sessionId });
}

// ===================== PHIẾU CHI (EXPENSES) =====================

export interface ExpenseRow {
  id: string;
  code: string;
  category: string;
  amount: number;
  expense_date: string;
  payee_name: string | null;
  payee_address: string | null;
  reason: string | null;
  attachment_count: number | null;
  note: string | null;
  status: RecordStatus;
  prepared_by_name: string;
  checked_by_name: string | null;
  approved_by_name: string | null;
}

export async function listExpenses(status?: RecordStatus | "all"): Promise<ExpenseRow[]> {
  const snap = await getDocs(collection(db, COL.expenses));
  let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExpenseRow, "id">) }));
  if (status && status !== "all") items = items.filter((e) => e.status === status);
  return items.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
}

export async function createExpense(input: {
  schoolYearId: string;
  category: string;
  amount: number;
  expenseDate: string;
  payeeName?: string;
  payeeAddress?: string;
  reason?: string;
  attachmentCount?: number;
  note?: string;
  preparedBy: string;
}): Promise<void> {
  const countSnap = await getCountFromServer(collection(db, COL.expenses));
  const year = new Date().getFullYear();
  const code = `PC-${year}-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  await addDoc(collection(db, COL.expenses), {
    code,
    school_year_id: input.schoolYearId,
    category: input.category,
    amount: input.amount,
    expense_date: input.expenseDate,
    payee_name: input.payeeName ?? null,
    payee_address: input.payeeAddress ?? null,
    reason: input.reason ?? null,
    attachment_count: input.attachmentCount ?? null,
    note: input.note ?? null,
    status: "draft" as RecordStatus,
    prepared_by: input.preparedBy,
    prepared_by_name: await getUserName(input.preparedBy),
    checked_by: null,
    checked_by_name: null,
    approved_by: null,
    approved_by_name: null,
    version: 1,
    created_at: ts,
    updated_at: ts,
  });
}

export async function transitionExpense(
  id: string,
  toStatus: RecordStatus,
  actorId: string,
  sessionId: string | null,
  extra?: { setCheckedBy?: boolean; setApprovedBy?: boolean },
): Promise<void> {
  const before = await getDoc(doc(db, COL.expenses, id));
  const patch: Record<string, unknown> = { status: toStatus, version: ((before.data()?.version as number) ?? 1) + 1, updated_at: nowIso() };
  if (extra?.setCheckedBy) {
    patch.checked_by = actorId;
    patch.checked_by_name = await getUserName(actorId);
  }
  if (extra?.setApprovedBy) {
    patch.approved_by = actorId;
    patch.approved_by_name = await getUserName(actorId);
  }
  await updateDoc(doc(db, COL.expenses, id), patch);
  await logAudit({ entityTable: "expenses", entityId: id, action: `status_change:->${toStatus}`, userId: actorId, sessionId });
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
  const snap = await getDocs(collection(db, COL.assets));
  let items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AssetRow, "id">) }))
    .filter((a) => !(a as unknown as { deleted_at?: string }).deleted_at);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter((a) => a.name.toLowerCase().includes(s) || a.code.toLowerCase().includes(s));
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, "vi"));
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
  const countSnap = await getCountFromServer(collection(db, COL.assets));
  const code = `TS-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  await addDoc(collection(db, COL.assets), {
    code,
    name: input.name,
    category: input.category ?? null,
    quantity: input.quantity,
    unit_price: input.unitPrice ?? null,
    purchase_date: input.purchaseDate ?? null,
    location: input.location ?? null,
    status: "active",
    note: null,
    version: 1,
    created_by: input.createdBy,
    created_at: ts,
    updated_by: input.createdBy,
    updated_at: ts,
    deleted_at: null,
  });
}

export async function changeAssetStatus(id: string, toStatus: AssetStatus, changedBy: string, sessionId: string | null, note?: string): Promise<void> {
  const snap = await getDoc(doc(db, COL.assets, id));
  const fromStatus = (snap.data()?.status as AssetStatus) ?? "active";
  await updateDoc(doc(db, COL.assets, id), {
    status: toStatus,
    version: ((snap.data()?.version as number) ?? 1) + 1,
    updated_by: changedBy,
    updated_at: nowIso(),
  });
  await addDoc(collection(db, COL.assetStatusHistory), {
    asset_id: id,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    changed_by_name: await getUserName(changedBy),
    changed_at: nowIso(),
    note: note ?? null,
  });
  await logAudit({ entityTable: "assets", entityId: id, action: `status_change:${fromStatus}->${toStatus}`, userId: changedBy, sessionId });
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
  const snap = await getDocs(query(collection(db, COL.assetStatusHistory), where("asset_id", "==", assetId), orderBy("changed_at", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssetStatusHistoryRow, "id">) }));
}
