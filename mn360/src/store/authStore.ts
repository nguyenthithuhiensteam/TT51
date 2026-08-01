import { create } from "zustand";
import type { User } from "@/lib/db/types";

interface AuthState {
  user: User | null;
  roles: string[];
  permissions: Set<string>;
  sessionId: string | null;
  isLocked: boolean;
  setSession: (data: {
    user: User;
    roles: string[];
    permissions: string[];
    sessionId: string;
  }) => void;
  updateUser: (user: User) => void;
  clearSession: () => void;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  lock: () => void;
  unlock: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  roles: [],
  permissions: new Set(),
  sessionId: null,
  isLocked: false,
  setSession: ({ user, roles, permissions, sessionId }) =>
    set({ user, roles, permissions: new Set(permissions), sessionId, isLocked: false }),
  updateUser: (user) => set({ user }),
  clearSession: () =>
    set({ user: null, roles: [], permissions: new Set(), sessionId: null, isLocked: false }),
  hasPermission: (code) => get().permissions.has(code),
  hasAnyPermission: (codes) => codes.some((c) => get().permissions.has(c)),
  lock: () => set({ isLocked: true }),
  unlock: () => set({ isLocked: false }),
}));
