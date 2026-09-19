import { invoke } from "@tauri-apps/api/core";
import { dbExecute, dbSelect, nowIso } from "../db/client";
import { newId } from "../utils/id";

export type AiProvider = "openai" | "gemini" | "claude" | "off";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

const SETTINGS_KEY = "ai_gateway_config";

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  claude: "claude-3-5-haiku-latest",
  off: "",
};

const DEFAULT_CONFIG: AiConfig = { provider: "off", apiKey: "", model: "" };

export async function loadAiConfig(): Promise<AiConfig> {
  const rows = await dbSelect<{ value_json: string }>(
    "SELECT value_json FROM system_settings WHERE key = ?",
    [SETTINGS_KEY],
  );
  if (!rows[0]) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(rows[0].value_json) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveAiConfig(config: AiConfig, userId: string): Promise<void> {
  const valueJson = JSON.stringify(config);
  await dbExecute(
    `INSERT INTO system_settings (id, key, value_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    [newId(), SETTINGS_KEY, valueJson, userId, nowIso()],
  );
}

export function defaultModelFor(provider: AiProvider): string {
  return DEFAULT_MODEL[provider];
}

export interface AiGenerateResult {
  content: string;
  label: string;
}

/** Diễn giải lỗi kỹ thuật từ tầng gọi AI thành thông báo tiếng Việt dễ hiểu cho giáo viên. */
export function describeAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("chưa cấu hình") || raw.includes("đang tắt")) return raw;
  if (raw.startsWith("[mang]")) {
    return "Không kết nối được tới máy chủ AI. Kiểm tra Internet rồi thử lại.";
  }
  const statusMatch = raw.match(/^\[(\d{3})\]/);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  if (status === 401 || status === 403) return "Khóa API không hợp lệ hoặc đã bị thu hồi. Kiểm tra lại trong Cài đặt.";
  if (status === 429) return "Đã hết hạn mức sử dụng AI hoặc gửi yêu cầu quá nhanh. Vui lòng thử lại sau ít phút.";
  if (status && status >= 500) return "Máy chủ AI đang gặp sự cố. Vui lòng thử lại sau.";
  return raw || "Có lỗi không xác định khi gọi AI.";
}

const AI_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Yêu cầu AI quá thời gian chờ (30 giây). Vui lòng thử lại."));
    }, AI_TIMEOUT_MS);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error("Đã hủy yêu cầu tạo nội dung AI."));
        return;
      }
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Đã hủy yêu cầu tạo nội dung AI."));
      });
    }
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Gọi AI Gateway với nội dung ĐÃ ẨN DANH. Không tự động ban hành/phê duyệt/gửi ra ngoài —
 * kết quả luôn có nhãn "Nội dung do AI hỗ trợ" và phải được người dùng kiểm tra trước khi lưu.
 * `signal` cho phép hủy yêu cầu đang chờ (nút "Hủy"); có giới hạn thời gian chờ 30 giây.
 */
export async function generateWithAi(
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<AiGenerateResult> {
  const config = await loadAiConfig();
  if (config.provider === "off" || !config.apiKey) {
    throw new Error("AI đang tắt hoặc chưa cấu hình khóa API. Vào Cài đặt để bật.");
  }
  const result = await withTimeout(
    invoke<{ content: string }>("ai_generate", {
      req: {
        provider: config.provider,
        api_key: config.apiKey,
        model: config.model || defaultModelFor(config.provider),
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
      },
    }),
    signal,
  );
  return { content: result.content, label: "Nội dung do AI hỗ trợ — cần người kiểm tra trước khi lưu chính thức" };
}

export type AiHealthStatus = "connected" | "invalid_key" | "quota" | "network" | "not_configured" | "error";

export interface AiHealthResult {
  status: AiHealthStatus;
  message: string;
}

/**
 * Kiểm tra kết nối AI bằng một yêu cầu tối thiểu, dùng cho nút "Kiểm tra kết nối" ở Cài đặt.
 * Truyền `overrideConfig` để kiểm tra cấu hình đang nhập trên form (chưa lưu), thay vì cấu hình
 * đã lưu trong cơ sở dữ liệu.
 */
export async function healthCheckAI(overrideConfig?: AiConfig): Promise<AiHealthResult> {
  const config = overrideConfig ?? (await loadAiConfig());
  if (config.provider === "off" || !config.apiKey) {
    return { status: "not_configured", message: "Chưa cấu hình nhà cung cấp hoặc khóa API." };
  }
  try {
    const result = await withTimeout(
      invoke<{ content: string }>("ai_generate", {
        req: {
          provider: config.provider,
          api_key: config.apiKey,
          model: config.model || defaultModelFor(config.provider),
          system_prompt: "Bạn là hệ thống kiểm tra kết nối.",
          user_prompt: "Trả lời đúng một chữ: OK",
        },
      }),
    );
    void result;
    return { status: "connected", message: "Đã kết nối AI thành công." };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.startsWith("[mang]") || raw.includes("thời gian chờ")) {
      return { status: "network", message: describeAiError(err) };
    }
    const statusMatch = raw.match(/^\[(\d{3})\]/);
    const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
    if (httpStatus === 401 || httpStatus === 403) return { status: "invalid_key", message: describeAiError(err) };
    if (httpStatus === 429) return { status: "quota", message: describeAiError(err) };
    return { status: "error", message: describeAiError(err) };
  }
}
