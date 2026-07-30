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
  getCombinedDailyReport,
  getDefaultMealFeeRate,
  getHeadcountForGroup,
  getNutritionNorms,
  getOrCreateDailyRation,
  getPolicyChecklistState,
  getWeeklyRationSummary,
  listFoods,
  listRationItems,
  removeRationItem,
  setPolicyChecklistItem,
  statusForNutrient,
  updateRationItem,
  type CombinedDailyReport,
  type RationItemRow,
  type WeeklyRationDay,
} from "../../lib/db/rationRepo";
import {
  BENEFICIARY_GROUPS,
  COOK_SUPPORT_TEXT,
  LEGAL_REFERENCES,
  PAYMENT_SCHEDULE,
  POLICY_CHECKLIST_ITEMS,
  SUPPORT_AMOUNT_TEXT,
} from "./mealPolicyContent";
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

type MealRationSubTab = "entry" | "weekly" | "policy" | "print";

const SUB_TABS: [MealRationSubTab, string][] = [
  ["entry", "Nhập liệu & dinh dưỡng"],
  ["weekly", "Tổng hợp tuần"],
  ["policy", "Chính sách"],
  ["print", "In biểu mẫu"],
];

export function MealRationTab() {
  const [subTab, setSubTab] = useState<MealRationSubTab>("entry");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-navy/10">
        {SUB_TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={
              "px-4 py-2 text-sm font-medium " +
              (subTab === key ? "border-b-2 border-brand text-brand" : "text-navy/50 hover:text-navy")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {subTab === "entry" && <MealRationEntrySection />}
      {subTab === "weekly" && <WeeklyRationSummarySection />}
      {subTab === "policy" && <MealPolicySection />}
      {subTab === "print" && <MealRationPrintSection />}
    </div>
  );
}

function MealRationEntrySection() {
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
            {ration && items.length > 0 && hasPermission("nutrition.export") && (
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

// ===================== TỔNG HỢP TUẦN =====================

const WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const offset = (d.getDay() + 6) % 7; // 0 = Thứ 2
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function formatDdMm(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function WeeklyRationSummarySection() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [weekStart, setWeekStart] = useState(mondayOf(new Date().toISOString().slice(0, 10)));
  const [days, setDays] = useState<WeeklyRationDay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolYear) return;
    setLoading(true);
    getWeeklyRationSummary(schoolYear.id, weekStart)
      .then(setDays)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id, weekStart]);

  const totalHeadcount = days.reduce((s, d) => s + d.nhaTre.headcount + d.mauGiao.headcount, 0);
  const totalCost = days.reduce((s, d) => s + d.nhaTre.cost + d.mauGiao.cost, 0);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-navy">Tổng hợp tuần — từ {formatDdMm(weekStart)}</h3>
        <Input
          type="date"
          className="w-48"
          value={weekStart}
          onChange={(e) => setWeekStart(mondayOf(e.target.value))}
        />
        {hasPermission("nutrition.export") && days.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() =>
              exportFinanceReportToExcel(
                `Tong-hop-tuan-${weekStart}`,
                [
                  ...days.map((d) => [
                    formatDdMm(d.date),
                    d.nhaTre.headcount,
                    d.nhaTre.cost,
                    d.mauGiao.headcount,
                    d.mauGiao.cost,
                    d.nhaTre.headcount + d.mauGiao.headcount,
                    d.nhaTre.cost + d.mauGiao.cost,
                  ]),
                  ["Cộng tuần", "", "", "", "", totalHeadcount, totalCost],
                ],
                ["Ngày", "SL trẻ NT", "Chi phí NT", "SL trẻ MG", "Chi phí MG", "Tổng SL trẻ", "Tổng chi phí"],
              )
            }
          >
            Xuất Excel
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-navy/50">Đang tải...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-2 pr-3 font-medium">Chỉ tiêu</th>
                {days.map((d, i) => (
                  <th key={d.date} className="pb-2 pr-3 text-center font-medium">
                    {WEEKDAY_LABELS[i]}
                    <br />
                    <span className="font-normal">{formatDdMm(d.date)}</span>
                  </th>
                ))}
                <th className="pb-2 text-center font-medium">Cộng tuần</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy/5">
                <td className="py-2 pr-3 text-navy/70">Số trẻ — Nhà trẻ</td>
                {days.map((d) => (
                  <td key={d.date} className="py-2 pr-3 text-center">
                    {d.nhaTre.headcount || "—"}
                  </td>
                ))}
                <td className="py-2 text-center font-medium">
                  {days.reduce((s, d) => s + d.nhaTre.headcount, 0)}
                </td>
              </tr>
              <tr className="border-b border-navy/5">
                <td className="py-2 pr-3 text-navy/70">Số trẻ — Mẫu giáo</td>
                {days.map((d) => (
                  <td key={d.date} className="py-2 pr-3 text-center">
                    {d.mauGiao.headcount || "—"}
                  </td>
                ))}
                <td className="py-2 text-center font-medium">
                  {days.reduce((s, d) => s + d.mauGiao.headcount, 0)}
                </td>
              </tr>
              <tr className="border-b border-navy/5 font-medium">
                <td className="py-2 pr-3 text-navy">Tổng số trẻ</td>
                {days.map((d) => (
                  <td key={d.date} className="py-2 pr-3 text-center">
                    {d.nhaTre.headcount + d.mauGiao.headcount || "—"}
                  </td>
                ))}
                <td className="py-2 text-center">{totalHeadcount}</td>
              </tr>
              <tr className="border-b border-navy/5">
                <td className="py-2 pr-3 text-navy/70">Chi phí đã nhập</td>
                {days.map((d) => {
                  const cost = d.nhaTre.cost + d.mauGiao.cost;
                  const hasData = d.nhaTre.hasData || d.mauGiao.hasData;
                  return (
                    <td key={d.date} className="py-2 pr-3 text-center">
                      {hasData ? formatVnd(cost) : <span className="text-navy/30">Chưa nhập</span>}
                    </td>
                  );
                })}
                <td className="py-2 text-center font-semibold text-brand">{formatVnd(totalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ===================== CHÍNH SÁCH =====================

function MealPolicySection() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [checks, setChecks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    getPolicyChecklistState().then(setChecks);
  }, []);

  async function toggle(index: number) {
    if (!user || !hasPermission("nutrition.edit")) return;
    const next = !checks[index];
    setChecks((prev) => ({ ...prev, [index]: next }));
    await setPolicyChecklistItem(index, next, user.id);
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-navy">Căn cứ pháp lý bữa ăn bán trú mầm non</h3>
        <div className="space-y-2">
          {LEGAL_REFERENCES.map((ref) => (
            <div key={ref.code} className="rounded-lg bg-navy/5 p-3">
              <p className="text-xs font-bold text-brand">Số: {ref.code}</p>
              <p className="mt-1 text-sm text-navy/80">{ref.title}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-mint/10 p-3">
          <p className="text-sm font-semibold text-mint">Mức hỗ trợ</p>
          <p className="mt-1 text-sm text-navy/70">{SUPPORT_AMOUNT_TEXT}</p>
        </div>
        <p className="mt-4 mb-2 text-sm font-semibold text-navy">Đối tượng hưởng hỗ trợ</p>
        <div className="divide-y divide-navy/5">
          {BENEFICIARY_GROUPS.map((g, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <span className="text-lg">{g.icon}</span>
              <span className="text-sm text-navy/80">{g.text}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-navy">Lịch chi trả — 2 lần/năm học</h3>
        <div className="grid grid-cols-2 gap-3">
          {PAYMENT_SCHEDULE.map((p) => (
            <div key={p.label} className="rounded-lg bg-warn/10 p-3 text-center">
              <div className="text-2xl">{p.icon}</div>
              <p className="font-semibold text-warn">{p.label}</p>
              <p className="text-xs text-navy/50">{p.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-brand/10 p-3 text-sm text-brand">{COOK_SUPPORT_TEXT}</div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-navy">Checklist việc cần làm</h3>
        {!hasPermission("nutrition.edit") && (
          <p className="mb-2 text-xs text-navy/40">Chỉ người có quyền sửa Nuôi dưỡng mới đánh dấu được checklist.</p>
        )}
        <div className="divide-y divide-navy/5">
          {POLICY_CHECKLIST_ITEMS.map((item, i) => (
            <label
              key={i}
              className={`flex items-start gap-3 py-2 ${hasPermission("nutrition.edit") ? "cursor-pointer" : ""}`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={!!checks[i]}
                disabled={!hasPermission("nutrition.edit")}
                onChange={() => toggle(i)}
              />
              <span className={`text-sm ${checks[i] ? "text-navy/40 line-through" : "text-navy/80"}`}>{item}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ===================== IN BIỂU MẪU =====================

function MealRationPrintSection() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const school = useAppStore((s) => s.school);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<CombinedDailyReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolYear) return;
    setLoading(true);
    getCombinedDailyReport(schoolYear.id, date)
      .then(setReport)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id, date]);

  const dateLabel = (() => {
    const d = new Date(`${date}T00:00:00`);
    const weekday = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][d.getDay()];
    return `${weekday}, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  })();

  const hasData = !!report && report.rows.length > 0;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #meal-ration-print-area, #meal-ration-print-area * { visibility: visible; }
          #meal-ration-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
      <Card className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-navy">In biểu — Bảng tính ăn hàng ngày</h3>
          <Input type="date" className="w-48" value={date} onChange={(e) => setDate(e.target.value)} />
          {hasPermission("nutrition.export") && (
            <Button size="sm" className="ml-auto" disabled={!hasData} onClick={() => window.print()}>
              In / Lưu PDF
            </Button>
          )}
        </div>
        {!hasData && !loading && (
          <p className="text-sm text-navy/50">Ngày này chưa có dữ liệu khẩu phần ở tab Nhập liệu.</p>
        )}
      </Card>

      {hasData && report && (
        <div id="meal-ration-print-area" className="mt-4 rounded-xl border border-navy/10 bg-white p-4 text-sm">
          <div className="mb-3 text-center">
            <p className="font-bold">{school?.name ?? ""}</p>
            <p className="text-base font-bold">BẢNG TÍNH ĂN HÀNG NGÀY</p>
            <p>{dateLabel}</p>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-navy/30 p-1">TT</th>
                <th rowSpan={2} className="border border-navy/30 p-1">Thực phẩm</th>
                <th rowSpan={2} className="border border-navy/30 p-1">ĐVT</th>
                <th colSpan={3} className="border border-navy/30 bg-blue-50 p-1">
                  NHÀ TRẺ ({report.headcountNT} trẻ)
                </th>
                <th colSpan={3} className="border border-navy/30 bg-green-50 p-1">
                  MẪU GIÁO ({report.headcountMG} trẻ)
                </th>
              </tr>
              <tr>
                <th className="border border-navy/30 bg-blue-50 p-1">ĐM/trẻ</th>
                <th className="border border-navy/30 bg-blue-50 p-1">Đơn giá</th>
                <th className="border border-navy/30 bg-blue-50 p-1">Thành tiền</th>
                <th className="border border-navy/30 bg-green-50 p-1">ĐM/trẻ</th>
                <th className="border border-navy/30 bg-green-50 p-1">Đơn giá</th>
                <th className="border border-navy/30 bg-green-50 p-1">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => (
                <tr key={row.foodId}>
                  <td className="border border-navy/30 p-1 text-center">{i + 1}</td>
                  <td className="border border-navy/30 p-1">{row.foodName}</td>
                  <td className="border border-navy/30 p-1 text-center">{FOOD_UNIT_LABELS[row.unit]}</td>
                  <td className="border border-navy/30 p-1 text-right">
                    {row.nt ? row.nt.amountPerChild : ""}
                  </td>
                  <td className="border border-navy/30 p-1 text-right">{row.nt ? row.nt.unitPrice.toLocaleString("vi-VN") : ""}</td>
                  <td className="border border-navy/30 p-1 text-right">{row.nt ? row.nt.cost.toLocaleString("vi-VN") : ""}</td>
                  <td className="border border-navy/30 p-1 text-right">
                    {row.mg ? row.mg.amountPerChild : ""}
                  </td>
                  <td className="border border-navy/30 p-1 text-right">{row.mg ? row.mg.unitPrice.toLocaleString("vi-VN") : ""}</td>
                  <td className="border border-navy/30 p-1 text-right">{row.mg ? row.mg.cost.toLocaleString("vi-VN") : ""}</td>
                </tr>
              ))}
              <tr className="bg-warn/10 font-bold">
                <td colSpan={5} className="border border-navy/30 p-1 text-center">Tổng cộng</td>
                <td className="border border-navy/30 p-1 text-right">{report.totalCostNT.toLocaleString("vi-VN")}</td>
                <td colSpan={2} className="border border-navy/30 p-1"></td>
                <td className="border border-navy/30 p-1 text-right">{report.totalCostMG.toLocaleString("vi-VN")}</td>
              </tr>
            </tbody>
          </table>

          <table className="mt-4 w-full text-xs">
            <tbody>
              <tr>
                <td className="w-1/2 align-top">
                  <p>Tiêu chuẩn được chi (NT): {formatVnd(report.budgetNT)}</p>
                  <p>Tiêu chuẩn được chi (MG): {formatVnd(report.budgetMG)}</p>
                </td>
                <td className="w-1/2 align-top">
                  <p>Đã chi (NT): {formatVnd(report.totalCostNT)}</p>
                  <p>Đã chi (MG): {formatVnd(report.totalCostMG)}</p>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="mt-8 w-full text-center text-xs">
            <tbody>
              <tr className="font-bold">
                <td>NGƯỜI TỔNG HỢP</td>
                <td>NGƯỜI DUYỆT</td>
                <td>DUYỆT CHI</td>
              </tr>
              <tr className="italic text-navy/50">
                <td>(Ký, ghi rõ họ tên)</td>
                <td>(Ký, ghi rõ họ tên)</td>
                <td>(Ký, ghi rõ họ tên, đóng dấu)</td>
              </tr>
              <tr>
                <td className="h-16"></td>
                <td className="h-16"></td>
                <td className="h-16"></td>
              </tr>
              <tr className="font-semibold">
                <td></td>
                <td></td>
                <td>{school?.principal_name ?? ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
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
