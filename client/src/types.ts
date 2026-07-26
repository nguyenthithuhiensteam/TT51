export const DOMAIN_VALUES = ["the_chat", "tinh_cam_ky_nang_xa_hoi", "ngon_ngu", "nhan_thuc", "tham_my"] as const;
export type Domain = (typeof DOMAIN_VALUES)[number];
export const DOMAIN_LABELS: Record<Domain, string> = {
  the_chat: "Giáo dục phát triển thể chất",
  tinh_cam_ky_nang_xa_hoi: "Giáo dục phát triển tình cảm và kỹ năng xã hội",
  ngon_ngu: "Giáo dục phát triển ngôn ngữ",
  nhan_thuc: "Giáo dục phát triển nhận thức",
  tham_my: "Giáo dục phát triển thẩm mỹ",
};

export const AGE_GROUPS = ["3-4", "4-5", "5-6"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Thứ Hai",
  tue: "Thứ Ba",
  wed: "Thứ Tư",
  thu: "Thứ Năm",
  fri: "Thứ Sáu",
};

export type PlanStatus = "nhap" | "cho_duyet" | "da_duyet" | "can_dieu_chinh";
export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  nhap: "Nháp",
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  can_dieu_chinh: "Cần điều chỉnh",
};

export type Role = "giao_vien" | "to_truong" | "can_bo_quan_ly";
export const ROLE_LABELS: Record<Role, string> = {
  giao_vien: "Giáo viên",
  to_truong: "Tổ trưởng",
  can_bo_quan_ly: "Cán bộ quản lý",
};

export interface CurriculumObjective {
  id: string;
  code: string;
  age_group: AgeGroup;
  domain: Domain;
  statement: string;
  source_ref: string | null;
  active: number;
}

export interface AnnualDomainGoal {
  objectiveId: string;
  note?: string;
}
export interface AnnualThemeOverview {
  monthOrTime: string;
  themeName: string;
  weeksCount: number;
  focusObjectiveIds: string[];
  mainContent: string;
  events: string;
  note: string;
}
export interface AnnualPlanContent {
  schoolName: string;
  schoolYear: string;
  classGroup: string;
  ageGroup: AgeGroup;
  teacherNames: string[];
  childCount: number;
  classCharacteristics: string;
  program: string;
  advantages: string;
  difficulties: string;
  domainGoals: Record<Domain, AnnualDomainGoal[]>;
  educationContent: string;
  themesOverview: AnnualThemeOverview[];
  eventsAndIntegration: string;
  parentCoordination: string;
  facilityConditions: string;
  monitoringAdjustment: string;
}

export interface ThemeDomainRow {
  stt: number;
  objectiveId: string;
  content: string;
  activity: string;
}
export interface ParentCoordinationRow {
  weekOrTime: string;
  content: string;
}
export interface DayLearningActivity {
  domain: Domain;
  activityType: string;
  activityName: string;
  objectiveId: string;
}
export interface WeeklyLearningActivityRow {
  weekNumber: number;
  weekLabel: string;
  days: Record<Weekday, DayLearningActivity | null>;
}
export interface ThemePlanContent {
  themeName: string;
  branchTopics: string[];
  startDate: string;
  endDate: string;
  weeksCount: number;
  ageGroup: AgeGroup;
  classGroup: string;
  teacherNames: string[];
  domains: Record<Domain, ThemeDomainRow[]>;
  routinesAndHabits: string;
  parentCoordination: ParentCoordinationRow[];
  weeklyLearningActivities: WeeklyLearningActivityRow[];
  principalComment: string;
}

export interface CornerActivity {
  cornerName: string;
  preparation: string;
  skillsAndProcess: string;
}
export interface OutdoorActivityDay {
  purposeActivity: string;
  requirement: string;
  preparation: string;
  method: string;
  game: string;
  freePlay: string;
  safetyMeasures: string;
}
export interface WeeklyPlanContent {
  weekNumber: number;
  themeName: string;
  branchTopic: string;
  startDate: string;
  endDate: string;
  teacherNames: string[];
  classGroup: string;
  ageGroup: AgeGroup;
  dayDates: Record<Weekday, string>;
  welcomeAndMorningExercise: string;
  weeklyOpeningTalk: string;
  learningActivities: Record<Weekday, DayLearningActivity | null>;
  cornerActivities: CornerActivity[];
  outdoorActivities: Record<Weekday, OutdoorActivityDay>;
  mealsAndSleep: string;
  afternoonActivities: Record<Weekday, string>;
  pickup: Record<Weekday, string>;
  parentCoordination: string;
}

