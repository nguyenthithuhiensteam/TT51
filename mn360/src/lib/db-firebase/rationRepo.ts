import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { DailyRation, Food, FoodUnit, NutrientKey, NutritionGroup, NutritionNorm, RecordStatus } from "./types";

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return "";
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? "") : "";
}

// ===================== ĐỊNH MỨC TIỀN ĂN (lưu trong mn360_system_settings) =====================

const MEAL_FEE_SETTINGS_KEY = "meal_fee_rate_per_child_per_day";
const DEFAULT_MEAL_FEE_RATE = 20000;
const POLICY_CHECKLIST_SETTINGS_KEY = "nutrition_policy_checklist_state";

export async function getDefaultMealFeeRate(): Promise<number> {
  const snap = await getDoc(doc(db, COL.systemSettings, MEAL_FEE_SETTINGS_KEY));
  if (!snap.exists()) return DEFAULT_MEAL_FEE_RATE;
  const parsed = Number(snap.data().value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MEAL_FEE_RATE;
}

export async function setDefaultMealFeeRate(rate: number, userId: string): Promise<void> {
  await setDoc(doc(db, COL.systemSettings, MEAL_FEE_SETTINGS_KEY), {
    value: rate,
    updated_by: userId,
    updated_at: nowIso(),
  });
}

// ===================== THỰC PHẨM =====================

export async function listFoods(search?: string): Promise<Food[]> {
  const snap = await getDocs(collection(db, COL.foods));
  let items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Food, "id">) }))
    .filter((f) => !(f as unknown as { deleted_at?: string }).deleted_at);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter((f) => f.name.toLowerCase().includes(s));
  }
  return items.sort((a, b) => a.food_group.localeCompare(b.food_group, "vi") || a.name.localeCompare(b.name, "vi"));
}

export interface CreateFoodInput {
  name: string;
  foodGroup: string;
  unit: FoodUnit;
  protein: number;
  fat: number;
  carb: number;
  kcal: number;
  calcium?: number;
  iron?: number;
  vitaminA?: number;
  vitaminC?: number;
}

export async function createFood(input: CreateFoodInput, createdBy: string): Promise<string> {
  const countSnap = await getCountFromServer(collection(db, COL.foods));
  const code = `TP-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  const ref = await addDoc(collection(db, COL.foods), {
    code,
    name: input.name,
    food_group: input.foodGroup,
    unit: input.unit,
    protein_per_100: input.protein,
    fat_per_100: input.fat,
    carb_per_100: input.carb,
    kcal_per_100: input.kcal,
    calcium_per_100: input.calcium ?? 0,
    iron_per_100: input.iron ?? 0,
    vitamin_a_per_100: input.vitaminA ?? 0,
    vitamin_c_per_100: input.vitaminC ?? 0,
    status: "active",
    created_by: createdBy,
    created_at: ts,
    updated_by: createdBy,
    updated_at: ts,
  });
  return ref.id;
}

// ===================== ĐỊNH MỨC DINH DƯỠNG =====================

export async function getNutritionNorms(group: NutritionGroup): Promise<NutritionNorm[]> {
  const snap = await getDocs(query(collection(db, COL.nutritionNorms), where("nutrition_group", "==", group)));
  return snap.docs.map((d) => d.data() as NutritionNorm).sort((a, b) => a.nutrient_key.localeCompare(b.nutrient_key));
}

// ===================== KHẨU PHẦN NGÀY =====================

export async function getDailyRation(schoolYearId: string, date: string, group: NutritionGroup): Promise<DailyRation | null> {
  const snap = await getDocs(
    query(
      collection(db, COL.dailyRations),
      where("school_year_id", "==", schoolYearId),
      where("ration_date", "==", date),
      where("nutrition_group", "==", group),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<DailyRation, "id">) };
}

export async function getOrCreateDailyRation(
  schoolYearId: string,
  date: string,
  group: NutritionGroup,
  defaultFeeRate: number,
  createdBy: string,
): Promise<DailyRation> {
  const existing = await getDailyRation(schoolYearId, date, group);
  if (existing) return existing;

  const countSnap = await getCountFromServer(collection(db, COL.dailyRations));
  const year = new Date().getFullYear();
  const code = `KP-${year}-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  await addDoc(collection(db, COL.dailyRations), {
    code,
    school_year_id: schoolYearId,
    ration_date: date,
    nutrition_group: group,
    meal_fee_rate: defaultFeeRate,
    status: "draft" as RecordStatus,
    version: 1,
    created_by: createdBy,
    created_at: ts,
    updated_by: createdBy,
    updated_at: ts,
  });
  return (await getDailyRation(schoolYearId, date, group))!;
}

export interface RationItemRow {
  id: string;
  food_id: string;
  food_name: string;
  food_group: string;
  unit: FoodUnit;
  amount_per_child: number;
  unit_price: number;
}

