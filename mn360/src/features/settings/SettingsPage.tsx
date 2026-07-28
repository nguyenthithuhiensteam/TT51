import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { open } from "@tauri-apps/plugin-dialog";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { schoolSchema, schoolYearSchema, type SchoolFormInput, type SchoolYearFormInput } from "../../lib/schemas/system";
import {
  createSchoolYear,
  getSchool,
  listSchoolYears,
  setCurrentSchoolYear,
  updateSchool,
} from "../../lib/db/systemRepo";
import { getDataDir, setDataDir } from "../../lib/db/backupRepo";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import type { School, SchoolYear } from "../../lib/db/types";

export function SettingsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const setSchoolContext = useAppStore((s) => s.setSchoolContext);
  const [school, setSchool] = useState<School | null>(null);
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [dataDir, setDataDirState] = useState("");
  const [dirBusy, setDirBusy] = useState(false);
  const [dirMessage, setDirMessage] = useState<string | null>(null);
  const canEdit = hasPermission("system.edit");

  const schoolForm = useForm<SchoolFormInput>({ resolver: zodResolver(schoolSchema) });
  const yearForm = useForm<SchoolYearFormInput>({ resolver: zodResolver(schoolYearSchema) });

  async function refresh() {
    const s = await getSchool();
    setSchool(s);
    if (s) {
      schoolForm.reset({
        name: s.name,
        address: s.address ?? "",
        phone: s.phone ?? "",
        principalName: s.principal_name ?? "",
      });
      setYears(await listSchoolYears(s.id));
    }
    setDataDirState(await getDataDir());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveSchool(data: SchoolFormInput) {
    if (!school) return;
    await updateSchool(school.id, data);
    const updated = await getSchool();
    setSchool(updated);
    const current = years.find((y) => y.is_current) ?? null;
    setSchoolContext(updated, current);
  }

  async function onAddYear(data: SchoolYearFormInput) {
    if (!school) return;
    await createSchoolYear(school.id, data.code, data.startDate, data.endDate);
    yearForm.reset({ code: "", startDate: "", endDate: "" });
    setYears(await listSchoolYears(school.id));
  }

  async function onSetCurrentYear(yearId: string) {
    if (!school) return;
    await setCurrentSchoolYear(school.id, yearId);
    const updatedYears = await listSchoolYears(school.id);
    setYears(updatedYears);
    setSchoolContext(school, updatedYears.find((y) => y.id === yearId) ?? null);
  }

  async function onChangeDataDir() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    setDirBusy(true);
    setDirMessage(null);
    try {
      await setDataDir(selected);
      setDataDirState(selected);
      setDirMessage(
        "Đã sao chép dữ liệu sang thư mục mới. Vui lòng khởi động lại ứng dụng để áp dụng.",
      );
    } finally {
      setDirBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Cấu hình trường và năm học</h1>
        <p className="text-sm text-navy/60">Thông tin dùng chung cho toàn bộ hệ thống MN360.</p>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-navy">Thông tin trường</h2>
        <form
          onSubmit={schoolForm.handleSubmit(onSaveSchool)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <Field label="Tên trường" error={schoolForm.formState.errors.name?.message} required>
              <Input disabled={!canEdit} {...schoolForm.register("name")} />
            </Field>
          </div>
          <Field label="Địa chỉ">
            <Input disabled={!canEdit} {...schoolForm.register("address")} />
          </Field>
          <Field label="Điện thoại">
            <Input disabled={!canEdit} {...schoolForm.register("phone")} />
          </Field>
          <Field label="Hiệu trưởng">
            <Input disabled={!canEdit} {...schoolForm.register("principalName")} />
          </Field>
          {canEdit && (
            <div className="sm:col-span-2">
              <Button type="submit">Lưu thông tin trường</Button>
            </div>
          )}
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-navy">Năm học</h2>
        <table className="mb-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-navy/50">
              <th className="pb-2 font-medium">Năm học</th>
              <th className="pb-2 font-medium">Bắt đầu</th>
              <th className="pb-2 font-medium">Kết thúc</th>
              <th className="pb-2 font-medium">Trạng thái</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.id} className="border-b border-navy/5">
                <td className="py-2 font-medium">{y.code}</td>
                <td className="py-2">{y.start_date}</td>
                <td className="py-2">{y.end_date}</td>
                <td className="py-2">
                  {y.is_current ? (
                    <span className="rounded-full bg-mint/15 px-2 py-0.5 text-xs text-mint">
                      Đang sử dụng
                    </span>
                  ) : (
                    <span className="text-xs text-navy/40">—</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {!y.is_current && canEdit && (
                    <Button size="sm" variant="secondary" onClick={() => onSetCurrentYear(y.id)}>
                      Đặt làm năm học hiện tại
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <form
            onSubmit={yearForm.handleSubmit(onAddYear)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <Field label="Mã năm học" error={yearForm.formState.errors.code?.message}>
              <Input placeholder="2026-2027" {...yearForm.register("code")} />
            </Field>
            <Field label="Ngày bắt đầu" error={yearForm.formState.errors.startDate?.message}>
              <Input type="date" {...yearForm.register("startDate")} />
            </Field>
            <Field label="Ngày kết thúc" error={yearForm.formState.errors.endDate?.message}>
              <Input type="date" {...yearForm.register("endDate")} />
            </Field>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Thêm năm học
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Thư mục lưu dữ liệu</h2>
        <p className="mb-2 text-sm text-navy/60">
          Dữ liệu SQLite hiện đang lưu tại (khuyến nghị chọn ổ đĩa ngoài OneDrive):
        </p>
        <code className="mb-3 block break-all rounded-lg bg-cream p-2 text-xs">{dataDir}</code>
        {hasPermission("system.edit") && (
          <Button variant="secondary" disabled={dirBusy} onClick={onChangeDataDir}>
            {dirBusy ? "Đang chuyển..." : "Chọn thư mục dữ liệu khác"}
          </Button>
        )}
        {dirMessage && <p className="mt-2 text-sm text-warn">{dirMessage}</p>}
      </Card>
    </div>
  );
}
