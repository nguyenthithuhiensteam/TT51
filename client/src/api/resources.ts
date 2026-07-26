import { del, get, patch, post, put } from "./client";
import type {
  AnnualPlanContent,
  AnnualPlanRecord,
  CurriculumObjective,
  LessonPlanContent,
  LessonPlanRecord,
  PlanStatus,
  ThemePlanContent,
  ThemePlanRecord,
  WeeklyPlanContent,
  WeeklyPlanRecord,
} from "../types";

export interface CurrentUser {
  id: string;
  fullName: string;
  username: string;
  role: "giao_vien" | "to_truong" | "can_bo_quan_ly";
}

export const authApi = {
  login: (username: string, password: string) => post<{ token: string; user: CurrentUser }>("/auth/login", { username, password }),
  me: () => get<CurrentUser>("/auth/me"),
};

export const objectivesApi = {
  list: (params: { ageGroup?: string; domain?: string; search?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return get<CurriculumObjective[]>(`/objectives${qs ? `?${qs}` : ""}`);
  },
  create: (data: { code: string; ageGroup: string; domain: string; statement: string; sourceRef?: string }) => post<{ id: string }>("/objectives", data),
  update: (id: string, data: { statement?: string; sourceRef?: string; active?: boolean }) => put(`/objectives/${id}`, data),
  remove: (id: string) => del(`/objectives/${id}`),
};

export interface AiSettingsResponse {
  provider: "gemini" | "openai" | "openai_compatible";
  model: string;
  compatibleBaseUrl?: string | null;
  keys: { gemini: { configured: boolean; masked: string }; openai: { configured: boolean; masked: string } };
}
export interface AiHealthResponse {
  status: "connected" | "not_connected" | "invalid_key" | "quota_exceeded" | "network_error" | "error";
  message: string;
}
export interface AiGenerateResponse<T> {
  content: T;
  warnings: string[];
}
export interface AiSectionResponse {
  value: unknown;
  warnings: string[];
}

export const aiApi = {
  getSettings: () => get<AiSettingsResponse>("/ai/settings"),
  saveSettings: (data: { provider: string; model: string; compatibleBaseUrl?: string; apiKey?: string }) => post("/ai/settings", data),
  health: (params?: { provider?: string; model?: string; baseUrl?: string }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString() : "";
    return get<AiHealthResponse>(`/ai/health${qs ? `?${qs}` : ""}`);
  },
  generate: <T>(payload: {
    planType: "annual" | "theme" | "weekly" | "lesson";
    ageGroup: string;
    domain?: string;
    inputData: Record<string, unknown>;
    parentContext?: Record<string, unknown>;
    integrations?: string[];
    targetPlanId?: string;
  }, signal?: AbortSignal) => post<AiGenerateResponse<T>>("/ai/generate", payload, signal),
  regenerateSection: (payload: {
    planType: "annual" | "theme" | "weekly" | "lesson";
    ageGroup: string;
    action: string;
    sectionPath: string;
    currentSectionValue: unknown;
    fullPlanContext: unknown;
    instruction?: string;
    targetPlanId?: string;
  }, signal?: AbortSignal) => post<AiSectionResponse>("/ai/regenerate-section", payload, signal),
  validate: (planType: string, content: unknown) => post<{ valid: boolean; issues: string[] }>("/ai/validate", { planType, content }),
};

function crud<TContent, TRecord>(base: string) {
  return {
    list: (params: Record<string, string | undefined> = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
      return get<TRecord[]>(`${base}${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => get<TRecord & { dependentsCount?: number }>(`${base}/${id}`),
    create: (data: Record<string, unknown>) => post<{ id: string }>(base, data),
    update: (id: string, content: TContent, opts: { confirm?: boolean; changeNote?: string } = {}) =>
      put<{ ok: boolean; version: number; status: PlanStatus; warnings: string[] }>(`${base}/${id}`, { content, ...opts }),
    setStatus: (id: string, status: PlanStatus) => patch<{ ok: boolean; status: PlanStatus }>(`${base}/${id}/status`, { status }),
    duplicate: (id: string) => post<{ id: string }>(`${base}/${id}/duplicate`),
    remove: (id: string) => del(`${base}/${id}`),
    versions: (id: string) => get<{ id: string; version_number: number; change_note: string | null; edited_by: string | null; edited_at: string }[]>(`${base}/${id}/versions`),
    restore: (id: string, versionNumber: number) => post<{ ok: boolean; version: number }>(`${base}/${id}/restore/${versionNumber}`),
    exportDocxUrl: (id: string) => `${base}/${id}/export.docx`,
    exportPdfUrl: (id: string) => `${base}/${id}/export.pdf`,
  };
}

export const annualPlansApi = crud<AnnualPlanContent, AnnualPlanRecord>("/annual-plans");
export const themePlansApi = crud<ThemePlanContent, ThemePlanRecord>("/theme-plans");
export const weeklyPlansApi = crud<WeeklyPlanContent, WeeklyPlanRecord>("/weekly-plans");
export const lessonPlansApi = {
  ...crud<LessonPlanContent, LessonPlanRecord>("/lesson-plans"),
  bulkCreateFromWeekly: (weeklyPlanId: string) => post<{ createdIds: string[]; skipped: string[] }>(`/lesson-plans/bulk-create-from-weekly/${weeklyPlanId}`),
};
