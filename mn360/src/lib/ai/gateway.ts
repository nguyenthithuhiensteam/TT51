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

/**
 * Gọi AI Gateway với nội dung ĐÃ ẨN DANH. Không tự động ban hành/phê duyệt/gửi ra ngoài —
 * kết quả luôn có nhãn "Nội dung do AI hỗ trợ" và phải được người dùng kiểm tra trước khi lưu.
 */
export async function generateWithAi(systemPrompt: string, userPrompt: string): Promise<AiGenerateResult> {
  const config = await loadAiConfig();
  if (config.provider === "off" || !config.apiKey) {
    throw new Error("AI đang tắt hoặc chưa cấu hình khóa API. Vào Cài đặt để bật.");
  }
  const result = await invoke<{ content: string }>("ai_generate", {
    req: {
      provider: config.provider,
      api_key: config.apiKey,
      model: config.model || defaultModelFor(config.provider),
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
    },
  });
  return { content: result.content, label: "Nội dung do AI hỗ trợ — cần người kiểm tra trước khi lưu chính thức" };
}
