import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { ImportFileSourceBar } from "../../components/import/ImportFileSourceBar";
import { parseWorkbookRows, downloadImportTemplate } from "../../lib/import/excel";
import { createUserAccount, isUsernameTaken } from "../../lib/db/systemRepo";
import { createStaff } from "../../lib/db/staffRepo";
import { ROLE_LABELS, EMPLOYMENT_TYPE_LABELS, type EmploymentType, type Role } from "../../lib/db/types";

const TEMPLATE_HEADERS = [
  "Họ và tên",
  "Tên đăng nhập (để trống sẽ tự tạo)",
  "Vai trò",
  "Mã viên chức",
  "Chức vụ",
  "Loại hợp đồng (Biên chế/Hợp đồng/Thử việc)",
  "Trình độ",
  "Ngày bắt đầu (YYYY-MM-DD)",
];

const ROLE_LABEL_TO_CODE = Object.entries(ROLE_LABELS).reduce<Record<string, string>>((acc, [code, label]) => {
  acc[label.toLowerCase()] = code;
  return acc;
}, {});

const EMPLOYMENT_LABEL_TO_CODE = Object.entries(EMPLOYMENT_TYPE_LABELS).reduce<Record<string, EmploymentType>>(
  (acc, [code, label]) => {
    acc[label.toLowerCase()] = code as EmploymentType;
    return acc;
  },
  {},
);

