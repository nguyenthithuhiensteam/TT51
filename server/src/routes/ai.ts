import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import {
  friendlyAiErrorMessage,
  generateEducationPlan,
  getAiSettings,
  healthCheckAI,
  regenerateSection,
  setAiSettings,
  validatePlan,
} from "../services/aiService.js";
import { setApiKey, getApiKey, maskKey } from "../services/secretsStore.js";
import type { AiProviderId } from "../services/providers/types.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const inFlight = new Map<string, boolean>();

function lockKey(req: AuthedRequest, action: string) {
  const bodyKey = JSON.stringify({ t: (req.body as any)?.planType, p: (req.body as any)?.targetPlanId, s: (req.body as any)?.sectionPath });
  return `${req.user?.id}:${action}:${bodyKey}`;
}

aiRouter.get("/settings", (_req, res) => {
  const settings = getAiSettings();
  const geminiKey = getApiKey("gemini");
  const openaiKey = getApiKey("openai");
  res.json({
    provider: settings.provider,
    model: settings.model,
    compatibleBaseUrl: settings.compatible_base_url,
    keys: {
      gemini: { configured: Boolean(geminiKey), masked: maskKey(geminiKey) },
      openai: { configured: Boolean(openaiKey), masked: maskKey(openaiKey) },
    },
  });
});

aiRouter.post("/settings", (req: AuthedRequest, res) => {
  const { provider, model, compatibleBaseUrl, apiKey } = req.body as {
    provider: AiProviderId;
    model: string;
    compatibleBaseUrl?: string;
    apiKey?: string;
  };
  if (!provider || !model) {
    return res.status(400).json({ error: "Thiếu nhà cung cấp hoặc mô hình AI." });
  }
  if (apiKey && apiKey.trim()) {
    setApiKey(provider === "openai_compatible" ? "openai" : (provider as "gemini" | "openai"), apiKey.trim());
  }
  setAiSettings(provider, model, compatibleBaseUrl);
  res.json({ ok: true });
});

aiRouter.get("/health", async (req: AuthedRequest, res) => {
  const providerQ = req.query.provider as AiProviderId | undefined;
  const modelQ = req.query.model as string | undefined;
  const baseUrlQ = req.query.baseUrl as string | undefined;
  const result = await healthCheckAI(providerQ, modelQ, baseUrlQ);
  if (result.ok) return res.json({ status: "connected", message: "Kết nối AI thành công." });
  const statusMap: Record<string, string> = {
    missing_key: "not_connected",
    invalid_key: "invalid_key",
    quota_exceeded: "quota_exceeded",
    network_error: "network_error",
    timeout: "network_error",
  };
  res.json({ status: statusMap[result.code] || "error", message: result.message });
});

aiRouter.post("/generate", async (req: AuthedRequest, res) => {
  const key = lockKey(req, "generate");
  if (inFlight.get(key)) {
    return res.status(409).json({ error: "Yêu cầu tạo nội dung trước đó vẫn đang xử lý. Vui lòng đợi." });
  }
  inFlight.set(key, true);
  const controller = new AbortController();
  req.on("close", () => controller.abort());
  try {
    const { planType, ageGroup, domain, inputData, parentContext, integrations } = req.body;
    if (!planType || !ageGroup || !inputData) {
      return res.status(400).json({ error: "Thiếu dữ liệu đầu vào để tạo kế hoạch." });
    }
    const result = await generateEducationPlan({
      planType,
      ageGroup,
      domain,
      inputData,
      parentContext,
      integrations,
      signal: controller.signal,
    });
    res.json(result);
  } catch (err) {
    const friendly = friendlyAiErrorMessage(err);
    res.status(friendly.code === "missing_key" || friendly.code === "invalid_key" ? 400 : 502).json({ error: friendly.message, code: friendly.code });
  } finally {
    inFlight.delete(key);
  }
});

aiRouter.post("/regenerate-section", async (req: AuthedRequest, res) => {
  const key = lockKey(req, "regenerate-section");
  if (inFlight.get(key)) {
    return res.status(409).json({ error: "Yêu cầu chỉnh sửa trước đó vẫn đang xử lý. Vui lòng đợi." });
  }
  inFlight.set(key, true);
  const controller = new AbortController();
  req.on("close", () => controller.abort());
  try {
    const { planType, ageGroup, action, sectionPath, currentSectionValue, fullPlanContext, instruction } = req.body;
    if (!planType || !ageGroup || !action || !sectionPath) {
      return res.status(400).json({ error: "Thiếu dữ liệu để chỉnh sửa phần nội dung." });
    }
    const result = await regenerateSection({
      planType,
      ageGroup,
      action,
      sectionPath,
      currentSectionValue,
      fullPlanContext: fullPlanContext || {},
      instruction,
      signal: controller.signal,
    });
    res.json(result);
  } catch (err) {
    const friendly = friendlyAiErrorMessage(err);
    res.status(friendly.code === "missing_key" || friendly.code === "invalid_key" ? 400 : 502).json({ error: friendly.message, code: friendly.code });
  } finally {
    inFlight.delete(key);
  }
});

aiRouter.post("/validate", (req, res) => {
  const { planType, content } = req.body;
  if (!planType) return res.status(400).json({ error: "Thiếu loại kế hoạch cần kiểm tra." });
  const result = validatePlan(planType, content);
  res.json(result);
});
