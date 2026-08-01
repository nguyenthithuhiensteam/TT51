import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { loginSchema, type LoginInput } from "../../lib/schemas/auth";
import { loginWithPassword } from "@/lib/db/authRepo";
import { getSchool, getCurrentSchoolYear } from "@/lib/db/systemRepo";
import { generateOverdueNotifications } from "@/lib/db/taskRepo";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { WebPreviewBanner } from "../../components/layout/WebPreviewBanner";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setSchoolContext = useAppStore((s) => s.setSchoolContext);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      const { user, roles, permissions, sessionId } = await loginWithPassword(
        data.username.trim(),
        data.password,
      );

      const school = await getSchool();
      const schoolYear = school ? await getCurrentSchoolYear(school.id) : null;
      setSchoolContext(school, schoolYear);
      if (schoolYear) {
        const today = new Date().toISOString().slice(0, 10);
        await generateOverdueNotifications(schoolYear.id, today);
      }

      setSession({ user, roles, permissions, sessionId });
      navigate(user.must_change_password ? "/doi-mat-khau" : "/", { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4">
      <div className="fixed inset-x-0 top-0">
        <WebPreviewBanner />
      </div>
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">
            M
          </div>
          <h1 className="text-xl font-bold text-navy">MN360</h1>
          <p className="text-sm text-navy/60">Hệ điều hành trường mầm non số</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Tên đăng nhập" error={errors.username?.message} required>
            <Input autoFocus autoComplete="username" {...register("username")} />
          </Field>
          <Field label="Mật khẩu" error={errors.password?.message} required>
            <Input type="password" autoComplete="current-password" {...register("password")} />
          </Field>
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-navy/40">
          Dữ liệu được lưu trữ và bảo vệ theo tài khoản đăng nhập của bạn.
        </p>
      </div>
    </div>
  );
}
