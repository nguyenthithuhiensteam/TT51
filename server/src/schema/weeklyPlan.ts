import { z } from "zod";
import { AgeGroupEnum, DomainEnum } from "./common.js";

const LearningActivityCellSchema = z
  .object({
    domain: DomainEnum,
    activityType: z.string(),
    activityName: z.string(),
    objectiveId: z.string(),
  })
  .nullable();

const DayMapSchema = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ mon: v, tue: v, wed: v, thu: v, fri: v });

export const CornerActivitySchema = z.object({
  cornerName: z.string(),
  preparation: z.string(),
  skillsAndProcess: z.string(),
});

export const OutdoorActivityDaySchema = z.object({
  purposeActivity: z.string(),
  requirement: z.string(),
  preparation: z.string(),
  method: z.string(),
  game: z.string(),
  freePlay: z.string(),
  safetyMeasures: z.string(),
});

export const WeeklyPlanContentSchema = z.object({
  weekNumber: z.number().int().min(1),
  themeName: z.string(),
  branchTopic: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  teacherNames: z.array(z.string()).default([]),
  classGroup: z.string(),
  ageGroup: AgeGroupEnum,
  dayDates: DayMapSchema(z.string()),
  welcomeAndMorningExercise: z.string().default(""),
  weeklyOpeningTalk: z.string().default(""),
  learningActivities: DayMapSchema(LearningActivityCellSchema),
  cornerActivities: z.array(CornerActivitySchema).default([]),
  outdoorActivities: DayMapSchema(OutdoorActivityDaySchema),
  mealsAndSleep: z.string().default(""),
  afternoonActivities: DayMapSchema(z.string()),
  pickup: DayMapSchema(z.string()),
  parentCoordination: z.string().default(""),
});

export type WeeklyPlanContent = z.infer<typeof WeeklyPlanContentSchema>;
