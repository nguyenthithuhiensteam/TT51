import { describe, expect, it } from "vitest";
import { childSchema, classSchema } from "./children";

describe("classSchema", () => {
  it("chấp nhận lớp hợp lệ", () => {
    const result = classSchema.safeParse({ code: "MGL-A", name: "Mẫu giáo lớn A", ageGroup: "5-6 tuổi" });
    expect(result.success).toBe(true);
  });

  it("từ chối khi thiếu mã lớp", () => {
    const result = classSchema.safeParse({ code: "", name: "Mẫu giáo lớn A", ageGroup: "5-6 tuổi" });
    expect(result.success).toBe(false);
  });
});

describe("childSchema", () => {
  it("chấp nhận hồ sơ trẻ hợp lệ", () => {
    const result = childSchema.safeParse({
      fullName: "Nguyễn Văn An",
      dob: "2020-03-15",
      gender: "male",
      enrollmentDate: "2025-09-05",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối khi thiếu ngày sinh", () => {
    const result = childSchema.safeParse({
      fullName: "Nguyễn Văn An",
      dob: "",
      gender: "male",
      enrollmentDate: "2025-09-05",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối giới tính không hợp lệ", () => {
    const result = childSchema.safeParse({
      fullName: "Nguyễn Văn An",
      dob: "2020-03-15",
      gender: "unknown",
      enrollmentDate: "2025-09-05",
    });
    expect(result.success).toBe(false);
  });
});
