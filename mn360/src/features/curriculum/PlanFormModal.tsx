import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { PLAN_TYPE_LABELS } from "../../lib/db/types";
import { educationPlanSchema, type EducationPlanFormInput } from "../../lib/schemas/curriculum";
import type { ClassWithTeacher } from "../../lib/db/childRepo";
import { generateEducationPlanDraft } from "../../lib/ai/curriculumAi";
import { describeAiError } from "../../lib/ai/gateway";

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
    watch,
    setValue,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(educationPlanSchema),
    defaultValues: { planType: "week" },
  });

  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const values = watch();

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
      setAiError(null);
      setAiBusy(false);
    }
  }, [open, reset]);

  async function handleGenerateWithAi() {
    if (!values.title?.trim()) {
      setAiError("Nhập tên/chủ đề kế hoạch trước khi tạo nội dung bằng AI.");
      return;
    }
    setAiError(null);
    setAiBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const className = classes.find((c) => c.id === values.classId)?.name;
      const draft = await generateEducationPlanDraft(
        {
          planType: values.planType,
          title: values.title,
          ageGroup: values.ageGroup,
          className,
          periodStart: values.periodStart,
          periodEnd: values.periodEnd,
          objectives: values.objectives,
          requirements: values.requirements,
          content: values.content,
        },
        controller.signal,
      );
      // Chỉ điền vào các mục còn trống — không ghi đè nội dung giáo viên đã nhập.
      if (!values.objectives?.trim() && draft.objectives) setValue("objectives", draft.objectives);
      if (!values.requirements?.trim() && draft.requirements) setValue("requirements", draft.requirements);
      const contentParts = [draft.content, draft.activities].filter(Boolean).join("\n\n");
      if (!values.content?.trim() && contentParts) setValue("content", contentParts);
    } catch (err) {
      setAiError(describeAiError(err));
    } finally {
      setAiBusy(false);
      abortRef.current = null;
    }
  }

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
        <div className="flex flex-col justify-end gap-1 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={aiBusy} onClick={handleGenerateWithAi}>
              <Sparkles size={14} /> {aiBusy ? "Đang tạo nội dung bằng AI..." : "Tạo bằng AI"}
            </Button>
            {aiBusy && (
              <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
                Hủy
              </Button>
            )}
          </div>
          <p className="text-xs text-navy/50">
            AI chỉ điền vào các mục còn trống bên dưới; bạn có thể chỉnh sửa mọi nội dung trước khi lưu.
          </p>
          {aiError && <p className="text-xs text-danger">{aiError}</p>}
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
