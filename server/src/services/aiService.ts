import { randomUUID } from "node:crypto";
import { db, newId } from "../db.js";
import { geminiProvider } from "./providers/gemini.js";
import { openaiProvider, openaiCompatibleProvider } from "./providers/openai.js";
import { AiError, AiErrorCode, AiProvider, AiProviderId, VIETNAMESE_ERROR_MESSAGES } from "./providers/types.js";
import { getApiKey } from "./secretsStore.js";
import { listObjectives, stripInvalidObjectiveIds } from "./objectiveBank.js";
import { AnnualPlanContentSchema } from "../schema/annualPlan.js";
import { ThemePlanContentSchema } from "../schema/themePlan.js";
import { WeeklyPlanContentSchema } from "../schema/weeklyPlan.js";
import { ACTIVITY_PROCEDURE_OUTLINE, LessonPlanContentSchema } from "../schema/lessonPlan.js";
import { DOMAIN_LABELS } from "../schema/common.js";
import type { ZodSchema } from "zod";

export type PlanType = "annual" | "theme" | "weekly" | "lesson";

const SYSTEM_PROMPT = `Bạn là chuyên gia xây dựng kế hoạch giáo dục mầm non. Hãy tạo nội dung phù hợp độ tuổi, mục tiêu, yêu cầu cần đạt, bối cảnh lớp học và dữ liệu chương trình được cung cấp. Không tự tạo mã mục tiêu. Không đưa vào nội dung không có trong dữ liệu nguồn. Hoạt động phải lấy trẻ làm trung tâm, có cơ hội trải nghiệm, quan sát và đánh giá; bảo đảm an toàn, khả thi và phù hợp điều kiện cơ sở giáo dục. Tích hợp STEAM, SEL hoặc giáo dục công dân số khi phù hợp, không tích hợp hình thức. Trả về đúng JSON schema được yêu cầu, không thêm Markdown và không thêm nội dung ngoài cấu trúc.`;

const SCHEMA_BY_TYPE: Record<PlanType, ZodSchema> = {
  annual: AnnualPlanContentSchema,
  theme: ThemePlanContentSchema,
  weekly: WeeklyPlanContentSchema,
  lesson: LessonPlanContentSchema,
};

function getProvider(id: AiProviderId): AiProvider {
  if (id === "gemini") return geminiProvider;
  if (id === "openai") return openaiProvider;
  return openaiCompatibleProvider;
}

export function getAiSettings() {
  const row = db.prepare(`SELECT * FROM ai_settings WHERE id = 1`).get() as {
    provider: AiProviderId;
    model: string;
    compatible_base_url: string | null;
  };
  return row;
}

export function setAiSettings(provider: AiProviderId, model: string, compatibleBaseUrl?: string) {
  db.prepare(
    `UPDATE ai_settings SET provider = ?, model = ?, compatible_base_url = ?, updated_at = datetime('now') WHERE id = 1`
  ).run(provider, model, compatibleBaseUrl || null);
}

