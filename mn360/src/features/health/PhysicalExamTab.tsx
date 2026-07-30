import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import { listClasses, type ClassWithTeacher } from "../../lib/db/childRepo";
import {
  getPhysicalExamGrid,
  listPhysicalExamRounds,
  upsertPhysicalExam,
  type PhysicalExamRow,
  type UpsertPhysicalExamInput,
} from "../../lib/db/healthRepo";
import { PHYSICAL_EXAM_SPECIALTY_LABELS, type PhysicalExamSpecialtyFields } from "../../lib/db/types";

const SPECIALTY_KEYS = Object.keys(PHYSICAL_EXAM_SPECIALTY_LABELS) as (keyof PhysicalExamSpecialtyFields)[];

function blankForm(row: PhysicalExamRow): UpsertPhysicalExamInput {
  return {
    tai_mui_hong: row.tai_mui_hong ?? "",
    rang_ham_mat: row.rang_ham_mat ?? "",
    co_xuong_khop: row.co_xuong_khop ?? "",
    tim_mach: row.tim_mach ?? "",
    ho_hap: row.ho_hap ?? "",
    tam_than_kinh: row.tam_than_kinh ?? "",
    mat: row.mat ?? "",
    benh_khac: row.benh_khac ?? "",
    xepLoai: row.xep_loai ?? "",
    ketLuan: row.ket_luan ?? "Bình thường",
  };
}

