import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { changePasswordSchema, type ChangePasswordInput } from "../../lib/schemas/auth";
import { logAudit, updatePassword } from "../../lib/db/authRepo";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";

export function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  if (!user) return null;

  async function onSubmit(data: ChangePasswordInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      const ok = await invoke<boolean>("verify_password", {
        password: data.currentPassword,
        hash: user!.password_hash,
      });
      if (!ok) {
        setServerError("Mật khẩu hiện tại không đúng");
        return;
      }
      const newHash = await invoke<string>("hash_password", { password: data.newPassword });
      await updatePassword(user!.id, newHash);
      await logAudit({
        entityTable: "users",
        entityId: user!.id,
        action: "change_password",
        userId: user!.id,
        sessionId,
      });
      updateUser({ ...user!, password_hash: newHash, must_change_password: 0 });
      navigate("/", { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold text-navy">Đổi mật khẩu</h1>
      <p className="mb-4 text-sm text-navy/60">
        {user.must_change_password
          ? "Đây là lần đăng nhập đầu tiên, vui lòng đặt mật khẩu mới trước khi tiếp tục."
          : "Cập nhật mật khẩu tài khoản của bạn."}
      </p>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Mật khẩu hiện tại" error={errors.currentPassword?.message} required>
            <Input type="password" {...register("currentPassword")} />
          </Field>
          <Field label="Mật khẩu mới" error={errors.newPassword?.message} required>
            <Input type="password" {...register("newPassword")} />
          </Field>
          <Field label="Xác nhận mật khẩu mới" error={errors.confirmPassword?.message} required>
            <Input type="password" {...register("confirmPassword")} />
          </Field>
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Đang lưu..." : "Lưu mật khẩu mới"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
