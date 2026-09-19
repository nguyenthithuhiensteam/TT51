import { describe, expect, it } from "vitest";
import { describeAiError } from "./gateway";

describe("describeAiError", () => {
  it("nhận diện lỗi khóa API không hợp lệ (401/403)", () => {
    expect(describeAiError(new Error("[401] OpenAI báo lỗi: Incorrect API key"))).toContain("Khóa API không hợp lệ");
    expect(describeAiError(new Error("[403] Gemini báo lỗi: permission denied"))).toContain("Khóa API không hợp lệ");
  });

  it("nhận diện lỗi hết hạn mức (429)", () => {
    expect(describeAiError(new Error("[429] Claude báo lỗi: rate limited"))).toContain("hết hạn mức");
  });

  it("nhận diện lỗi mạng", () => {
    expect(describeAiError(new Error("[mang] Không gọi được OpenAI: fetch failed"))).toContain("Không kết nối được");
  });

  it("giữ nguyên thông báo chưa cấu hình", () => {
    const raw = "AI đang tắt hoặc chưa cấu hình khóa API. Vào Cài đặt để bật.";
    expect(describeAiError(new Error(raw))).toBe(raw);
  });

  it("trả về lỗi máy chủ 5xx", () => {
    expect(describeAiError(new Error("[500] OpenAI báo lỗi: internal error"))).toContain("Máy chủ AI");
  });
});
