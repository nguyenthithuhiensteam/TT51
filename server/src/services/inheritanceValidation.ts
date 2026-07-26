import type { AnnualPlanContent } from "../schema/annualPlan.js";
import type { ThemePlanContent } from "../schema/themePlan.js";
import type { WeeklyPlanContent } from "../schema/weeklyPlan.js";
import type { LessonPlanContent } from "../schema/lessonPlan.js";
import { WEEKDAYS } from "../schema/common.js";

export function validateThemeInheritsAnnual(theme: ThemePlanContent, annual: AnnualPlanContent): string[] {
  const errors: string[] = [];
  const allowedIds = new Set<string>();
  for (const domain of Object.keys(annual.domainGoals) as (keyof typeof annual.domainGoals)[]) {
    for (const g of annual.domainGoals[domain] ?? []) allowedIds.add(g.objectiveId);
  }
  for (const domain of Object.keys(theme.domains) as (keyof typeof theme.domains)[]) {
    for (const row of theme.domains[domain] ?? []) {
      if (row.objectiveId && !allowedIds.has(row.objectiveId)) {
        errors.push(`Mục tiêu "${row.objectiveId}" trong lĩnh vực không có trong kế hoạch giáo dục năm đã chọn. Kế hoạch chủ đề chỉ được lựa chọn mục tiêu từ kế hoạch năm.`);
      }
    }
  }
  for (const w of theme.weeklyLearningActivities) {
    for (const day of WEEKDAYS) {
      const cell = w.days[day];
      if (cell?.objectiveId && !allowedIds.has(cell.objectiveId)) {
        errors.push(`Mục tiêu "${cell.objectiveId}" trong hoạt động học không có trong kế hoạch giáo dục năm đã chọn.`);
      }
    }
  }
  return errors;
}

export function validateWeeklyInheritsTheme(weekly: WeeklyPlanContent, theme: ThemePlanContent): string[] {
  const errors: string[] = [];
  const allowedIds = new Set<string>();
  for (const domain of Object.keys(theme.domains) as (keyof typeof theme.domains)[]) {
    for (const row of theme.domains[domain] ?? []) if (row.objectiveId) allowedIds.add(row.objectiveId);
  }
  for (const w of theme.weeklyLearningActivities) {
    for (const day of WEEKDAYS) {
      const cell = w.days[day];
      if (cell?.objectiveId) allowedIds.add(cell.objectiveId);
    }
  }
  for (const day of WEEKDAYS) {
    const cell = weekly.learningActivities[day];
    if (cell?.objectiveId && !allowedIds.has(cell.objectiveId)) {
      errors.push(`Mục tiêu "${cell.objectiveId}" trong hoạt động học ngày ${day} không có trong kế hoạch chủ đề đã chọn. Kế hoạch tuần chỉ được lựa chọn mục tiêu và hoạt động phù hợp với kế hoạch chủ đề.`);
    }
  }
  if (weekly.themeName && theme.themeName && weekly.themeName !== theme.themeName) {
    errors.push(`Tên chủ đề "${weekly.themeName}" không khớp với kế hoạch chủ đề đã chọn ("${theme.themeName}").`);
  }
  return errors;
}

export function validateLessonInheritsWeekly(lesson: LessonPlanContent, weekly: WeeklyPlanContent, dayKey: (typeof WEEKDAYS)[number]): string[] {
  const errors: string[] = [];
  const cell = weekly.learningActivities[dayKey];
  if (!cell) {
    errors.push(`Kế hoạch tuần chưa có hoạt động học cho ngày này. Vui lòng bổ sung hoạt động học trong kế hoạch tuần trước khi tạo giáo án.`);
    return errors;
  }
  if (lesson.domain !== cell.domain) {
    errors.push(`Lĩnh vực giáo dục "${lesson.domain}" không khớp với lĩnh vực đã lên trong kế hoạch tuần ("${cell.domain}").`);
  }
  if (lesson.objectiveId && lesson.objectiveId !== cell.objectiveId) {
    errors.push(`Mã mục tiêu của giáo án phải khớp với mã mục tiêu đã chọn trong kế hoạch tuần ("${cell.objectiveId}").`);
  }
  if (lesson.date !== weekly.dayDates[dayKey]) {
    errors.push(`Ngày thực hiện giáo án phải khớp với ngày của kế hoạch tuần ("${weekly.dayDates[dayKey]}").`);
  }
  return errors;
}