export async function listRationItems(rationId: string): Promise<RationItemRow[]> {
  const snap = await getDocs(query(collection(db, COL.rationItems), where("ration_id", "==", rationId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<RationItemRow, "id">) }))
    .sort((a, b) => a.food_group.localeCompare(b.food_group, "vi") || a.food_name.localeCompare(b.food_name, "vi"));
}

export async function addRationItem(rationId: string, foodId: string, amountPerChild: number, unitPrice: number): Promise<void> {
  const foodSnap = await getDoc(doc(db, COL.foods, foodId));
  const food = foodSnap.data();
  await addDoc(collection(db, COL.rationItems), {
    ration_id: rationId,
    food_id: foodId,
    food_name: food?.name ?? "",
    food_group: food?.food_group ?? "",
    unit: food?.unit ?? "gam",
    amount_per_child: amountPerChild,
    unit_price: unitPrice,
    created_at: nowIso(),
  });
}

export async function updateRationItem(itemId: string, amountPerChild: number, unitPrice: number): Promise<void> {
  await updateDoc(doc(db, COL.rationItems, itemId), { amount_per_child: amountPerChild, unit_price: unitPrice });
}

export async function removeRationItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, COL.rationItems, itemId));
}

/** Số trẻ ăn thực tế của một nhóm tuổi trong ngày — Firestore không JOIN được nên tra lớp thuộc
 * nhóm tuổi trước rồi đếm điểm danh của các lớp đó. */
export async function getHeadcountForGroup(date: string, group: NutritionGroup): Promise<number> {
  const classesSnap = await getDocs(query(collection(db, COL.classes), where("nutrition_group", "==", group)));
  const classIds = classesSnap.docs.map((d) => d.id);
  if (classIds.length === 0) return 0;
  let count = 0;
  for (const classId of classIds) {
    const snap = await getDocs(
      query(collection(db, COL.attendance), where("class_id", "==", classId), where("attendance_date", "==", date)),
    );
    count += snap.docs.filter((d) => ["present", "late"].includes(d.data().status)).length;
  }
  return count;
}

export type NutritionTotals = Record<NutrientKey, number>;

const NUTRIENT_COLUMN: Record<NutrientKey, keyof Food> = {
  kcal: "kcal_per_100",
  protein: "protein_per_100",
  fat: "fat_per_100",
  carb: "carb_per_100",
  calcium: "calcium_per_100",
  iron: "iron_per_100",
  vitamin_a: "vitamin_a_per_100",
  vitamin_c: "vitamin_c_per_100",
};

export function computeNutritionTotals(
  items: {
    amount_per_child: number;
    kcal_per_100: number;
    protein_per_100: number;
    fat_per_100: number;
    carb_per_100: number;
    calcium_per_100: number;
    iron_per_100: number;
    vitamin_a_per_100: number;
    vitamin_c_per_100: number;
  }[],
): NutritionTotals {
  const totals: NutritionTotals = { kcal: 0, protein: 0, fat: 0, carb: 0, calcium: 0, iron: 0, vitamin_a: 0, vitamin_c: 0 };
  for (const item of items) {
    (Object.keys(NUTRIENT_COLUMN) as NutrientKey[]).forEach((key) => {
      const per100 = item[NUTRIENT_COLUMN[key] as keyof typeof item] as number;
      totals[key] += (per100 * item.amount_per_child) / 100;
    });
  }
  return totals;
}

export type NutrientStatus = "ok" | "under" | "over";

export function statusForNutrient(value: number, norm: NutritionNorm | undefined): NutrientStatus {
  if (!norm) return "ok";
  if (norm.max_value !== null && value > norm.max_value) return "over";
  if (norm.min_value !== null && value < norm.min_value) return "under";
  return "ok";
}

export function computeItemCost(item: { amount_per_child: number; unit_price: number; unit: FoodUnit }, headcount: number): number {
  if (item.unit === "hop") {
    return Math.round(item.amount_per_child * headcount * item.unit_price);
  }
  return Math.round(((item.amount_per_child * headcount) / 1000) * item.unit_price);
}

// ===================== TỔNG HỢP TUẦN =====================

export interface WeeklyRationGroupDay {
  headcount: number;
  cost: number;
  hasData: boolean;
}

export interface WeeklyRationDay {
  date: string;
  nhaTre: WeeklyRationGroupDay;
  mauGiao: WeeklyRationGroupDay;
}

export async function getWeeklyRationSummary(schoolYearId: string, weekStartDate: string): Promise<WeeklyRationDay[]> {
  const days: WeeklyRationDay[] = [];
  const start = new Date(`${weekStartDate}T00:00:00`);
  for (let i = 0; i < 6; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const groupData: Record<NutritionGroup, WeeklyRationGroupDay> = {
      nha_tre: { headcount: 0, cost: 0, hasData: false },
      mau_giao: { headcount: 0, cost: 0, hasData: false },
    };
    for (const group of ["nha_tre", "mau_giao"] as NutritionGroup[]) {
      const headcount = await getHeadcountForGroup(date, group);
      const ration = await getDailyRation(schoolYearId, date, group);
      let cost = 0;
      let hasData = false;
      if (ration) {
        const items = await listRationItems(ration.id);
        if (items.length > 0) {
          hasData = true;
          cost = items.reduce((sum, item) => sum + computeItemCost(item, headcount), 0);
        }
      }
      groupData[group] = { headcount, cost, hasData };
    }
    days.push({ date, nhaTre: groupData.nha_tre, mauGiao: groupData.mau_giao });
  }
  return days;
}

