import { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/Badge";
import { useAuthStore } from "../../store/authStore";
import { listChildren, type ChildWithClass } from "../../lib/db/childRepo";
import {
  addGrowthMeasurement,
  addVaccination,
  createIncident,
  createSafetyInspection,
  changeSafetyInspectionStatus,
  getHealthRecord,
  listGrowthMeasurements,
  listIncidents,
  listSafetyInspections,
  listVaccinations,
  upsertHealthRecord,
  type GrowthRow,
  type HealthRecordRow,
  type IncidentRow,
  type SafetyInspectionRow,
  type VaccinationRow,
} from "../../lib/db/healthRepo";
import { SAFETY_AREA_LABELS, SEVERITY_LABELS } from "../../lib/db/types";
import type { IncidentSeverity, SafetyArea } from "../../lib/db/types";
import { PhysicalExamTab } from "./PhysicalExamTab";

type Tab = "child" | "physicalExam" | "incidents" | "safety";

export function HealthSafetyPage() {
  const [tab, setTab] = useState<Tab>("child");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Sức khỏe – An toàn</h1>
        <p className="text-sm text-navy/60">
          Dữ liệu sức khỏe được phân loại bảo vệ cao, chỉ hiển thị cho tài khoản có quyền.
        </p>
      </div>
      <div className="flex gap-1 border-b border-navy/10">
        {(
          [
            ["child", "Sức khỏe trẻ"],
            ["physicalExam", "Khám sức khỏe toàn diện"],
            ["incidents", "Sự cố / Tai nạn"],
            ["safety", "Kiểm tra an toàn"],
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
      {tab === "child" && <ChildHealthTab />}
      {tab === "physicalExam" && <PhysicalExamTab />}
      {tab === "incidents" && <IncidentsTab />}
      {tab === "safety" && <SafetyInspectionsTab />}
    </div>
  );
}

function ChildHealthTab() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [children, setChildren] = useState<ChildWithClass[]>([]);
  const [childId, setChildId] = useState("");
  const [record, setRecord] = useState<HealthRecordRow | null>(null);
  const [growth, setGrowth] = useState<GrowthRow[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRow[]>([]);
  const [form, setForm] = useState({ bloodType: "", chronicConditions: "", allergies: "", note: "" });
  const [growthForm, setGrowthForm] = useState({ date: "", height: "", weight: "" });
  const [vaccineForm, setVaccineForm] = useState({ name: "", dose: "1", date: "", place: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listChildren({ page: 1, pageSize: 200 }).then((r) => {
      setChildren(r.items);
      if (r.items[0]) setChildId(r.items[0].id);
    });
  }, []);

  async function refresh() {
    if (!childId) return;
    const r = await getHealthRecord(childId);
    setRecord(r);
    setForm({
      bloodType: r?.blood_type ?? "",
      chronicConditions: r?.chronic_conditions ?? "",
      allergies: r?.allergies ?? "",
      note: r?.note ?? "",
    });
    setGrowth(await listGrowthMeasurements(childId));
    setVaccinations(await listVaccinations(childId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  if (!hasPermission("health.view")) return null;

  return (
    <div className="space-y-4">
      <Card>
        <Select value={childId} onChange={(e) => setChildId(e.target.value)} className="w-72">
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} — {c.class_name ?? "Chưa xếp lớp"}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Hồ sơ sức khỏe</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nhóm máu">
            <Input
              disabled={!hasPermission("health.edit")}
              value={form.bloodType}
              onChange={(e) => setForm((p) => ({ ...p, bloodType: e.target.value }))}
            />
          </Field>
          <Field label="Bệnh nền">
            <Input
              disabled={!hasPermission("health.edit")}
              value={form.chronicConditions}
              onChange={(e) => setForm((p) => ({ ...p, chronicConditions: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dị ứng (cách nhau bởi dấu phẩy, VD: Trứng, Hải sản)">
              <Input
                disabled={!hasPermission("health.edit")}
                value={form.allergies}
                onChange={(e) => setForm((p) => ({ ...p, allergies: e.target.value }))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Ghi chú">
              <Textarea
                disabled={!hasPermission("health.edit")}
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        {hasPermission("health.edit") && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await upsertHealthRecord(childId, form, user.id);
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lưu hồ sơ sức khỏe
            </Button>
          </div>
        )}
        <p className="mt-1 text-xs text-navy/40">
          {record ? `Cập nhật lần cuối: ${new Date(record.updated_at).toLocaleString("vi-VN")}` : "Chưa có hồ sơ"}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Chiều cao, cân nặng</h2>
          {hasPermission("health.edit") && (
            <div className="mb-3 grid grid-cols-4 gap-2">
              <Input type="date" value={growthForm.date} onChange={(e) => setGrowthForm((p) => ({ ...p, date: e.target.value }))} />
              <Input placeholder="Cao (cm)" type="number" value={growthForm.height} onChange={(e) => setGrowthForm((p) => ({ ...p, height: e.target.value }))} />
              <Input placeholder="Nặng (kg)" type="number" value={growthForm.weight} onChange={(e) => setGrowthForm((p) => ({ ...p, weight: e.target.value }))} />
              <Button
                size="sm"
                disabled={!growthForm.date || !growthForm.height || !growthForm.weight || busy}
                onClick={async () => {
                  if (!user) return;
                  setBusy(true);
                  try {
                    await addGrowthMeasurement(childId, growthForm.date, Number(growthForm.height), Number(growthForm.weight), undefined, user.id);
                    setGrowthForm({ date: "", height: "", weight: "" });
                    refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Ghi
              </Button>
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-1 font-medium">Ngày đo</th>
                <th className="pb-1 font-medium">Cao (cm)</th>
                <th className="pb-1 font-medium">Nặng (kg)</th>
              </tr>
            </thead>
            <tbody>
              {growth.map((g) => (
                <tr key={g.id} className="border-b border-navy/5">
                  <td className="py-1">{g.measured_date}</td>
                  <td className="py-1">{g.height_cm}</td>
                  <td className="py-1">{g.weight_kg}</td>
                </tr>
              ))}
              {growth.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-navy/50">Chưa có số liệu.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-navy">Tiêm chủng</h2>
          {hasPermission("health.edit") && (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
              <Input className="sm:col-span-2" placeholder="Tên vắc xin" value={vaccineForm.name} onChange={(e) => setVaccineForm((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Mũi số" type="number" value={vaccineForm.dose} onChange={(e) => setVaccineForm((p) => ({ ...p, dose: e.target.value }))} />
              <Input type="date" value={vaccineForm.date} onChange={(e) => setVaccineForm((p) => ({ ...p, date: e.target.value }))} />
              <Button
                size="sm"
                disabled={!vaccineForm.name.trim() || !vaccineForm.date || busy}
                onClick={async () => {
                  if (!user) return;
                  setBusy(true);
                  try {
                    await addVaccination(childId, vaccineForm.name.trim(), Number(vaccineForm.dose), vaccineForm.date, vaccineForm.place || undefined, undefined, user.id);
                    setVaccineForm({ name: "", dose: "1", date: "", place: "" });
                    refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Ghi
              </Button>
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-1 font-medium">Ngày</th>
                <th className="pb-1 font-medium">Vắc xin</th>
                <th className="pb-1 font-medium">Mũi</th>
              </tr>
            </thead>
            <tbody>
              {vaccinations.map((v) => (
                <tr key={v.id} className="border-b border-navy/5">
                  <td className="py-1">{v.vaccinated_date}</td>
                  <td className="py-1">{v.vaccine_name}</td>
                  <td className="py-1">{v.dose_no}</td>
                </tr>
              ))}
              {vaccinations.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-navy/50">Chưa có dữ liệu.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function IncidentsTab() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [children, setChildren] = useState<ChildWithClass[]>([]);
  const [form, setForm] = useState({
    childId: "",
    category: "accident" as "accident" | "health" | "other",
    severity: "low" as IncidentSeverity,
    description: "",
    actionsTaken: "",
  });
  const [busy, setBusy] = useState(false);

  const refresh = () => listIncidents().then(setIncidents);
  useEffect(() => {
    refresh();
    listChildren({ page: 1, pageSize: 200 }).then((r) => setChildren(r.items));
  }, []);

  return (
    <Card>
      {hasPermission("health.create") && (
        <div className="mb-4 space-y-2 rounded-xl border border-navy/10 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={form.childId} onChange={(e) => setForm((p) => ({ ...p, childId: e.target.value }))}>
              <option value="">-- Trẻ liên quan (nếu có) --</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
            <Select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as typeof form.category }))}>
              <option value="accident">Tai nạn</option>
              <option value="health">Sức khỏe</option>
              <option value="other">Khác</option>
            </Select>
            <Select value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value as IncidentSeverity }))}>
              {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Textarea placeholder="Mô tả sự việc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <Textarea placeholder="Đã xử lý" value={form.actionsTaken} onChange={(e) => setForm((p) => ({ ...p, actionsTaken: e.target.value }))} />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!form.description.trim() || busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await createIncident({
                    childId: form.childId || undefined,
                    occurredAt: new Date().toISOString(),
                    category: form.category,
                    severity: form.severity,
                    description: form.description.trim(),
                    actionsTaken: form.actionsTaken || undefined,
                    reportedBy: user.id,
                  });
                  setForm({ childId: "", category: "accident", severity: "low", description: "", actionsTaken: "" });
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={14} /> Ghi nhận sự cố
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {incidents.map((i) => (
          <div key={i.id} className="rounded-lg border border-navy/5 p-3 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-navy/50">{i.code}</span>
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-xs",
                  i.severity === "high" ? "bg-danger/15 text-danger" : i.severity === "medium" ? "bg-warn/15 text-warn" : "bg-navy/10 text-navy/70",
                )}
              >
                {SEVERITY_LABELS[i.severity]}
              </span>
              {i.child_name && <span className="text-navy/60">Trẻ: {i.child_name}</span>}
            </div>
            <p className="text-navy">{i.description}</p>
            {i.actions_taken && <p className="text-navy/60">Đã xử lý: {i.actions_taken}</p>}
            <p className="text-xs text-navy/40">
              {i.reported_by_name} · {new Date(i.occurred_at).toLocaleString("vi-VN")}
            </p>
          </div>
        ))}
        {incidents.length === 0 && <p className="text-sm text-navy/50">Chưa có sự cố nào được ghi nhận.</p>}
      </div>
    </Card>
  );
}

function SafetyInspectionsTab() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [inspections, setInspections] = useState<SafetyInspectionRow[]>([]);
  const [form, setForm] = useState({
    area: "classroom" as SafetyArea,
    date: new Date().toISOString().slice(0, 10),
    result: "",
    riskLevel: "low" as IncidentSeverity,
    plan: "",
  });
  const [busy, setBusy] = useState(false);

  const refresh = () => listSafetyInspections().then(setInspections);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card>
      {hasPermission("health.create") && (
        <div className="mb-4 space-y-2 rounded-xl border border-navy/10 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value as SafetyArea }))}>
              {Object.entries(SAFETY_AREA_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            <Select value={form.riskLevel} onChange={(e) => setForm((p) => ({ ...p, riskLevel: e.target.value as IncidentSeverity }))}>
              {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  Nguy cơ: {label}
                </option>
              ))}
            </Select>
          </div>
          <Textarea placeholder="Kết quả kiểm tra theo checklist" value={form.result} onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))} />
          <Textarea placeholder="Kế hoạch khắc phục (nếu có)" value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!form.result.trim() || busy}
              onClick={async () => {
                if (!user) return;
                setBusy(true);
                try {
                  await createSafetyInspection({
                    area: form.area,
                    inspectionDate: form.date,
                    checklistResult: form.result.trim(),
                    riskLevel: form.riskLevel,
                    remediationPlan: form.plan || undefined,
                    inspectedBy: user.id,
                  });
                  setForm({ area: "classroom", date: new Date().toISOString().slice(0, 10), result: "", riskLevel: "low", plan: "" });
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={14} /> Ghi nhận kiểm tra
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {inspections.map((s) => (
          <div key={s.id} className="rounded-lg border border-navy/5 p-3 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-navy/50">{s.code}</span>
              <span className="font-medium text-navy">{SAFETY_AREA_LABELS[s.area]}</span>
              <StatusBadge status={s.status} />
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-xs",
                  s.risk_level === "high" ? "bg-danger/15 text-danger" : s.risk_level === "medium" ? "bg-warn/15 text-warn" : "bg-navy/10 text-navy/70",
                )}
              >
                Nguy cơ {SEVERITY_LABELS[s.risk_level]}
              </span>
            </div>
            <p className="text-navy">{s.checklist_result}</p>
            {s.remediation_plan && <p className="text-navy/60">Khắc phục: {s.remediation_plan}</p>}
            <p className="mb-1 text-xs text-navy/40">
              {s.inspected_by_name} · {s.inspection_date}
            </p>
            {s.status === "draft" && hasPermission("health.create") && (
              <Button size="sm" onClick={() => changeSafetyInspectionStatus(s.id, "pending_approval", user!.id, sessionId).then(refresh)}>
                Gửi duyệt
              </Button>
            )}
            {s.status === "pending_approval" && hasPermission("health.approve") && (
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => changeSafetyInspectionStatus(s.id, "approved", user!.id, sessionId).then(refresh)}>
                  Duyệt kế hoạch khắc phục
                </Button>
              </div>
            )}
          </div>
        ))}
        {inspections.length === 0 && <p className="text-sm text-navy/50">Chưa có đợt kiểm tra nào.</p>}
      </div>
    </Card>
  );
}
