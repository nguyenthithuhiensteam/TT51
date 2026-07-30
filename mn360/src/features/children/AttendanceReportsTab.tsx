import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import {
  getMonthlyAttendanceGrid,
  getYearlyAttendanceSummary,
  type ClassWithTeacher,
  type MonthlyAttendanceGrid,
  type MonthlyAttendanceStatsRow,
  type YearlyAttendanceSummary,
} from "../../lib/db/childRepo";
import { exportFinanceReportToExcel } from "../../lib/export/excel";

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function weekdayOf(dateStr: string): string {
  return WEEKDAY_SHORT[new Date(`${dateStr}T00:00:00`).getDay()];
}

function formatDdMm(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ReportSubTab = "monthly" | "yearly";

const SUB_TABS: [ReportSubTab, string][] = [
  ["monthly", "Lưới điểm danh tháng"],
  ["yearly", "Tổng hợp năm học"],
];

export function AttendanceReportsTab({ classes }: { classes: ClassWithTeacher[] }) {
  const [subTab, setSubTab] = useState<ReportSubTab>("monthly");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");

  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Select className="w-56" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
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
      </div>
      {!classId && <Card>Chưa có lớp nào.</Card>}
      {classId && subTab === "monthly" && <MonthlyGridSection classId={classId} />}
      {classId && subTab === "yearly" && <YearlySummarySection classId={classId} />}
    </div>
  );
}

