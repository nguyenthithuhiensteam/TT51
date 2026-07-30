import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type {
  DailyRation,
  Food,
  FoodUnit,
  NutrientKey,
  NutritionGroup,
  NutritionNorm,
  RecordStatus,
} from "./types";

// ===================== ĐỊNH MỨC TIỀN ĂN =====================

const MEAL_FEE_SETTINGS_KEY = "meal_fee_rate_per_child_per_day";
const DEFAULT_MEAL_FEE_RATE = 20000;

export async function getDefaultMealFeeRate(): Promise<number> {
  const rows = await dbSelect<{ value_json: string }>(
    "SELECT value_json FROM system_settings WHERE key = ?",
    [MEAL_FEE_SETTINGS_KEY],
  );
  if (!rows[0]) return DEFAULT_MEAL_FEE_RATE;
  const parsed = Number(JSON.parse(rows[0].value_json));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MEAL_FEE_RATE;
}

export async function setDefaultMealFeeRate(rate: number, userId: string): Promise<void> {
  await dbExecute(
    `INSERT INTO system_settings (id, key, value_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    [newId(), MEAL_FEE_SETTINGS_KEY, JSON.stringify(rate), userId, nowIso()],
  );
}

// ===================== THỰC PHẨM =====================

export async function listFoods(search?: string): Promise<Food[]> {
  if (search) {
    return dbSelect<Food>(
      "SELECT * FROM foods WHERE deleted_at IS NULL AND name LIKE ? ORDER BY food_group, name ASC",
      [`%${search}%`],
    );
  }
  return dbSelect<Food>("SELECT * FROM foods WHERE deleted_at IS NULL ORDER BY food_group, name ASC");
}

async function nextFoodSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM foods", []);
  return (rows[0]?.n ?? 0) + 1;
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
  const id = newId();
  const seq = await nextFoodSequence();
  const code = `TP-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO foods (id, code, name, food_group, unit, protein_per_100, fat_per_100, carb_per_100,
      kcal_per_100, calcium_per_100, iron_per_100, vitamin_a_per_100, vitamin_c_per_100,
      status, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [
      id,
      code,
      input.name,
      input.foodGroup,
      input.unit,
      input.protein,
      input.fat,
      input.carb,
      input.kcal,
      input.calcium ?? 0,
      input.iron ?? 0,
      input.vitaminA ?? 0,
      input.vitaminC ?? 0,
      createdBy,
      ts,
      createdBy,
      ts,
    ],
  );
  return id;
}

// ===================== ĐỊNH MỨC DINH DƯỠNG =====================

export async function getNutritionNorms(group: NutritionGroup): Promise<NutritionNorm[]> {
  return dbSelect<NutritionNorm>(
    "SELECT * FROM nutrition_norms WHERE nutrition_group = ? ORDER BY nutrient_key",
    [group],
  );
}

// ===================== KHẨU PHẦN NGÀY =====================

async function nextRationSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM daily_rations", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function getDailyRation(
  schoolYearId: string,
  date: string,
  group: NutritionGroup,
): Promise<DailyRation | null> {
  const rows = await dbSelect<DailyRation>(
    "SELECT * FROM daily_rations WHERE school_year_id = ? AND ration_date = ? AND nutrition_group = ?",
    [schoolYearId, date, group],
  );
  return rows[0] ?? null;
}

/** Lấy khẩu phần ngày của một nhóm tuổi, tự tạo bản nháp mới nếu chưa có. */
export async function getOrCreateDailyRation(
  schoolYearId: string,
  date: string,
  group: NutritionGroup,
  defaultFeeRate: number,
  createdBy: string,
): Promise<DailyRation> {
  const existing = await getDailyRation(schoolYearId, date, group);
  if (existing) return existing;

  const id = newId();
  const seq = await nextRationSequence();
  const year = new Date().getFullYear();
  const code = `KP-${year}-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO daily_rations (id, code, school_year_id, ration_date, nutrition_group, meal_fee_rate,
      status, version, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`,
    [id, code, schoolYearId, date, group, defaultFeeRate, createdBy, ts, createdBy, ts],
  );
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
  return dbSelect<RationItemRow>(
    `SELECT ri.id, ri.food_id, f.name AS food_name, f.food_group, f.unit,
       ri.amount_per_child, ri.unit_price
     FROM ration_items ri JOIN foods f ON f.id = ri.food_id
     WHERE ri.ration_id = ?
     ORDER BY f.food_group, f.name`,
    [rationId],
  );
}

export async function addRationItem(
  rationId: string,
  foodId: string,
  amountPerChild: number,
  unitPrice: number,
): Promise<void> {
  await dbExecute(
    "INSERT INTO ration_items (id, ration_id, food_id, amount_per_child, unit_price, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [newId(), rationId, foodId, amountPerChild, unitPrice, nowIso()],
  );
}

export async function updateRationItem(
  itemId: string,
  amountPerChild: number,
  unitPrice: number,
): Promise<void> {
  await dbExecute("UPDATE ration_items SET amount_per_child = ?, unit_price = ? WHERE id = ?", [
    amountPerChild,
    unitPrice,
    itemId,
  ]);
}

