import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Input";
import { staffSchema, type StaffFormInput } from "../../lib/schemas/staff";
import type { User } from "../../lib/db/types";

export type StaffFormValues = StaffFormInput;

export function StaffFormModal({
  open,
  onClose,
  onSubmit,
  users,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: StaffFormValues) => Promise<void>;
  users: User[];
  submitting: boolean;
  error: string | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { employmentType: "contract" },
  });

  useEffect(() => {
    if (open) {
      reset({ userId: "", employeeCode: "", position: "", employmentType: "contract", degree: "", startDate: "" });
    }
  }, [open, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Tạo hồ sơ cán bộ">
      <form
        onSubmit={handleSubmit(async (data) => onSubmit(data))}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Field label="Tài khoản người dùng" error={errors.userId?.message} required>
            <Select {...register("userId")}>
              <option value="">-- Chọn người dùng --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </Select>
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
            {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