export const ACTIVITY_TYPE_VALUES = [
  "the_duc",
  "am_nhac",
  "tao_hinh",
  "van_hoc",
  "lam_quen_chu_cai",
  "lam_quen_voi_toan",
  "kham_pha_khoa_hoc",
  "kham_pha_xa_hoi",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPE_VALUES)[number];
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  the_duc: "Thể dục (Vận động)",
  am_nhac: "Âm nhạc",
  tao_hinh: "Tạo hình",
  van_hoc: "Làm quen văn học",
  lam_quen_chu_cai: "Làm quen chữ cái",
  lam_quen_voi_toan: "Làm quen với Toán",
  kham_pha_khoa_hoc: "Khám phá khoa học",
  kham_pha_xa_hoi: "Khám phá xã hội",
};

export const ACTIVITY_PROCEDURE_OUTLINE: Record<ActivityType, string[]> = {
  the_duc: ["Khởi động", "Trọng động - Bài tập phát triển chung", "Vận động cơ bản", "Trò chơi vận động", "Hồi tĩnh"],
  am_nhac: ["Ổn định - gây hứng thú", "Dạy hát / Vận động theo nhạc trọng tâm", "Nghe hát", "Trò chơi âm nhạc", "Kết thúc"],
  tao_hinh: ["Ổn định - gây hứng thú", "Quan sát mẫu - đàm thoại", "Hướng dẫn kỹ năng", "Trẻ thực hiện sản phẩm", "Trưng bày - nhận xét sản phẩm"],
  van_hoc: ["Ổn định - gây hứng thú", "Giới thiệu tác phẩm", "Đọc/kể diễn cảm", "Đàm thoại - giảng nội dung", "Dạy trẻ đọc/kể lại", "Kết thúc - giáo dục"],
  lam_quen_chu_cai: ["Ổn định - gây hứng thú", "Làm quen chữ cái mới", "Trò chơi luyện tập nhận biết chữ cái", "Kết thúc"],
  lam_quen_voi_toan: ["Ổn định - gây hứng thú", "Ôn kiến thức cũ", "Cung cấp kiến thức mới", "Luyện tập - trò chơi củng cố", "Kết thúc"],
  kham_pha_khoa_hoc: ["Ổn định - gây hứng thú", "Quan sát - khám phá đối tượng", "Đàm thoại - khái quát hoá", "Trải nghiệm - thí nghiệm", "Luyện tập - trò chơi", "Kết thúc"],
  kham_pha_xa_hoi: ["Ổn định - gây hứng thú", "Quan sát tranh/tình huống - đàm thoại", "Cung cấp kiến thức - mở rộng hiểu biết", "Liên hệ thực tế - giáo dục", "Luyện tập - trò chơi", "Kết thúc"],
};

export interface LessonProcedureStep {
  section: string;
  teacherActivity: string;
  childActivity: string;
}
export interface LessonPlanContent {
  dayOfWeek: string;
  date: string;
  domain: Domain;
  activityType: ActivityType;
  topic: string;
  combinedContent: string;
  objectiveId: string;
  purpose: { knowledge: string; skill: string; attitude: string; differentiation: string };
  preparation: { teacherItems: string; childItems: string; space: string; materials: string; safety: string };
  procedure: LessonProcedureStep[];
  evaluationNotes: string;
}

export interface PlanRecord<T> {
  id: string;
  content: T;
  status: PlanStatus;
  version: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  dependentsCount?: number;
}
export interface AnnualPlanRecord extends PlanRecord<AnnualPlanContent> {
  code: string;
  schoolYear: string;
  classGroup: string;
  ageGroup: AgeGroup;
}
export interface ThemePlanRecord extends PlanRecord<ThemePlanContent> {
  code: string;
  annualPlanId: string;
  themeName: string;
}
export interface WeeklyPlanRecord extends PlanRecord<WeeklyPlanContent> {
  code: string;
  themePlanId: string;
  weekNumber: number;
}
export interface LessonPlanRecord extends PlanRecord<LessonPlanContent> {
  code: string;
  weeklyPlanId: string;
  date: string;
  domain: Domain;
}
