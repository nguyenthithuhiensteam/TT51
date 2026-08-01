import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { COL, db, nowIso } from "./client";
import { logAudit } from "./authRepo";
import type { Dish, DishCategory, InspectionStep, MenuRecord, RecordStatus } from "./types";

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return "";
  const snap = await getDoc(doc(db, COL.users, userId));
  return snap.exists() ? ((snap.data().full_name as string) ?? "") : "";
}

// ===================== MÓN ĂN =====================

export async function listDishes(search?: string): Promise<Dish[]> {
  const snap = await getDocs(collection(db, COL.dishes));
  let items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Dish, "id">) }))
    .filter((d) => !(d as unknown as { deleted_at?: string }).deleted_at);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter((d) => d.name.toLowerCase().includes(s));
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function createDish(
  name: string,
  category: DishCategory,
  energyKcal: number | undefined,
  ingredientsNote: string | undefined,
  allergensNote: string | undefined,
  createdBy: string,
): Promise<string> {
  const countSnap = await getCountFromServer(collection(db, COL.dishes));
  const code = `MA-${String(countSnap.data().count + 1).padStart(4, "0")}`;
  const ts = nowIso();
  const ref = await addDoc(collection(db, COL.dishes), {
    code,
    name,
    category,
    energy_kcal: energyKcal ?? null,
    ingredients_note: ingredientsNote ?? null,
    allergens_note: allergensNote ?? null,
    status: "active",
    created_by: createdBy,
    created_at: ts,
    updated_by: createdBy,
    updated_at: ts,
  });
  return ref.id;
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

async function loadMenuItems(menuId: string): Promise<MenuItemRow[]> {
  const snap = await getDocs(query(collection(db, COL.menuItems), where("menu_id", "==", menuId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItemRow, "id">) }))
    .sort((a, b) => a.meal_slot.localeCompare(b.meal_slot));
}

async function mapMenuDoc(d: { id: string; data: () => Record<string, unknown> }): Promise<MenuWithDetail> {
  const data = d.data() as Omit<MenuWithDetail, "id" | "items">;
  return { id: d.id, ...data, items: await loadMenuItems(d.id) };
}

export async function getMenuForClassDate(classId: string, date: string): Promise<MenuWithDetail | null> {
  const snap = await getDocs(
    query(collection(db, COL.menus), where("class_id", "==", classId), where("menu_date", "==", date)),
  );
  const found = snap.docs.find((d) => !d.data().deleted_at);
  return found ? mapMenuDoc(found) : null;
}

export async function getMenuById(menuId: string): Promise<MenuWithDetail | null> {
  const snap = await getDoc(doc(db, COL.menus, menuId));
  if (!snap.exists() || snap.data().deleted_at) return null;
  return mapMenuDoc(snap);
}

export interface ListMenusParams {
  fromDate: string;
  toDate: string;
  classId?: string;
}

export async function listMenus(params: ListMenusParams): Promise<MenuWithDetail[]> {
  const constraints = [where("menu_date", ">=", params.fromDate), where("menu_date", "<=", params.toDate)];
  if (params.classId) constraints.push(where("class_id", "==", params.classId));
  const snap = await getDocs(query(collection(db, COL.menus), ...constraints));
  const menus = snap.docs.filter((d) => !d.data().deleted_at);
  const result = await Promise.all(menus.map(mapMenuDoc));
  return result.sort((a, b) => b.menu_date.localeCompare(a.menu_date));
}

export interface SaveMenuInput {
  schoolYearId: string;
  classId: string;
  menuDate: string;
  items: { dishId: string; mealSlot: DishCategory }[];
  createdBy: string;
}

