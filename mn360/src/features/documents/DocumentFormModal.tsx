import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { documentSchema, type DocumentFormInput } from "../../lib/schemas/document";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";

export function DocumentFormModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DocumentFormInput) => Promise<void>;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DocumentFormInput>({
    resolver: zodResolver(documentSchema),
    defaultValues: { docType: "internal" },
  });

  useEffect(() => {
    if (open) reset({ docType: "internal", title: "", summary: "", issuingUnit: "", recipient: "", category: "", contentHtml: "" });
  }, [open, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Soạn thảo văn bản mới" wide>
      <form
        onSubmit={handleSubmit(async (data) => onSubmit(data))}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field label="Loại văn bản" required>
          <Select {...register("docType")}>
            <option value="incoming">Văn bản đến</option>
            <option value="outgoing">Văn bản đi</option>
            <option value="internal">Văn bản nội bộ</option>
            <option value="draft">Dự thảo</option>
          </Select>
        </Field>
        <Field label="Danh mục">
          <Input {...register("category")} placeholder="VD: Kế hoạch, Báo cáo..." />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tiêu đề" error={errors.title?.message} required>
            <Input {...register("title")} />
          </Field>
        </div>
        <Field label="Đơn vị ban hành">
          <Input {...register("issuingUnit")} />
        </Field>
        <Field label="Nơi nhận">
          <Input {...register("recipient")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Trích yếu">
            <Textarea {...register("summary")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Nội dung dự thảo">
            <Textarea {...register("contentHtml")} className="min-h-[140px]" />
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
