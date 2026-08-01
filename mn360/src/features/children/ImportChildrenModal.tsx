import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ImportFileSourceBar } from "../../components/import/ImportFileSourceBar";
import { parseWorkbookRows, downloadImportTemplate } from "../../lib/import/excel";
import { createChild, type CreateChildInput, type ClassWithTeacher } from "@/lib/db/childRepo";

const TEMPLATE_HEADERS = ["Họ và tên", "Ngày sinh (YYYY-MM-DD)", "Giới tính (Nam/Nữ)", "Lớp", "Ngày nhập học (YYYY-MM-DD)"];

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

interface ParsedRow {
  rowNumber: number;
  fullName: string;
  dob: string;
  gender: "male" | "female" | "";
  className: string;
  classId?: string;
  enrollmentDate: string;
  errors: string[];
}

function mapRow(raw: Record<string, string>, index: number, classes: ClassWithTeacher[]): ParsedRow {
  const errors: string[] = [];
  const fullName = (raw["Họ và tên"] ?? "").trim();
  if (fullName.length < 2) errors.push("Thiếu họ và tên");

  const dobRaw = raw["Ngày sinh (YYYY-MM-DD)"] ?? raw["Ngày sinh"] ?? "";
  const dob = normalizeDate(dobRaw) ?? "";
  if (!dob) errors.push("Ngày sinh không hợp lệ (cần dạng YYYY-MM-DD)");

  const genderRaw = (raw["Giới tính (Nam/Nữ)"] ?? raw["Giới tính"] ?? "").trim().toLowerCase();
  let gender: "male" | "female" | "" = "";
  if (["nam", "male", "m"].includes(genderRaw)) gender = "male";
  else if (["nữ", "nu", "female", "f"].includes(genderRaw)) gender = "female";
  else errors.push("Giới tính không hợp lệ (Nam/Nữ)");

  const className = (raw["Lớp"] ?? "").trim();
  const matchedClass = classes.find((c) => c.name.trim().toLowerCase() === className.toLowerCase());
  if (className && !matchedClass) errors.push(`Không tìm thấy lớp "${className}" — sẽ nhập trẻ chưa xếp lớp`);

  const enrollRaw = raw["Ngày nhập học (YYYY-MM-DD)"] ?? raw["Ngày nhập học"] ?? "";
  const enrollmentDate = normalizeDate(enrollRaw) ?? new Date().toISOString().slice(0, 10);

  return {
    rowNumber: index + 2,
    fullName,
    dob,
    gender,
    className,
    classId: matchedClass?.id,
    enrollmentDate,
    errors,
  };
}

export function ImportChildrenModal({
  open,
  onClose,
  classes,
  schoolYearId,
  createdBy,
  sessionId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  classes: ClassWithTeacher[];
  schoolYearId: string | undefined;
  createdBy: string;
  sessionId: string | null;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; failMessages: string[] } | null>(null);

  function reset() {
    setRows([]);
    setParseError(null);
    setResult(null);
  }

  async function handleFile(bytes: ArrayBuffer) {
    setParseError(null);
    setResult(null);
    try {
      const raw = await parseWorkbookRows(bytes);
      if (raw.length === 0) {
        setParseError("Không đọc được dòng dữ liệu nào — kiểm tra lại tệp và tiêu đề cột.");
        return;
      }
      setRows(raw.map((r, i) => mapRow(r, i, classes)));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Không đọc được tệp Excel");
    }
  }

  const blockingErrorRows = rows.filter((r) => !r.fullName || !r.dob || !r.gender);
  const importableRows = rows.filter((r) => r.fullName && r.dob && r.gender);

  async function handleImport() {
    if (!schoolYearId) return;
    setImporting(true);
    let success = 0;
    const failMessages: string[] = [];
    for (const row of importableRows) {
      try {
        const input: CreateChildInput = {
          schoolYearId,
          classId: row.classId,
          fullName: row.fullName,
          dob: row.dob,
          gender: row.gender as "male" | "female",
          enrollmentDate: row.enrollmentDate,
          createdBy,
          sessionId,
        };
        await createChild(input);
        success += 1;
      } catch (err) {
        failMessages.push(`Dòng ${row.rowNumber} (${row.fullName}): ${err instanceof Error ? err.message : "lỗi không xác định"}`);
      }
    }
    setImporting(false);
    setResult({ success, failed: failMessages.length, failMessages });
    if (success > 0) onImported();
  }

  return (
    <Modal
      open={open}
      title="Nhập danh sách trẻ từ Excel"
      onClose={() => {
        reset();
        onClose();
      }}
      wide
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-cream p-3 text-sm text-navy/70">
          <p className="mb-2">
            Tải mẫu, điền danh sách trẻ theo đúng cột, rồi chọn tệp để nhập. Cột "Lớp" cần khớp
            đúng tên lớp đã có trong hệ thống (không bắt buộc).
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadImportTemplate("Trẻ em", "mau-nhap-tre-em.xlsx", TEMPLATE_HEADERS, [
                "Nguyễn Văn An",
                "2021-05-10",
                "Nam",
                "Mẫu giáo bé A",
                "2026-09-05",
              ])
            }
          >
            Tải mẫu Excel
          </Button>
        </div>

        <ImportFileSourceBar onFile={handleFile} disabled={importing} />
        {parseError && <p className="text-sm text-danger">{parseError}</p>}

        {rows.length > 0 && !result && (
          <>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-navy/10">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-navy/10 text-navy/50">
                    <th className="px-2 py-1.5 font-medium">Dòng</th>
                    <th className="px-2 py-1.5 font-medium">Họ và tên</th>
                    <th className="px-2 py-1.5 font-medium">Ngày sinh</th>
                    <th className="px-2 py-1.5 font-medium">Giới tính</th>
                    <th className="px-2 py-1.5 font-medium">Lớp</th>
                    <th className="px-2 py-1.5 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNumber} className={`border-b border-navy/5 ${r.errors.length && (!r.fullName || !r.dob || !r.gender) ? "bg-danger/5" : ""}`}>
                      <td className="px-2 py-1.5">{r.rowNumber}</td>
                      <td className="px-2 py-1.5">{r.fullName || "—"}</td>
                      <td className="px-2 py-1.5">{r.dob || "—"}</td>
                      <td className="px-2 py-1.5">{r.gender === "male" ? "Nam" : r.gender === "female" ? "Nữ" : "—"}</td>
                      <td className="px-2 py-1.5">{r.className || "—"}</td>
                      <td className="px-2 py-1.5 text-xs text-danger">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-navy/70">
              {importableRows.length} dòng hợp lệ sẽ được nhập
              {blockingErrorRows.length > 0 && `, ${blockingErrorRows.length} dòng lỗi sẽ bị bỏ qua`}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={reset} disabled={importing}>
                Chọn tệp khác
              </Button>
              <Button onClick={handleImport} disabled={importing || importableRows.length === 0}>
                {importing ? "Đang nhập..." : `Nhập ${importableRows.length} trẻ`}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="rounded-lg border border-navy/10 p-3 text-sm">
            <p className="font-medium text-navy">
              Đã nhập thành công {result.success} trẻ{result.failed > 0 && `, ${result.failed} dòng lỗi`}.
            </p>
            {result.failMessages.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-danger">
                {result.failMessages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => {
                  reset();
                  onClose();
                }}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