export async function saveMenu(input: SaveMenuInput): Promise<string> {
  const existing = await getMenuForClassDate(input.classId, input.menuDate);
  let menuId: string;
  const ts = nowIso();

  if (existing) {
    menuId = existing.id;
    await updateDoc(doc(db, COL.menus, menuId), { version: existing.version + 1, updated_by: input.createdBy, updated_at: ts });
    // Firestore không có DELETE WHERE — xoá từng tài liệu món cũ trước khi ghi lại danh sách mới.
    const oldItems = await loadMenuItems(menuId);
    await Promise.all(oldItems.map((it) => deleteDoc(doc(db, COL.menuItems, it.id))));
  } else {
    const countSnap = await getCountFromServer(collection(db, COL.menus));
    const code = `TD-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, "0")}`;
    const ref = await addDoc(collection(db, COL.menus), {
      code,
      school_year_id: input.schoolYearId,
      class_id: input.classId,
      menu_date: input.menuDate,
      status: "draft" as RecordStatus,
      note: null,
      version: 1,
      created_by: input.createdBy,
      created_at: ts,
      updated_by: input.createdBy,
      updated_at: ts,
    });
    menuId = ref.id;
  }

  for (const item of input.items) {
    const dishSnap = await getDoc(doc(db, COL.dishes, item.dishId));
    await addDoc(collection(db, COL.menuItems), {
      menu_id: menuId,
      dish_id: item.dishId,
      dish_name: dishSnap.exists() ? (dishSnap.data().name as string) : "",
      meal_slot: item.mealSlot,
      allergens_note: dishSnap.exists() ? ((dishSnap.data().allergens_note as string) ?? null) : null,
      created_at: ts,
    });
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
  await updateDoc(doc(db, COL.menus, menuId), { status: toStatus, version: menu.version + 1, updated_by: actorId, updated_at: nowIso() });
  await addDoc(collection(db, COL.planApprovals), {
    plan_id: menuId,
    approver_id: actorId,
    approver_name: await getUserName(actorId),
    action,
    comment: comment ?? null,
    from_status: menu.status,
    to_status: toStatus,
    acted_at: nowIso(),
  });
  await logAudit({
    entityTable: "menus",
    entityId: menuId,
    action: `status_change:${menu.status}->${toStatus}`,
    userId: actorId,
    sessionId,
  });
}

export async function getMealCountFromAttendance(classId: string, date: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, COL.attendance), where("class_id", "==", classId), where("attendance_date", "==", date)),
  );
  return snap.docs.filter((d) => ["present", "late"].includes(d.data().status)).length;
}

export interface AllergyWarning {
  childName: string;
  allergies: string;
  dishName: string;
  allergensNote: string;
}

/** Sẽ luôn trả về [] cho tới khi phân hệ Sức khỏe (mn360_health_records) được chuyển đổi —
 * không lỗi, chỉ chưa có dữ liệu dị ứng để đối chiếu. */
export async function checkAllergyWarnings(classId: string, menuId: string): Promise<AllergyWarning[]> {
  const menu = await getMenuById(menuId);
  if (!menu) return [];
  const childrenSnap = await getDocs(
    query(collection(db, COL.children), where("class_id", "==", classId), where("status", "==", "studying")),
  );
  const warnings: AllergyWarning[] = [];
  for (const childDoc of childrenSnap.docs) {
    const hrSnap = await getDocs(query(collection(db, COL.healthRecords), where("child_id", "==", childDoc.id)));
    const allergies = hrSnap.docs[0]?.data().allergies as string | undefined;
    if (!allergies || !allergies.trim()) continue;
    for (const item of menu.items) {
      if (!item.allergens_note) continue;
      const allergyWords = allergies.split(/[,;/]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
      const dishAllergens = item.allergens_note.toLowerCase();
      if (allergyWords.some((w) => dishAllergens.includes(w))) {
        warnings.push({
          childName: childDoc.data().full_name as string,
          allergies,
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
  const snap = await getDocs(query(collection(db, COL.suppliers), orderBy("name", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, "id">) }));
}

export async function createSupplier(name: string, phone?: string, address?: string): Promise<void> {
  const ts = nowIso();
  await addDoc(collection(db, COL.suppliers), { name, phone: phone ?? null, address: address ?? null, created_at: ts, updated_at: ts });
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
  const snap = await getDocs(
    query(collection(db, COL.foodDeliveries), where("delivery_date", ">=", fromDate), where("delivery_date", "<=", toDate)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<FoodDeliveryRow, "id">) }))
    .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date));
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
  const supplierSnap = await getDoc(doc(db, COL.suppliers, input.supplierId));
  await addDoc(collection(db, COL.foodDeliveries), {
    supplier_id: input.supplierId,
    supplier_name: supplierSnap.exists() ? (supplierSnap.data().name as string) : "",
    delivery_date: input.deliveryDate,
    item_name: input.itemName,
    quantity: input.quantity,
    unit: input.unit,
    unit_price: input.unitPrice ?? null,
    total_price: totalPrice,
    received_by: input.receivedBy,
    received_by_name: await getUserName(input.receivedBy),
    note: input.note ?? null,
    created_at: nowIso(),
  });
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

function inspectionDocId(menuId: string, step: InspectionStep): string {
  return `${menuId}_${step}`;
}

export async function listThreeStepInspections(menuId: string): Promise<ThreeStepInspectionRow[]> {
  const snap = await getDocs(
    query(collection(db, COL.threeStepInspections), where("menu_id", "==", menuId), orderBy("checked_at", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ThreeStepInspectionRow, "id">) }));
}

export async function recordThreeStepInspection(
  menuId: string,
  step: InspectionStep,
  checkedBy: string,
  result: "dat" | "khong_dat",
  note: string | undefined,
): Promise<void> {
  await setDoc(doc(db, COL.threeStepInspections, inspectionDocId(menuId, step)), {
    menu_id: menuId,
    step,
    checked_by: checkedBy,
    checked_by_name: await getUserName(checkedBy),
    checked_at: nowIso(),
    result,
    note: note ?? null,
  });
}
