import { describe, expect, it } from "vitest";
import { staffSchema } from "./staff";

describe("staffSchema", () => {
  it("chấp nhận hồ sơ cán bộ hợp lệ", () => {
    const result = staffSchema.safeParse({
      userId: "user-gv1",
      employeeCode: "VC-0016",
      position: "Giáo viên",
      employmentType: "contract",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối khi thiếu tài khoản người dùng", () => {
    const result = staffSchema.safeParse({
      userId: "",
      employeeCode: "VC-0016",
      position: "Giáo viên",
      employmentType: "contract",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối loại hợp đồng không hợp lệ", () => {
    const result = staffSchema.safeParse({
      userId: "user-gv1",
      employeeCode: "VC-0016",
      position: "Giáo viên",
      employmentType: "vinh_vien",
    });
    expect(result.success).toBe(false);
  });
});
