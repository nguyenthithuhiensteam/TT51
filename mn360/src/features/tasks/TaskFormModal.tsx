import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { taskSchema, type TaskFormInput } from "../../lib/schemas/task";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import type { User } from "../../lib/db/types";
import type { TaskWithOwner } from "../../lib/db/taskRepo";

export function TaskFormModal({
  open,
  onClose,
  onSubmit,
  users,
  initial,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormInput) => Promise<void>;
  users: User[];
  initial?: TaskWithOwner | null;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "normal", coordinatorIds: [] },
  });

  useEffect(() => {
    if (open) {
      reset(
        initial
          ? {
              title: initial.title,
              field: initial.field ?? "",
              content: initial.content ?? "",
              priority: initial.priority,
              ownerId: initial.owner_id,
              coordinatorIds: [],
              startDate: initial.start_date ?? "",
              dueDate: initial.due_date ?? "",
              deliverable: initial.deliverable ?? "",
              doneCriteria: initial.done_criteria ?? "",
            }
          : {
              title: "",
              field: "",
              content: "",
              priority: "normal",
              ownerId: "",
              coordinatorIds: [],
              startDate: "",
              dueDate: "",
              deliverable: "",
              doneCriteria: "",
            },
      );
    }
  }, [open, initial, reset]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Sửa nhiệm vụ" : "Tạo nhiệm vụ mới"} wide>
      <form
        onSubmit={handleSubmit(async (data) => {
          await onSubmit(data);
        })}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Field label="Tên nhiệm vụ" error={errors.title?.message} required>
            <Input {...register("title")} />
          </Field>
        </div>
        <Field label="Lĩnh vực">
          <Input {...register("field")} placeholder="VD: Chuyên môn, Tài sản..." />
        </Field>
        <Field label="Mức độ ưu tiên" required>
          <Select {...register("priority")}>
            <option value="low">Thấp</option>
            <option value="normal">Bình thường</option>
            <option value="high">Cao</option>
            <option value="urgent">Khẩn cấp</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Nội dung">
            <Textarea {...register("content")} />
          </Field>
        </div>
        <Field label="Người chủ trì" error={errors.ownerId?.message} required>
          <Select {...register("ownerId")}>
            <option value="">-- Chọn người chủ trì --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ngày bắt đầu">
          <Input type="date" {...register("startDate")} />
        </Field>
        <Field label="Hạn hoàn thành" error={errors.dueDate?.message} required>
          <Input type="date" {...register("dueDate")} />
        </Field>
        <Field label="Sản phẩm phải nộp">
          <Input {...register("deliverable")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tiêu chí hoàn thành">
            <Textarea {...register("doneCriteria")} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu nhiệm vụ"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
