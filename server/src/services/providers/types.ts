export type AiProviderId = "gemini" | "openai" | "openai_compatible";

export type AiErrorCode =
  | "missing_key"
  | "invalid_key"
  | "quota_exceeded"
  | "network_error"
  | "timeout"
  | "invalid_response"
  | "unknown";

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AiError";
  }
}

export interface AiCallOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
}

export interface AiProvider {
  generateJson(options: AiCallOptions): Promise<string>;
  checkHealth(apiKey: string, model: string, baseUrl?: string): Promise<{ ok: true } | { ok: false; code: AiErrorCode; message: string }>;
}

export const VIETNAMESE_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  missing_key: "Chưa cấu hình khoá API. Vui lòng nhập khoá API trong mục Cài đặt AI.",
  invalid_key: "Khoá API không hợp lệ. Vui lòng kiểm tra lại khoá API trong Cài đặt AI.",
  quota_exceeded: "Đã hết hạn mức sử dụng AI. Vui lòng kiểm tra lại gói dịch vụ hoặc thử lại sau.",
  network_error: "Không thể kết nối tới máy chủ AI. Vui lòng kiểm tra kết nối mạng và thử lại.",
  timeout: "Yêu cầu tới AI đã quá thời gian chờ. Vui lòng thử lại.",
  invalid_response: "AI trả về dữ liệu không đúng định dạng. Vui lòng thử lại hoặc điều chỉnh nội dung yêu cầu.",
  unknown: "Đã xảy ra lỗi không xác định khi kết nối AI. Vui lòng thử lại sau.",
};