export async function removeRationItem(itemId: string): Promise<void> {
  await dbExecute("DELETE FROM ration_items WHERE id = ?", [itemId]);
}

/** Số trẻ ăn thực tế của một nhóm tuổi trong ngày — lấy trực tiếp từ điểm danh, không nhập lại. */
export async function getHeadcountForGroup(date: string, group: NutritionGroup): Promise<number> {
  const rows = await dbSelect<{ n: number }>(
    `SELECT COUNT(*) AS n FROM attendance a
     JOIN classes c ON c.id = a.class_id
     WHERE a.attendance_date = ? AND c.nutrition_group = ? AND a.status IN ('present', 'late')`,
    [date, group],
  );
  return rows[0]?.n ?? 0;
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

/** Tính tổng dinh dưỡng trên một trẻ/ngày từ danh sách thực phẩm đã nhập. */
export function computeNutritionTotals(
  items: { amount_per_child: number; kcal_per_100: number; protein_per_100: number; fat_per_100: number; carb_per_100: number; calcium_per_100: number; iron_per_100: number; vitamin_a_per_100: number; vitamin_c_per_100: number }[],
): NutritionTotals {
  const totals: NutritionTotals = {
    kcal: 0,
    protein: 0,
    fat: 0,
    carb: 0,
    calcium: 0,
    iron: 0,
    vitamin_a: 0,
    vitamin_c: 0,
  };
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

/**
 * Tính chi phí một dòng thực phẩm: đơn vị "hộp" tính theo số hộp/trẻ * đơn giá/hộp;
 * đơn vị gam/ml tính theo gam/trẻ * đơn giá/kg (đơn giá nhập theo kg nên chia 1000).
 */
export function computeItemCost(
  item: { amount_per_child: number; unit_price: number; unit: FoodUnit },
  headcount: number,
): number {
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

/** Tổng hợp 6 ngày (Thứ 2 → Thứ 7) kể từ ngày bắt đầu tuần — dùng cho tab Tổng hợp tuần. */
export async function getWeeklyRationSummary(
  schoolYearId: string,
  weekStartDate: string,
): Promise<WeeklyRationDay[]> {
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

/** Gộp khẩu phần Nhà trẻ + Mẫu giáo của một ngày thành một bảng — dùng để in "Bảng tính ăn hàng ngày". */
export async function getCombinedDailyReport(
  schoolYearId: string,
  date: string,
): Promise<CombinedDailyReport> {
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
      row = {
        foodId: item.food_id,
        foodName: item.food_name,
        foodGroup: item.food_group,
        unit: item.unit,
        nt: null,
        mg: null,
      };
      rowMap.set(item.food_id, row);
    }
    return row;
  }
  ntItems.forEach((item) => {
    ensureRow(item).nt = {
      amountPerChild: item.amount_per_child,
      unitPrice: item.unit_price,
      cost: computeItemCost(item, headcountNT),
    };
  });
  mgItems.forEach((item) => {
    ensureRow(item).mg = {
      amountPerChild: item.amount_per_child,
      unitPrice: item.unit_price,
      cost: computeItemCost(item, headcountMG),
    };
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

const POLICY_CHECKLIST_SETTINGS_KEY = "nutrition_policy_checklist_state";

export async function getPolicyChecklistState(): Promise<Record<number, boolean>> {
  const rows = await dbSelect<{ value_json: string }>(
    "SELECT value_json FROM system_settings WHERE key = ?",
    [POLICY_CHECKLIST_SETTINGS_KEY],
  );
  if (!rows[0]) return {};
  try {
    return JSON.parse(rows[0].value_json) as Record<number, boolean>;
  } catch {
    return {};
  }
}

export async function setPolicyChecklistItem(index: number, checked: boolean, userId: string): Promise<void> {
  const current = await getPolicyChecklistState();
  current[index] = checked;
  await dbExecute(
    `INSERT INTO system_settings (id, key, value_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    [newId(), POLICY_CHECKLIST_SETTINGS_KEY, JSON.stringify(current), userId, nowIso()],
  );
}

export async function changeRationStatus(
  rationId: string,
  toStatus: RecordStatus,
  action: "submit" | "approve" | "reject",
  actorId: string,
  sessionId: string | null,
  comment?: string,
): Promise<void> {
  const rows = await dbSelect<DailyRation>("SELECT * FROM daily_rations WHERE id = ?", [rationId]);
  const ration = rows[0];
  if (!ration) throw new Error("Không tìm thấy khẩu phần");
  await dbExecute(
    "UPDATE daily_rations SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, actorId, nowIso(), rationId],
  );
  await dbExecute(
    `INSERT INTO approvals (id, entity_table, entity_id, step_no, approver_id, action, comment, from_status, to_status, acted_at)
     VALUES (?, 'daily_rations', ?, 1, ?, ?, ?, ?, ?, ?)`,
    [newId(), rationId, actorId, action, comment ?? null, ration.status, toStatus, nowIso()],
  );
  await logAudit({
    entityTable: "daily_rations",
    entityId: rationId,
    action: `status_change:${ration.status}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}
