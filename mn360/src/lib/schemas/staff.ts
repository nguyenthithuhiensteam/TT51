import { z } from "zod";

export const staffSchema = z.object({
  userId: z.string().min(1, "Vui lòng chọn tài khoản người dùng"),
  employeeCode: z.string().min(1, "Vui lòng nhập mã viên chức"),
  position: z.string().min(2, "Vui lòng nhập chức vụ"),
  employmentType: z.enum(["payroll", "contract", "probation"]),
  degree: z.string().optional(),
  startDate: z.string().optional(),
});
export type StaffFormInput = z.infer<typeof staffSchema>;
