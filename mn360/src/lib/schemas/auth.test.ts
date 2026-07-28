import { describe, expect, it } from "vitest";
import { changePasswordSchema, loginSchema } from "./auth";

describe("loginSchema", () => {
  it("chấp nhận tên đăng nhập và mật khẩu hợp lệ", () => {
    const result = loginSchema.safeParse({ username: "hieutruong", password: "MN360@2026" });
    expect(result.success).toBe(true);
  });

  it("từ chối khi thiếu tên đăng nhập", () => {
    const result = loginSchema.safeParse({ username: "", password: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("từ chối mật khẩu mới quá ngắn", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "MN360@2026",
      newPassword: "abc1",
      confirmPassword: "abc1",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối mật khẩu mới không có chữ số", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "MN360@2026",
      newPassword: "abcdefgh",
      confirmPassword: "abcdefgh",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối khi xác nhận mật khẩu không khớp", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "MN360@2026",
      newPassword: "Abcdef12",
      confirmPassword: "Abcdef13",
    });
    expect(result.success).toBe(false);
  });

  it("chấp nhận mật khẩu mới hợp lệ và khớp xác nhận", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "MN360@2026",
      newPassword: "Abcdef12",
      confirmPassword: "Abcdef12",
    });
    expect(result.success).toBe(true);
  });
});
