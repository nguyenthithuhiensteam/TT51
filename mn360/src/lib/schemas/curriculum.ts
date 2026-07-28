import { z } from "zod";

export const educationPlanSchema = z.object({
  planType: z.enum(["year", "month", "topic", "week", "day", "activity", "steam", "sel", "inclusive"]),
  title: z.string().min(3, "Tên kế hoạch phải có ít nhất 3 ký tự"),
  classId: z.string().optional(),
  ageGroup: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  objectives: z.string().optional(),
  requirements: z.string().optional(),
  content: z.string().optional(),
});
export type EducationPlanFormInput = z.infer<typeof educationPlanSchema>;
