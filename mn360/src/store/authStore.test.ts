import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./authStore";
import type { User } from "@/lib/db/types";

const fakeUser: User = {
  id: "user-1",
  username: "giaovien1",
  full_name: "Vũ Thị Thu",
  email: null,
  phone: null,
  password_hash: "hash",
  password_algo: "argon2id",
  must_change_password: 0,
  failed_login_count: 0,
  locked_until: null,
  last_login_at: null,
  is_active: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("authStore RBAC", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it("không có quyền nào khi chưa đăng nhập", () => {
    expect(useAuthStore.getState().hasPermission("party.view")).toBe(false);
  });

  it("chỉ có đúng các quyền được cấp sau khi đăng nhập", () => {
    useAuthStore.getState().setSession({
      user: fakeUser,
      roles: ["teacher"],
      permissions: ["task.view", "task.create", "curriculum.view"],
      sessionId: "session-1",
    });
    const state = useAuthStore.getState();
    expect(state.hasPermission("task.view")).toBe(true);
    expect(state.hasPermission("party.view")).toBe(false);
    expect(state.hasAnyPermission(["party.view", "task.create"])).toBe(true);
  });

  it("xóa hết quyền và phiên đăng nhập khi đăng xuất", () => {
    useAuthStore.getState().setSession({
      user: fakeUser,
      roles: ["teacher"],
      permissions: ["task.view"],
      sessionId: "session-1",
    });
    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.hasPermission("task.view")).toBe(false);
    expect(state.sessionId).toBeNull();
  });

  it("khóa và mở khóa ứng dụng", () => {
    useAuthStore.getState().lock();
    expect(useAuthStore.getState().isLocked).toBe(true);
    useAuthStore.getState().unlock();
    expect(useAuthStore.getState().isLocked).toBe(false);
  });
});
