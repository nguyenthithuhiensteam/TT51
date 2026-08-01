import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Input";
import { newStaffAccountSchema, type NewStaffAccountInput } from "../../lib/schemas/staff";
import type { Role } from "@/lib/db/types";

export type CreateStaffAccountValues = NewStaffAccountInput;

export function CreateStaffAccountModal({
  open,
  onClose,
  onSubmit,
  roles,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateStaffAccountValues) => Promise<void>;
  roles: Role[];
  submitting: boolean;
  error: string | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStaffAccountValues>({
    resolver: zodResolver(newStaffAccountSchema),
    defaultValues: { employmentType: "contract" },
  });

  useEffect(() => {
    if (open) {
      reset({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        roleId: "",
        tempPassword: "",
        employeeCode: "",
        position: "",
        employmentType: "contract",
        degree: "",
        startDate: "",
      });
    }
  }, [open, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Thêm cán bộ mới (tạo tài khoản đăng nhập)">
      <form
        onSubmit={handleSubmit(async (data) => onSubmit(data))}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <p className="text-xs text-navy/50 sm:col-span-2">
          Tạo tài khoản đăng nhập mới và hồ sơ cán bộ trong cùng một bước. Cán bộ bắt buộc phải
          đổi mật khẩu ngay lần đăng nhập đầu tiên.
        </p>
        <div className="sm:col-span-2">
          <Field label="Họ và tên" error={errors.fullName?.message} required>
            <Input {...register("fullName")} />
          </Field>
        </div>
        <Field label="Tên đăng nhập" error={errors.username?.message} required>
          <Input placeholder="VD: nguyenvana" {...register("username")} />
        </Field>
        <Field label="Vai trò" error={errors.roleId?.message} required>
          <Select {...register("roleId")}>
            <option value="">-- Chọn vai trò --</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Email">
          <Input type="email" {...register("email")} />
        </Field>
        <Field label="Điện thoại">
          <Input {...register("phone")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Mật khẩu tạm" error={errors.tempPassword?.message} required>
            <Input type="text" placeholder="VD: Abcd1234" {...register("tempPassword")} />
          </Field>
        </div>
        <Field label="Mã viên chức" error={errors.employeeCode?.message} required>
          <Input placeholder="VD: VC-0016" {...register("employeeCode")} />
        </Field>
        <Field label="Chức vụ" error={errors.position?.message} required>
          <Input placeholder="VD: Giáo viên" {...register("position")} />
        </Field>
        <Field label="Loại hợp đồng" required>
          <Select {...register("employmentType")}>
            <option value="payroll">Biên chế</option>
            <option value="contract">Hợp đồng</option>
            <option value="probation">Thử việc</option>
          </Select>
        </Field>
        <Field label="Trình độ">
          <Input {...register("degree")} />
        </Field>
        <Field label="Ngày vào trường">
          <Input type="date" {...register("startDate")} />
        </Field>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang tạo..." : "Tạo tài khoản + hồ sơ"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
