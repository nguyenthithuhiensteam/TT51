import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lưu khoá API phía server, KHÔNG bao giờ trả nguyên văn về trình duyệt và
// KHÔNG bao giờ commit vào git (xem .gitignore). Đây là nơi thay thế cho
// Secret Manager khi triển khai tự lưu trữ (self-hosted); khi triển khai lên
// nền tảng có Secret Manager thật, hãy trỏ các biến GEMINI_API_KEY /
// OPENAI_API_KEY tới dịch vụ đó và bỏ qua tệp này.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const secretsPath = path.resolve(__dirname, "..", "..", ".secrets.json");

type SecretsShape = {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
};

function readFile(): SecretsShape {
  if (!fs.existsSync(secretsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(secretsPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeFile(data: SecretsShape) {
  fs.writeFileSync(secretsPath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function getApiKey(provider: "gemini" | "openai" | "openai_compatible"): string | undefined {
  const envKey =
    provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
  if (envKey) return envKey;
  const stored = readFile();
  if (provider === "gemini") return stored.GEMINI_API_KEY;
  return stored.OPENAI_API_KEY;
}

export function setApiKey(provider: "gemini" | "openai" | "openai_compatible", key: string) {
  const stored = readFile();
  if (provider === "gemini") stored.GEMINI_API_KEY = key;
  else stored.OPENAI_API_KEY = key;
  writeFile(stored);
}

export function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 6) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export function hasApiKey(provider: "gemini" | "openai" | "openai_compatible"): boolean {
  return Boolean(getApiKey(provider));
}
