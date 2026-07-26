import { z } from "zod";
import { AgeGroupEnum, DomainEnum, WEEKDAYS } from "./common.js";

export const ThemeDomainRowSchema = z.object({
  stt: z.number().int().min(1),
  objectiveId: z.string(),
  content: z.string(),
  activity: z.string(),
});

export const ParentCoordinationRowSchema = z.object({
  weekOrTime: z.string(),
  content: z.string(),
});

const DayLearningActivitySchema = z
  .object({
    domain: DomainEnum,
    activityType: z.string(),
    activityName: z.string(),
    objectiveId: z.string(),
  })
  .nullable();

export const WeeklyLearningActivityRowSchema = z.object({
  weekNumber: z.number().int().min(1),
  weekLabel: z.string(),
  days: z.object({
    mon: DayLearningActivitySchema,
    tue: DayLearningActivitySchema,
    wed: DayLearningActivitySchema,
    thu: DayLearningActivitySchema,
    fri: DayLearningActivitySchema,
  }),
});

export const ThemePlanContentSchema = z.object({
  themeName: z.string(),
  branchTopics: z.array(z.string()).default([]),
  startDate: z.string(),
  endDate: z.string(),
  weeksCount: z.number().int().min(1),
  ageGroup: AgeGroupEnum,
  classGroup: z.string(),
  teacherNames: z.array(z.string()).default([]),
  domains: z
    .record(DomainEnum, z.array(ThemeDomainRowSchema))
    .default({ the_chat: [], tinh_cam_ky_nang_xa_hoi: [], ngon_ngu: [], nhan_thuc: [], tham_my: [] }),
  routinesAndHabits: z.string().default(""),
  parentCoordination: z.array(ParentCoordinationRowSchema).default([]),
  weeklyLearningActivities: z.array(WeeklyLearningActivityRowSchema).default([]),
  principalComment: z.string().default(""),
});

export type ThemePlanContent = z.infer<typeof ThemePlanContentSchema>;
export { WEEKDAYS };
