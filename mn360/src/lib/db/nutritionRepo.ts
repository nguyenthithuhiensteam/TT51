import { dbExecute, dbSelect, nowIso } from "./client";
import { newId } from "../utils/id";
import { logAudit } from "./authRepo";
import type { Dish, DishCategory, InspectionStep, MenuRecord, RecordStatus } from "./types";

// ===================== MÓN ĂN =====================

export async function listDishes(search?: string): Promise<Dish[]> {
  if (search) {
    return dbSelect<Dish>(
      "SELECT * FROM dishes WHERE deleted_at IS NULL AND name LIKE ? ORDER BY name ASC",
      [`%${search}%`],
    );
  }
  return dbSelect<Dish>("SELECT * FROM dishes WHERE deleted_at IS NULL ORDER BY name ASC");
}

async function nextDishSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM dishes", []);
  return (rows[0]?.n ?? 0) + 1;
}

export async function createDish(
  name: string,
  category: DishCategory,
  energyKcal: number | undefined,
  ingredientsNote: string | undefined,
  allergensNote: string | undefined,
  createdBy: string,
): Promise<string> {
  const id = newId();
  const seq = await nextDishSequence();
  const code = `MA-${String(seq).padStart(4, "0")}`;
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO dishes (id, code, name, category, energy_kcal, ingredients_note, allergens_note,
      status, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [id, code, name, category, energyKcal ?? null, ingredientsNote ?? null, allergensNote ?? null, createdBy, ts, createdBy, ts],
  );
  return id;
}

// ===================== THỰC ĐƠN =====================

export interface MenuItemRow {
  id: string;
  dish_id: string;
  dish_name: string;
  meal_slot: DishCategory;
  allergens_note: string | null;
}

export interface MenuWithDetail extends MenuRecord {
  class_name: string | null;
  items: MenuItemRow[];
}

export async function getMenuForClassDate(
  classId: string,
  date: string,
): Promise<MenuWithDetail | null> {
  const rows = await dbSelect<MenuRecord & { class_name: string | null }>(
    `SELECT m.*, c.name AS class_name FROM menus m
     LEFT JOIN classes c ON c.id = m.class_id
     WHERE m.class_id = ? AND m.menu_date = ? AND m.deleted_at IS NULL`,
    [classId, date],
  );
  const menu = rows[0];
  if (!menu) return null;
  const items = await dbSelect<MenuItemRow>(
    `SELECT mi.id, mi.dish_id, d.name AS dish_name, mi.meal_slot, d.allergens_note
     FROM menu_items mi JOIN dishes d ON d.id = mi.dish_id
     WHERE mi.menu_id = ? ORDER BY mi.meal_slot`,
    [menu.id],
  );
  return { ...menu, items };
}

export async function getMenuById(menuId: string): Promise<MenuWithDetail | null> {
  const rows = await dbSelect<MenuRecord & { class_name: string | null }>(
    `SELECT m.*, c.name AS class_name FROM menus m
     LEFT JOIN classes c ON c.id = m.class_id
     WHERE m.id = ? AND m.deleted_at IS NULL`,
    [menuId],
  );
  const menu = rows[0];
  if (!menu) return null;
  const items = await dbSelect<MenuItemRow>(
    `SELECT mi.id, mi.dish_id, d.name AS dish_name, mi.meal_slot, d.allergens_note
     FROM menu_items mi JOIN dishes d ON d.id = mi.dish_id
     WHERE mi.menu_id = ? ORDER BY mi.meal_slot`,
    [menuId],
  );
  return { ...menu, items };
}

export interface ListMenusParams {
  fromDate: string;
  toDate: string;
  classId?: string;
}

export async function listMenus(params: ListMenusParams): Promise<MenuWithDetail[]> {
  const where = ["m.deleted_at IS NULL", "m.menu_date BETWEEN ? AND ?"];
  const args: unknown[] = [params.fromDate, params.toDate];
  if (params.classId) {
    where.push("m.class_id = ?");
    args.push(params.classId);
  }
  const menus = await dbSelect<MenuRecord & { class_name: string | null }>(
    `SELECT m.*, c.name AS class_name FROM menus m
     LEFT JOIN classes c ON c.id = m.class_id
     WHERE ${where.join(" AND ")}
     ORDER BY m.menu_date DESC`,
    args,
  );
  const result: MenuWithDetail[] = [];
  for (const menu of menus) {
    const items = await dbSelect<MenuItemRow>(
      `SELECT mi.id, mi.dish_id, d.name AS dish_name, mi.meal_slot, d.allergens_note
       FROM menu_items mi JOIN dishes d ON d.id = mi.dish_id
       WHERE mi.menu_id = ? ORDER BY mi.meal_slot`,
      [menu.id],
    );
    result.push({ ...menu, items });
  }
  return result;
}

