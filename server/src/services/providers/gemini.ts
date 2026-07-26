import { AiCallOptions, AiError, AiProvider } from "./types.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

async function isInvalidKeyBody(res: Response): Promise<{ invalid: boolean; text: string }> {
  const text = await res.text().catch(() => "");
  if (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(text)) {
    return { invalid: true, text };
  }
  return { invalid: false, text };
}

export const geminiProvider: AiProvider = {
  async generateJson(options: AiCallOptions): Promise<string> {
    const { apiKey, model, systemPrompt, userPrompt, signal } = options;
    if (!apiKey) throw new AiError("missing_key", "Thiếu khoá API Gemini");

    let res: Response;
    try {
      res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.6,
          },
        }),
      });
    } catch (err: any) {
      if (err?.name === "AbortError") throw new AiError("timeout", "Yêu cầu tới Gemini quá thời gian chờ");
      throw new AiError("network_error", "Không thể kết nối tới Gemini API");
    }

    if (res.status === 401 || res.status === 403) {
      throw new AiError("invalid_key", "Khoá API Gemini không hợp lệ");
    }
    if (res.status === 429) {
      throw new AiError("quota_exceeded", "Gemini API đã hết hạn mức");
    }
    if (res.status === 400) {
      const { invalid, text } = await isInvalidKeyBody(res);
      if (invalid) throw new AiError("invalid_key", "Khoá API Gemini không hợp lệ");
      throw new AiError("unknown", `Gemini API lỗi (400): ${text.slice(0, 300)}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AiError("unknown", `Gemini API lỗi (${res.status}): ${text.slice(0, 300)}`);
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    if (!text) throw new AiError("invalid_response", "Gemini không trả về nội dung");
    return text;
  },

  async checkHealth(apiKey: string, model: string) {
    if (!apiKey) return { ok: false, code: "missing_key" as const, message: "Thiếu khoá API Gemini" };
    try {
      const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, code: "invalid_key" as const, message: "Khoá API Gemini không hợp lệ" };
      }
      if (res.status === 429) {
        return { ok: false, code: "quota_exceeded" as const, message: "Gemini API đã hết hạn mức" };
      }
      if (res.status === 400) {
        const { invalid } = await isInvalidKeyBody(res);
        if (invalid) return { ok: false, code: "invalid_key" as const, message: "Khoá API Gemini không hợp lệ" };
        return { ok: false, code: "unknown" as const, message: "Gemini API lỗi (400)" };
      }
      if (res.status === 404) {
        return { ok: false, code: "invalid_response" as const, message: `Không tìm thấy mô hình "${model}"` };
      }
      if (!res.ok) {
        return { ok: false, code: "unknown" as const, message: `Gemini API lỗi (${res.status})` };
      }
      return { ok: true as const };
    } catch (err: any) {
      if (err?.name === "TimeoutError") return { ok: false, code: "timeout" as const, message: "Quá thời gian chờ khi kiểm tra kết nối" };
      return { ok: false, code: "network_error" as const, message: "Không thể kết nối tới Gemini API" };
    }
  },
};
