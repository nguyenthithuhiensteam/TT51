import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import {
  addRationItem,
  changeRationStatus,
  computeItemCost,
  computeNutritionTotals,
  createFood,
  getDefaultMealFeeRate,
  getHeadcountForGroup,
  getNutritionNorms,
  getOrCreateDailyRation,
  listFoods,
  listRationItems,
  removeRationItem,
  statusForNutrient,
  updateRationItem,
  type RationItemRow,
} from "../../lib/db/rationRepo";
import {
  NUTRIENT_LABELS,
  NUTRITION_GROUP_LABELS,
  FOOD_UNIT_LABELS,
  type DailyRation,
  type Food,
  type FoodUnit,
  type NutrientKey,
  type NutritionGroup,
  type NutritionNorm,
  type RecordStatus,
} from "../../lib/db/types";
import { exportFinanceReportToExcel } from "../../lib/export/excel";

function formatVnd(amount: number): string {
  return Math.round(amount).toLocaleString("vi-VN") + " đ";
}

interface RationAction {
  label: string;
  toStatus: RecordStatus;
  action: "submit" | "approve" | "reject";
  requiresComment?: boolean;
  variant?: "primary" | "danger" | "success";
}

const RATION_ACTIONS: Record<string, RationAction[]> = {
  draft: [{ label: "Gửi duyệt", toStatus: "pending_approval", action: "submit" }],
  pending_approval: [
    { label: "Duyệt khẩu phần", toStatus: "approved", action: "approve", variant: "success" },
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

const NUTRIENT_ORDER: NutrientKey[] = [
  "kcal",
  "protein",
  "fat",
  "carb",
  "calcium",
  "iron",
  "vitamin_a",
  "vitamin_c",
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ok: { label: "Đạt", className: "bg-mint/15 text-mint" },
  under: { label: "Thiếu", className: "bg-warn/15 text-warn" },
  over: { label: "Cao", className: "bg-danger/15 text-danger" },
};

export function MealRationTab() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [group, setGroup] = useState<NutritionGroup>("mau_giao");
  const [ration, setRation] = useState<DailyRation | null>(null);
  const [items, setItems] = useState<RationItemRow[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [norms, setNorms] = useState<NutritionNorm[]>([]);
  const [headcount, setHeadcount] = useState(0);
  const [addFoodId, setAddFoodId] = useState("");
  const [actionModal, setActionModal] = useState<RationAction | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [newFoodModal, setNewFoodModal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listFoods().then(setFoods);
  }, []);

  async function refresh() {
    if (!user || !schoolYear || !date) return;
    const defaultRate = await getDefaultMealFeeRate();
    const r = await getOrCreateDailyRation(schoolYear.id, date, group, defaultRate, user.id);
    setRation(r);
    setItems(await listRationItems(r.id));
    setNorms(await getNutritionNorms(group));
    setHeadcount(await getHeadcountForGroup(date, group));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, schoolYear?.id, date, group]);

  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const normMap = useMemo(() => new Map(norms.map((n) => [n.nutrient_key, n])), [norms]);

  const totals = useMemo(
    () =>
      computeNutritionTotals(
        items.map((item) => {
          const f = foodMap.get(item.food_id);
          return {
            amount_per_child: item.amount_per_child,
            kcal_per_100: f?.kcal_per_100 ?? 0,
            protein_per_100: f?.protein_per_100 ?? 0,
            fat_per_100: f?.fat_per_100 ?? 0,
            carb_per_100: f?.carb_per_100 ?? 0,
            calcium_per_100: f?.calcium_per_100 ?? 0,
            iron_per_100: f?.iron_per_100 ?? 0,
            vitamin_a_per_100: f?.vitamin_a_per_100 ?? 0,
            vitamin_c_per_100: f?.vitamin_c_per_100 ?? 0,
          };
        }),
      ),
    [items, foodMap],
  );

  const totalCost = useMemo(
    () =>
      items.reduce((sum, item) => {
        const f = foodMap.get(item.food_id);
        if (!f) return sum;
        return sum + computeItemCost({ amount_per_child: item.amount_per_child, unit_price: item.unit_price, unit: f.unit }, headcount);
      }, 0),
    [items, foodMap, headcount],
  );

  const budget = headcount * (ration?.meal_fee_rate ?? 0);
  const balance = budget - totalCost;

  const availableActions = (RATION_ACTIONS[ration?.status ?? ""] ?? []).filter((a) =>
    hasPermission(a.action === "submit" ? "nutrition.create" : "nutrition.approve"),
  );
  const canEdit = ration && ["draft", "needs_revision"].includes(ration.status) && hasPermission("nutrition.create");

  async function handleAddItem() {
    if (!ration || !addFoodId) return;
    setBusy(true);
    try {
      await addRationItem(ration.id, addFoodId, 0, 0);
      setAddFoodId("");
      setItems(await listRationItems(ration.id));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateItem(item: RationItemRow, amount: number, price: number) {
    await updateRationItem(item.id, amount, price);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, amount_per_child: amount, unit_price: price } : i)));
  }

  async function handleRemoveItem(itemId: string) {
    await removeRationItem(itemId);
    if (ration) setItems(await listRationItems(ration.id));
  }

  async function runAction(action: RationAction) {
    if (!user || !ration) return;
    setBusy(true);
    try {
      await changeRationStatus(
        ration.id,
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

  const foodsByGroup = useMemo(() => {
    const map = new Map<string, Food[]>();
    for (const f of foods) {
      if (!map.has(f.food_group)) map.set(f.food_group, []);
      map.get(f.food_group)!.push(f);
    }
    return map;
  }, [foods]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Select className="w-40" value={group} onChange={(e) => setGroup(e.target.value as NutritionGroup)}>
            {(Object.keys(NUTRITION_GROUP_LABELS) as NutritionGroup[]).map((g) => (
              <option key={g} value={g}>
                {NUTRITION_GROUP_LABELS[g]}
              </option>
            ))}
          </Select>
          <Input type="date" className="w-48" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="text-sm text-navy/60">
            Số trẻ ăn thực tế (theo điểm danh): <strong>{headcount}</strong>
          </span>
          {ration && <StatusBadge status={ration.status} />}
          <div className="ml-auto flex gap-2">
            {ration && items.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  exportFinanceReportToExcel(
                    `Khau-phan-${NUTRITION_GROUP_LABELS[group]}-${date}`,
                    [
                      ...items.map((i) => {
                        const f = foodMap.get(i.food_id);
                        const cost = f
                          ? computeItemCost({ amount_per_child: i.amount_per_child, unit_price: i.unit_price, unit: f.unit }, headcount)
                          : 0;
                        return [
                          i.food_name,
                          i.food_group,
                          i.amount_per_child,
                          FOOD_UNIT_LABELS[i.unit],
                          i.unit_price,
                          cost,
                        ];
                      }),
                      ["", "", "", "", "Tổng chi", totalCost],
                      ["", "", "", "", "Tiêu chuẩn được chi", budget],
                      ["", "", "", "", balance >= 0 ? "Còn thừa" : "Thiếu", Math.abs(balance)],
                    ],
                    ["Thực phẩm", "Nhóm", "Định mức/trẻ", "Đơn vị", "Đơn giá", "Thành tiền"],
                  )
                }
              >
                Xuất Excel
              </Button>
            )}
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

        {canEdit && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select className="w-72" value={addFoodId} onChange={(e) => setAddFoodId(e.target.value)}>
              <option value="">-- Chọn thực phẩm --</option>
              {[...foodsByGroup.entries()].map(([grp, list]) => (
                <optgroup key={grp} label={grp}>
                  {list.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({FOOD_UNIT_LABELS[f.unit]})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Button size="sm" disabled={!addFoodId || busy} onClick={handleAddItem}>
              + Thêm thực phẩm
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setNewFoodModal(true)}>
              + Thực phẩm ngoài danh mục
            </Button>
          </div>
        )}

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-2 font-medium">Thực phẩm</th>
              <th className="pb-2 font-medium">Nhóm</th>
              <th className="pb-2 font-medium">Định mức/trẻ</th>
              <th className="pb-2 font-medium">Đơn giá</th>
              <th className="pb-2 font-medium">Thành tiền</th>
              {canEdit && <th className="pb-2 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const f = foodMap.get(item.food_id);
              const cost = f
                ? computeItemCost({ amount_per_child: item.amount_per_child, unit_price: item.unit_price, unit: f.unit }, headcount)
                : 0;
              return (
                <tr key={item.id} className="border-b border-navy/5">
                  <td className="py-2">{item.food_name}</td>
                  <td className="py-2 text-navy/60">{item.food_group}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={item.amount_per_child || ""}
                          onChange={(e) => handleUpdateItem(item, parseFloat(e.target.value) || 0, item.unit_price)}
                        />
                        <span className="text-xs text-navy/50">{FOOD_UNIT_LABELS[item.unit]}</span>
                      </div>
                    ) : (
                      `${item.amount_per_child} ${FOOD_UNIT_LABELS[item.unit]}`
                    )}
                  </td>
                  <td className="py-2">
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        className="w-28"
                        value={item.unit_price || ""}
                        onChange={(e) => handleUpdateItem(item, item.amount_per_child, parseFloat(e.target.value) || 0)}
                        placeholder={item.unit === "hop" ? "đ/hộp" : "đ/kg"}
                      />
                    ) : (
                      formatVnd(item.unit_price)
                    )}
                  </td>
                  <td className="py-2 font-medium">{formatVnd(cost)}</td>
                  {canEdit && (
                    <td className="py-2">
                      <button
                        className="text-danger hover:underline"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="py-4 text-center text-navy/50">
                  Chưa có thực phẩm nào trong khẩu phần.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-navy">
            Đối chiếu dinh dưỡng — {NUTRITION_GROUP_LABELS[group]}
          </h3>
          <div className="space-y-3">
            {NUTRIENT_ORDER.map((key) => {
              const norm = normMap.get(key);
              const value = totals[key];
              const status = statusForNutrient(value, norm);
              const badge = STATUS_BADGE[status];
              const info = NUTRIENT_LABELS[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-navy/80">{info.label}</span>
                    <div className="flex items-center gap-2">
                      <span>
                        {value.toFixed(1)} {info.unit}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-navy/40">
                    Chuẩn: {norm?.min_value ?? 0}
                    {norm?.max_value ? ` – ${norm.max_value}` : ""} {info.unit}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-navy">Đối chiếu tiền ăn</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-navy/60">Định mức tiền ăn/trẻ/ngày</span>
              <strong>{formatVnd(ration?.meal_fee_rate ?? 0)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-navy/60">Tiêu chuẩn được chi ({headcount} trẻ)</span>
              <strong>{formatVnd(budget)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-navy/60">Đã chi</span>
              <strong className="text-brand">{formatVnd(totalCost)}</strong>
            </div>
            <div
              className={`mt-2 flex justify-between rounded-lg p-3 font-semibold ${
                balance >= 0 ? "bg-mint/10 text-mint" : "bg-danger/10 text-danger"
              }`}
            >
              <span>{balance >= 0 ? "Còn thừa" : "Thiếu"}</span>
              <span>{formatVnd(Math.abs(balance))}</span>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={!!actionModal} title={actionModal?.label ?? ""} onClose={() => setActionModal(null)}>
        <Field label="Ý kiến / lý do">
          <textarea
            className="w-full rounded-lg border border-navy/15 p-2 text-sm"
            rows={3}
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
          />
        </Field>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setActionModal(null)}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={!actionComment.trim() || busy}
            onClick={() => actionModal && runAction(actionModal)}
          >
            Xác nhận
          </Button>
        </div>
      </Modal>

      <NewFoodModal
        open={newFoodModal}
        onClose={() => setNewFoodModal(false)}
        onCreated={(food) => {
          setFoods((prev) => [...prev, food]);
          setNewFoodModal(false);
        }}
      />
    </div>
  );
}

function NewFoodModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (food: Food) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState("");
  const [foodGroup, setFoodGroup] = useState("Khác");
  const [unit, setUnit] = useState<FoodUnit>("gam");
  const [kcal, setKcal] = useState("0");
  const [protein, setProtein] = useState("0");
  const [fat, setFat] = useState("0");
  const [carb, setCarb] = useState("0");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const id = await createFood(
        {
          name: name.trim(),
          foodGroup,
          unit,
          kcal: parseFloat(kcal) || 0,
          protein: parseFloat(protein) || 0,
          fat: parseFloat(fat) || 0,
          carb: parseFloat(carb) || 0,
        },
        user.id,
      );
      onCreated({
        id,
        code: "",
        name: name.trim(),
        food_group: foodGroup,
        unit,
        protein_per_100: parseFloat(protein) || 0,
        fat_per_100: parseFloat(fat) || 0,
        carb_per_100: parseFloat(carb) || 0,
        kcal_per_100: parseFloat(kcal) || 0,
        calcium_per_100: 0,
        iron_per_100: 0,
        vitamin_a_per_100: 0,
        vitamin_c_per_100: 0,
        status: "active",
      });
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Thêm thực phẩm ngoài danh mục" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Tên thực phẩm">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Thịt bò" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nhóm thực phẩm">
            <Input value={foodGroup} onChange={(e) => setFoodGroup(e.target.value)} />
          </Field>
          <Field label="Đơn vị nhập">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as FoodUnit)}>
              <option value="gam">Gam</option>
              <option value="ml">Ml</option>
              <option value="hop">Hộp</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-navy/50">
          Giá trị dinh dưỡng tính trên 100 {unit === "hop" ? "— nhập theo 1 hộp" : unit}.
        </p>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Kcal">
            <Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </Field>
          <Field label="Đạm (g)">
            <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </Field>
          <Field label="Béo (g)">
            <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
          </Field>
          <Field label="Đường (g)">
            <Input type="number" value={carb} onChange={(e) => setCarb(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button disabled={!name.trim() || busy} onClick={handleCreate}>
          Thêm
        </Button>
      </div>
    </Modal>
  );
}
