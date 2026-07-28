import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(3, "Tên nhiệm vụ phải có ít nhất 3 ký tự"),
  field: z.string().optional(),
  content: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  ownerId: z.string().min(1, "Vui lòng chọn người chủ trì"),
  coordinatorIds: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  dueDate: z.string().min(1, "Vui lòng chọn hạn hoàn thành"),
  deliverable: z.string().optional(),
  doneCriteria: z.string().optional(),
});
export type TaskFormInput = z.infer<typeof taskSchema>;

export const taskProgressSchema = z.object({
  progressPercent: z.number().min(0).max(100),
  difficulty: z.string().optional(),
  proposal: z.string().optional(),
});
export type TaskProgressInput = z.infer<typeof taskProgressSchema>;
