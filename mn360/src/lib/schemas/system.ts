import { z } from "zod";

export const schoolSchema = z.object({
  name: z.string().min(3, "Tên trường phải có ít nhất 3 ký tự"),
  address: z.string().optional(),
  phone: z.string().optional(),
  principalName: z.string().optional(),
});
export type SchoolFormInput = z.infer<typeof schoolSchema>;

export const schoolYearSchema = z
  .object({
    code: z
      .string()
      .regex(/^\d{4}-\d{4}$/, "Mã năm học phải có dạng 2025-2026"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: "Ngày bắt đầu phải trước ngày kết thúc",
    path: ["endDate"],
  });
export type SchoolYearFormInput = z.infer<typeof schoolYearSchema>;