async function nextMenuSequence(): Promise<number> {
  const rows = await dbSelect<{ n: number }>("SELECT COUNT(*) AS n FROM menus", []);
  return (rows[0]?.n ?? 0) + 1;
}

export interface SaveMenuInput {
  schoolYearId: string;
  classId: string;
  menuDate: string;
  items: { dishId: string; mealSlot: DishCategory }[];
  createdBy: string;
}

/** Tạo mới hoặc cập nhật thực đơn của một lớp trong một ngày, thay toàn bộ danh sách món. */
export async function saveMenu(input: SaveMenuInput): Promise<string> {
  const existing = await getMenuForClassDate(input.classId, input.menuDate);
  let menuId: string;
  const ts = nowIso();

  if (existing) {
    menuId = existing.id;
    await dbExecute(
      "UPDATE menus SET version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
      [input.createdBy, ts, menuId],
    );
    await dbExecute("DELETE FROM menu_items WHERE menu_id = ?", [menuId]);
  } else {
    menuId = newId();
    const seq = await nextMenuSequence();
    const year = new Date().getFullYear();
    const code = `TD-${year}-${String(seq).padStart(4, "0")}`;
    await dbExecute(
      `INSERT INTO menus (id, code, school_year_id, class_id, menu_date, status, version,
        created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`,
      [menuId, code, input.schoolYearId, input.classId, input.menuDate, input.createdBy, ts, input.createdBy, ts],
    );
  }

  for (const item of input.items) {
    await dbExecute(
      "INSERT INTO menu_items (id, menu_id, dish_id, meal_slot, created_at) VALUES (?, ?, ?, ?, ?)",
      [newId(), menuId, item.dishId, item.mealSlot, ts],
    );
  }

  return menuId;
}

