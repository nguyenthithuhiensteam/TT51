import { z } from "zod";

export const classSchema = z.object({
  code: z.string().min(1, "Vui lòng nhập mã lớp"),
  name: z.string().min(2, "Tên lớp phải có ít nhất 2 ký tự"),
  ageGroup: z.string().min(1, "Vui lòng nhập độ tuổi"),
  homeroomTeacherId: z.string().optional(),
  room: z.string().optional(),
  capacity: z.string().optional(),
});
export type ClassFormInput = z.infer<typeof classSchema>;

export const childSchema = z.object({
  fullName: z.string().min(2, "Họ và tên phải có ít nhất 2 ký tự"),
  dob: z.string().min(1, "Vui lòng chọn ngày sinh"),
  gender: z.enum(["male", "female"]),
  classId: z.string().optional(),
  enrollmentDate: z.string().min(1, "Vui lòng chọn ngày tiếp nhận"),
});
export type ChildFormInput = z.infer<typeof childSchema>;
