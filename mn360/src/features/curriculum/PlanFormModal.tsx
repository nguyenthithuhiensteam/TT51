import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { PLAN_TYPE_LABELS } from "@/lib/db/types";
import { educationPlanSchema, type EducationPlanFormInput } from "../../lib/schemas/curriculum";
import type { ClassWithTeacher } from "@/lib/db/childRepo";

export type PlanFormValues = EducationPlanFormInput;

export function PlanFormModal({
  open,
  onClose,
  onSubmit,
  classes,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PlanFormValues) => Promise<void>;
  classes: ClassWithTeacher[];
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(educationPlanSchema),
    defaultValues: { planType: "week" },
  });

  useEffect(() => {
    if (open) {
      reset({
        planType: "week",
        title: "",
        classId: "",
        ageGroup: "",
        periodStart: "",
        periodEnd: "",
        objectives: "",
        requirements: "",
        content: "",
      });
    }
  }, [open, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Soạn kế hoạch giáo dục" wide>
      <form
        onSubmit={handleSubmit(async (data) => onSubmit(data))}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field label="Loại kế hoạch" required>
          <Select {...register("planType")}>
            {Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lớp áp dụng">
          <Select {...register("classId")}>
            <option value="">-- Toàn khối / không gắn lớp --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tên kế hoạch" error={errors.title?.message} required>
            <Input {...register("title")} />
          </Field>
        </div>
        <Field label="Độ tuổi">
          <Input {...register("ageGroup")} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Từ ngày">
            <Input type="date" {...register("periodStart")} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" {...register("periodEnd")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Mục tiêu">
            <Textarea {...register("objectives")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Yêu cầu cần đạt">
            <Textarea {...register("requirements")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Nội dung / hoạt động">
            <Textarea {...register("content")} className="min-h-[120px]" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu bản nháp"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
