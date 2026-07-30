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

export const newStaffAccountSchema = z.object({
  fullName: z.string().min(2, "Vui lòng nhập họ tên"),
  username: z
    .string()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .regex(/^[a-z0-9_.]+$/, "Chỉ dùng chữ thường, số, dấu chấm hoặc gạch dưới"),
  email: z.union([z.string().email("Email không hợp lệ"), z.literal("")]).optional(),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Vui lòng chọn vai trò"),
  tempPassword: z
    .string()
    .min(8, "Mật khẩu tạm phải có ít nhất 8 ký tự")
    .regex(/[A-Za-z]/, "Mật khẩu tạm phải có ít nhất một chữ cái")
    .regex(/[0-9]/, "Mật khẩu tạm phải có ít nhất một chữ số"),
  employeeCode: z.string().min(1, "Vui lòng nhập mã viên chức"),
  position: z.string().min(2, "Vui lòng nhập chức vụ"),
  employmentType: z.enum(["payroll", "contract", "probation"]),
  degree: z.string().optional(),
  startDate: z.string().optional(),
});
export type NewStaffAccountInput = z.infer<typeof newStaffAccountSchema>;
