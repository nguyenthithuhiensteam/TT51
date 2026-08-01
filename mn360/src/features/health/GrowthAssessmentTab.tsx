import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Input";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { listChildren, listClasses, type ChildWithClass, type ClassWithTeacher } from "@/lib/db/childRepo";
import {
  getGrowthAssessments,
  getGrowthSummary,
  type GrowthAssessment,
  type GrowthSummaryCounts,
} from "@/lib/db/healthRepo";
import {
  GROWTH_CLASSIFICATION_BY_CODE,
  GROWTH_INDICATOR_LABELS,
  type GrowthClassification,
  type GrowthIndicator,
} from "../../lib/utils/growth";

const INDICATORS: GrowthIndicator[] = ["wfa", "hfa", "bmifa"];

const SEVERITY_COLORS: Record<GrowthClassification["severity"], string> = {
  normal: "bg-mint/15 text-mint",
  risk: "bg-warn/15 text-warn",
  moderate: "bg-warn/20 text-warn",
  severe: "bg-danger/15 text-danger",
  high: "bg-danger/20 text-danger",
};

function ClassificationBadge({ classification }: { classification: GrowthClassification }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", SEVERITY_COLORS[classification.severity])}>
      {classification.label}
    </span>
  );
}

type SubTab = "child" | "summary";

