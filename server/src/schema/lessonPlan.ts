import { z } from "zod";
import { DomainEnum } from "./common.js";

export const LessonPurposeSchema = z.object({
  knowledge: z.string(),
  skill: z.string(),
  attitude: z.string(),
  differentiation: z.string().default(""),
});

export const LessonPreparationSchema = z.object({
  teacherItems: z.string(),
  childItems: z.string(),
  space: z.string(),
  materials: z.string(),
  safety: z.string().default(""),
});

export const LessonProcedureStepSchema = z.object({
  section: z.string(),
  teacherActivity: z.string(),
  childActivity: z.string(),
});

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

export const ActivityTypeEnum = z.enum(ACTIVITY_TYPE_VALUES);

export const ACTIVITY_TYPE_LABELS: Record<(typeof ACTIVITY_TYPE_VALUES)[number], string> = {
  the_duc: "Thể dục (Vận động)",
  am_nhac: "Âm nhạc",
  tao_hinh: "Tạo hình",
  van_hoc: "Làm quen văn học",
  lam_quen_chu_cai: "Làm quen chữ cái",
  lam_quen_voi_toan: "Làm quen với Toán",
  kham_pha_khoa_hoc: "Khám phá khoa học",
  kham_pha_xa_hoi: "Khám phá xã hội",
};

// Quy trình chuyên môn gợi ý theo từng loại hoạt động - dùng để chỉ dẫn AI và
// kiểm tra tính đầy đủ, KHÔNG áp một quy trình chung cho mọi loại hoạt động.
export const ACTIVITY_PROCEDURE_OUTLINE: Record<(typeof ACTIVITY_TYPE_VALUES)[number], string[]> = {
  the_duc: ["Khởi động", "Trọng động - Bài tập phát triển chung", "Vận động cơ bản", "Trò chơi vận động", "Hồi tĩnh"],
  am_nhac: ["Ổn định - gây hứng thú", "Dạy hát / Vận động theo nhạc trọng tâm", "Nghe hát", "Trò chơi âm nhạc", "Kết thúc"],
  tao_hinh: ["Ổn định - gây hứng thú", "Quan sát mẫu - đàm thoại", "Hướng dẫn kỹ năng", "Trẻ thực hiện sản phẩm", "Trưng bày - nhận xét sản phẩm"],
  van_hoc: ["Ổn định - gây hứng thú", "Giới thiệu tác phẩm", "Đọc/kể diễn cảm", "Đàm thoại - giảng nội dung", "Dạy trẻ đọc/kể lại", "Kết thúc - giáo dục"],
  lam_quen_chu_cai: ["Ổn định - gây hứng thú", "Làm quen chữ cái mới", "Trò chơi luyện tập nhận biết chữ cái", "Kết thúc"],
  lam_quen_voi_toan: ["Ổn định - gây hứng thú", "Ôn kiến thức cũ", "Cung cấp kiến thức mới", "Luyện tập - trò chơi củng cố", "Kết thúc"],
  kham_pha_khoa_hoc: ["Ổn định - gây hứng thú", "Quan sát - khám phá đối tượng", "Đàm thoại - khái quát hoá", "Trải nghiệm - thí nghiệm", "Luyện tập - trò chơi", "Kết thúc"],
  kham_pha_xa_hoi: ["Ổn định - gây hứng thú", "Quan sát tranh/tình huống - đàm thoại", "Cung cấp kiến thức - mở rộng hiểu biết", "Liên hệ thực tế - giáo dục", "Luyện tập - trò chơi", "Kết thúc"],
};

export const LessonPlanContentSchema = z.object({
  dayOfWeek: z.string(),
  date: z.string(),
  domain: DomainEnum,
  activityType: ActivityTypeEnum,
  topic: z.string(),
  combinedContent: z.string().default(""),
  objectiveId: z.string(),
  purpose: LessonPurposeSchema,
  preparation: LessonPreparationSchema,
  procedure: z.array(LessonProcedureStepSchema).min(1),
  evaluationNotes: z.string().default(""),
});

export type LessonPlanContent = z.infer<typeof LessonPlanContentSchema>;
