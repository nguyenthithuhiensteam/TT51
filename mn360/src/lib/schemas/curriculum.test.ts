import { describe, expect, it } from "vitest";
import { educationPlanSchema } from "./curriculum";

describe("educationPlanSchema", () => {
  it("chấp nhận kế hoạch giáo dục hợp lệ", () => {
    const result = educationPlanSchema.safeParse({
      planType: "week",
      title: "Kế hoạch tuần 1 tháng 8",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối khi tên kế hoạch quá ngắn", () => {
    const result = educationPlanSchema.safeParse({ planType: "week", title: "KH" });
    expect(result.success).toBe(false);
  });

  it("từ chối loại kế hoạch không hợp lệ", () => {
    const result = educationPlanSchema.safeParse({ planType: "quarter", title: "Kế hoạch quý" });
    expect(result.success).toBe(false);
  });
});