function MonthlyGridSection({ classId }: { classId: string }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().slice(0, 7));
  const [grid, setGrid] = useState<MonthlyAttendanceGrid | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMonthlyAttendanceGrid(classId, yearMonth)
      .then(setGrid)
      .finally(() => setLoading(false));
  }, [classId, yearMonth]);

  const hasData = !!grid && grid.schoolDays.length > 0;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #attendance-print-area, #attendance-print-area * { visibility: visible; }
          #attendance-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>
      <Card className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-navy">Lưới điểm danh tháng</h3>
          <Input type="month" className="w-48" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
          {hasPermission("children.export") && (
            <Button size="sm" className="ml-auto" disabled={!hasData} onClick={() => window.print()}>
              In / Lưu PDF
            </Button>
          )}
        </div>
        {!hasData && !loading && <p className="text-sm text-navy/50">Tháng này chưa có bản ghi điểm danh nào.</p>}
      </Card>

      {hasData && grid && (
        <div id="attendance-print-area" className="mt-4 overflow-x-auto rounded-xl border border-navy/10 bg-white p-4 text-xs">
          <div className="mb-3 text-center">
            <p className="text-base font-bold">THÁNG {Number(yearMonth.slice(5, 7))} NĂM {yearMonth.slice(0, 4)}</p>
            <p>
              Tỷ lệ chuyên cần: Bình quân {grid.avgPerDay} trẻ = {grid.rate}%
            </p>
          </div>
          <table className="w-full border-collapse whitespace-nowrap">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-navy/30 p-1">TT</th>
                <th rowSpan={2} className="border border-navy/30 p-1 text-left">Họ và tên trẻ</th>
                {grid.schoolDays.map((d) => (
                  <th key={d} className="border border-navy/30 p-1">{weekdayOf(d)}</th>
                ))}
                <th rowSpan={2} className="border border-navy/30 p-1">Tổng số ngày</th>
              </tr>
              <tr>
                {grid.schoolDays.map((d) => (
                  <th key={d} className="border border-navy/30 p-1 font-normal">{formatDdMm(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.children.map((c, i) => (
                <tr key={c.childId}>
                  <td className="border border-navy/30 p-1 text-center">{i + 1}</td>
                  <td className="border border-navy/30 p-1">{c.fullName}</td>
                  {grid.schoolDays.map((d) => (
                    <td key={d} className="border border-navy/30 p-1 text-center">
                      {c.cells[d] === "N" ? <span className="text-danger">N</span> : c.cells[d] === "x" ? "x" : ""}
                    </td>
                  ))}
                  <td className="border border-navy/30 p-1 text-center font-semibold">{c.totalDays}</td>
                </tr>
              ))}
              <tr className="bg-warn/10 font-semibold">
                <td colSpan={2} className="border border-navy/30 p-1 text-center">Tổng số</td>
                {grid.schoolDays.map((d) => (
                  <td key={d} className="border border-navy/30 p-1 text-center">{grid.dailyTotals[d]}</td>
                ))}
                <td className="border border-navy/30 p-1 text-center">
                  {Object.values(grid.dailyTotals).reduce((s, n) => s + n, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function monthLabel(row: MonthlyAttendanceStatsRow): string {
  if (row.label.includes("-")) return String(Number(row.label.slice(5, 7)));
  return row.label;
}

function YearlySummarySection({ classId }: { classId: string }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [summary, setSummary] = useState<YearlyAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolYear) return;
    setLoading(true);
    getYearlyAttendanceSummary(classId, schoolYear.start_date, schoolYear.end_date)
      .then(setSummary)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, schoolYear?.id, schoolYear?.start_date, schoolYear?.end_date]);

  const rows = summary ? [...summary.months, summary.semester1, summary.semester2, summary.fullYear] : [];
  const isSummaryRow = (r: MonthlyAttendanceStatsRow) => !r.label.includes("-");

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #attendance-yearly-print-area, #attendance-yearly-print-area * { visibility: visible; }
          #attendance-yearly-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <Card className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-navy">Tổng hợp chuyên cần hàng tháng</h3>
          {hasPermission("children.export") && summary && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => window.print()}>
                In / Lưu PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  exportFinanceReportToExcel(
                    `Tong-hop-chuyen-can-${classId}`,
                    rows.map((r) => [
                      monthLabel(r),
                      r.registered,
                      r.attended,
                      r.schoolDays,
                      r.totalPresentDays,
                      r.avgPerDay,
                      `${r.rate}%`,
                    ]),
                    [
                      "Tháng",
                      "Số trẻ đăng ký",
                      "Số trẻ đi học",
                      "Số ngày học trong tháng",
                      "Tổng số ngày trẻ đi học",
                      "Bình quân trẻ đi học/tháng",
                      "Tỷ lệ chuyên cần",
                    ],
                  )
                }
              >
                Xuất Excel
              </Button>
            </div>
          )}
        </div>
        {!loading && summary && summary.months.every((m) => m.schoolDays === 0) && (
          <p className="text-sm text-navy/50">Chưa có bản ghi điểm danh nào trong năm học này.</p>
        )}
      </Card>

      {summary && (
        <div id="attendance-yearly-print-area" className="mt-4 overflow-x-auto rounded-xl border border-navy/10 bg-white p-4 text-sm">
          <p className="mb-3 text-center text-base font-bold">TỔNG HỢP CHUYÊN CẦN HÀNG THÁNG</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-navy/30 p-1">Tháng</th>
                <th className="border border-navy/30 p-1">Số trẻ đăng ký</th>
                <th className="border border-navy/30 p-1">Số trẻ đi học</th>
                <th className="border border-navy/30 p-1">Số ngày học trong tháng</th>
                <th className="border border-navy/30 p-1">Tổng số ngày trẻ đi học</th>
                <th className="border border-navy/30 p-1">Bình quân trẻ đi học/tháng</th>
                <th className="border border-navy/30 p-1">Tỷ lệ chuyên cần</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={isSummaryRow(r) ? "bg-navy/5 font-semibold" : ""}>
                  <td className="border border-navy/30 p-1 text-center">{monthLabel(r)}</td>
                  <td className="border border-navy/30 p-1 text-center">{r.registered}</td>
                  <td className="border border-navy/30 p-1 text-center">{r.attended}</td>
                  <td className="border border-navy/30 p-1 text-center">{r.schoolDays}</td>
                  <td className="border border-navy/30 p-1 text-center">{r.totalPresentDays}</td>
                  <td className="border border-navy/30 p-1 text-center">{r.avgPerDay}</td>
                  <td className="border border-navy/30 p-1 text-center">{r.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
