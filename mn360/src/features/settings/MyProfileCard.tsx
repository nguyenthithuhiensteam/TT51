import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { myProfileSchema, type MyProfileInput } from "../../lib/schemas/system";
import { updateMyProfile } from "@/lib/db/authRepo";
import { useAuthStore } from "../../store/authStore";

/** "Tài khoản của tôi" — mọi tài khoản đăng nhập đều tự sửa được họ tên/email/điện thoại của
 * chính mình, không cần quyền system.edit (khác với thông tin trường/năm học). */
export function MyProfileCard() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<MyProfileInput>({
    resolver: zodResolver(myProfileSchema),
    values: user
      ? { fullName: user.full_name, email: user.email ?? "", phone: user.phone ?? "" }
      : undefined,
  });

  async function onSave(data: MyProfileInput) {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateMyProfile(user.id, {
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
      });
      updateUser({ ...user, full_name: data.fullName, email: data.email || null, phone: data.phone || null });
      setMessage("Đã lưu thông tin cá nhân.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-navy">Tài khoản của tôi</h2>
      <form onSubmit={form.handleSubmit(onSave)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Họ và tên" error={form.formState.errors.fullName?.message} required>
          <Input {...form.register("fullName")} />
        </Field>
        <Field label="Tên đăng nhập">
          <Input disabled value={user?.username ?? ""} />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register("email")} />
        </Field>
        <Field label="Điện thoại">
          <Input {...form.register("phone")} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu thông tin cá nhân"}
          </Button>
          {message && <span className="ml-3 text-sm text-mint">{message}</span>}
        </div>
      </form>
    </Card>
  );
}
