import { AiCallOptions, AiError, AiProvider } from "./types.js";

function buildOpenAiLike(defaultBase: string): AiProvider {
  return {
    async generateJson(options: AiCallOptions): Promise<string> {
      const { apiKey, model, systemPrompt, userPrompt, signal, baseUrl } = options;
      if (!apiKey) throw new AiError("missing_key", "Thiếu khoá API");
      const base = (baseUrl || defaultBase).replace(/\/$/, "");

      let res: Response;
      try {
        res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
          }),
        });
      } catch (err: any) {
        if (err?.name === "AbortError") throw new AiError("timeout", "Yêu cầu tới AI quá thời gian chờ");
        throw new AiError("network_error", "Không thể kết nối tới máy chủ AI");
      }

      if (res.status === 401 || res.status === 403) {
        throw new AiError("invalid_key", "Khoá API không hợp lệ");
      }
      if (res.status === 429) {
        throw new AiError("quota_exceeded", "Đã hết hạn mức sử dụng AI");
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AiError("unknown", `AI API lỗi (${res.status}): ${text.slice(0, 300)}`);
      }
      const data: any = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AiError("invalid_response", "AI không trả về nội dung");
      return text;
    },

    async checkHealth(apiKey: string, model: string, baseUrl?: string) {
      if (!apiKey) return { ok: false, code: "missing_key" as const, message: "Thiếu khoá API" };
      const base = (baseUrl || defaultBase).replace(/\/$/, "");
      try {
        const res = await fetch(`${base}/models/${encodeURIComponent(model)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 401 || res.status === 403) {
          return { ok: false, code: "invalid_key" as const, message: "Khoá API không hợp lệ" };
        }
        if (res.status === 429) {
          return { ok: false, code: "quota_exceeded" as const, message: "Đã hết hạn mức sử dụng AI" };
        }
        if (res.status === 404) {
          return { ok: false, code: "invalid_response" as const, message: `Không tìm thấy mô hình "${model}"` };
        }
        if (!res.ok) {
          return { ok: false, code: "unknown" as const, message: `AI API lỗi (${res.status})` };
        }
        return { ok: true as const };
      } catch (err: any) {
        if (err?.name === "TimeoutError") return { ok: false, code: "timeout" as const, message: "Quá thời gian chờ khi kiểm tra kết nối" };
        return { ok: false, code: "network_error" as const, message: "Không thể kết nối tới máy chủ AI" };
      }
    },
  };
}

export const openaiProvider = buildOpenAiLike("https://api.openai.com/v1");
export const openaiCompatibleProvider = buildOpenAiLike("https://api.openai.com/v1");
