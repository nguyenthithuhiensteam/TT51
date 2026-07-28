import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Input";
import { classSchema, type ClassFormInput } from "../../lib/schemas/children";
import type { User } from "../../lib/db/types";

export type ClassFormValues = ClassFormInput;

export function ClassFormModal({
  open,
  onClose,
  onSubmit,
  teachers,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ClassFormValues) => Promise<void>;
  teachers: User[];
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassFormValues>({ resolver: zodResolver(classSchema) });

  useEffect(() => {
    if (open) {
      reset({ code: "", name: "", ageGroup: "", homeroomTeacherId: "", room: "", capacity: "" });
    }
  }, [open, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Thêm nhóm/lớp mới">
      <form
        onSubmit={handleSubmit(async (data) => onSubmit(data))}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field label="Mã lớp" error={errors.code?.message} required>
          <Input placeholder="VD: MGL-A" {...register("code")} />
        </Field>
        <Field label="Tên lớp" error={errors.name?.message} required>
          <Input placeholder="VD: Mẫu giáo lớn A" {...register("name")} />
        </Field>
        <Field label="Độ tuổi" error={errors.ageGroup?.message} required>
          <Input placeholder="VD: 5-6 tuổi" {...register("ageGroup")} />
        </Field>
        <Field label="Giáo viên chủ nhiệm">
          <Select {...register("homeroomTeacherId")}>
            <option value="">-- Chọn giáo viên --</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phòng học">
          <Input {...register("room")} />
        </Field>
        <Field label="Sĩ số tối đa">
          <Input type="number" {...register("capacity")} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu lớp"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
