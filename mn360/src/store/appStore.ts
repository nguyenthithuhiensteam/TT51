import { create } from "zustand";
import type { School, SchoolYear } from "@/lib/db/types";

interface AppState {
  isOnline: boolean;
  school: School | null;
  currentSchoolYear: SchoolYear | null;
  setOnline: (online: boolean) => void;
  setSchoolContext: (school: School | null, schoolYear: SchoolYear | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  school: null,
  currentSchoolYear: null,
  setOnline: (online) => set({ isOnline: online }),
  setSchoolContext: (school, schoolYear) => set({ school, currentSchoolYear: schoolYear }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("online", () => useAppStore.getState().setOnline(true));
  window.addEventListener("offline", () => useAppStore.getState().setOnline(false));
}
