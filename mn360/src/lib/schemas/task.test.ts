import { describe, expect, it } from "vitest";
import { taskSchema } from "./task";

describe("taskSchema", () => {
  it("chấp nhận nhiệm vụ hợp lệ đầy đủ trường bắt buộc", () => {
    const result = taskSchema.safeParse({
      title: "Xây dựng kế hoạch giáo dục chủ đề Gia đình",
      priority: "high",
      ownerId: "user-gv1",
      coordinatorIds: ["user-gv2"],
      dueDate: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối khi tên nhiệm vụ quá ngắn", () => {
    const result = taskSchema.safeParse({
      title: "AB",
      priority: "normal",
      ownerId: "user-gv1",
      dueDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối khi thiếu người chủ trì", () => {
    const result = taskSchema.safeParse({
      title: "Kiểm tra an toàn phòng cháy chữa cháy",
      priority: "urgent",
      ownerId: "",
      dueDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối khi thiếu hạn hoàn thành", () => {
    const result = taskSchema.safeParse({
      title: "Kiểm tra an toàn phòng cháy chữa cháy",
      priority: "urgent",
      ownerId: "user-gv1",
      dueDate: "",
    });
    expect(result.success).toBe(false);
  });
});
