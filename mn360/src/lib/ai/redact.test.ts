import { describe, expect, it } from "vitest";
import { redactText } from "./redact";

describe("redactText", () => {
  it("ẩn số điện thoại và ngày tháng dạng chuẩn", () => {
    const result = redactText("Liên hệ 0912345678 hoặc gặp ngày 2026-07-28 hay 28/07/2026");
    expect(result.redacted).not.toContain("0912345678");
    expect(result.redacted).not.toContain("2026-07-28");
    expect(result.redacted).not.toContain("28/07/2026");
    expect(result.replacedCount).toBeGreaterThanOrEqual(3);
  });

  it("ẩn tên trẻ/phụ huynh được truyền vào ngữ cảnh", () => {
    const result = redactText("Bé Nguyễn Văn An hôm nay ăn ngoan, mẹ là Trần Thị Cúc đến đón sớm.", {
      names: ["Nguyễn Văn An", "Trần Thị Cúc"],
    });
    expect(result.redacted).not.toContain("Nguyễn Văn An");
    expect(result.redacted).not.toContain("Trần Thị Cúc");
    expect(result.redacted).toContain("[TÊN TRẺ/PHỤ HUYNH]");
  });

  it("không thay đổi văn bản không chứa thông tin nhận dạng", () => {
    const result = redactText("Kế hoạch tuần tới tập trung vào hoạt động STEAM.");
    expect(result.redacted).toBe("Kế hoạch tuần tới tập trung vào hoạt động STEAM.");
    expect(result.replacedCount).toBe(0);
  });
});
