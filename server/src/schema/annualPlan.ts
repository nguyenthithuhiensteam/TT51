import { z } from "zod";
import { AgeGroupEnum, DomainEnum } from "./common.js";

export const AnnualDomainGoalSchema = z.object({
  objectiveId: z.string(),
  note: z.string().optional().default(""),
});

export const AnnualThemeOverviewSchema = z.object({
  monthOrTime: z.string(),
  themeName: z.string(),
  weeksCount: z.number().int().min(1),
  focusObjectiveIds: z.array(z.string()).default([]),
  mainContent: z.string().default(""),
  events: z.string().default(""),
  note: z.string().default(""),
});

export const AnnualPlanContentSchema = z.object({
  schoolName: z.string(),
  schoolYear: z.string(),
  classGroup: z.string(),
  ageGroup: AgeGroupEnum,
  teacherNames: z.array(z.string()).default([]),
  childCount: z.number().int().min(0).default(0),
  classCharacteristics: z.string().default(""),
  program: z.string().default("Chương trình Giáo dục mầm non"),
  advantages: z.string().default(""),
  difficulties: z.string().default(""),
  domainGoals: z.record(DomainEnum, z.array(AnnualDomainGoalSchema)).default({
    the_chat: [],
    tinh_cam_ky_nang_xa_hoi: [],
    ngon_ngu: [],
    nhan_thuc: [],
    tham_my: [],
  }),
  educationContent: z.string().default(""),
  themesOverview: z.array(AnnualThemeOverviewSchema).default([]),
  eventsAndIntegration: z.string().default(""),
  parentCoordination: z.string().default(""),
  facilityConditions: z.string().default(""),
  monitoringAdjustment: z.string().default(""),
});

export type AnnualPlanContent = z.infer<typeof AnnualPlanContentSchema>;
