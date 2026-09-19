import { generateWithAi } from "./gateway";
import { redactText } from "./redact";
import { PLAN_TYPE_LABELS } from "../db/types";
import type { PlanType } from "../db/types";

/** Ẩn danh số điện thoại/ngày sinh dạng tự do mà giáo viên có thể lỡ gõ vào nội dung tự nhập. */
function redactFreeText(text: string | undefined): string | undefined {
  if (!text) return text;
  return redactText(text).redacted;
}

/**
 * Chỉ dẫn hệ thống dùng chung cho mọi lời gọi AI liên quan đến kế hoạch giáo dục mầm non.
 * Không tự bịa mã mục tiêu/yêu cầu cần đạt — vì hệ thống hiện chưa có ngân hàng chương trình
 * khung với mã chuẩn hoá, AI chỉ được diễn đạt mục tiêu bằng lời, không gán mã số.
 */
const SYSTEM_PROMPT =
  "Bạn là chuyên gia xây dựng kế hoạch giáo dục mầm non tại Việt Nam. " +
  "Hãy tạo nội dung phù hợp độ tuổi, chủ đề, bối cảnh lớp học và dữ liệu được giáo viên cung cấp. " +
  "Không bịa đặt số liệu, văn bản pháp luật hay nội dung ngoài phạm vi được cung cấp. " +
  "Hoạt động phải lấy trẻ làm trung tâm, có cơ hội trải nghiệm, quan sát và đánh giá; " +
  "bảo đảm an toàn, khả thi và phù hợp điều kiện của một trường mầm non công lập Việt Nam. " +
  "Tích hợp STEAM, SEL hoặc giáo dục công dân số khi thực sự phù hợp, không tích hợp hình thức. " +
  "Dùng tiếng Việt chuẩn, đúng thuật ngữ giáo dục mầm non. " +
  "Trả lời đúng theo cấu trúc được yêu cầu trong câu hỏi, không thêm lời dẫn, không thêm nhận xét ngoài cấu trúc.";

export interface PlanAiContext {
  planType: PlanType;
  title: string;
  ageGroup?: string;
  className?: string;
  periodStart?: string;
  periodEnd?: string;
  objectives?: string;
  requirements?: string;
  content?: string;
}

function describeContext(ctx: PlanAiContext): string {
  const lines = [
    `Loại kế hoạch: ${PLAN_TYPE_LABELS[ctx.planType]}`,
    `Tên/chủ đề kế hoạch: ${ctx.title || "(chưa đặt tên)"}`,
  ];
  if (ctx.ageGroup) lines.push(`Độ tuổi: ${ctx.ageGroup}`);
  if (ctx.className) lines.push(`Lớp: ${ctx.className}`);
  if (ctx.periodStart) lines.push(`Thời gian thực hiện: ${ctx.periodStart} → ${ctx.periodEnd || "..."}`);
  const objectives = redactFreeText(ctx.objectives);
  const requirements = redactFreeText(ctx.requirements);
  const content = redactFreeText(ctx.content);
  if (objectives) lines.push(`Mục tiêu giáo viên đã ghi (nếu có, phải tôn trọng, không thay đổi ý): ${objectives}`);
  if (requirements) lines.push(`Yêu cầu cần đạt giáo viên đã ghi (nếu có): ${requirements}`);
  if (content) lines.push(`Nội dung giáo viên đã ghi (nếu có): ${content}`);
  return lines.join("\n");
}

export interface PlanDraftSections {
  objectives: string;
  requirements: string;
  content: string;
  activities: string;
  environment: string;
  materials: string;
  methods: string;
}

const SECTION_KEYS: { key: keyof PlanDraftSections; label: string }[] = [
  { key: "objectives", label: "MỤC TIÊU" },
  { key: "requirements", label: "YÊU CẦU CẦN ĐẠT" },
  { key: "content", label: "NỘI DUNG" },
  { key: "activities", label: "HOẠT ĐỘNG" },
  { key: "environment", label: "MÔI TRƯỜNG" },
  { key: "materials", label: "HỌC LIỆU" },
  { key: "methods", label: "PHƯƠNG PHÁP" },
];

export function parseSections(raw: string): PlanDraftSections {
  const result: PlanDraftSections = {
    objectives: "",
    requirements: "",
    content: "",
    activities: "",
    environment: "",
    materials: "",
    methods: "",
  };
  const markerPattern = SECTION_KEYS.map((s) => s.label).join("|");
  const regex = new RegExp(`\\[(${markerPattern})\\]`, "g");
  const matches = [...raw.matchAll(regex)];
  if (matches.length === 0) {
    // AI không theo đúng định dạng — không mất nội dung, đưa toàn bộ vào "Nội dung".
    result.content = raw.trim();
    return result;
  }
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1];
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    const text = raw.slice(start, end).trim();
    const entry = SECTION_KEYS.find((s) => s.label === label);
    if (entry) result[entry.key] = text;
  }
  return result;
}