// ===================== BIỂU IN "BẢNG TÍNH ĂN HÀNG NGÀY" =====================

export interface CombinedRationRow {
  foodId: string;
  foodName: string;
  foodGroup: string;
  unit: FoodUnit;
  nt: { amountPerChild: number; unitPrice: number; cost: number } | null;
  mg: { amountPerChild: number; unitPrice: number; cost: number } | null;
}

export interface CombinedDailyReport {
  date: string;
  headcountNT: number;
  headcountMG: number;
  ntRation: DailyRation | null;
  mgRation: DailyRation | null;
  rows: CombinedRationRow[];
  totalCostNT: number;
  totalCostMG: number;
  budgetNT: number;
  budgetMG: number;
}

export async function getCombinedDailyReport(schoolYearId: string, date: string): Promise<CombinedDailyReport> {
  const headcountNT = await getHeadcountForGroup(date, "nha_tre");
  const headcountMG = await getHeadcountForGroup(date, "mau_giao");
  const ntRation = await getDailyRation(schoolYearId, date, "nha_tre");
  const mgRation = await getDailyRation(schoolYearId, date, "mau_giao");
  const ntItems = ntRation ? await listRationItems(ntRation.id) : [];
  const mgItems = mgRation ? await listRationItems(mgRation.id) : [];

  const rowMap = new Map<string, CombinedRationRow>();
  function ensureRow(item: RationItemRow): CombinedRationRow {
    let row = rowMap.get(item.food_id);
    if (!row) {
      row = { foodId: item.food_id, foodName: item.food_name, foodGroup: item.food_group, unit: item.unit, nt: null, mg: null };
      rowMap.set(item.food_id, row);
    }
    return row;
  }
  ntItems.forEach((item) => {
    ensureRow(item).nt = { amountPerChild: item.amount_per_child, unitPrice: item.unit_price, cost: computeItemCost(item, headcountNT) };
  });
  mgItems.forEach((item) => {
    ensureRow(item).mg = { amountPerChild: item.amount_per_child, unitPrice: item.unit_price, cost: computeItemCost(item, headcountMG) };
  });

  return {
    date,
    headcountNT,
    headcountMG,
    ntRation,
    mgRation,
    rows: [...rowMap.values()],
    totalCostNT: ntItems.reduce((sum, item) => sum + computeItemCost(item, headcountNT), 0),
    totalCostMG: mgItems.reduce((sum, item) => sum + computeItemCost(item, headcountMG), 0),
    budgetNT: headcountNT * (ntRation?.meal_fee_rate ?? 0),
    budgetMG: headcountMG * (mgRation?.meal_fee_rate ?? 0),
  };
}

// ===================== CHECKLIST CHÍNH SÁCH =====================

export async function getPolicyChecklistState(): Promise<Record<number, boolean>> {
  const snap = await getDoc(doc(db, COL.systemSettings, POLICY_CHECKLIST_SETTINGS_KEY));
  if (!snap.exists()) return {};
  return (snap.data().value as Record<number, boolean>) ?? {};
}

export async function setPolicyChecklistItem(index: number, checked: boolean, userId: string): Promise<void> {
  const current = await getPolicyChecklistState();
  current[index] = checked;
  await setDoc(doc(db, COL.systemSettings, POLICY_CHECKLIST_SETTINGS_KEY), {
    value: current,
    updated_by: userId,
    updated_at: nowIso(),
  });
}

export async function changeRationStatus(
  rationId: string,
  toStatus: RecordStatus,
  action: "submit" | "approve" | "reject",
  actorId: string,
  sessionId: string | null,
  comment?: string,
): Promise<void> {
  const snap = await getDoc(doc(db, COL.dailyRations, rationId));
  if (!snap.exists()) throw new Error("Không tìm thấy khẩu phần");
  const ration = snap.data() as DailyRation;
  await updateDoc(doc(db, COL.dailyRations, rationId), { status: toStatus, version: ration.version + 1, updated_by: actorId, updated_at: nowIso() });
  await addDoc(collection(db, COL.planApprovals), {
    plan_id: rationId,
    approver_id: actorId,
    approver_name: await getUserName(actorId),
    action,
    comment: comment ?? null,
    from_status: ration.status,
    to_status: toStatus,
    acted_at: nowIso(),
  });
  await logAudit({
    entityTable: "daily_rations",
    entityId: rationId,
    action: `status_change:${ration.status}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}