export function GrowthAssessmentTab() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [subTab, setSubTab] = useState<SubTab>("child");

  if (!hasPermission("health.view")) return null;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-navy/10">
        {(
          [
            ["child", "Biểu đồ tăng trưởng trẻ"],
            ["summary", "Tổng hợp lớp/trường"],
          ] as [SubTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium",
              subTab === key ? "border-b-2 border-brand text-brand" : "text-navy/50 hover:text-navy",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {subTab === "child" && <ChildGrowthChartSection />}
      {subTab === "summary" && <GrowthSummarySection />}
    </div>
  );
}

function formatDdMmYyyy(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function ChildGrowthChartSection() {
  const [children, setChildren] = useState<ChildWithClass[]>([]);
  const [childId, setChildId] = useState("");
  const [assessments, setAssessments] = useState<GrowthAssessment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listChildren({ page: 1, pageSize: 200 }).then((r) => {
      setChildren(r.items);
      if (r.items[0]) setChildId(r.items[0].id);
    });
  }, []);

  useEffect(() => {
    if (!childId) return;
    setLoading(true);
    getGrowthAssessments(childId)
      .then(setAssessments)
      .finally(() => setLoading(false));
  }, [childId]);

  const chartData = assessments.map((a) => ({
    date: formatDdMmYyyy(a.measured_date),
    "Cân nặng/tuổi": Number(a.wfa.zScore.toFixed(2)),
    "Chiều cao/tuổi": Number(a.hfa.zScore.toFixed(2)),
    "BMI/tuổi": Number(a.bmifa.zScore.toFixed(2)),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <Select className="w-72" value={childId} onChange={(e) => setChildId(e.target.value)}>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} — {c.class_name ?? "Chưa xếp lớp"}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-navy">Biểu đồ z-score (độ lệch chuẩn SD) theo chuẩn WHO</h2>
        <p className="mb-3 text-xs text-navy/50">
          Vùng bình thường nằm giữa hai đường -2SD và +2SD. Trẻ trên 60 tháng tuổi tạm được đánh giá theo mốc 60 tháng.
        </p>
        {chartData.length === 0 ? (
          <p className="py-6 text-center text-sm text-navy/50">
            {loading ? "Đang tải..." : "Trẻ chưa có số liệu đo chiều cao/cân nặng."}
          </p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0A1F4E10" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[-5, 5]} tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#0A1F4E40" />
                <ReferenceLine y={-2} stroke="#F0B429" strokeDasharray="4 4" label={{ value: "-2SD", fontSize: 10, position: "insideBottomLeft" }} />
                <ReferenceLine y={2} stroke="#F0B429" strokeDasharray="4 4" label={{ value: "+2SD", fontSize: 10, position: "insideTopLeft" }} />
                <ReferenceLine y={-3} stroke="#E5484D" strokeDasharray="4 4" label={{ value: "-3SD", fontSize: 10, position: "insideBottomLeft" }} />
                <ReferenceLine y={3} stroke="#E5484D" strokeDasharray="4 4" label={{ value: "+3SD", fontSize: 10, position: "insideTopLeft" }} />
                <Line type="monotone" dataKey="Cân nặng/tuổi" stroke="#2563EB" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Chiều cao/tuổi" stroke="#16A34A" strokeWidth={2} dot />
                <Line type="monotone" dataKey="BMI/tuổi" stroke="#D97706" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Chi tiết từng lần đo</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-1 font-medium">Ngày đo</th>
              <th className="pb-1 font-medium">Tháng tuổi</th>
              <th className="pb-1 font-medium">Cao (cm)</th>
              <th className="pb-1 font-medium">Nặng (kg)</th>
              <th className="pb-1 font-medium">BMI</th>
              <th className="pb-1 font-medium">Cân nặng/tuổi</th>
              <th className="pb-1 font-medium">Chiều cao/tuổi</th>
              <th className="pb-1 font-medium">BMI/tuổi</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => (
              <tr key={a.id} className="border-b border-navy/5">
                <td className="py-1">{a.measured_date}</td>
                <td className="py-1">{a.age_months}</td>
                <td className="py-1">{a.height_cm}</td>
                <td className="py-1">{a.weight_kg}</td>
                <td className="py-1">{a.bmi}</td>
                <td className="py-1"><ClassificationBadge classification={a.wfa.classification} /></td>
                <td className="py-1"><ClassificationBadge classification={a.hfa.classification} /></td>
                <td className="py-1"><ClassificationBadge classification={a.bmifa.classification} /></td>
              </tr>
            ))}
            {assessments.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-navy/50">Chưa có số liệu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function GrowthSummarySection() {
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);
  const [scopeId, setScopeId] = useState("__school__");
  const [summary, setSummary] = useState<GrowthSummaryCounts | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolYear) return;
    listClasses(schoolYear.id).then(setClasses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  useEffect(() => {
    if (!schoolYear) return;
    setLoading(true);
    const scope = scopeId === "__school__" ? { schoolYearId: schoolYear.id } : { classId: scopeId };
    getGrowthSummary(scope)
      .then(setSummary)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, schoolYear?.id]);

  return (
    <div className="space-y-4">
      <Card>
        <Select className="w-64" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
          <option value="__school__">Toàn trường</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Card>

      {loading && <p className="text-sm text-navy/50">Đang tải...</p>}

      {!loading && summary && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {INDICATORS.map((ind) => (
            <Card key={ind}>
              <h3 className="mb-2 text-sm font-semibold text-navy">{GROWTH_INDICATOR_LABELS[ind]}</h3>
              <p className="mb-2 text-xs text-navy/50">
                Tổng số trẻ có số liệu: {summary.total}
              </p>
              <table className="w-full text-left text-sm">
                <tbody>
                  {Object.entries(summary[ind]).length === 0 && (
                    <tr>
                      <td className="py-2 text-navy/50">Chưa có dữ liệu.</td>
                    </tr>
                  )}
                  {Object.entries(summary[ind])
                    .sort((a, b) => b[1] - a[1])
                    .map(([code, count]) => (
                      <tr key={code} className="border-b border-navy/5">
                        <td className="py-1">
                          {GROWTH_CLASSIFICATION_BY_CODE[code] ? (
                            <ClassificationBadge classification={GROWTH_CLASSIFICATION_BY_CODE[code]} />
                          ) : (
                            code
                          )}
                        </td>
                        <td className="py-1 text-right font-medium">{count}</td>
                        <td className="py-1 text-right text-navy/50">
                          {summary.total > 0 ? `${Math.round((count / summary.total) * 1000) / 10}%` : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