/** Tạo bản nháp đầy đủ cho một kế hoạch giáo dục mới — giáo viên phải xem lại trước khi lưu. */
export async function generateEducationPlanDraft(ctx: PlanAiContext, signal?: AbortSignal): Promise<PlanDraftSections> {
  const prompt =
    `Hãy soạn nội dung cho một "${PLAN_TYPE_LABELS[ctx.planType]}" trong chương trình giáo dục mầm non, dựa trên thông tin sau:\n\n` +
    `${describeContext(ctx)}\n\n` +
    `Trả lời theo đúng cấu trúc sau, mỗi phần bắt đầu bằng nhãn trong ngoặc vuông ở đầu dòng riêng, ` +
    `không thêm ký tự Markdown (không dùng #, *, -), viết thành đoạn văn hoặc gạch đầu dòng bằng số thứ tự thường:\n` +
    SECTION_KEYS.map((s) => `[${s.label}]\n(nội dung phần ${s.label.toLowerCase()})`).join("\n\n");
  const { content } = await generateWithAi(SYSTEM_PROMPT, prompt, signal);
  return parseSections(content);
}

export type SectionEditMode = "rewrite" | "shorten" | "expand" | "age_fit" | "steam" | "sel";

const MODE_INSTRUCTION: Record<SectionEditMode, string> = {
  rewrite: "Viết lại đoạn nội dung dưới đây cho rõ ràng, mạch lạc, đúng thuật ngữ giáo dục mầm non hơn, giữ nguyên ý chính.",
  shorten: "Rút gọn đoạn nội dung dưới đây, giữ lại ý chính, bỏ phần trùng lặp/rườm rà.",
  expand: "Mở rộng đoạn nội dung dưới đây với chi tiết cụ thể hơn, vẫn khả thi và phù hợp độ tuổi.",
  age_fit: "Điều chỉnh đoạn nội dung dưới đây cho phù hợp hơn với độ tuổi trẻ đã nêu ở phần bối cảnh.",
  steam: "Bổ sung yếu tố tích hợp STEAM (Khoa học – Công nghệ – Kỹ thuật – Nghệ thuật – Toán) vào đoạn nội dung dưới đây, chỉ khi thực sự phù hợp, không gượng ép.",
  sel: "Bổ sung yếu tố phát triển tình cảm – kỹ năng xã hội (SEL) vào đoạn nội dung dưới đây, chỉ khi thực sự phù hợp, không gượng ép.",
};

/**
 * Chỉnh sửa ĐÚNG một mục nội dung đang chọn, không được viết lại toàn bộ kế hoạch.
 * `fieldLabel` chỉ dùng để AI hiểu ngữ cảnh (ví dụ "Mục tiêu", "Hoạt động"...).
 */
export async function editSection(
  ctx: PlanAiContext,
  fieldLabel: string,
  currentText: string,
  mode: SectionEditMode,
  signal?: AbortSignal,
): Promise<string> {
  const prompt =
    `Bối cảnh kế hoạch:\n${describeContext(ctx)}\n\n` +
    `${MODE_INSTRUCTION[mode]}\n\n` +
    `Đây là mục "${fieldLabel}" — CHỈ trả về nội dung mới của riêng mục này, không thêm nhãn, không thêm phần khác, không thêm ký tự Markdown.\n\n` +
    `Nội dung hiện tại:\n${redactFreeText(currentText) || "(trống)"}`;
  const { content } = await generateWithAi(SYSTEM_PROMPT, prompt, signal);
  return content.trim();
}

/** Rà soát kế hoạch: kiểm tra tính thống nhất, trùng lặp, mục tiêu chưa được thể hiện qua hoạt động. Chỉ trả về nhận xét, không sửa dữ liệu. */
export async function validatePlan(
  ctx: PlanAiContext,
  full: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<string> {
  const prompt =
    `Hãy rà soát kế hoạch giáo dục mầm non sau đây và chỉ ra (nếu có):\n` +
    `1) Mục tiêu chưa được thể hiện qua nội dung/hoạt động nào.\n` +
    `2) Nội dung hoặc hoạt động bị lặp lại không cần thiết.\n` +
    `3) Điểm chưa phù hợp với độ tuổi hoặc thiếu tính khả thi/an toàn.\n` +
    `4) Điểm chưa nhất quán giữa các mục (mục tiêu, nội dung, hoạt động, đánh giá).\n` +
    `Nếu không có vấn đề nào, hãy nói rõ "Không phát hiện vấn đề đáng chú ý." ` +
    `Trả lời ngắn gọn dạng gạch đầu dòng bằng số, không thêm lời khen/mở đầu dài dòng.\n\n` +
    `${describeContext(ctx)}\n` +
    `Hoạt động: ${redactFreeText(full.activities) || "—"}\n` +
    `Môi trường: ${redactFreeText(full.environment) || "—"}\n` +
    `Học liệu: ${redactFreeText(full.materials) || "—"}\n` +
    `Phương pháp: ${redactFreeText(full.methods) || "—"}\n` +
    `Đánh giá: ${redactFreeText(full.evaluation) || "—"}`;
  const { content } = await generateWithAi(SYSTEM_PROMPT, prompt, signal);
  return content.trim();
}