export async function changeMenuStatus(
  menuId: string,
  toStatus: RecordStatus,
  action: "submit" | "approve" | "reject" | "publish",
  actorId: string,
  sessionId: string | null,
  comment?: string,
): Promise<void> {
  const menu = await getMenuById(menuId);
  if (!menu) throw new Error("Không tìm thấy thực đơn");
  await dbExecute(
    "UPDATE menus SET status = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?",
    [toStatus, actorId, nowIso(), menuId],
  );
  await dbExecute(
    `INSERT INTO approvals (id, entity_table, entity_id, step_no, approver_id, action, comment, from_status, to_status, acted_at)
     VALUES (?, 'menus', ?, 1, ?, ?, ?, ?, ?, ?)`,
    [newId(), menuId, actorId, action, comment ?? null, menu.status, toStatus, nowIso()],
  );
  await logAudit({
    entityTable: "menus",
    entityId: menuId,
    action: `status_change:${menu.status}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

/** Số trẻ ăn thực tế lấy trực tiếp từ điểm danh — không nhập lại thủ công. */
export async function getMealCountFromAttendance(classId: string, date: string): Promise<number> {
  const rows = await dbSelect<{ n: number }>(
    `SELECT COUNT(*) AS n FROM attendance
     WHERE class_id = ? AND attendance_date = ? AND status IN ('present', 'late')`,
    [classId, date],
  );
  return rows[0]?.n ?? 0;
}

export interface AllergyWarning {
  childName: string;
  allergies: string;
  dishName: string;
  allergensNote: string;
}

/**
 * Đối chiếu dị ứng của trẻ trong lớp với thành phần món ăn trong thực đơn.
 * Chỉ đưa ra cảnh báo để người có trách nhiệm (nuôi dưỡng/y tế) xác nhận, không tự động chặn.
 */
export async function checkAllergyWarnings(classId: string, menuId: string): Promise<AllergyWarning[]> {
  const menu = await getMenuById(menuId);
  if (!menu) return [];
  const children = await dbSelect<{ full_name: string; allergies: string }>(
    `SELECT ch.full_name, hr.allergies FROM children ch
     JOIN health_records hr ON hr.child_id = ch.id
     WHERE ch.class_id = ? AND ch.deleted_at IS NULL AND ch.status = 'studying'
     AND hr.allergies IS NOT NULL AND TRIM(hr.allergies) != ''`,
    [classId],
  );
  const warnings: AllergyWarning[] = [];
  for (const child of children) {
    for (const item of menu.items) {
      if (!item.allergens_note) continue;
      const allergyWords = child.allergies
        .split(/[,;/]/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
      const dishAllergens = item.allergens_note.toLowerCase();
      if (allergyWords.some((w) => dishAllergens.includes(w))) {
        warnings.push({
          childName: child.full_name,
          allergies: child.allergies,
          dishName: item.dish_name,
          allergensNote: item.allergens_note,
        });
      }
    }
  }
  return warnings;
}

// ===================== NHÀ CUNG CẤP & GIAO NHẬN =====================

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

export async function listSuppliers(): Promise<Supplier[]> {
  return dbSelect<Supplier>("SELECT * FROM suppliers ORDER BY name ASC");
}

export async function createSupplier(name: string, phone?: string, address?: string): Promise<void> {
  const ts = nowIso();
  await dbExecute(
    "INSERT INTO suppliers (id, name, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [newId(), name, phone ?? null, address ?? null, ts, ts],
  );
}

export interface FoodDeliveryRow {
  id: string;
  supplier_name: string;
  delivery_date: string;
  item_name: string;
  quantity: number;
  unit: string;
  total_price: number | null;
  received_by_name: string;
  note: string | null;
}

export async function listFoodDeliveries(fromDate: string, toDate: string): Promise<FoodDeliveryRow[]> {
  return dbSelect<FoodDeliveryRow>(
    `SELECT fd.id, s.name AS supplier_name, fd.delivery_date, fd.item_name, fd.quantity, fd.unit,
       fd.total_price, u.full_name AS received_by_name, fd.note
     FROM food_deliveries fd
     JOIN suppliers s ON s.id = fd.supplier_id
     JOIN users u ON u.id = fd.received_by
     WHERE fd.delivery_date BETWEEN ? AND ?
     ORDER BY fd.delivery_date DESC`,
    [fromDate, toDate],
  );
}

export async function createFoodDelivery(input: {
  supplierId: string;
  deliveryDate: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  receivedBy: string;
  note?: string;
}): Promise<void> {
  const totalPrice = input.unitPrice ? input.unitPrice * input.quantity : null;
  await dbExecute(
    `INSERT INTO food_deliveries (id, supplier_id, delivery_date, item_name, quantity, unit,
      unit_price, total_price, received_by, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      input.supplierId,
      input.deliveryDate,
      input.itemName,
      input.quantity,
      input.unit,
      input.unitPrice ?? null,
      totalPrice,
      input.receivedBy,
      input.note ?? null,
      nowIso(),
    ],
  );
}

// ===================== KIỂM THỰC BA BƯỚC =====================

export interface ThreeStepInspectionRow {
  id: string;
  step: InspectionStep;
  checked_by_name: string;
  checked_at: string;
  result: "dat" | "khong_dat";
  note: string | null;
}

export async function listThreeStepInspections(menuId: string): Promise<ThreeStepInspectionRow[]> {
  return dbSelect<ThreeStepInspectionRow>(
    `SELECT i.id, i.step, u.full_name AS checked_by_name, i.checked_at, i.result, i.note
     FROM three_step_inspections i JOIN users u ON u.id = i.checked_by
     WHERE i.menu_id = ? ORDER BY i.checked_at ASC`,
    [menuId],
  );
}

export async function recordThreeStepInspection(
  menuId: string,
  step: InspectionStep,
  checkedBy: string,
  result: "dat" | "khong_dat",
  note: string | undefined,
): Promise<void> {
  await dbExecute(
    `INSERT INTO three_step_inspections (id, menu_id, step, checked_by, checked_at, result, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(menu_id, step) DO UPDATE SET
       checked_by = excluded.checked_by, checked_at = excluded.checked_at,
       result = excluded.result, note = excluded.note`,
    [newId(), menuId, step, checkedBy, nowIso(), result, note ?? null],
  );
}
