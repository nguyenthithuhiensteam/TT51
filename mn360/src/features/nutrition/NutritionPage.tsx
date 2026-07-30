import { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import { listClasses, type ClassWithTeacher } from "../../lib/db/childRepo";
import {
  checkAllergyWarnings,
  createDish,
  createFoodDelivery,
  createSupplier,
  getMealCountFromAttendance,
  getMenuForClassDate,
  changeMenuStatus,
  listDishes,
  listFoodDeliveries,
  listSuppliers,
  listThreeStepInspections,
  recordThreeStepInspection,
  saveMenu,
  type AllergyWarning,
  type FoodDeliveryRow,
  type MenuWithDetail,
  type Supplier,
  type ThreeStepInspectionRow,
} from "../../lib/db/nutritionRepo";
import {
  MEAL_SLOT_LABELS,
  INSPECTION_STEP_LABELS,
  type Dish,
  type DishCategory,
  type RecordStatus,
} from "../../lib/db/types";

import { MealRationTab } from "./MealRationTab";

type Tab = "menu" | "ration" | "dishes" | "delivery";

interface MenuAction {
  label: string;
  toStatus: RecordStatus;
  action: "submit" | "approve" | "reject";
  requiresComment?: boolean;
  variant?: "primary" | "danger" | "success";
}

const MENU_ACTIONS: Record<string, MenuAction[]> = {
  draft: [{ label: "Gửi duyệt", toStatus: "pending_approval", action: "submit" }],
  pending_approval: [
    { label: "Duyệt thực đơn", toStatus: "approved", action: "approve", variant: "success" },
    {
      label: "Yêu cầu điều chỉnh",
      toStatus: "needs_revision",
      action: "reject",
      requiresComment: true,
      variant: "danger",
    },
  ],
  needs_revision: [{ label: "Gửi duyệt lại", toStatus: "pending_approval", action: "submit" }],
};

export function NutritionPage() {
  const [tab, setTab] = useState<Tab>("menu");
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);

  useEffect(() => {
    if (schoolYear) listClasses(schoolYear.id).then(setClasses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Nuôi dưỡng</h1>
        <p className="text-sm text-navy/60">
          Số trẻ ăn lấy trực tiếp từ điểm danh; cảnh báo dị ứng cần người có trách nhiệm xác nhận.
        </p>
      </div>
      <div className="flex gap-1 border-b border-navy/10">
        {(
          [
            ["menu", "Thực đơn"],
            ["ration", "Khẩu phần dinh dưỡng"],
            ["dishes", "Ngân hàng món ăn"],
            ["delivery", "Giao nhận thực phẩm"],
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
      {tab === "menu" && <MenuTab classes={classes} />}
      {tab === "ration" && <MealRationTab />}
      {tab === "dishes" && <DishesTab />}
      {tab === "delivery" && <DeliveryTab />}
    </div>
  );
}

function MenuTab({ classes }: { classes: ClassWithTeacher[] }) {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [menu, setMenu] = useState<MenuWithDetail | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [mealCount, setMealCount] = useState(0);
  const [warnings, setWarnings] = useState<AllergyWarning[]>([]);
  const [inspections, setInspections] = useState<ThreeStepInspectionRow[]>([]);
  const [addSlot, setAddSlot] = useState<DishCategory>("lunch");
  const [addDishId, setAddDishId] = useState("");
  const [actionModal, setActionModal] = useState<MenuAction | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);

  useEffect(() => {
    listDishes().then(setDishes);
  }, []);

  async function refresh() {
    if (!classId || !date) return;
    const m = await getMenuForClassDate(classId, date);
    setMenu(m);
    setMealCount(await getMealCountFromAttendance(classId, date));
    if (m) {
      setWarnings(await checkAllergyWarnings(classId, m.id));
      setInspections(await listThreeStepInspections(m.id));
    } else {
      setWarnings([]);
      setInspections([]);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  const availableActions = (MENU_ACTIONS[menu?.status ?? ""] ?? []).filter((a) =>
    hasPermission(a.action === "submit" ? "nutrition.create" : "nutrition.approve"),
  );

  async function handleAddDish() {
    if (!user || !schoolYear || !classId || !addDishId) return;
    setBusy(true);
    try {
      const items = (menu?.items ?? []).map((i) => ({ dishId: i.dish_id, mealSlot: i.meal_slot }));
      items.push({ dishId: addDishId, mealSlot: addSlot });
      await saveMenu({ schoolYearId: schoolYear.id, classId, menuDate: date, items, createdBy: user.id });
      setAddDishId("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: MenuAction) {
    if (!user || !menu) return;
    setBusy(true);
    try {
      await changeMenuStatus(
        menu.id,
        action.toStatus,
        action.action,
        user.id,
        sessionId,
        action.requiresComment ? actionComment : undefined,
      );
      setActionModal(null);
      setActionComment("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Select className="w-56" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input type="date" className="w-48" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="text-sm text-navy/60">
            Số trẻ ăn thực tế (theo điểm danh): <strong>{mealCount}</strong>
          </span>
          {menu && <StatusBadge status={menu.status} />}
          <div className="ml-auto flex gap-2">
            {availableActions.map((a) => (
              <Button
                key={a.label}
                size="sm"
                variant={a.variant ?? "primary"}
                disabled={busy}
                onClick={() => (a.requiresComment ? setActionModal(a) : runAction(a))}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mb-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            <p className="mb-1 font-semibold">Cảnh báo dị ứng — cần xác nhận trước khi duyệt:</p>
            <ul className="list-disc pl-5">
              {warnings.map((w, idx) => (
                <li key={idx}>
                  {w.childName} dị ứng "{w.allergies}" — món "{w.dishName}" có thành phần{" "}
                  {w.allergensNote}
                </li>
              ))}
            </ul>
          </div>
        )}

        <table className="mb-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-2 font-medium">Bữa</th>
              <th className="pb-2 font-medium">Món ăn</th>
              <th className="pb-2 font-medium">Thành phần dị ứng</th>
            </tr>
          </thead>
          <tbody>
            {(menu?.items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-navy/5">
                <td className="py-2">{MEAL_SLOT_LABELS[item.meal_slot]}</td>
                <td className="py-2">{item.dish_name}</td>
                <td className="py-2 text-navy/60">{item.allergens_note ?? "—"}</td>
              </tr>
            ))}
            {(menu?.items ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-navy/50">
                  Chưa có món ăn trong thực đơn.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {hasPermission("nutrition.create") && (!menu || menu.status === "draft" || menu.status === "needs_revision") && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Bữa">
              <Select value={addSlot} onChange={(e) => setAddSlot(e.target.value as DishCategory)}>
                {Object.entries(MEAL_SLOT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Món ăn">
              <Select value={addDishId} onChange={(e) => setAddDishId(e.target.value)} className="w-64">
                <option value="">-- Chọn món --</option>
                {dishes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button size="sm" disabled={!addDishId || busy} onClick={handleAddDish}>
              <Plus size={14} /> Thêm vào thực đơn
            </Button>
          </div>
        )}
      </Card>

      {menu && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Kiểm thực ba bước</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(["before_processing", "before_eating", "sample_storage"] as const).map((step) => {
              const existing = inspections.find((i) => i.step === step);
              return (
                <div key={step} className="rounded-lg border border-navy/10 p-3">
                  <p className="mb-2 text-sm font-medium text-navy">{INSPECTION_STEP_LABELS[step]}</p>
                  {existing ? (
                    <div className="text-sm">
                      <p className={existing.result === "dat" ? "text-mint" : "text-danger"}>
                        {existing.result === "dat" ? "Đạt" : "Không đạt"}
                      </p>
                      <p className="text-xs text-navy/50">
                        {existing.checked_by_name} · {new Date(existing.checked_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  ) : (
                    hasPermission("nutrition.edit") && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={async () => {
                            if (!user) return;
                            await recordThreeStepInspection(menu.id, step, user.id, "dat", undefined);
                            refresh();
                          }}
                        >
                          Đạt
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            if (!user) return;
                            await recordThreeStepInspection(menu.id, step, user.id, "khong_dat", undefined);
                            refresh();
                          }}
                        >
                          Không đạt
                        </Button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={actionModal?.label ?? ""}>
        <Textarea
          placeholder="Nhập lý do yêu cầu điều chỉnh"
          value={actionComment}
          onChange={(e) => setActionComment(e.target.value)}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setActionModal(null)}>
            Hủy
          </Button>
          <Button variant="danger" disabled={!actionComment.trim() || busy} onClick={() => actionModal && runAction(actionModal)}>
            Xác nhận
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DishesTab() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [form, setForm] = useState({ name: "", category: "lunch" as DishCategory, energy: "", ingredients: "", allergens: "" });
  const [busy, setBusy] = useState(false);

  const refresh = () => listDishes().then(setDishes);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card>
      {hasPermission("nutrition.create") && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Input
            className="sm:col-span-2"
            placeholder="Tên món ăn"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as DishCategory }))}>
            {Object.entries(MEAL_SLOT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Năng lượng (kcal)"
            type="number"
            value={form.energy}
            onChange={(e) => setForm((p) => ({ ...p, energy: e.target.value }))}
          />
          <Input
            placeholder="Thành phần gây dị ứng"
            value={form.allergens}
            onChange={(e) => setForm((p) => ({ ...p, allergens: e.target.value }))}
          />
          <Button
            size="sm"
            disabled={!form.name.trim() || busy}
            onClick={async () => {
              if (!user) return;
              setBusy(true);
              try {
                await createDish(
                  form.name.trim(),
                  form.category,
                  form.energy ? Number(form.energy) : undefined,
                  form.ingredients || undefined,
                  form.allergens || undefined,
                  user.id,
                );
                setForm({ name: "", category: "lunch", energy: "", ingredients: "", allergens: "" });
                refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            Thêm món
          </Button>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-navy/10 text-navy/50">
            <th className="pb-2 font-medium">Mã</th>
            <th className="pb-2 font-medium">Tên món</th>
            <th className="pb-2 font-medium">Bữa</th>
            <th className="pb-2 font-medium">Năng lượng</th>
            <th className="pb-2 font-medium">Dị ứng</th>
          </tr>
        </thead>
        <tbody>
          {dishes.map((d) => (
            <tr key={d.id} className="border-b border-navy/5">
              <td className="py-2 font-mono text-xs text-navy/60">{d.code}</td>
              <td className="py-2">{d.name}</td>
              <td className="py-2">{MEAL_SLOT_LABELS[d.category]}</td>
              <td className="py-2">{d.energy_kcal ?? "—"} kcal</td>
              <td className="py-2 text-danger">{d.allergens_note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function DeliveryTab() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<FoodDeliveryRow[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [form, setForm] = useState({ supplierId: "", itemName: "", quantity: "", unit: "kg", unitPrice: "" });
  const [busy, setBusy] = useState(false);

  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const today = new Date().toISOString().slice(0, 10);

  const refresh = async () => {
    setSuppliers(await listSuppliers());
    setDeliveries(await listFoodDeliveries(monthStart, today));
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {hasPermission("nutrition.create") && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Thêm nhà cung cấp</h2>
          <div className="flex gap-2">
            <Input placeholder="Tên nhà cung cấp" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            <Button
              size="sm"
              disabled={!supplierName.trim() || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await createSupplier(supplierName.trim());
                  setSupplierName("");
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Thêm
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-navy">Giao nhận thực phẩm tháng này</h2>
        {hasPermission("nutrition.create") && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
            <Select value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
              <option value="">-- Nhà cung cấp --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Tên thực phẩm" value={form.itemName} onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))} />
            <Input placeholder="Số lượng" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
            <Input placeholder="Đơn vị" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
            <Input placeholder="Đơn giá" type="number" value={form.unitPrice} onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))} />
            <Button
              size="sm"
              disabled={!form.supplierId || !form.itemName.trim() || !form.quantity || busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await createFoodDelivery({
                    supplierId: form.supplierId,
                    deliveryDate: today,
                    itemName: form.itemName.trim(),
                    quantity: Number(form.quantity),
                    unit: form.unit,
                    unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
                    receivedBy: user.id,
                  });
                  setForm({ supplierId: "", itemName: "", quantity: "", unit: "kg", unitPrice: "" });
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ghi nhận
            </Button>
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-2 font-medium">Ngày</th>
              <th className="pb-2 font-medium">Thực phẩm</th>
              <th className="pb-2 font-medium">Số lượng</th>
              <th className="pb-2 font-medium">Nhà cung cấp</th>
              <th className="pb-2 font-medium">Người nhận</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-b border-navy/5">
                <td className="py-2">{d.delivery_date}</td>
                <td className="py-2">{d.item_name}</td>
                <td className="py-2">
                  {d.quantity} {d.unit}
                </td>
                <td className="py-2">{d.supplier_name}</td>
                <td className="py-2">{d.received_by_name}</td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-navy/50">
                  Chưa có giao nhận nào trong tháng.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