function logAiCall(entry: {
  endpoint: string;
  provider?: string;
  model?: string;
  status: "success" | "error";
  latencyMs?: number;
  errorMessage?: string;
  planType?: string;
}) {
  db.prepare(
    `INSERT INTO ai_logs (id, endpoint, provider, model, status, latency_ms, error_message, plan_type) VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    newId("log"),
    entry.endpoint,
    entry.provider || null,
    entry.model || null,
    entry.status,
    entry.latencyMs || null,
    entry.errorMessage || null,
    entry.planType || null
  );
}

async function callWithRetry(
  provider: AiProvider,
  opts: { apiKey: string; model: string; baseUrl?: string; systemPrompt: string; userPrompt: string },
  externalSignal: AbortSignal | undefined,
  maxRetries = 2
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), 45000);
    const onExternalAbort = () => timeoutController.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);
    try {
      const result = await provider.generateJson({ ...opts, signal: timeoutController.signal });
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      if (externalSignal?.aborted) throw new AiError("timeout", "Đã huỷ yêu cầu theo yêu cầu người dùng");
      lastError = err;
      const code = err instanceof AiError ? err.code : "unknown";
      const retriable: AiErrorCode[] = ["network_error", "timeout"];
      if (attempt < maxRetries && retriable.includes(code)) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function extractJson(raw: string): any {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError("invalid_response", "AI trả về dữ liệu không đúng định dạng JSON");
  }
}

function objectiveBankPromptSection(ageGroup: string, domain?: string) {
  const rows = listObjectives(ageGroup, domain);
  if (rows.length === 0) {
    return `NGÂN HÀNG MỤC TIÊU CHƯƠNG TRÌNH (độ tuổi ${ageGroup}): TRỐNG. Nhà trường chưa nhập mục tiêu cho độ tuổi này. TUYỆT ĐỐI KHÔNG được tự đặt ra mã mục tiêu hay yêu cầu cần đạt. Hãy để các trường liên quan tới mã mục tiêu trống ("") và ghi chú trong phần liên quan rằng cần bổ sung ngân hàng mục tiêu.`;
  }
  const lines = rows
    .map((r) => `- id="${r.id}" mã="${r.code}" lĩnh vực="${DOMAIN_LABELS[r.domain as keyof typeof DOMAIN_LABELS]}" nội dung="${r.statement}"`)
    .join("\n");
  return `NGÂN HÀNG MỤC TIÊU CHƯƠNG TRÌNH (độ tuổi ${ageGroup}) - CHỈ ĐƯỢC CHỌN objectiveId TỪ DANH SÁCH id BÊN DƯỚI, KHÔNG BỊA MÃ MỚI:\n${lines}`;
}

interface GenerateArgs {
  planType: PlanType;
  ageGroup: string;
  domain?: string;
  inputData: Record<string, unknown>;
  parentContext?: Record<string, unknown>;
  integrations?: string[];
  signal?: AbortSignal;
}

async function resolveCredentials() {
  const settings = getAiSettings();
  const apiKey = getApiKey(settings.provider) || "";
  return { settings, apiKey };
}

function schemaDescription(planType: PlanType): string {
  switch (planType) {
    case "annual":
      return `Trả về JSON đúng cấu trúc AnnualPlanContent gồm: schoolName, schoolYear, classGroup, ageGroup, teacherNames[], childCount, classCharacteristics, program, advantages, difficulties, domainGoals{the_chat,tinh_cam_ky_nang_xa_hoi,ngon_ngu,nhan_thuc,tham_my: mỗi mảng gồm {objectiveId, note}}, educationContent, themesOverview[{monthOrTime, themeName, weeksCount, focusObjectiveIds[], mainContent, events, note}], eventsAndIntegration, parentCoordination, facilityConditions, monitoringAdjustment. Rà soát để không gán trùng lặp quá nhiều mục tiêu vào một chủ đề, và không bỏ sót thời gian giữa các chủ đề trong năm học.`;
    case "theme":
      return `Trả về JSON đúng cấu trúc ThemePlanContent gồm: themeName, branchTopics[], startDate, endDate, weeksCount, ageGroup, classGroup, teacherNames[], domains{the_chat,tinh_cam_ky_nang_xa_hoi,ngon_ngu,nhan_thuc,tham_my: mỗi mảng gồm {stt, objectiveId, content, activity}}, routinesAndHabits, parentCoordination[{weekOrTime, content}], weeklyLearningActivities[{weekNumber, weekLabel, days:{mon,tue,wed,thu,fri: mỗi ngày là {domain, activityType, activityName, objectiveId} hoặc null}}], principalComment (để trống). CHỈ ĐƯỢC dùng objectiveId nằm trong danh sách mục tiêu đã chọn từ kế hoạch năm được cung cấp.`;
    case "weekly":
      return `Trả về JSON đúng cấu trúc WeeklyPlanContent gồm: weekNumber, themeName, branchTopic, startDate, endDate, teacherNames[], classGroup, ageGroup, dayDates{mon,tue,wed,thu,fri: chuỗi ngày/tháng/năm}, welcomeAndMorningExercise, weeklyOpeningTalk, learningActivities{mon..fri: {domain, activityType, activityName, objectiveId} hoặc null}, cornerActivities[{cornerName, preparation, skillsAndProcess}] (chỉ chọn góc phù hợp, không bắt buộc đủ mọi góc), outdoorActivities{mon..fri: {purposeActivity, requirement, preparation, method, game, freePlay, safetyMeasures}}, mealsAndSleep, afternoonActivities{mon..fri: chuỗi}, pickup{mon..fri: chuỗi}, parentCoordination. CHỈ dùng objectiveId đã có trong kế hoạch chủ đề được cung cấp.`;
    case "lesson":
      return `Trả về JSON đúng cấu trúc LessonPlanContent gồm: dayOfWeek, date, domain, activityType, topic, combinedContent, objectiveId, purpose{knowledge, skill, attitude, differentiation}, preparation{teacherItems, childItems, space, materials, safety}, procedure[{section, teacherActivity, childActivity}] (PHẢI theo đúng trình tự chuyên môn của loại hoạt động được nêu bên dưới, KHÔNG dùng chung một quy trình cho mọi loại hoạt động), evaluationNotes (để trống). objectiveId PHẢI khớp với mã mục tiêu đã chọn trong kế hoạch tuần.`;
  }
}

export async function healthCheckAI(providerOverride?: AiProviderId, modelOverride?: string, baseUrlOverride?: string) {
  const settings = getAiSettings();
  const providerId = providerOverride || settings.provider;
  const model = modelOverride || settings.model;
  const apiKey = getApiKey(providerId) || "";
  const provider = getProvider(providerId);
  const started = Date.now();
  const result = await provider.checkHealth(apiKey, model, baseUrlOverride || settings.compatible_base_url || undefined);
  logAiCall({
    endpoint: "health",
    provider: providerId,
    model,
    status: result.ok ? "success" : "error",
    latencyMs: Date.now() - started,
    errorMessage: result.ok ? undefined : result.message,
  });
  return result;
}

export async function generateEducationPlan(args: GenerateArgs) {
  const { settings, apiKey } = await resolveCredentials();
  const provider = getProvider(settings.provider);
  if (!apiKey) {
    throw new AiError("missing_key", VIETNAMESE_ERROR_MESSAGES.missing_key);
  }

  const objectiveContext = objectiveBankPromptSection(args.ageGroup, args.domain);
  const procedureHint =
    args.planType === "lesson" && (args.inputData as any).activityType
      ? `Quy trình chuyên môn bắt buộc tham khảo cho loại hoạt động "${(args.inputData as any).activityType}": ${
          ACTIVITY_PROCEDURE_OUTLINE[(args.inputData as any).activityType as keyof typeof ACTIVITY_PROCEDURE_OUTLINE]?.join(" → ") || ""
        }`
      : "";

  const userPrompt = [
    `NHIỆM VỤ: Tạo nội dung cho loại kế hoạch "${args.planType}".`,
    schemaDescription(args.planType),
    procedureHint,
    `DỮ LIỆU ĐẦU VÀO GIÁO VIÊN CUNG CẤP:\n${JSON.stringify(args.inputData, null, 2)}`,
    args.parentContext ? `DỮ LIỆU KẾ THỪA TỪ CẤP TRÊN (bắt buộc tuân thủ, không được vượt ra ngoài):\n${JSON.stringify(args.parentContext, null, 2)}` : "",
    args.integrations && args.integrations.length ? `ĐỊNH HƯỚNG TÍCH HỢP CẦN THỂ HIỆN: ${args.integrations.join(", ")}` : "",
    objectiveContext,
    `Chỉ trả về một đối tượng JSON duy nhất, không giải thích thêm.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const started = Date.now();
  try {
    const raw = await callWithRetry(
      provider,
      { apiKey, model: settings.model, baseUrl: settings.compatible_base_url || undefined, systemPrompt: SYSTEM_PROMPT, userPrompt },
      args.signal
    );
    const json = extractJson(raw);
    const { cleaned, invalidCodes } = stripInvalidObjectiveIds(json, args.ageGroup);
    const schema = SCHEMA_BY_TYPE[args.planType];
    const parsed = schema.safeParse(cleaned);
    if (!parsed.success) {
      throw new AiError("invalid_response", `AI trả về dữ liệu thiếu hoặc sai định dạng: ${parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")).join(", ")}`);
    }
    logAiCall({ endpoint: "generate", provider: settings.provider, model: settings.model, status: "success", latencyMs: Date.now() - started, planType: args.planType });
    return { content: parsed.data, warnings: invalidCodes.length ? [`AI đã đề xuất mã mục tiêu không có trong ngân hàng chương trình và đã bị loại bỏ: ${invalidCodes.join(", ")}. Vui lòng chọn mục tiêu thủ công cho các mục này.`] : [] };
  } catch (err) {
    const aiErr = err instanceof AiError ? err : new AiError("unknown", String((err as Error)?.message || err));
    logAiCall({ endpoint: "generate", provider: settings.provider, model: settings.model, status: "error", latencyMs: Date.now() - started, errorMessage: aiErr.message, planType: args.planType });
    throw aiErr;
  }
}

export interface RecordSuggestionArgs {
  ageGroup: string;
  objective: string;
  content?: string;
  activity?: string;
  instruction?: string;
  signal?: AbortSignal;
}

// Dùng cho webapp/ctgdmn-web (màn hình "AI và nguồn trực tuyến"): gợi ý bổ
// sung hoạt động/nội dung cho một "bản ghi chuẩn hóa" (mục tiêu - nội dung -
// hoạt động), trả về văn bản thuần thay vì một kế hoạch đầy đủ. Không được
// tự bịa mã mục tiêu; chỉ được đề xuất diễn giải nội dung/hoạt động.
export async function suggestForRecord(args: RecordSuggestionArgs) {
  const { settings, apiKey } = await resolveCredentials();
  const provider = getProvider(settings.provider);
  if (!apiKey) throw new AiError("missing_key", VIETNAMESE_ERROR_MESSAGES.missing_key);

  const userPrompt = [
    `NHIỆM VỤ: Gợi ý bổ sung nội dung giáo dục và hoạt động phù hợp cho mục tiêu/yêu cầu cần đạt dưới đây, dành cho trẻ độ tuổi ${args.ageGroup}.`,
    `Mục tiêu/yêu cầu cần đạt: ${args.objective}`,
    args.content ? `Nội dung hiện có: ${args.content}` : "",
    args.activity ? `Hoạt động hiện có: ${args.activity}` : "",
    args.instruction ? `Yêu cầu thêm của giáo viên: ${args.instruction}` : "",
    `Không đưa họ tên, ngày sinh, hình ảnh hoặc thông tin nhận dạng của trẻ vào câu trả lời. Không tự đặt ra mã mục tiêu mới.`,
    `Chỉ trả về một đối tượng JSON duy nhất dạng {"suggestion": "..."} chứa đoạn gợi ý (định dạng văn bản thường, có thể xuống dòng bằng \\n), không thêm nội dung ngoài cấu trúc.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const started = Date.now();
  try {
    const raw = await callWithRetry(
      provider,
      { apiKey, model: settings.model, baseUrl: settings.compatible_base_url || undefined, systemPrompt: SYSTEM_PROMPT, userPrompt },
      args.signal
    );
    const json = extractJson(raw);
    if (typeof json?.suggestion !== "string" || !json.suggestion.trim()) {
      throw new AiError("invalid_response", "AI không trả về nội dung gợi ý hợp lệ.");
    }
    logAiCall({ endpoint: "ctgdmn-suggest", provider: settings.provider, model: settings.model, status: "success", latencyMs: Date.now() - started });
    return { suggestion: json.suggestion as string };
  } catch (err) {
    const aiErr = err instanceof AiError ? err : new AiError("unknown", String((err as Error)?.message || err));
    logAiCall({ endpoint: "ctgdmn-suggest", provider: settings.provider, model: settings.model, status: "error", latencyMs: Date.now() - started, errorMessage: aiErr.message });
    throw aiErr;
  }
}

interface SectionArgs {
  planType: PlanType;
  ageGroup: string;
  action: "regenerate" | "shorten" | "expand" | "age_adjust" | "steam" | "sel" | "differentiate";
  sectionPath: string;
  currentSectionValue: unknown;
  fullPlanContext: Record<string, unknown>;
  instruction?: string;
  signal?: AbortSignal;
}

const ACTION_INSTRUCTIONS: Record<SectionArgs["action"], string> = {
  regenerate: "Viết lại đúng phần dữ liệu được chỉ định cho hay hơn, chính xác hơn, KHÔNG thay đổi các phần khác.",
  shorten: "Rút gọn nội dung phần được chỉ định, giữ ý chính, ngắn gọn hơn khoảng 40%.",
  expand: "Mở rộng, bổ sung chi tiết cho phần được chỉ định, vẫn bám sát mục tiêu và dữ liệu chương trình.",
  age_adjust: "Điều chỉnh độ khó, từ ngữ và yêu cầu của phần được chỉ định cho phù hợp đúng độ tuổi đã cho.",
  steam: "Tích hợp yếu tố STEAM (Khoa học - Công nghệ - Kỹ thuật - Nghệ thuật - Toán) một cách thực chất vào phần được chỉ định, không tích hợp hình thức.",
  sel: "Tích hợp yếu tố giáo dục cảm xúc xã hội (SEL) một cách thực chất vào phần được chỉ định.",
  differentiate: "Bổ sung phương án phân hóa phù hợp với trẻ cần hỗ trợ hoặc có nhu cầu đặc biệt vào phần được chỉ định.",
};

export async function regenerateSection(args: SectionArgs) {
  const { settings, apiKey } = await resolveCredentials();
  const provider = getProvider(settings.provider);
  if (!apiKey) throw new AiError("missing_key", VIETNAMESE_ERROR_MESSAGES.missing_key);

  const objectiveContext = objectiveBankPromptSection(args.ageGroup);
  const userPrompt = [
    `NHIỆM VỤ: ${ACTION_INSTRUCTIONS[args.action]}`,
    `Loại kế hoạch: ${args.planType}. Đường dẫn phần cần chỉnh sửa: "${args.sectionPath}".`,
    `GIÁ TRỊ HIỆN TẠI CỦA PHẦN NÀY (JSON):\n${JSON.stringify(args.currentSectionValue, null, 2)}`,
    `BỐI CẢNH TOÀN BỘ KẾ HOẠCH (chỉ để tham khảo, KHÔNG chỉnh sửa các phần khác):\n${JSON.stringify(args.fullPlanContext, null, 2)}`,
    args.instruction ? `Ghi chú thêm của giáo viên: ${args.instruction}` : "",
    objectiveContext,
    `Chỉ trả về một đối tượng JSON có DUY NHẤT khoá "value" chứa giá trị mới của đúng phần "${args.sectionPath}" (cùng kiểu dữ liệu với giá trị hiện tại). Không trả về toàn bộ kế hoạch.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const started = Date.now();
  try {
    const raw = await callWithRetry(
      provider,
      { apiKey, model: settings.model, baseUrl: settings.compatible_base_url || undefined, systemPrompt: SYSTEM_PROMPT, userPrompt },
      args.signal
    );
    const json = extractJson(raw);
    if (!("value" in json)) {
      throw new AiError("invalid_response", "AI không trả về đúng khoá 'value' cho phần cần chỉnh sửa");
    }
    const { cleaned, invalidCodes } = stripInvalidObjectiveIds(json.value, args.ageGroup);
    logAiCall({ endpoint: "regenerate-section", provider: settings.provider, model: settings.model, status: "success", latencyMs: Date.now() - started, planType: args.planType });
    return {
      value: cleaned,
      warnings: invalidCodes.length ? [`AI đã đề xuất mã mục tiêu không có trong ngân hàng chương trình và đã bị loại bỏ: ${invalidCodes.join(", ")}.`] : [],
    };
  } catch (err) {
    const aiErr = err instanceof AiError ? err : new AiError("unknown", String((err as Error)?.message || err));
    logAiCall({ endpoint: "regenerate-section", provider: settings.provider, model: settings.model, status: "error", latencyMs: Date.now() - started, errorMessage: aiErr.message, planType: args.planType });
    throw aiErr;
  }
}

export function validatePlan(planType: PlanType, content: unknown) {
  const schema = SCHEMA_BY_TYPE[planType];
  const parsed = schema.safeParse(content);
  if (parsed.success) return { valid: true as const, issues: [] as string[] };
  return {
    valid: false as const,
    issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`),
  };
}

export function friendlyAiErrorMessage(err: unknown): { code: AiErrorCode; message: string } {
  if (err instanceof AiError) return { code: err.code, message: err.message || VIETNAMESE_ERROR_MESSAGES[err.code] };
  return { code: "unknown", message: VIETNAMESE_ERROR_MESSAGES.unknown };
}
