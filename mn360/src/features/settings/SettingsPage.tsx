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
} from "@/lib/db/systemRepo";
import { getDataDir, setDataDir } from "@/lib/db/backupRepo";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import type { School, SchoolYear } from "@/lib/db/types";
import { defaultModelFor, loadAiConfig, saveAiConfig, type AiConfig, type AiProvider } from "../../lib/ai/gateway";
import { Select } from "../../components/ui/Input";
import { getDefaultMealFeeRate, setDefaultMealFeeRate } from "@/lib/db/rationRepo";
import { loadGoogleDriveConfig, saveGoogleDriveConfig, type GoogleDriveConfig } from "../../lib/import/googleDrive";
import { MyProfileCard } from "./MyProfileCard";
import { AccountManagementCard } from "./AccountManagementCard";

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const setSchoolContext = useAppStore((s) => s.setSchoolContext);
  const [school, setSchool] = useState<School | null>(null);
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [dataDir, setDataDirState] = useState("");
  const [dirBusy, setDirBusy] = useState(false);
  const [dirMessage, setDirMessage] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig>({ provider: "off", apiKey: "", model: "" });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [mealFeeRate, setMealFeeRateState] = useState("20000");
  const [mealFeeBusy, setMealFeeBusy] = useState(false);
  const [mealFeeMessage, setMealFeeMessage] = useState<string | null>(null);
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig>({ clientId: "", apiKey: "" });
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMessage, setDriveMessage] = useState<string | null>(null);
  const [schoolBusy, setSchoolBusy] = useState(false);
  const [schoolMessage, setSchoolMessage] = useState<string | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [yearError, setYearError] = useState<string | null>(null);
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
    setAiConfig(await loadAiConfig());
    setMealFeeRateState(String(await getDefaultMealFeeRate()));
    setDriveConfig(await loadGoogleDriveConfig());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveSchool(data: SchoolFormInput) {
    if (!school) return;
    setSchoolError(null);
    setSchoolMessage(null);
    setSchoolBusy(true);
    try {
      await updateSchool(school.id, data);
      const updated = await getSchool();
      setSchool(updated);
      const current = years.find((y) => y.is_current) ?? null;
      setSchoolContext(updated, current);
      setSchoolMessage("Đã lưu thông tin trường.");
    } catch (err) {
      setSchoolError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setSchoolBusy(false);
    }
  }

  async function onAddYear(data: SchoolYearFormInput) {
    if (!school) return;
    setYearError(null);
    try {
      await createSchoolYear(school.id, data.code, data.startDate, data.endDate);
      yearForm.reset({ code: "", startDate: "", endDate: "" });
      setYears(await listSchoolYears(school.id));
    } catch (err) {
      setYearError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    }
  }

  async function onSetCurrentYear(yearId: string) {
    if (!school) return;
    setYearError(null);
    try {
      await setCurrentSchoolYear(school.id, yearId);
      const updatedYears = await listSchoolYears(school.id);
      setYears(updatedYears);
      setSchoolContext(school, updatedYears.find((y) => y.id === yearId) ?? null);
    } catch (err) {
      setYearError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    }
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

      <MyProfileCard />

      {__ENABLE_GOOGLE_LOGIN__ && canEdit && <AccountManagementCard />}

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
              <Button type="submit" disabled={schoolBusy}>
                {schoolBusy ? "Đang lưu..." : "Lưu thông tin trường"}
              </Button>
              {schoolMessage && <span className="ml-3 text-sm text-mint">{schoolMessage}</span>}
              {schoolError && <p className="mt-2 text-sm text-danger">{schoolError}</p>}
            </div>
          )}
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-navy">Năm học</h2>
        {yearError && <p className="mb-3 text-sm text-danger">{yearError}</p>}
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

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Trợ lý AI (AI Gateway)</h2>
        <p className="mb-3 text-sm text-navy/60">
          AI chỉ hoạt động khi có Internet và đã cấu hình khóa API. Không gửi tên, ngày sinh,
          địa chỉ, số điện thoại của trẻ/phụ huynh — dữ liệu được ẩn danh trước khi gửi. Kết quả
          AI luôn có nhãn "Nội dung do AI hỗ trợ" và cần người kiểm tra trước khi lưu chính thức.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Nhà cung cấp">
            <Select
              disabled={!canEdit}
              value={aiConfig.provider}
              onChange={(e) => {
                const provider = e.target.value as AiProvider;
                setAiConfig((p) => ({ ...p, provider, model: p.model || defaultModelFor(provider) }));
              }}
            >
              <option value="off">Tắt hoàn toàn</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="claude">Anthropic Claude</option>
            </Select>
          </Field>
          <Field label="Model">
            <Input
              disabled={!canEdit || aiConfig.provider === "off"}
              value={aiConfig.model}
              placeholder={defaultModelFor(aiConfig.provider)}
              onChange={(e) => setAiConfig((p) => ({ ...p, model: e.target.value }))}
            />
          </Field>
          <Field label="Khóa API">
            <Input
              type="password"
              disabled={!canEdit || aiConfig.provider === "off"}
              value={aiConfig.apiKey}
              onChange={(e) => setAiConfig((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder="Dán khóa API tại đây"
            />
          </Field>
        </div>
        {canEdit && (
          <div className="mt-3">
            <Button
              size="sm"
              disabled={aiBusy}
              onClick={async () => {
                if (!user) return;
                setAiBusy(true);
                setAiMessage(null);
                try {
                  await saveAiConfig(aiConfig, user.id);
                  setAiMessage("Đã lưu cấu hình AI.");
                } finally {
                  setAiBusy(false);
                }
              }}
            >
              Lưu cấu hình AI
            </Button>
            {aiMessage && <span className="ml-3 text-sm text-mint">{aiMessage}</span>}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Tích hợp Google Drive</h2>
        <p className="mb-3 text-sm text-navy/60">
          Dùng để chọn tệp Excel trực tiếp từ Google Drive khi nhập danh sách trẻ/cán bộ hàng loạt.
          Cần Internet. Chỉ cần OAuth Client ID + API Key (tạo tại Google Cloud Console → APIs &
          Services → Credentials, bật Google Picker API và Google Drive API) — MN360 không lưu
          Client Secret, chỉ xin quyền đọc tệp (drive.readonly), không truy cập gì khác trên Drive
          của bạn.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="OAuth Client ID">
            <Input
              disabled={!canEdit}
              value={driveConfig.clientId}
              onChange={(e) => setDriveConfig((p) => ({ ...p, clientId: e.target.value }))}
              placeholder="xxxxxxxx.apps.googleusercontent.com"
            />
          </Field>
          <Field label="API Key">
            <Input
              disabled={!canEdit}
              value={driveConfig.apiKey}
              onChange={(e) => setDriveConfig((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder="Dán API Key tại đây"
            />
          </Field>
        </div>
        {canEdit && (
          <div className="mt-3">
            <Button
              size="sm"
              disabled={driveBusy}
              onClick={async () => {
                if (!user) return;
                setDriveBusy(true);
                setDriveMessage(null);
                try {
                  await saveGoogleDriveConfig(driveConfig, user.id);
                  setDriveMessage("Đã lưu cấu hình Google Drive.");
                } finally {
                  setDriveBusy(false);
                }
              }}
            >
              Lưu cấu hình Google Drive
            </Button>
            {driveMessage && <span className="ml-3 text-sm text-mint">{driveMessage}</span>}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-navy">Định mức tiền ăn</h2>
        <p className="mb-3 text-sm text-navy/60">
          Áp dụng làm mặc định khi lập khẩu phần ngày mới (Nuôi dưỡng → Khẩu phần dinh dưỡng).
          Đổi định mức ở đây không ảnh hưởng các khẩu phần đã lập trước đó.
        </p>
        <div className="max-w-xs">
          <Field label="Định mức tiền ăn/trẻ/ngày (đ)">
            <Input
              type="number"
              min="0"
              step="1000"
              disabled={!canEdit}
              value={mealFeeRate}
              onChange={(e) => setMealFeeRateState(e.target.value)}
            />
          </Field>
        </div>
        {canEdit && (
          <div className="mt-3">
            <Button
              size="sm"
              disabled={mealFeeBusy}
              onClick={async () => {
                if (!user) return;
                setMealFeeBusy(true);
                setMealFeeMessage(null);
                try {
                  await setDefaultMealFeeRate(parseFloat(mealFeeRate) || 0, user.id);
                  setMealFeeMessage("Đã lưu định mức tiền ăn.");
                } finally {
                  setMealFeeBusy(false);
                }
              }}
            >
              Lưu định mức
            </Button>
            {mealFeeMessage && <span className="ml-3 text-sm text-mint">{mealFeeMessage}</span>}
          </div>
        )}
      </Card>
    </div>
  );
}
