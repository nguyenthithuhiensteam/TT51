import { describe, expect, it } from "vitest";
import { newBusinessCode, newId } from "./id";

describe("newId", () => {
  it("sinh UUID v4 duy nhất mỗi lần gọi", () => {
    const a = newId();
    const b = newId();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe("newBusinessCode", () => {
  it("sinh mã nghiệp vụ đúng định dạng PREFIX-YYYY-0000", () => {
    expect(newBusinessCode("NV", 7, 2026)).toBe("NV-2026-0007");
    expect(newBusinessCode("DI", 123, 2026)).toBe("DI-2026-0123");
  });
});
