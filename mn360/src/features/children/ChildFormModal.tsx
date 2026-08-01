import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Input";
import { childSchema, type ChildFormInput } from "../../lib/schemas/children";
import type { ClassWithTeacher } from "@/lib/db/childRepo";

export type ChildFormValues = ChildFormInput;

export function ChildFormModal({
  open,
  onClose,
  onSubmit,
  classes,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ChildFormValues) => Promise<void>;
  classes: ClassWithTeacher[];
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChildFormValues>({
    resolver: zodResolver(childSchema),
    defaultValues: { gender: "male" },
  });

  useEffect(() => {
    if (open) {
      reset({
        fullName: "",
        dob: "",
        gender: "male",
        classId: "",
        enrollmentDate: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Tiếp nhận trẻ mới">
      <form
        onSubmit={handleSubmit(async (data) => onSubmit(data))}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Field label="Họ và tên trẻ" error={errors.fullName?.message} required>
            <Input {...register("fullName")} />
          </Field>
        </div>
        <Field label="Ngày sinh" error={errors.dob?.message} required>
          <Input type="date" {...register("dob")} />
        </Field>
        <Field label="Giới tính" required>
          <Select {...register("gender")}>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </Select>
        </Field>
        <Field label="Xếp lớp">
          <Select {...register("classId")}>
            <option value="">-- Chưa xếp lớp --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ngày tiếp nhận" error={errors.enrollmentDate?.message} required>
          <Input type="date" {...register("enrollmentDate")} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu hồ sơ trẻ"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