function slugifyVietnamese(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

interface ParsedStaffRow {
  rowNumber: number;
  fullName: string;
  usernameInput: string;
  roleLabel: string;
  roleId: string;
  employeeCode: string;
  position: string;
  employmentType: EmploymentType | "";
  degree: string;
  startDate: string;
  errors: string[];
}

function mapRow(raw: Record<string, string>, index: number, roles: Role[]): ParsedStaffRow {
  const errors: string[] = [];
  const fullName = (raw["Họ và tên"] ?? "").trim();
  if (fullName.length < 2) errors.push("Thiếu họ và tên");

  const usernameInput = (raw["Tên đăng nhập (để trống sẽ tự tạo)"] ?? raw["Tên đăng nhập"] ?? "").trim().toLowerCase();
  if (usernameInput && !/^[a-z0-9_.]+$/.test(usernameInput)) {
    errors.push("Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm hoặc gạch dưới");
  }

  const roleLabel = (raw["Vai trò"] ?? "").trim();
  const roleCode = ROLE_LABEL_TO_CODE[roleLabel.toLowerCase()];
  const role = roles.find((r) => r.code === roleCode);
  if (!role) errors.push(`Không nhận diện được vai trò "${roleLabel}"`);

  const employeeCode = (raw["Mã viên chức"] ?? "").trim();
  if (!employeeCode) errors.push("Thiếu mã viên chức");

  const position = (raw["Chức vụ"] ?? "").trim();
  if (position.length < 2) errors.push("Thiếu chức vụ");

  const employmentLabel = (raw["Loại hợp đồng (Biên chế/Hợp đồng/Thử việc)"] ?? raw["Loại hợp đồng"] ?? "").trim();
  const employmentType = EMPLOYMENT_LABEL_TO_CODE[employmentLabel.toLowerCase()] ?? "";
  if (!employmentType) errors.push(`Không nhận diện được loại hợp đồng "${employmentLabel}"`);

  return {
    rowNumber: index + 2,
    fullName,
    usernameInput,
    roleLabel,
    roleId: role?.id ?? "",
    employeeCode,
    position,
    employmentType,
    degree: (raw["Trình độ"] ?? "").trim(),
    startDate: (raw["Ngày bắt đầu (YYYY-MM-DD)"] ?? raw["Ngày bắt đầu"] ?? "").trim(),
    errors,
  };
}

async function resolveUsername(base: string, usedInBatch: Set<string>): Promise<string> {
  let candidate = base || "canbo";
  let suffix = 1;
  while (usedInBatch.has(candidate) || (await isUsernameTaken(candidate))) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  usedInBatch.add(candidate);
  return candidate;
}

export function ImportStaffModal({
  open,
  onClose,
  roles,
  createdBy,
  sessionId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
  createdBy: string;
  sessionId: string | null;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ParsedStaffRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; failMessages: string[] } | null>(null);

  function reset() {
    setRows([]);
    setParseError(null);
    setTempPassword("");
    setPasswordError(null);
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
      setRows(raw.map((r, i) => mapRow(r, i, roles)));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Không đọc được tệp Excel");
    }
  }

  const importableRows = rows.filter((r) => r.errors.length === 0);
  const blockingErrorRows = rows.filter((r) => r.errors.length > 0);

  function validatePassword(): boolean {
    if (tempPassword.length < 8 || !/[A-Za-z]/.test(tempPassword) || !/[0-9]/.test(tempPassword)) {
      setPasswordError("Mật khẩu tạm phải có ít nhất 8 ký tự, gồm chữ và số");
      return false;
    }
    setPasswordError(null);
    return true;
  }

  async function handleImport() {
    if (!validatePassword()) return;
    setImporting(true);
    let success = 0;
    const failMessages: string[] = [];
    const usedUsernames = new Set<string>();
    for (const row of importableRows) {
      try {
        const username = row.usernameInput || (await resolveUsername(slugifyVietnamese(row.fullName), usedUsernames));
        if (row.usernameInput) {
          if (await isUsernameTaken(row.usernameInput)) {
            throw new Error(`tên đăng nhập "${row.usernameInput}" đã tồn tại`);
          }
          usedUsernames.add(row.usernameInput);
        }
        const passwordHash = await invoke<string>("hash_password", { password: tempPassword });
        const userId = await createUserAccount({
          username,
          fullName: row.fullName,
          roleId: row.roleId,
          passwordHash,
          createdBy,
          sessionId,
        });
        await createStaff({
          userId,
          employeeCode: row.employeeCode,
          position: row.position,
          employmentType: row.employmentType as EmploymentType,
          degree: row.degree || undefined,
          startDate: row.startDate || undefined,
          createdBy,
        });
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
      title="Nhập danh sách cán bộ từ Excel"
      onClose={() => {
        reset();
        onClose();
      }}
      wide
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-cream p-3 text-sm text-navy/70">
          <p className="mb-2">
            Mỗi dòng sẽ tạo một tài khoản đăng nhập mới + hồ sơ cán bộ, dùng chung một mật khẩu tạm
            (bắt buộc đổi khi đăng nhập lần đầu). Cột "Vai trò" cần khớp đúng tên vai trò trong hệ
            thống (ví dụ: Giáo viên, Kế toán, Nhân viên y tế...).
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadImportTemplate("Đội ngũ", "mau-nhap-can-bo.xlsx", TEMPLATE_HEADERS, [
                "Trần Thị Bình",
                "",
                "Giáo viên",
                "NV-0099",
                "Giáo viên lớp Mẫu giáo bé A",
                "Biên chế",
                "Cao đẳng Sư phạm Mầm non",
                "2026-09-01",
              ])
            }
          >
            Tải mẫu Excel
          </Button>
        </div>

        <Field label="Mật khẩu tạm cho tất cả tài khoản mới" error={passwordError ?? undefined} required>
          <Input
            type="password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Ít nhất 8 ký tự, gồm chữ và số"
          />
        </Field>

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
                    <th className="px-2 py-1.5 font-medium">Vai trò</th>
                    <th className="px-2 py-1.5 font-medium">Mã viên chức</th>
                    <th className="px-2 py-1.5 font-medium">Chức vụ</th>
                    <th className="px-2 py-1.5 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNumber} className={`border-b border-navy/5 ${r.errors.length ? "bg-danger/5" : ""}`}>
                      <td className="px-2 py-1.5">{r.rowNumber}</td>
                      <td className="px-2 py-1.5">{r.fullName || "—"}</td>
                      <td className="px-2 py-1.5">{r.roleLabel || "—"}</td>
                      <td className="px-2 py-1.5">{r.employeeCode || "—"}</td>
                      <td className="px-2 py-1.5">{r.position || "—"}</td>
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
                {importing ? "Đang nhập..." : `Nhập ${importableRows.length} cán bộ`}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="rounded-lg border border-navy/10 p-3 text-sm">
            <p className="font-medium text-navy">
              Đã tạo thành công {result.success} tài khoản + hồ sơ cán bộ{result.failed > 0 && `, ${result.failed} dòng lỗi`}.
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
