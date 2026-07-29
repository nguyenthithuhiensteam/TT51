import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as svc from "../ctgdmn/service.js";
import { PermissionError } from "../ctgdmn/permissions.js";
import { friendlyAiErrorMessage, getAiSettings, healthCheckAI, setAiSettings, suggestForRecord } from "../services/aiService.js";
import { getApiKey, maskKey, setApiKey } from "../services/secretsStore.js";
import type { AiProviderId } from "../services/providers/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(__dirname, "..", "..", "data", "ctgdmn-videos");
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

export const ctgdmnRouter = Router();

function tokenFrom(req: any): string {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return "";
}

function handle(res: any, fn: () => unknown) {
  try {
    const result = fn();
    res.json(result ?? { ok: true });
  } catch (err) {
    if (err instanceof PermissionError) return res.status(403).json({ error: err.message });
    res.status(400).json({ error: err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định." });
  }
}

// ---- Xác thực / phiên ------------------------------------------------------
ctgdmnRouter.get("/auth/needs-setup", (_req, res) => {
  res.json({ needsSetup: !svc.hasAnyUser() });
});

ctgdmnRouter.post("/auth/first-admin", (req, res) => {
  handle(res, () => svc.createFirstAdmin(req.body.username, req.body.password, req.body.fullName));
});

ctgdmnRouter.post("/auth/login", (req, res) => {
  const result = svc.login(req.body.username, req.body.password);
  if (!result.ok) return res.json({ ok: false, message: "Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa." });
  res.json(result);
});

ctgdmnRouter.post("/auth/logout", (req, res) => {
  svc.logout(tokenFrom(req));
  res.json({ ok: true });
});

ctgdmnRouter.get("/auth/whoami", (req, res) => {
  res.json(svc.whoAmI(tokenFrom(req)));
});

ctgdmnRouter.post("/auth/change-password", (req, res) => {
  handle(res, () => {
    const user = svc.requireUser(tokenFrom(req));
    svc.changeOwnPassword(user, req.body.currentPassword, req.body.newPassword);
    return { ok: true };
  });
});

// ---- Tài khoản --------------------------------------------------------------
ctgdmnRouter.get("/accounts", (req, res) => {
  handle(res, () => svc.listUsers(svc.requireUser(tokenFrom(req))));
});
ctgdmnRouter.post("/accounts", (req, res) => {
  handle(res, () => svc.createUser(svc.requireUser(tokenFrom(req)), req.body));
});
ctgdmnRouter.post("/accounts/:id/lock", (req, res) => {
  handle(res, () => {
    svc.setAccountLocked(svc.requireUser(tokenFrom(req)), req.params.id, Boolean(req.body.locked));
    return { ok: true };
  });
});
ctgdmnRouter.post("/accounts/:id/reset-password", (req, res) => {
  handle(res, () => {
    svc.adminResetPassword(svc.requireUser(tokenFrom(req)), req.params.id, req.body.temporaryPassword);
    return { ok: true };
  });
});

// ---- Kế hoạch ----------------------------------------------------------------
ctgdmnRouter.get("/plans", (req, res) => {
  handle(res, () => svc.listPlansForUser(svc.requireUser(tokenFrom(req))));
});
ctgdmnRouter.get("/plans/:id", (req, res) => {
  handle(res, () => svc.getPlan(svc.requireUser(tokenFrom(req)), req.params.id));
});
ctgdmnRouter.post("/plans", (req, res) => {
  handle(res, () => svc.createPlan(svc.requireUser(tokenFrom(req)), req.body));
});
ctgdmnRouter.put("/plans/:id/content", (req, res) => {
  handle(res, () => svc.updatePlanContent(svc.requireUser(tokenFrom(req)), req.params.id, req.body.content));
});
ctgdmnRouter.post("/plans/:id/submit", (req, res) => {
  handle(res, () => svc.submitPlan(svc.requireUser(tokenFrom(req)), req.params.id));
});
ctgdmnRouter.post("/plans/:id/comment", (req, res) => {
  handle(res, () => svc.addComment(svc.requireUser(tokenFrom(req)), req.params.id, req.body.content));
});
ctgdmnRouter.get("/plans/:id/comments", (req, res) => {
  handle(res, () => svc.listComments(svc.requireUser(tokenFrom(req)), req.params.id));
});
ctgdmnRouter.post("/plans/:id/return", (req, res) => {
  handle(res, () => svc.returnPlanForRevision(svc.requireUser(tokenFrom(req)), req.params.id, req.body.note));
});
ctgdmnRouter.post("/plans/:id/propose", (req, res) => {
  handle(res, () => svc.proposeNextStage(svc.requireUser(tokenFrom(req)), req.params.id));
});
ctgdmnRouter.post("/plans/:id/approve", (req, res) => {
  handle(res, () => svc.approvePlan(svc.requireUser(tokenFrom(req)), req.params.id));
});
ctgdmnRouter.post("/plans/:id/revise", (req, res) => {
  handle(res, () => svc.reviseApprovedPlan(svc.requireUser(tokenFrom(req)), req.params.id));
});
ctgdmnRouter.get("/plans/:id/history", (req, res) => {
  handle(res, () => svc.getPlanHistory(svc.requireUser(tokenFrom(req)), req.params.id));
});
ctgdmnRouter.post("/plans/:id/mark-signed-export", (req, res) => {
  handle(res, () => {
    svc.markSignedExport(svc.requireUser(tokenFrom(req)), req.params.id, req.body.fileInfo);
    return { ok: true };
  });
});

// ---- Nhật ký hoạt động --------------------------------------------------------
ctgdmnRouter.get("/activity-log", (req, res) => {
  handle(res, () => svc.listActivityLog(svc.requireUser(tokenFrom(req)), Number(req.query.limit) || 200));
});

// ---- Sao lưu / khôi phục -------------------------------------------------------
ctgdmnRouter.get("/backup/export", (req, res) => {
  handle(res, () => svc.exportBackupData(svc.requireUser(tokenFrom(req))));
});
ctgdmnRouter.post("/backup/restore", (req, res) => {
  handle(res, () => {
    svc.restoreBackupData(svc.requireUser(tokenFrom(req)), req.body.backup);
    return { ok: true };
  });
});
ctgdmnRouter.post("/backup/migrate-legacy", (req, res) => {
  handle(res, () => svc.migrateLegacyLocalStorage(svc.requireUser(tokenFrom(req)), req.body.legacyExport));
});

// ---- Video hướng dẫn ------------------------------------------------------------
ctgdmnRouter.get("/videos/mine", (req, res) => {
  handle(res, () => svc.listVideosForUser(svc.requireUser(tokenFrom(req))));
});
ctgdmnRouter.get("/videos/all", (req, res) => {
  handle(res, () => svc.listAllVideos(svc.requireUser(tokenFrom(req))));
});
ctgdmnRouter.post("/videos", (req, res) => {
  handle(res, () => svc.addVideo(svc.requireUser(tokenFrom(req)), req.body));
});
ctgdmnRouter.patch("/videos/:id", (req, res) => {
  handle(res, () => svc.updateVideo(svc.requireUser(tokenFrom(req)), req.params.id, req.body));
});
ctgdmnRouter.delete("/videos/:id", (req, res) => {
  handle(res, () => {
    const video = svc.deleteVideo(svc.requireUser(tokenFrom(req)), req.params.id);
    if (video?.sourceType === "offline" && video.sourceValue) {
      const filePath = path.join(videoDir, video.sourceValue);
      fs.rm(filePath, { force: true }, () => {});
    }
    return { ok: true };
  });
});

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

ctgdmnRouter.post("/videos/upload", (req, res, next) => {
  try {
    const user = svc.requireUser(tokenFrom(req));
    if (user.role !== "admin") return res.status(403).json({ error: "Chỉ quản trị hệ thống được tải lên video." });
  } catch (err) {
    return res.status(401).json({ error: err instanceof Error ? err.message : "Chưa đăng nhập." });
  }
  next();
}, (req, res) => {
  const chunks: Buffer[] = [];
  let total = 0;
  let rejected = false;
  req.on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > MAX_VIDEO_BYTES) {
      if (!rejected) {
        rejected = true;
        res.status(413).json({ error: "Tệp video vượt quá giới hạn kích thước cho phép (500MB)." });
        req.destroy();
      }
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (rejected) return;
    const buffer = Buffer.concat(chunks);
    const header = buffer.subarray(0, 64).toString("latin1");
    if (!header.includes("ftyp")) {
      return res.status(400).json({ error: "Tệp không đúng định dạng MP4." });
    }
    const originalName = String(req.query.filename || "video.mp4");
    if (!originalName.toLowerCase().endsWith(".mp4")) {
      return res.status(400).json({ error: "Chỉ chấp nhận tệp .mp4." });
    }
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp4`;
    fs.writeFileSync(path.join(videoDir, storedName), buffer);
    res.json({ storedName, originalName, sizeBytes: buffer.length });
  });
});

ctgdmnRouter.delete("/videos/file/:storedName", (req, res) => {
  try {
    const user = svc.requireUser(tokenFrom(req));
    if (user.role !== "admin") return res.status(403).json({ error: "Chỉ quản trị hệ thống được xoá tệp video." });
  } catch (err) {
    return res.status(401).json({ error: err instanceof Error ? err.message : "Chưa đăng nhập." });
  }
  const filePath = path.join(videoDir, path.basename(req.params.storedName));
  fs.rm(filePath, { force: true }, () => res.json({ ok: true }));
});

// ---- AI (kết nối thật, dùng chung aiService với ứng dụng kế hoạch giáo dục) ----
const aiInFlight = new Set<string>();

ctgdmnRouter.get("/ai/settings", (req, res) => {
  handle(res, () => {
    const user = svc.requireUser(tokenFrom(req));
    if (user.role !== "admin") throw new PermissionError("Chỉ quản trị hệ thống được xem/sửa cấu hình AI.");
    const settings = getAiSettings();
    const geminiKey = getApiKey("gemini");
    const openaiKey = getApiKey("openai");
    return {
      provider: settings.provider,
      model: settings.model,
      compatibleBaseUrl: settings.compatible_base_url,
      keys: {
        gemini: { configured: Boolean(geminiKey), masked: maskKey(geminiKey) },
        openai: { configured: Boolean(openaiKey), masked: maskKey(openaiKey) },
      },
    };
  });
});

ctgdmnRouter.post("/ai/settings", (req, res) => {
  handle(res, () => {
    const user = svc.requireUser(tokenFrom(req));
    if (user.role !== "admin") throw new PermissionError("Chỉ quản trị hệ thống được xem/sửa cấu hình AI.");
    const { provider, model, compatibleBaseUrl, apiKey } = req.body as { provider: AiProviderId; model: string; compatibleBaseUrl?: string; apiKey?: string };
    if (!provider || !model) throw new Error("Thiếu nhà cung cấp hoặc mô hình AI.");
    if (apiKey && apiKey.trim()) setApiKey(provider === "openai_compatible" ? "openai" : (provider as "gemini" | "openai"), apiKey.trim());
    setAiSettings(provider, model, compatibleBaseUrl);
    return { ok: true };
  });
});

ctgdmnRouter.get("/ai/health", async (req, res) => {
  try {
    svc.requireUser(tokenFrom(req));
  } catch (err) {
    return res.status(401).json({ error: err instanceof Error ? err.message : "Chưa đăng nhập." });
  }
  const result = await healthCheckAI();
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

ctgdmnRouter.post("/ai/suggest", async (req, res) => {
  let user;
  try {
    user = svc.requireUser(tokenFrom(req));
  } catch (err) {
    return res.status(401).json({ error: err instanceof Error ? err.message : "Chưa đăng nhập." });
  }
  const lockKey = `${user.id}:${req.body.recordId || ""}`;
  if (aiInFlight.has(lockKey)) {
    return res.status(409).json({ error: "Yêu cầu tạo gợi ý trước đó vẫn đang xử lý. Vui lòng đợi." });
  }
  aiInFlight.add(lockKey);
  const controller = new AbortController();
  req.on("close", () => controller.abort());
  try {
    const { ageGroup, objective, content, activity, instruction } = req.body;
    if (!ageGroup || !objective) return res.status(400).json({ error: "Thiếu độ tuổi hoặc mục tiêu/yêu cầu cần đạt." });
    const result = await suggestForRecord({ ageGroup, objective, content, activity, instruction, signal: controller.signal });
    res.json(result);
  } catch (err) {
    const friendly = friendlyAiErrorMessage(err);
    res.status(friendly.code === "missing_key" || friendly.code === "invalid_key" ? 400 : 502).json({ error: friendly.message, code: friendly.code });
  } finally {
    aiInFlight.delete(lockKey);
  }
});

ctgdmnRouter.get("/videos/file/:storedName", (req, res) => {
  try {
    svc.requireUser(tokenFrom(req) || String(req.query.token || ""));
  } catch (err) {
    return res.status(401).json({ error: "Chưa đăng nhập." });
  }
  const filePath = path.join(videoDir, path.basename(req.params.storedName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Không tìm thấy video." });
  res.sendFile(filePath);
});