export function PhysicalExamTab() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const school = useAppStore((s) => s.school);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);
  const [classId, setClassId] = useState("");
  const [rounds, setRounds] = useState<{ examNo: number; examDate: string }[]>([]);
  const [examNo, setExamNo] = useState(1);
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<PhysicalExamRow[]>([]);
  const [forms, setForms] = useState<Record<string, UpsertPhysicalExamInput>>({});
  const [busyChild, setBusyChild] = useState<string | null>(null);

  useEffect(() => {
    if (schoolYear) listClasses(schoolYear.id).then(setClasses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);

  async function refreshRounds() {
    if (!classId) return;
    const r = await listPhysicalExamRounds(classId);
    setRounds(r);
    const existing = r.find((x) => x.examNo === examNo);
    if (existing) setExamDate(existing.examDate);
  }

  useEffect(() => {
    refreshRounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function refresh() {
    if (!classId) return;
    const grid = await getPhysicalExamGrid(classId, examNo);
    setRows(grid);
    const f: Record<string, UpsertPhysicalExamInput> = {};
    grid.forEach((row) => {
      f[row.child_id] = blankForm(row);
    });
    setForms(f);
    const round = rounds.find((r) => r.examNo === examNo);
    if (round) setExamDate(round.examDate);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, examNo]);

  async function saveRow(childId: string) {
    if (!user || !classId) return;
    const form = forms[childId];
    if (!form) return;
    setBusyChild(childId);
    try {
      await upsertPhysicalExam(childId, classId, examNo, examDate, form, user.id);
      await refreshRounds();
      await refresh();
    } finally {
      setBusyChild(null);
    }
  }

  const canEdit = hasPermission("health.edit");
  const dateLabel = useMemo(() => {
    const d = new Date(`${examDate}T00:00:00`);
    return `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  }, [examDate]);

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #physical-exam-print-area, #physical-exam-print-area * { visibility: visible; }
          #physical-exam-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>
      <Card className="print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Select className="w-56" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-40"
            value={examNo}
            onChange={(e) => setExamNo(Number(e.target.value))}
          >
            {[1, 2, 3, ...(rounds.some((r) => r.examNo > 3) ? [Math.max(...rounds.map((r) => r.examNo)) + 1] : [])]
              .filter((v, i, arr) => arr.indexOf(v) === i)
              .map((n) => (
                <option key={n} value={n}>
                  Lần {n}
                </option>
              ))}
          </Select>
          <Input type="date" className="w-48" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          {hasPermission("health.export") && rows.length > 0 && (
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => window.print()}>
              In / Lưu PDF
            </Button>
          )}
        </div>
        {!canEdit && <p className="mt-2 text-xs text-navy/40">Chỉ xem — cần quyền sửa Sức khỏe để nhập kết quả khám.</p>}
      </Card>

      <div id="physical-exam-print-area" className="overflow-x-auto rounded-xl border border-navy/10 bg-white p-4 text-xs">
        <div className="mb-3 text-center">
          <p className="font-bold">{school?.name ?? ""}</p>
          <p className="text-base font-bold">KHÁM SỨC KHỎE TOÀN DIỆN LẦN {examNo}</p>
          <p>{dateLabel}</p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-navy/30 p-1">TT</th>
              <th className="border border-navy/30 p-1 text-left">Họ và tên</th>
              {SPECIALTY_KEYS.map((k) => (
                <th key={k} className="border border-navy/30 p-1">
                  {PHYSICAL_EXAM_SPECIALTY_LABELS[k]}
                </th>
              ))}
              <th className="border border-navy/30 p-1">Xếp loại</th>
              <th className="border border-navy/30 p-1">Kết luận</th>
              {canEdit && <th className="border border-navy/30 p-1 print:hidden"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const form = forms[row.child_id] ?? blankForm(row);
              return (
                <tr key={row.child_id}>
                  <td className="border border-navy/30 p-1 text-center">{i + 1}</td>
                  <td className="border border-navy/30 p-1 whitespace-nowrap">{row.full_name}</td>
                  {SPECIALTY_KEYS.map((k) => (
                    <td key={k} className="border border-navy/30 p-0.5">
                      {canEdit ? (
                        <>
                          <input
                            className="w-24 border-0 bg-transparent p-1 text-center focus:outline-none focus:ring-1 focus:ring-brand/40 print:hidden"
                            value={form[k] ?? ""}
                            onChange={(e) => setForms((prev) => ({ ...prev, [row.child_id]: { ...form, [k]: e.target.value } }))}
                          />
                          <span className="hidden whitespace-normal break-words text-center print:block">{form[k] || ""}</span>
                        </>
                      ) : (
                        <span className="block whitespace-normal break-words text-center">{form[k] || ""}</span>
                      )}
                    </td>
                  ))}
                  <td className="border border-navy/30 p-0.5">
                    {canEdit ? (
                      <>
                        <input
                          className="w-16 border-0 bg-transparent p-1 text-center focus:outline-none focus:ring-1 focus:ring-brand/40 print:hidden"
                          value={form.xepLoai}
                          onChange={(e) => setForms((prev) => ({ ...prev, [row.child_id]: { ...form, xepLoai: e.target.value } }))}
                        />
                        <span className="hidden whitespace-normal break-words text-center print:block">{form.xepLoai}</span>
                      </>
                    ) : (
                      <span className="block whitespace-normal break-words text-center">{form.xepLoai}</span>
                    )}
                  </td>
                  <td className="border border-navy/30 p-0.5">
                    {canEdit ? (
                      <>
                        <input
                          className="w-36 border-0 bg-transparent p-1 focus:outline-none focus:ring-1 focus:ring-brand/40 print:hidden"
                          value={form.ketLuan}
                          onChange={(e) => setForms((prev) => ({ ...prev, [row.child_id]: { ...form, ketLuan: e.target.value } }))}
                        />
                        <span className="hidden whitespace-normal break-words print:block">{form.ketLuan}</span>
                      </>
                    ) : (
                      <span className="block whitespace-normal break-words">{form.ketLuan}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="border border-navy/30 p-1 text-center print:hidden">
                      <button
                        className="text-brand hover:underline disabled:opacity-40"
                        disabled={busyChild === row.child_id}
                        onClick={() => saveRow(row.child_id)}
                      >
                        Lưu
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={SPECIALTY_KEYS.length + (canEdit ? 4 : 3)} className="py-4 text-center text-navy/50">
                  Lớp chưa có trẻ đang học.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
